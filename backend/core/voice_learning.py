"""Voice Learning Mode — Adapts Whisper transcription to user's accent and slang.

Architecture:
- Stores correction pairs: what Whisper heard → what the user actually said
- Each correction stores: misheard_text, correct_text, language, audio_file, timestamp
- Post-processes Whisper output through fuzzy correction map
- Persists to JSON for durability across restarts
- Audio samples stored as WAV files in data/voice_learning/ directory

Correction Matching:
1. Exact match (fastest)
2. Substring match
3. Levenshtein distance / fuzzy matching for close mis-transcriptions
"""

from __future__ import annotations

import asyncio
import base64
import json
import os
import re
import struct
import tempfile
import time
import uuid
import wave
from pathlib import Path

import structlog

from config import settings

logger = structlog.get_logger(__name__)

# ── Constants ──
LEARNING_DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "voice_learning"
CORRECTIONS_FILE = LEARNING_DATA_DIR / "corrections.json"
FUZZY_THRESHOLD = 0.6  # Minimum similarity ratio for fuzzy matching

# ── Fuzzy string matching (lightweight Levenshtein) ──


def _levenshtein_ratio(a: str, b: str) -> float:
    """Compute similarity ratio between two strings (0.0 = different, 1.0 = identical)."""
    if not a and not b:
        return 1.0
    if not a or not b:
        return 0.0

    a_lower = a.lower().strip()
    b_lower = b.lower().strip()

    # Short-circuit for exact matches
    if a_lower == b_lower:
        return 1.0

    # Compute Levenshtein distance
    m, n = len(a_lower), len(b_lower)
    if m > n:
        a_lower, b_lower = b_lower, a_lower
        m, n = n, m

    current = list(range(m + 1))
    for i in range(1, n + 1):
        previous = current
        current = [i] + [0] * m
        for j in range(1, m + 1):
            add = previous[j] + 1
            delete = current[j - 1] + 1
            change = previous[j - 1]
            if a_lower[j - 1] != b_lower[i - 1]:
                change += 1
            current[j] = min(add, delete, change)

    distance = current[m]
    max_len = max(len(a_lower), len(b_lower))
    if max_len == 0:
        return 1.0
    return 1.0 - (distance / max_len)


class CorrectionEntry:
    """A single correction mapping — what Whisper heard → what the user said."""

    __slots__ = ("id", "misheard", "correct", "language", "audio_file",
                 "created_at", "usage_count", "last_used")

    def __init__(
        self,
        misheard: str,
        correct: str,
        language: str = "ml",
        audio_file: str | None = None,
        entry_id: str | None = None,
        created_at: float | None = None,
        usage_count: int = 0,
        last_used: float | None = None,
    ):
        self.id = entry_id or str(uuid.uuid4())
        self.misheard = misheard.strip()
        self.correct = correct.strip()
        self.language = language
        self.audio_file = audio_file
        self.created_at = created_at or time.time()
        self.usage_count = usage_count
        self.last_used = last_used

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "misheard": self.misheard,
            "correct": self.correct,
            "language": self.language,
            "audio_file": self.audio_file,
            "created_at": self.created_at,
            "usage_count": self.usage_count,
            "last_used": self.last_used,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "CorrectionEntry":
        return cls(
            entry_id=data.get("id"),
            misheard=data.get("misheard", ""),
            correct=data.get("correct", ""),
            language=data.get("language", "ml"),
            audio_file=data.get("audio_file"),
            created_at=data.get("created_at"),
            usage_count=data.get("usage_count", 0),
            last_used=data.get("last_used"),
        )


class VoiceLearningManager:
    """Manages voice correction learning — Persianists corrections and post-processes Whisper output."""

    def __init__(self):
        self.corrections: list[CorrectionEntry] = []
        self._loaded = False
        self._learning_mode_active = False
        self._lock = asyncio.Lock()

        # Ensure data directory exists
        LEARNING_DATA_DIR.mkdir(parents=True, exist_ok=True)

    # ─── Persistence ──────────────────────────────────────────

    def _load_corrections(self) -> None:
        """Load corrections from disk."""
        if self._loaded:
            return
        try:
            if CORRECTIONS_FILE.exists():
                with open(CORRECTIONS_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                self.corrections = [CorrectionEntry.from_dict(e) for e in data]
                logger.info("voice_learning_loaded", count=len(self.corrections))
            self._loaded = True
        except Exception as e:
            logger.error("voice_learning_load_error", error=str(e))
            self._loaded = True

    def _save_corrections(self) -> None:
        """Save corrections to disk."""
        try:
            with open(CORRECTIONS_FILE, "w", encoding="utf-8") as f:
                json.dump(
                    [c.to_dict() for c in self.corrections],
                    f,
                    indent=2,
                    ensure_ascii=False,
                )
        except Exception as e:
            logger.error("voice_learning_save_error", error=str(e))

    # ─── Learning Mode Control ────────────────────────────────

    def is_learning_active(self) -> bool:
        """Check if learning mode is currently active."""
        return self._learning_mode_active

    def set_learning_active(self, active: bool) -> None:
        """Enable or disable learning mode."""
        self._learning_mode_active = active
        logger.info("voice_learning_mode", active=active)

    # ─── Adding Corrections ───────────────────────────────────

    def add_correction(
        self,
        misheard: str,
        correct: str,
        language: str = "ml",
        audio_b64: str | None = None,
    ) -> CorrectionEntry:
        """Add a new correction mapping. If audio is provided, saves it to disk."""
        self._load_corrections()

        # Check if we already have a correction for this misheard text
        existing = self._find_exact_match(misheard)
        if existing:
            # Update the existing correction
            existing.correct = correct
            existing.language = language
            existing.last_used = time.time()
            existing.usage_count += 1
            self._save_corrections()
            logger.info("voice_learning_updated", misheard=misheard, correct=correct)
            return existing

        # Save audio if provided
        audio_file = None
        if audio_b64:
            audio_file = self._save_audio_sample(audio_b64, correct)

        entry = CorrectionEntry(
            misheard=misheard,
            correct=correct,
            language=language,
            audio_file=audio_file,
        )
        self.corrections.append(entry)
        self._save_corrections()
        logger.info("voice_learning_added", misheard=misheard, correct=correct,
                     language=language)
        return entry

    def _save_audio_sample(self, audio_b64: str, label: str) -> str:
        """Save a base64 audio sample to disk and return the filename."""
        try:
            raw_audio = base64.b64decode(audio_b64)
            # Sanitize label for filename
            safe_label = re.sub(r'[^\w\s-]', '', label)[:30].strip().replace(' ', '_')
            filename = f"{int(time.time())}_{safe_label}.wav"
            filepath = LEARNING_DATA_DIR / filename

            # Save as WAV (assuming 16kHz, 16-bit, mono PCM as standard)
            with wave.open(str(filepath), 'wb') as wf:
                wf.setnchannels(1)
                wf.setsampwidth(2)
                wf.setframerate(16000)
                wf.writeframes(raw_audio)

            logger.info("voice_learning_audio_saved", filename=filename)
            return filename
        except Exception as e:
            logger.error("voice_learning_audio_save_error", error=str(e))
            return ""

    # ─── Batch Import ─────────────────────────────────────────

    def batch_import_corrections(self, csv_text: str, default_language: str = "ml") -> dict:
        """Import corrections from CSV text. Returns summary of imported/skipped/errors.
        
        CSV format: misheard,correct[,language]
        - First row is skipped if it starts with 'misheard' or 'mis' (header detection)
        - Language column is optional; defaults to default_language if missing
        - Empty rows are skipped
        - Already existing corrections (exact match on misheard) are updated
        """
        self._load_corrections()
        imported = 0
        updated = 0
        skipped = 0
        errors = 0
        error_details = []

        lines = csv_text.strip().split('\n')
        for i, line in enumerate(lines):
            line = line.strip()
            if not line:
                continue

            # Skip header row (starts with 'mis' or 'word')
            if i == 0:
                first_col = line.split(',')[0].strip().lower()
                if first_col in ('misheard', 'mis', 'word', 'phrase', 'original'):
                    continue

            try:
                # Parse CSV line (handle quoted fields)
                parts = self._parse_csv_line(line)
                if len(parts) < 2:
                    skipped += 1
                    continue

                misheard = parts[0].strip()
                correct = parts[1].strip()
                language = parts[2].strip() if len(parts) > 2 else default_language

                if not misheard or not correct:
                    skipped += 1
                    continue

                # Check if this misheard text already exists
                existing = self._find_exact_match(misheard)
                if existing:
                    existing.correct = correct
                    existing.language = language
                    existing.usage_count += 1
                    existing.last_used = time.time()
                    updated += 1
                else:
                    entry = CorrectionEntry(
                        misheard=misheard,
                        correct=correct,
                        language=language,
                    )
                    self.corrections.append(entry)
                    imported += 1

            except Exception as e:
                errors += 1
                error_details.append(f"Line {i + 1}: {str(e)}")

        self._save_corrections()
        logger.info("voice_learning_batch_import", imported=imported, updated=updated,
                     skipped=skipped, errors=errors)

        return {
            "imported": imported,
            "updated": updated,
            "skipped": skipped,
            "errors": errors,
            "error_details": error_details,
            "total": imported + updated,
        }

    def _parse_csv_line(self, line: str) -> list[str]:
        """Parse a single CSV line, handling quoted fields."""
        parts = []
        current = ''
        in_quotes = False
        for char in line:
            if char == '"':
                in_quotes = not in_quotes
            elif char == ',' and not in_quotes:
                parts.append(current)
                current = ''
            else:
                current += char
        parts.append(current)
        return parts

    def preview_csv(self, csv_text: str, default_language: str = "ml") -> dict:
        """Preview a CSV import without actually importing.
        
        Returns the parsed rows and analysis for frontend preview.
        """
        self._load_corrections()
        rows = []
        errors = []
        header_skipped = False

        lines = csv_text.strip().split('\n')
        for i, line in enumerate(lines):
            line = line.strip()
            if not line:
                continue

            if i == 0:
                first_col = line.split(',')[0].strip().lower()
                if first_col in ('misheard', 'mis', 'word', 'phrase', 'original'):
                    header_skipped = True
                    continue

            try:
                parts = self._parse_csv_line(line)
                if len(parts) < 2:
                    errors.append(f"Line {i + 1}: insufficient columns")
                    continue

                misheard = parts[0].strip()
                correct = parts[1].strip()
                language = parts[2].strip() if len(parts) > 2 else default_language

                if not misheard or not correct:
                    errors.append(f"Line {i + 1}: empty field")
                    continue

                existing = self._find_exact_match(misheard)
                rows.append({
                    "line": i + 1,
                    "misheard": misheard,
                    "correct": correct,
                    "language": language,
                    "will_update": existing is not None,
                })
            except Exception as e:
                errors.append(f"Line {i + 1}: {str(e)}")

        return {
            "total_rows": len(rows),
            "header_skipped": header_skipped,
            "rows": rows,
            "errors": errors,
        }

    # ─── Removing Corrections ─────────────────────────────────

    def delete_correction(self, entry_id: str) -> bool:
        """Delete a correction by ID. Returns True if deleted."""
        self._load_corrections()
        before = len(self.corrections)
        self.corrections = [c for c in self.corrections if c.id != entry_id]
        deleted = len(self.corrections) < before
        if deleted:
            self._save_corrections()
            logger.info("voice_learning_deleted", entry_id=entry_id)
        return deleted

    def clear_all(self) -> None:
        """Delete all corrections."""
        self._load_corrections()
        self.corrections.clear()
        self._save_corrections()
        logger.info("voice_learning_cleared")

    # ─── Querying ─────────────────────────────────────────────

    def get_all_corrections(self) -> list[dict]:
        """Get all corrections as dicts for the frontend."""
        self._load_corrections()
        return [c.to_dict() for c in self.corrections]

    def get_corrections_by_language(self, language: str) -> list[dict]:
        """Get corrections filtered by language."""
        self._load_corrections()
        return [
            c.to_dict()
            for c in self.corrections
            if c.language == language
        ]

    def get_stats(self) -> dict:
        """Get learning mode statistics."""
        self._load_corrections()
        ml_corrections = [c for c in self.corrections if c.language == "ml"]
        total_uses = sum(c.usage_count for c in self.corrections)
        return {
            "total_corrections": len(self.corrections),
            "malayalam_corrections": len(ml_corrections),
            "other_corrections": len(self.corrections) - len(ml_corrections),
            "total_uses": total_uses,
            "learning_active": self._learning_mode_active,
        }

    # ─── Post-Processing ──────────────────────────────────────

    def _find_exact_match(self, text: str) -> CorrectionEntry | None:
        """Find an exact match for the given text in corrections."""
        cleaned = text.strip().lower()
        for c in self.corrections:
            if c.misheard.lower().strip() == cleaned:
                return c
        return None

    def _find_fuzzy_match(self, text: str) -> CorrectionEntry | None:
        """Find a fuzzy match for the given text in corrections."""
        cleaned = text.strip().lower()
        best_ratio = 0.0
        best_match = None

        for c in self.corrections:
            misheard_clean = c.misheard.lower().strip()

            # Check if misheard text is a substring of transcription
            if misheard_clean in cleaned:
                ratio = len(misheard_clean) / max(len(cleaned), 1)
                if ratio > best_ratio:
                    best_ratio = ratio
                    best_match = c

            # Check if transcription is a substring of misheard text
            if cleaned in misheard_clean:
                ratio = len(cleaned) / max(len(misheard_clean), 1)
                if ratio > best_ratio:
                    best_ratio = ratio
                    best_match = c

            # Levenshtein distance
            ratio = _levenshtein_ratio(cleaned, misheard_clean)
            if ratio > best_ratio:
                best_ratio = ratio
                best_match = c

        # Only return if similarity exceeds threshold
        if best_ratio >= FUZZY_THRESHOLD:
            return best_match
        return None

    def post_process_transcription(self, text: str) -> str:
        """Apply learned corrections to a Whisper transcription.
        
        This is the core adaptation method. It checks the raw Whisper output
        against all stored corrections and applies the best match.
        
        Returns the corrected text (or original text if no match found).
        """
        if not text or not self.corrections:
            return text

        self._load_corrections()

        # 1. Try exact match first (fast path)
        exact = self._find_exact_match(text)
        if exact:
            exact.usage_count += 1
            exact.last_used = time.time()
            self._save_corrections()
            logger.debug("voice_learning_corrected_exact",
                         original=text, corrected=exact.correct)
            return exact.correct

        # 2. Try fuzzy match for the full text
        fuzzy = self._find_fuzzy_match(text)
        if fuzzy:
            fuzzy.usage_count += 1
            fuzzy.last_used = time.time()
            self._save_corrections()
            logger.debug("voice_learning_corrected_fuzzy",
                         original=text, corrected=fuzzy.correct,
                         similarity=_levenshtein_ratio(
                             text.lower().strip(),
                             fuzzy.misheard.lower().strip()))
            return fuzzy.correct

        # 3. Try word-by-word replacement for partial corrections
        words = text.split()
        corrected_words = []
        any_correction = False

        for word in words:
            word_exact = self._find_exact_match(word)
            if word_exact:
                word_exact.usage_count += 1
                word_exact.last_used = time.time()
                corrected_words.append(word_exact.correct)
                any_correction = True
            else:
                word_fuzzy = self._find_fuzzy_match(word)
                if word_fuzzy:
                    word_fuzzy.usage_count += 1
                    word_fuzzy.last_used = time.time()
                    corrected_words.append(word_fuzzy.correct)
                    any_correction = True
                else:
                    corrected_words.append(word)

        if any_correction:
            self._save_corrections()
            result = " ".join(corrected_words)
            logger.debug("voice_learning_corrected_words",
                         original=text, corrected=result)
            return result

        return text

    # ─── Test Phrase ──────────────────────────────────────────

    async def test_transcribe(
        self, audio_b64: str, sample_rate: int = 16000
    ) -> dict:
        """Transcribe audio, show both raw and corrected versions.
        
        This is used in the learning mode UI to let users test phrases.
        Returns both the raw Whisper output and the post-processed corrected version.
        """
        raw_audio = base64.b64decode(audio_b64)

        # Save to temp WAV
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
        tmp.close()
        try:
            with wave.open(tmp.name, 'wb') as wf:
                wf.setnchannels(1)
                wf.setsampwidth(2)
                wf.setframerate(sample_rate)
                wf.writeframes(raw_audio)

            # Transcribe with Whisper
            from core.voice_engine import voice_engine
            raw_text = await voice_engine._transcribe_file(tmp.name)
        finally:
            try:
                os.remove(tmp.name)
            except Exception:
                pass

        if not raw_text:
            return {
                "raw": "",
                "corrected": "",
                "match_found": False,
                "match_details": None,
            }

        # Apply post-processing
        corrected = self.post_process_transcription(raw_text)
        match_found = raw_text.lower().strip() != corrected.lower().strip()

        # Find match details
        match_details = None
        if match_found:
            match = self._find_exact_match(raw_text) or self._find_fuzzy_match(raw_text)
            if match:
                match_details = {
                    "misheard": match.misheard,
                    "correct": match.correct,
                    "method": "exact" if self._find_exact_match(raw_text) else "fuzzy",
                }

        return {
            "raw": raw_text,
            "corrected": corrected,
            "match_found": match_found,
            "match_details": match_details,
        }


# Singleton
voice_learning = VoiceLearningManager()

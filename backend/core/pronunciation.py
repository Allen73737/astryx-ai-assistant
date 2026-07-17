"""Pronunciation Editor — Custom word pronunciation for edge-tts TTS.

Allows users to define how specific words should be pronounced by the TTS engine.
Supports two modes:
1. ALIAS (substitution): Replace a word with an alternate spelling. e.g., "ASTRYX" → "As-trix"
2. PHONEME (IPA): Specify exact IPA pronunciation. e.g., "Jarvis" → "/ˈdʒɑːrvɪs/"

The system generates SSML that edge-tts natively supports, wrapping words in
<phoneme alphabet="ipa" ph="..."> or <sub alias="..."> tags.

Architecture:
- Pronunciation map stored in memory and persisted to JSON
- Each entry: { word, pronunciation, type, language, created_at }
- When generating TTS, text is scanned for matching words and SSML is inserted
- If any SSML is generated, the full text is wrapped in <speak> tags
"""

from __future__ import annotations

import json
import re
import time
import uuid
from pathlib import Path

import structlog

logger = structlog.get_logger(__name__)

# ── Constants ──
PRONUNCIATION_FILE = Path(__file__).resolve().parent.parent / "data" / "pronunciation.json"


class PronunciationEntry:
    """A single pronunciation override for a specific word/phrase."""

    __slots__ = ("id", "word", "pronunciation", "type", "language",
                 "created_at", "usage_count")

    def __init__(
        self,
        word: str,
        pronunciation: str,
        ptype: str = "alias",  # "alias" or "phoneme"
        language: str = "en",
        entry_id: str | None = None,
        created_at: float | None = None,
        usage_count: int = 0,
    ):
        self.id = entry_id or str(uuid.uuid4())
        self.word = word.strip()
        self.pronunciation = pronunciation.strip()
        self.type = ptype  # "alias" | "phoneme"
        self.language = language
        self.created_at = created_at or time.time()
        self.usage_count = usage_count

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "word": self.word,
            "pronunciation": self.pronunciation,
            "type": self.type,
            "language": self.language,
            "created_at": self.created_at,
            "usage_count": self.usage_count,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "PronunciationEntry":
        return cls(
            entry_id=data.get("id"),
            word=data.get("word", ""),
            pronunciation=data.get("pronunciation", ""),
            ptype=data.get("type", "alias"),
            language=data.get("language", "en"),
            created_at=data.get("created_at"),
            usage_count=data.get("usage_count", 0),
        )


class PronunciationManager:
    """Manages custom word pronunciations and generates SSML for edge-tts."""

    def __init__(self):
        self.entries: list[PronunciationEntry] = []
        self._loaded = False
        self._ensure_data_dir()

    def _ensure_data_dir(self) -> None:
        PRONUNCIATION_FILE.parent.mkdir(parents=True, exist_ok=True)

    # ─── Persistence ──────────────────────────────────────────

    def _load(self) -> None:
        if self._loaded:
            return
        try:
            if PRONUNCIATION_FILE.exists():
                with open(PRONUNCIATION_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                self.entries = [PronunciationEntry.from_dict(e) for e in data]
                logger.info("pronunciation_loaded", count=len(self.entries))
            self._loaded = True
        except Exception as e:
            logger.error("pronunciation_load_error", error=str(e))
            self._loaded = True

    def _save(self) -> None:
        try:
            with open(PRONUNCIATION_FILE, "w", encoding="utf-8") as f:
                json.dump(
                    [e.to_dict() for e in self.entries],
                    f,
                    indent=2,
                    ensure_ascii=False,
                )
        except Exception as e:
            logger.error("pronunciation_save_error", error=str(e))

    # ─── CRUD ─────────────────────────────────────────────────

    def add(self, word: str, pronunciation: str, ptype: str = "alias",
            language: str = "en") -> PronunciationEntry:
        """Add a new pronunciation entry. Returns the entry."""
        self._load()

        # Check if we already have an entry for this exact word+type
        existing = next(
            (e for e in self.entries if e.word.lower() == word.lower()
             and e.type == ptype),
            None
        )
        if existing:
            existing.pronunciation = pronunciation
            existing.language = language
            existing.usage_count += 1
            self._save()
            logger.info("pronunciation_updated", word=word, pronunciation=pronunciation)
            return existing

        entry = PronunciationEntry(
            word=word,
            pronunciation=pronunciation,
            ptype=ptype,
            language=language,
        )
        self.entries.append(entry)
        self._save()
        logger.info("pronunciation_added", word=word, pronunciation=pronunciation,
                     type=ptype, language=language)
        return entry

    def delete(self, entry_id: str) -> bool:
        """Delete a pronunciation entry by ID."""
        self._load()
        before = len(self.entries)
        self.entries = [e for e in self.entries if e.id != entry_id]
        deleted = len(self.entries) < before
        if deleted:
            self._save()
            logger.info("pronunciation_deleted", entry_id=entry_id)
        return deleted

    def clear_all(self) -> None:
        """Delete all pronunciation entries."""
        self._load()
        self.entries.clear()
        self._save()
        logger.info("pronunciation_cleared")

    def get_all(self) -> list[dict]:
        """Get all entries as dicts for the frontend."""
        self._load()
        return [e.to_dict() for e in self.entries]

    def get_stats(self) -> dict:
        """Get pronunciation statistics."""
        self._load()
        return {
            "total": len(self.entries),
            "aliases": sum(1 for e in self.entries if e.type == "alias"),
            "phonemes": sum(1 for e in self.entries if e.type == "phoneme"),
        }

    # ─── SSML Generation ──────────────────────────────────────

    def apply_to_text(self, text: str) -> str:
        """Apply all pronunciation overrides to text, generating SSML.
        
        Scans the text for words matching any pronunciation entries and wraps
        them in the appropriate SSML tags. If no matches are found, returns
        the original text unchanged.
        
        Returns:
            Original text if no matches, or full SSML document with <speak> tags.
        """
        if not text or not self.entries:
            return text

        self._load()
        has_ssml = False

        # Sort entries by word length (longest first) to handle multi-word phrases
        sorted_entries = sorted(self.entries,
                                key=lambda e: len(e.word.split()), reverse=True)

        # Process multi-word phrases first, then single words
        for entry in sorted_entries:
            word_lower = entry.word.lower()
            words_in_phrase = len(entry.word.split())

            if words_in_phrase > 1:
                # Multi-word phrase — use regex replacement
                pattern = re.compile(re.escape(entry.word), re.IGNORECASE)
                replacement = self._make_ssml_tag(entry)
                if pattern.search(text):
                    text = pattern.sub(replacement, text)
                    entry.usage_count += 1
                    has_ssml = True
            else:
                # Single word — match whole words only
                pattern = re.compile(
                    r'\b' + re.escape(entry.word) + r'\b',
                    re.IGNORECASE,
                )
                replacement = self._make_ssml_tag(entry)
                if pattern.search(text):
                    text = pattern.sub(replacement, text)
                    entry.usage_count += 1
                    has_ssml = True

        if has_ssml:
            self._save()

            # Wrap in <speak> tags if not already wrapped
            if not text.strip().startswith('<speak'):
                text = f'<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis">{text}</speak>'

            return text

        return text

    def _make_ssml_tag(self, entry: PronunciationEntry) -> str:
        """Generate the appropriate SSML tag for a pronunciation entry."""
        if entry.type == "phoneme":
            # IPA phoneme tag
            escaped_pr = entry.pronunciation.replace('"', '&quot;')
            return f'<phoneme alphabet="ipa" ph="{escaped_pr}">{entry.word}</phoneme>'
        elif entry.type == "alias":
            # Substitution alias tag
            escaped_alias = entry.pronunciation.replace('"', '&quot;')
            return f'<sub alias="{escaped_alias}">{entry.word}</sub>'
        return entry.word

    def test_pronunciation(self, sentence: str) -> dict:
        """Test how pronunciations would be applied to a sentence.
        
        Returns the original, the SSML result, and a list of which entries matched.
        """
        self._load()
        original = sentence

        # Track which entries would match
        matched = []
        for entry in self.entries:
            word_lower = entry.word.lower()
            if word_lower in sentence.lower():
                matched.append({
                    "word": entry.word,
                    "pronunciation": entry.pronunciation,
                    "type": entry.type,
                })

        ssml = self.apply_to_text(sentence)

        return {
            "original": original,
            "ssml": ssml if ssml != original else "",
            "has_ssml": ssml != original,
            "matched_entries": matched,
        }


# Singleton
pronunciation_manager = PronunciationManager()

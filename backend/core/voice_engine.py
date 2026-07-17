"""Voice Engine — Ultra-Premium ASTRYX Voice System.

Features:
- Wake word detection ("Astryx") via browser audio capture
- Clap detection (sudden loud sound) in browser
- Premium British TTS via edge-tts (en-GB-RyanNeural)
- Pre-loaded whisper model for fallback STT

Architecture:
- Audio capture happens in Electron renderer (Web Audio API / getUserMedia)
  because the Intel SST microphone driver is incompatible with PortAudio.
- Renderer sends audio chunks + clap events via WebSocket to backend.
- Backend handles STT, orchestration, and TTS.

State Machine:
- IDLE:         Not listening, mic should be fully muted
- LISTENING:    Wake word detection mode (audio_chunk processing)
- CONVERSATION: Active conversation mode (voice_command processing)
- SPEAKING:     TTS is generating/playing (ALL audio input rejected)
- COOLDOWN:     Post-speech buffer drain period (ALL audio input rejected)
"""

from __future__ import annotations

import asyncio
import base64
import os
import struct
import tempfile
import time
import wave

import structlog

from api.websockets import ws_manager
from config import settings

logger = structlog.get_logger(__name__)

# ── Constants ──
COOLDOWN_SECONDS = 1.5          # Seconds after TTS ends before accepting audio
ACTIVATION_COOLDOWN = 3.0       # Min seconds between activations to prevent loops
VAD_SENSITIVITY_DEFAULT = 7     # Default VAD threshold (1=most sensitive, 10=most strict)

# Known Whisper hallucination phrases (it generates these on silence/noise)
WHISPER_HALLUCINATIONS = frozenset([
    "thank you", "thanks", "you", "bye", "the end", "thanks for watching",
    "thank you for watching", "i'll see you next time", "goodbye",
    "subscribe", "like and subscribe", ".", "", "so", "okay",
    "yes", "yes sir", "sir", "hmm", "uh", "um", "ah",
    "thanks for listening", "see you next time", "take care",
    "you're welcome", "thank you so much", "please subscribe",
])


class VoiceEngine:
    def __init__(self):
        self.is_listening = False
        self.main_loop = None
        self.whisper_model = None
        self.selected_voice: str = "en-GB-RyanNeural"  # Configurable TTS voice
        self.selected_rate: str = "+5%"                   # TTS rate adjustment
        self.selected_pitch: str = "-2Hz"                 # TTS pitch adjustment
        self._available_voices: list[dict] | None = None  # Cached voice list

        # ── State machine ──
        self._is_speaking = False        # True during entire TTS pipeline
        self._in_conversation = False    # True during conversation mode
        self._is_transcribing = False    # Mutex for Whisper calls
        self._speak_lock = asyncio.Lock() # Lock to prevent concurrent voice overlap

        # ── VAD (Voice Activity Detection) ──
        self.vad_sensitivity: int = VAD_SENSITIVITY_DEFAULT  # 1-10, default 7
        self._update_vad_threshold()

        # ── Cooldown timestamps ──
        self._speech_ended_at = 0.0      # time.monotonic() when last TTS finished
        self._last_activation_at = 0.0   # time.monotonic() when last activated

        # Load persisted voice from settings
        if settings.TTS_VOICE and settings.TTS_VOICE != "af_heart":
            self.selected_voice = settings.TTS_VOICE

    # ─── Guard: should we process ANY audio right now? ────────────
    def _audio_blocked(self) -> bool:
        """Return True if we should reject all incoming audio."""
        if self._is_speaking:
            return True
        if self._is_transcribing:
            return True
        # Post-speech cooldown
        elapsed = time.monotonic() - self._speech_ended_at
        if elapsed < COOLDOWN_SECONDS:
            return True
        return False

    # ─── Guard: can we activate right now? ────────────────────────
    def _can_activate(self) -> bool:
        """Prevent rapid re-activation loops."""
        elapsed = time.monotonic() - self._last_activation_at
        return elapsed > ACTIVATION_COOLDOWN

    # ─── Pre-load heavy models on startup ───────────────────────
    async def preload(self):
        """Pre-load dependencies in background to prevent hanging."""
        if not self.whisper_model:
            logger.info("preloading_whisper_model")
            def _load():
                from faster_whisper import WhisperModel
                self.whisper_model = WhisperModel(settings.STT_MODEL, device="auto", compute_type="int8")

            await asyncio.to_thread(_load)
            logger.info("whisper_model_ready")

    # ─── Wake trigger ───────────────────────────────────────────
    async def trigger_wake(self):
        """Trigger the Electron window to open/focus."""
        logger.info("wake_word_detected", word="ASTRYX")
        await ws_manager.broadcast_typed("wake_up", {})

    # ─── Handle clap event from browser ─────────────────────────
    async def handle_clap(self):
        """Called when the browser detects a clap. Activate JARVIS."""
        if self._audio_blocked() or not self._can_activate():
            logger.debug("clap_rejected_blocked")
            return
        logger.info("clap_detected_from_browser")
        await self._activate()

    def _save_to_wav(self, raw_pcm: bytes, sample_rate: int) -> str:
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
        tmp.close()
        with wave.open(tmp.name, 'wb') as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(sample_rate)
            wf.writeframes(raw_pcm)
        return tmp.name

    def _compute_audio_energy(self, raw_pcm: bytes) -> float:
        """Compute RMS energy of int16 PCM audio."""
        if len(raw_pcm) < 4:
            return 0.0
        n_samples = len(raw_pcm) // 2
        try:
            samples = struct.unpack(f'<{n_samples}h', raw_pcm[:n_samples * 2])
        except struct.error:
            return 0.0
        if not samples:
            return 0.0
        sum_sq = sum(s * s for s in samples)
        return (sum_sq / n_samples) ** 0.5

    def _is_hallucination(self, text: str) -> bool:
        """Check if Whisper output is a known hallucination."""
        cleaned = text.strip().lower().rstrip('.!?,')
        if not cleaned or len(cleaned) < 3:
            return True
        if cleaned in WHISPER_HALLUCINATIONS:
            return True
        return False

    # ─── Handle audio chunk from browser ────────────────────────
    async def handle_audio_chunk(self, audio_b64: str, sample_rate: int = 16000):
        """Called when browser sends an audio chunk for wake word detection."""
        # HARD BLOCK: reject all audio when speaking, cooling down, or already transcribing
        if self._audio_blocked():
            return

        self._is_transcribing = True
        try:
            raw_audio = base64.b64decode(audio_b64)

            # Energy gate: don't waste CPU on silence (uses configurable VAD threshold)
            energy = self._compute_audio_energy(raw_audio)
            if energy < self.vad_threshold:
                logger.debug("audio_chunk_too_quiet", energy=f"{energy:.1f}", threshold=self.vad_threshold)
                return

            wav_path = self._save_to_wav(raw_audio, sample_rate)

            try:
                text = await self._transcribe_file(wav_path)
            finally:
                try:
                    os.remove(wav_path)
                except Exception:
                    pass

            if not text:
                return

            # Reject Whisper hallucinations
            if self._is_hallucination(text):
                logger.debug("whisper_hallucination_rejected", text=text)
                return

            text_lower = text.lower()
            logger.info("browser_audio_heard", text=text_lower, energy=f"{energy:.1f}")

            # Presentation slide commands (work during slideshow without full wake word)
            from core.presentation_controller import presentation_controller
            if presentation_controller.voice_control_enabled or presentation_controller.is_slideshow_active():
                handled, slide_msg = presentation_controller.try_handle_command(text)
                if handled:
                    logger.info("presentation_voice_command", text=text_lower, result=slide_msg)
                    await ws_manager.broadcast_typed("voice_transcription", {"text": text})
                    if not self._in_conversation:
                        self._in_conversation = True
                        await ws_manager.broadcast_typed("conversation_started", {})
                    await self.speak(slide_msg)
                    return

            wake_words = ["astryx", "asterix", "astrix", "a strix",
                          "astrex", "astericks", "astricks", "jarvis",
                          "hey jarvis"]
            if any(w in text_lower for w in wake_words):
                if self._can_activate():
                    await self._activate()
                else:
                    logger.debug("activation_cooldown_active")

        except Exception as e:
            logger.error("handle_audio_chunk_error", error=str(e))
        finally:
            self._is_transcribing = False

    # ─── Handle voice command from browser ──────────────────────
    async def handle_voice_command(self, audio_b64: str, sample_rate: int = 16000):
        """Called when browser sends a voice command during conversation mode."""
        if not self._in_conversation:
            return

        # HARD BLOCK during speech/cooldown
        if self._audio_blocked():
            return

        self._is_transcribing = True
        try:
            raw_audio = base64.b64decode(audio_b64)

            # Energy gate (uses configurable VAD threshold)
            energy = self._compute_audio_energy(raw_audio)
            if energy < self.vad_threshold:
                logger.debug("voice_command_too_quiet", energy=f"{energy:.1f}", threshold=self.vad_threshold)
                return

            wav_path = self._save_to_wav(raw_audio, sample_rate)

            try:
                command_text = await self._transcribe_file(wav_path)
            finally:
                try:
                    os.remove(wav_path)
                except Exception:
                    pass

            if not command_text or len(command_text.strip()) < 2:
                return

            # Reject hallucinations
            if self._is_hallucination(command_text):
                logger.debug("command_hallucination_rejected", text=command_text)
                return

            logger.info("command_recognized", text=command_text)

            # Presentation slide navigation (next / previous / end)
            from core.presentation_controller import presentation_controller
            handled, slide_msg = presentation_controller.try_handle_command(command_text)
            if handled:
                await ws_manager.broadcast_typed("voice_transcription", {"text": command_text})
                await self.speak(slide_msg)
                return

            # Check if user said goodbye/dismiss
            dismissals = ["goodbye", "thank you", "thanks", "that's all",
                          "nevermind", "never mind", "go to sleep", "dismiss"]
            if any(d in command_text.lower() for d in dismissals):
                await self.speak("Of course, sir. I'll be here if you need me.")
                self._in_conversation = False
                await ws_manager.broadcast_typed("conversation_ended", {})
                await ws_manager.broadcast_typed("status", {"orb_state": "standby"})
                logger.info("conversation_dismissed")
                return

            # Show in UI
            await ws_manager.broadcast_typed("voice_transcription",
                                              {"text": command_text})

            # Send to the AI brain
            from core.orchestrator import orchestrator
            await orchestrator.handle_message(command_text)

        except Exception as e:
            logger.error("handle_voice_command_error", error=str(e))
        finally:
            self._is_transcribing = False

    # ─── Handle conversation silence from browser ───────────────
    async def handle_silence_timeout(self):
        """Called when browser reports sustained silence during conversation."""
        if self._in_conversation:
            await self.speak("Standing by, sir.")
            self._in_conversation = False
            await ws_manager.broadcast_typed("conversation_ended", {})
            await ws_manager.broadcast_typed("status", {"orb_state": "standby"})
            logger.info("conversation_mode_ended")

    # ─── Activate JARVIS ────────────────────────────────────────
    async def _activate(self, silent: bool = False):
        """Activate JARVIS — open UI, greet, enter conversation mode."""
        if self._is_speaking:
            return

        self._last_activation_at = time.monotonic()
        logger.info("jarvis_activating")

        # Set conversation mode BEFORE speaking so post-speech state is correct
        self._in_conversation = True

        # Open the interface
        await self.trigger_wake()

        # Tell browser to enter conversation mode immediately
        # (but the mic is muted because we're about to speak)
        await ws_manager.broadcast_typed("conversation_started", {})

        # Greet the user if not silent
        if not silent:
            await self.speak("Yes, sir?")

        logger.info("conversation_mode_started")

    async def toggle_manual_voice(self):
        """Manually toggle voice listening mode from the UI button."""
        if self._in_conversation:
            # Stop listening
            self._in_conversation = False
            await ws_manager.broadcast_typed("conversation_ended", {})
            await ws_manager.broadcast_typed("status", {"orb_state": "standby"})
            logger.info("manual_voice_stopped")
        else:
            # Start listening silently
            await self._activate(silent=True)
            logger.info("manual_voice_started")

    # ─── Transcribe audio file ──────────────────────────────────
    async def _transcribe_file(self, filepath: str, apply_learning: bool = True) -> str:
        """Transcribe a WAV file using faster-whisper.
        
        If apply_learning is True (default), the transcription is post-processed
        through the voice learning correction map to adapt to the user's accent/slang.
        """
        if not self.whisper_model:
            logger.warning("whisper_model_not_ready")
            return ""

        def _run():
            segments, _ = self.whisper_model.transcribe(filepath, beam_size=1)
            return " ".join(seg.text for seg in segments).strip()

        raw_text = await asyncio.to_thread(_run)

        # Apply voice learning post-processing if active
        if apply_learning and raw_text:
            from core.voice_learning import voice_learning
            corrected = voice_learning.post_process_transcription(raw_text)
            if corrected != raw_text:
                logger.info("voice_learning_applied",
                             original=raw_text, corrected=corrected)
            return corrected

        return raw_text

    # ─── Text to Speech ─────────────────────────────────────────
    def sanitize_text_for_tts(self, text: str) -> str:
        """Sanitize text to make vocal output premium, natural, and expressive.
        
        Specifically:
        - Omit code blocks and code symbols completely.
        - Strip markdown asterisks, backticks, hashtags, underscores, and line dividers.
        - Strip brackets, parentheses, and braces while keeping the text inside them.
        - Remove XML tags entirely.
        - Normalize punctuation, ellipsis, and dashes so the neural TTS pauses naturally.
        - Do not speak special characters literally (like backslashes, tildes, pipes, braces).
        """
        import re
        if not text:
            return ""

        # Remove markdown code blocks completely
        text = re.sub(r'```[\s\S]*?```', ' [code snippet] ', text)

        # Remove XML tags and contents if they represent tools
        text = re.sub(r'<[A-Z_]+>.*?</[A-Z_]+>', ' ', text)
        text = re.sub(r'<[^>]+>', ' ', text)

        # Remove markdown headers and line dividers
        text = re.sub(r'^#+\s+', '', text, flags=re.MULTILINE)
        text = re.sub(r'[-=]{3,}', ' ', text)

        # Remove formatting symbols: asterisks, underscores, backticks, hashtags, squiggly lines
        text = text.replace('*', '').replace('_', '').replace('`', '').replace('#', '').replace('~', '')

        # Remove literal special characters
        text = text.replace('\\', ' ').replace('/', ' ').replace('|', ' ').replace('=', ' ').replace('+', ' ')
        
        # Remove brackets, keeping the inner text
        text = text.replace('[', ' ').replace(']', ' ').replace('(', ' ').replace(')', ' ')
        text = text.replace('{', ' ').replace('}', ' ').replace('<', ' ').replace('>', ' ')

        # Clean up punctuation: normalize multiple periods/ellipses to a comma for natural pausing
        text = re.sub(r'\.{2,}', ', ', text)
        
        # Replace multiple spaces with a single space
        text = re.sub(r'\s+', ' ', text)

        return text.strip()

    async def speak_stream(self, sentence_queue: asyncio.Queue, language: str = "en") -> None:
        """Consumes sentences from the queue and speaks them sequentially.
        
        This method is the SOLE controller of the speaking state.
        It mutes the microphone BEFORE generating audio and unmutes
        AFTER a cooldown period to prevent acoustic feedback.
        """
        import edge_tts

        async with self._speak_lock:
            # ── MUTE: Block all audio processing ──
            self._is_speaking = True
            
            # Tell frontend to show speaking state (this also mutes mic capture)
            await ws_manager.broadcast_typed("tts_start", {})
            await ws_manager.broadcast_typed("status", {"orb_state": "speaking"})

            try:
                while True:
                    sentence = await sentence_queue.get()
                    
                    if sentence is None:
                        # Sentinel value indicating the LLM finished streaming
                        break
                        
                    if not sentence.strip():
                        continue

                    # Sanitize text
                    sentence = self.sanitize_text_for_tts(sentence)

                    if not sentence.strip():
                        continue

                    # Skip sentences without any speakable characters
                    import re
                    if not re.search(r'[a-zA-Z0-9\u0D00-\u0D7F]', sentence):
                        logger.debug("skipping_non_speakable_sentence", text=sentence)
                        continue

                    # ── Apply custom pronunciations ──
                    from core.pronunciation import pronunciation_manager
                    ssml_text = pronunciation_manager.apply_to_text(sentence)
                    if ssml_text != sentence:
                        logger.info("pronunciation_applied", original=sentence[:60], ssml=True)

                    logger.info("tts_generating", text=sentence[:80])

                    # Dynamically select voice based on text content (Indian language Unicode blocks)
                    # If the user already selected a matching voice, use it. Otherwise use the appropriate default.
                    has_ml = any('\u0D00' <= c <= '\u0D7F' for c in sentence)
                    has_hi = any('\u0900' <= c <= '\u097F' for c in sentence)
                    has_ta = any('\u0B80' <= c <= '\u0BFF' for c in sentence)
                    current_lang_prefix = self.selected_voice[:5]  # e.g. 'ml-IN', 'hi-IN', 'ta-IN'
                    
                    if has_ml:
                        voice = self.selected_voice if current_lang_prefix == 'ml-IN' else "ml-IN-MidhunNeural"
                    elif has_hi:
                        voice = self.selected_voice if current_lang_prefix == 'hi-IN' else "hi-IN-SwaraNeural"
                    elif has_ta:
                        voice = self.selected_voice if current_lang_prefix == 'ta-IN' else "ta-IN-PallaviNeural"
                    else:
                        voice = self.selected_voice

                    # Use SSML if pronunciations were applied, otherwise plain text
                    text_to_speak = ssml_text if ssml_text != sentence else sentence
                    communicate = edge_tts.Communicate(
                        text_to_speak, voice, rate=self.selected_rate, pitch=self.selected_pitch
                    )
                    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".mp3")
                    tmp.close()

                    await communicate.save(tmp.name)

                    # Play through speakers using isolated subprocess
                    def _play():
                        try:
                            import subprocess
                            import sys
                            from pathlib import Path
                            script_path = str(Path(__file__).parent / "play_mp3.py")
                            subprocess.run([sys.executable, script_path, tmp.name], creationflags=0x08000000)
                        except Exception as e:
                            logger.error("playback_error", error=str(e))
                        finally:
                            try:
                                os.remove(tmp.name)
                            except Exception:
                                pass

                    await asyncio.to_thread(_play)
                    logger.info("tts_playback_complete", text=sentence[:40])

            except Exception as e:
                logger.error("tts_error", error=str(e))

            finally:
                # ── UNMUTE: Release the audio block ──
                self._speech_ended_at = time.monotonic()
                self._is_speaking = False

                # Tell frontend TTS is done
                await ws_manager.broadcast_typed("tts_playback_complete", {})

                # Wait for physical OS audio buffer + room echo to fully drain
                await asyncio.sleep(COOLDOWN_SECONDS)

                # NOW set the correct post-speech state
                if self._in_conversation:
                    await ws_manager.broadcast_typed("status", {"orb_state": "listening"})
                else:
                    await ws_manager.broadcast_typed("status", {"orb_state": "standby"})

    async def speak(self, text: str, language: str = "en") -> bytes:
        """Legacy helper for single strings."""
        if not text or not text.strip():
            return b""
        q = asyncio.Queue()
        q.put_nowait(text)
        q.put_nowait(None)
        await self.speak_stream(q, language)
        return b""

    # ─── VAD Sensitivity ──────────────────────────────────────
    def _update_vad_threshold(self) -> None:
        """Map vad_sensitivity (1-10) to energy threshold.
        
        1 (most sensitive, quiet rooms): threshold = 5
        7 (default, balanced):           threshold = 20
        10 (most strict, noisy rooms):   threshold = 50
        """
        self.vad_threshold = 5.0 + (10 - self.vad_sensitivity) * 5.0
        logger.info("vad_threshold_updated", sensitivity=self.vad_sensitivity,
                     threshold=self.vad_threshold)

    def set_vad_sensitivity(self, value: int) -> bool:
        """Set VAD sensitivity (1=most sensitive, 10=most strict)."""
        value = max(1, min(10, value))
        self.vad_sensitivity = value
        self._update_vad_threshold()
        # Persist to settings
        settings.VAD_SENSITIVITY = value
        return True

    def get_vad_config(self) -> dict:
        """Return current VAD configuration."""
        return {
            "sensitivity": self.vad_sensitivity,
            "threshold": self.vad_threshold,
            "min_threshold": 5.0,
            "max_threshold": 50.0,
            "default_sensitivity": VAD_SENSITIVITY_DEFAULT,
        }

    # ─── Voice management ─────────────────────────────────────
    async def list_voices(self) -> list[dict]:
        """Return available edge-tts voices, cached after first fetch."""
        if self._available_voices is not None:
            return self._available_voices
        try:
            import edge_tts
            voices = await edge_tts.list_voices()
            # Format for frontend consumption
            self._available_voices = [
                {
                    "name": v["ShortName"],
                    "locale": v["Locale"],
                    "gender": v["Gender"],
                    "friendly_name": v["FriendlyName"],
                    "categories": v.get("VoiceTag", {}).get("ContentCategories", []),
                    "personality": v.get("VoiceTag", {}).get("VoicePersonality", ""),
                }
                for v in voices
            ]
            return self._available_voices
        except Exception as e:
            logger.error("voice_list_error", error=str(e))
            return []

    def set_voice(self, voice_name: str, rate: str | None = None, pitch: str | None = None) -> bool:
        """Set the active TTS voice with optional rate/pitch. Returns True if valid."""
        self.selected_voice = voice_name
        if rate is not None:
            self.selected_rate = rate
        if pitch is not None:
            self.selected_pitch = pitch
        # Also persist to settings for next boot
        settings.TTS_VOICE = voice_name
        logger.info("voice_changed", voice=voice_name, rate=self.selected_rate, pitch=self.selected_pitch)
        return True

    def get_current_voice(self) -> dict:
        """Return current voice info."""
        return {
            "name": self.selected_voice,
            "rate": self.selected_rate,
            "pitch": self.selected_pitch,
        }

    # ─── Lifecycle ──────────────────────────────────────────────
    async def start_listening(self):
        """Start the voice engine.

        In this architecture, we just tell the browser to start listening.
        The actual microphone capture happens in the Electron renderer.
        """
        if self.is_listening:
            return

        self.is_listening = True
        self.main_loop = asyncio.get_running_loop()
        logger.info("voice_engine_started",
                     mode="browser_audio_capture")

        # Pre-load whisper in background
        asyncio.create_task(self.preload())

        # Tell connected browsers to start listening
        await ws_manager.broadcast_typed("start_listening", {})

    async def stop_listening(self):
        self.is_listening = False
        self._in_conversation = False
        self._is_speaking = False
        await ws_manager.broadcast_typed("stop_listening", {})
        logger.info("voice_engine_stopped")


# Singleton
voice_engine = VoiceEngine()

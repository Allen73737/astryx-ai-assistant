"""Astryx Voice Engine — High-Fidelity Edge TTS & Neural Audio Playback"""

import asyncio
import edge_tts
import pygame
import tempfile
import os
import structlog

logger = structlog.get_logger(__name__)

class VoiceEngine:
    def __init__(self):
        self.mixer_ready = False
        try:
            pygame.mixer.init()
            self.mixer_ready = True
        except Exception as e:
            logger.warning("pygame_mixer_init_failed", error=str(e))

        # Microsoft Neural Voices
        self.en_voice = "en-US-ChristopherNeural"  # Professional commanding male assistant
        self.ml_voice = "ml-IN-MidhunNeural"       # Native Malayalam neural voice

    async def speak_stream(self, sentence_queue: asyncio.Queue, language: str, websocket):
        """Consumes sentences from the queue and speaks them sequentially."""
        voice = self.ml_voice if language == "ml" else self.en_voice
        
        while True:
            sentence = await sentence_queue.get()
            
            if sentence is None:
                # Sentinel value indicating LLM finished streaming
                break
                
            if not sentence.strip():
                continue
                
            if websocket:
                try:
                    await websocket.send_json({"type": "status", "payload": "speaking"})
                except Exception:
                    pass

            # Skip code blocks or long file dumps in spoken voice
            clean_sentence = sentence.replace("```", "").strip()
            if len(clean_sentence) > 300:
                clean_sentence = clean_sentence[:280] + "..."

            try:
                communicate = edge_tts.Communicate(clean_sentence, voice)
                
                fd, temp_path = tempfile.mkstemp(suffix=".mp3")
                os.close(fd)
                
                await communicate.save(temp_path)
                
                if self.mixer_ready:
                    pygame.mixer.music.load(temp_path)
                    pygame.mixer.music.play()
                    
                    while pygame.mixer.music.get_busy():
                        await asyncio.sleep(0.05)
                        
                    pygame.mixer.music.unload()
                
                try:
                    os.remove(temp_path)
                except Exception:
                    pass
                    
            except Exception as e:
                logger.warning("tts_chunk_error", error=str(e), sentence=sentence[:40])
                
        if websocket:
            try:
                await websocket.send_json({"type": "status", "payload": "idle"})
            except Exception:
                pass

    async def speak(self, text: str, websocket=None):
        """Legacy helper to speak a complete text string."""
        q = asyncio.Queue()
        q.put_nowait(text)
        q.put_nowait(None)
        await self.speak_stream(q, "en", websocket)

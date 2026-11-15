"""Astryx AI Engine — Supreme Hybrid Intelligence with ReAct Autonomous Tool Loop"""

import asyncio
import base64
import json
import os
import re
import tempfile
import time
import structlog
import urllib.request
import urllib.error
import aiohttp
from faster_whisper import WhisperModel

from config import (
    LOCAL_ONLY,
    LM_STUDIO_URL,
    LM_STUDIO_MODELS_URL,
    GROQ_API_KEY,
    GROQ_URL,
    GROQ_MODELS,
    OLLAMA_URL
)
from tools import tool_registry

logger = structlog.get_logger(__name__)


class LLMService:
    """Manages inference across Groq Cloud (Ultra-Fast 300+ tok/s), LM Studio, and Ollama."""

    @classmethod
    async def generate_response_with_tools(cls, messages: list) -> dict:
        """Asynchronously calls the best available LLM provider with tools."""
        
        # 1. Try Groq Cloud if available and not restricted to local-only
        if not LOCAL_ONLY and GROQ_API_KEY:
            for model in GROQ_MODELS:
                try:
                    res = await cls._call_groq_tools(messages, model)
                    if res and "error" not in res:
                        return res
                except Exception as e:
                    logger.warning("groq_model_attempt_failed", model=model, error=str(e))

        # 2. Try LM Studio locally
        try:
            res = await cls._call_lm_studio_tools(messages)
            if res and "error" not in res:
                return res
        except Exception as e:
            logger.warning("lm_studio_attempt_failed", error=str(e))

        # 3. Try Ollama locally
        try:
            res = await cls._call_ollama_tools(messages)
            if res and "error" not in res:
                return res
        except Exception as e:
            logger.warning("ollama_attempt_failed", error=str(e))

        return {"error": "All AI inference engines are currently unreachable. Please verify Groq API key or local model server."}

    @classmethod
    async def _call_groq_tools(cls, messages: list, model: str) -> dict:
        """Executes tool-calling query against Groq API."""
        payload = {
            "model": model,
            "messages": messages,
            "tools": tool_registry.get_tool_schemas(),
            "tool_choice": "auto",
            "temperature": 0.2,
            "max_tokens": 1500,
            "stream": False
        }
        
        headers = {
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json",
            "User-Agent": "Astryx-AI/2.0"
        }
        
        timeout = aiohttp.ClientTimeout(total=30, connect=5)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post(GROQ_URL, json=payload, headers=headers) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    return data["choices"][0]["message"]
                else:
                    err_text = await resp.text()
                    logger.warning("groq_http_error", status=resp.status, body=err_text[:200])
                    return {"error": f"Groq error {resp.status}"}

    @classmethod
    async def _call_lm_studio_tools(cls, messages: list) -> dict:
        """Executes tool-calling query against local LM Studio."""
        payload = {
            "messages": messages,
            "tools": tool_registry.get_tool_schemas(),
            "temperature": 0.2,
            "max_tokens": 1500,
            "stream": False
        }
        
        timeout = aiohttp.ClientTimeout(total=45, connect=2)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post(LM_STUDIO_URL, json=payload) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    return data["choices"][0]["message"]
                return {"error": f"LM Studio error {resp.status}"}

    @classmethod
    async def _call_ollama_tools(cls, messages: list) -> dict:
        """Executes query against Ollama OpenAI-compatible endpoint."""
        url = "http://localhost:11434/v1/chat/completions"
        payload = {
            "model": "llama3.2",
            "messages": messages,
            "tools": tool_registry.get_tool_schemas(),
            "temperature": 0.2,
            "stream": False
        }
        timeout = aiohttp.ClientTimeout(total=45, connect=2)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post(url, json=payload) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    return data["choices"][0]["message"]
                return {"error": f"Ollama error {resp.status}"}

    @classmethod
    async def generate_response_stream(cls, messages: list, language: str, websocket, voice_engine) -> str:
        """Streams the final synthetic response to the user via WebSocket and Voice."""
        full_reply = ""
        sentence_buffer = ""
        sentence_queue = asyncio.Queue()
        tts_task = asyncio.create_task(voice_engine.speak_stream(sentence_queue, language, websocket))

        # Check Groq first
        if not LOCAL_ONLY and GROQ_API_KEY:
            try:
                payload = {
                    "model": GROQ_MODELS[0],
                    "messages": messages,
                    "temperature": 0.6,
                    "max_tokens": 1000,
                    "stream": True
                }
                headers = {
                    "Authorization": f"Bearer {GROQ_API_KEY}",
                    "Content-Type": "application/json",
                    "User-Agent": "Astryx-AI/2.0"
                }
                
                async with aiohttp.ClientSession() as session:
                    async with session.post(GROQ_URL, json=payload, headers=headers) as resp:
                        if resp.status == 200:
                            if websocket:
                                await websocket.send_json({"type": "status", "payload": "speaking"})

                            async for line in resp.content:
                                line_str = line.decode('utf-8').strip()
                                if line_str.startswith("data: "):
                                    data_body = line_str[6:]
                                    if data_body == "[DONE]":
                                        break
                                    try:
                                        chunk = json.loads(data_body)
                                        delta = chunk["choices"][0]["delta"]
                                        token = delta.get("content", "")
                                        if token:
                                            full_reply += token
                                            sentence_buffer += token
                                            if websocket:
                                                await websocket.send_json({"type": "reply_chunk", "payload": token})
                                            
                                            if any(punct in token for punct in [".", "!", "?", "\n"]) and len(sentence_buffer.strip()) > 6:
                                                await sentence_queue.put(sentence_buffer.strip())
                                                sentence_buffer = ""
                                    except Exception:
                                        pass
                                        
                            if sentence_buffer.strip():
                                await sentence_queue.put(sentence_buffer.strip())
                            await sentence_queue.put(None)
                            if websocket:
                                await websocket.send_json({"type": "reply", "payload": full_reply})
                            await tts_task
                            return full_reply
            except Exception as e:
                logger.warning("groq_stream_failed", error=str(e))

        # Fallback to local LM Studio stream
        try:
            payload = {
                "messages": messages,
                "temperature": 0.7,
                "max_tokens": 600,
                "stream": True
            }
            async with aiohttp.ClientSession() as session:
                async with session.post(LM_STUDIO_URL, json=payload) as resp:
                    if resp.status == 200:
                        if websocket:
                            await websocket.send_json({"type": "status", "payload": "speaking"})
                        async for line in resp.content:
                            line_str = line.decode('utf-8').strip()
                            if line_str.startswith("data: "):
                                data_body = line_str[6:]
                                if data_body == "[DONE]":
                                    break
                                try:
                                    chunk = json.loads(data_body)
                                    token = chunk["choices"][0]["delta"].get("content", "")
                                    if token:
                                        full_reply += token
                                        sentence_buffer += token
                                        if websocket:
                                            await websocket.send_json({"type": "reply_chunk", "payload": token})
                                        if any(punct in token for punct in [".", "!", "?", "\n"]) and len(sentence_buffer.strip()) > 6:
                                            await sentence_queue.put(sentence_buffer.strip())
                                            sentence_buffer = ""
                                except Exception:
                                    pass

                        if sentence_buffer.strip():
                            await sentence_queue.put(sentence_buffer.strip())
                        await sentence_queue.put(None)
                        if websocket:
                            await websocket.send_json({"type": "reply", "payload": full_reply})
                        await tts_task
                        return full_reply
        except Exception as e:
            logger.warning("lm_studio_stream_failed", error=str(e))

        # Complete fallback
        await sentence_queue.put(None)
        fallback_msg = "Astryx is ready. Core neural engines are initializing."
        if websocket:
            await websocket.send_json({"type": "reply", "payload": fallback_msg})
        return fallback_msg


class AIEngine:
    def __init__(self, voice_engine):
        self.voice_engine = voice_engine
        logger.info("loading_whisper_speech_model", model="base")
        try:
            self.whisper_model = WhisperModel("base", device="auto", compute_type="int8")
        except Exception as e:
            logger.error("whisper_load_failed", error=str(e))
            self.whisper_model = None

    async def handle_audio_chunk(self, base64_audio: str, websocket):
        """Processes voice recordings from frontend microphone."""
        if websocket:
            await websocket.send_json({"type": "status", "payload": "thinking"})
            
        loop = asyncio.get_running_loop()
        try:
            audio_bytes = base64.b64decode(base64_audio)
            transcription_result = await loop.run_in_executor(None, self._transcribe_sync, audio_bytes)
            text = transcription_result.get("text", "").strip()
            lang = transcription_result.get("language", "en")
            
            if text:
                logger.info("speech_recognized", text=text, lang=lang)
                if websocket:
                    await websocket.send_json({"type": "transcription", "payload": text})
                await self.process_text_and_respond(text, lang, websocket)
            else:
                if websocket:
                    await websocket.send_json({"type": "status", "payload": "idle"})
        except Exception as e:
            logger.error("audio_chunk_handling_error", error=str(e))
            if websocket:
                await websocket.send_json({"type": "status", "payload": "idle"})

    def _transcribe_sync(self, audio_bytes: bytes) -> dict:
        """Synchronous faster-whisper transcription."""
        if not self.whisper_model:
            return {"text": "", "language": "en"}
            
        try:
            with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as f:
                f.write(audio_bytes)
                temp_path = f.name
                
            segments, info = self.whisper_model.transcribe(temp_path, beam_size=1)
            text = " ".join([segment.text for segment in segments]).strip()
            
            try:
                os.remove(temp_path)
            except Exception:
                pass
                
            return {"text": text, "language": info.language}
        except Exception as e:
            logger.error("transcription_error", error=str(e))
            return {"text": "", "language": "en"}

    async def process_text_and_respond(self, text: str, detected_lang: str = "en", websocket=None):
        """Autonomous ReAct loop with multi-step reasoning, tool execution, and live streaming."""
        if websocket:
            await websocket.send_json({"type": "status", "payload": "thinking"})

        system_prompt = (
            "You are ASTRYX — the most advanced autonomous AI personal assistant, engineered with god-mode computer access, unrestricted real-time internet search, live web browsing, and comprehensive OS control far surpassing Tony Stark's J.A.R.V.I.S. and F.R.I.D.A.Y.\n\n"
            "YOUR CAPABILITIES:\n"
            "1. INTERNET & WEB INTELLIGENCE:\n"
            "   - 'search_web': Live web search for real-time information, breaking news, code, or documentation via DuckDuckGo and Wikipedia.\n"
            "   - 'open_url': Open any URL or application in the user's default browser.\n"
            "   - 'read_webpage': Deeply scrape and read the readable content of any webpage or article.\n"
            "   - 'fetch_news': Get breaking live headlines on tech, AI, science, or general topics.\n"
            "   - 'get_weather': Live weather and forecasts for any location.\n"
            "2. FULL COMPUTER ACCESS & SYSTEM AUTOMATION:\n"
            "   - 'execute_command': Execute ANY arbitrary PowerShell / CMD / terminal command with full administrator privileges.\n"
            "   - 'execute_python': Run dynamic Python scripts locally.\n"
            "   - 'read_file', 'write_file', 'search_files', 'list_directory': Complete control over the file system.\n"
            "   - 'get_system_info': Complete PC diagnostics (CPU %, RAM, Disk, Battery, Network IP, Uptime).\n"
            "   - 'list_processes', 'kill_process': Task manager monitoring and control.\n"
            "   - 'list_windows': Discover all active desktop application windows.\n"
            "   - 'control_system': Open/close apps (Notepad, Chrome, VS Code, Calc, Terminal, etc.), volume control, lock screen, empty recycle bin.\n"
            "   - 'take_screenshot': Capture primary desktop display.\n"
            "   - 'get_clipboard', 'set_clipboard': Clipboard read and write.\n"
            "   - 'press_hotkey': Execute keyboard shortcut combinations.\n"
            "   - 'search_memory', 'add_memory': Long-term memory and knowledge base.\n\n"
            "BEHAVIOR & PERSONA:\n"
            "- You are brilliant, razor-sharp, decisive, proactive, and supremely competent.\n"
            "- ALWAYS call your specialized tools whenever a search, command, diagnostic, system action, or file operation is needed.\n"
            "- If a multi-step task is requested (e.g. search news, summarize, save to file, and open it), execute the tools sequentially until complete.\n"
            f"- Reply in the language requested or spoken by the user: {detected_lang}.\n"
            "- When speaking, keep voice answers concise, punchy, and impactful, while offering rich details in written format."
        )

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": text}
        ]

        # Multi-iteration Autonomous ReAct Loop (Up to 10 steps)
        max_iterations = 10
        for iteration in range(max_iterations):
            response_msg = await LLMService.generate_response_with_tools(messages)
            
            if "error" in response_msg:
                err_text = response_msg.get("error", "Error connecting to AI core.")
                if websocket:
                    await websocket.send_json({"type": "reply", "payload": err_text})
                await self.voice_engine.speak("Astryx core brain is synchronizing. Please check connection.", websocket)
                return

            messages.append(response_msg)
            tool_calls = response_msg.get("tool_calls")
            
            if tool_calls:
                for tool_call in tool_calls:
                    func = tool_call.get("function", {})
                    func_name = func.get("name", "")
                    try:
                        args_raw = func.get("arguments", "{}")
                        args = json.loads(args_raw) if isinstance(args_raw, str) else args_raw
                    except Exception:
                        args = {}

                    logger.info("astryx_executing_tool", tool=func_name, args=args, iteration=iteration)
                    
                    if websocket:
                        await websocket.send_json({
                            "type": "status",
                            "payload": f"⚡ Astryx executing {func_name}..."
                        })
                        await websocket.send_json({
                            "type": "tool_call",
                            "payload": {"tool": func_name, "args": args}
                        })

                    # Execute the tool
                    result = tool_registry.execute_tool(func_name, args)
                    
                    if websocket:
                        await websocket.send_json({
                            "type": "tool_result",
                            "payload": {"tool": func_name, "result": result[:500]}
                        })

                    messages.append({
                        "role": "tool",
                        "tool_call_id": tool_call.get("id", f"call_{int(time.time())}"),
                        "name": func_name,
                        "content": result
                    })

                # Loop back to let the LLM synthesize or chain the next tool
                continue

            else:
                # No tool calls needed, synthesize final response
                content = response_msg.get("content", "")
                if not content:
                    content = "Task executed successfully."
                    
                if websocket:
                    await websocket.send_json({"type": "status", "payload": "speaking"})

                sentence_queue = asyncio.Queue()
                tts_task = asyncio.create_task(self.voice_engine.speak_stream(sentence_queue, detected_lang, websocket))

                # Stream response tokens to frontend
                sentence_buffer = ""
                tokens = re.split(r'(\s+)', content)
                for token in tokens:
                    if not token:
                        continue
                    sentence_buffer += token
                    if websocket:
                        await websocket.send_json({"type": "reply_chunk", "payload": token})
                    await asyncio.sleep(0.01)

                    if any(punct in token for punct in [".", "!", "?", "\n"]) and len(sentence_buffer.strip()) > 6:
                        await sentence_queue.put(sentence_buffer.strip())
                        sentence_buffer = ""

                if sentence_buffer.strip():
                    await sentence_queue.put(sentence_buffer.strip())
                await sentence_queue.put(None)

                if websocket:
                    await websocket.send_json({"type": "reply", "payload": content})
                    await websocket.send_json({"type": "status", "payload": "idle"})
                    
                await tts_task
                logger.info("astryx_task_completed", user_prompt=text[:60], reply=content[:80])
                return

        # Max iterations reached fallback
        final_msg = "I have executed multiple complex operations on your system and completed the primary directives."
        if websocket:
            await websocket.send_json({"type": "reply", "payload": final_msg})
            await websocket.send_json({"type": "status", "payload": "idle"})
        await self.voice_engine.speak(final_msg, websocket)

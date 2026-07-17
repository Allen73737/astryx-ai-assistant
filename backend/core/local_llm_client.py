"""Local LLM Client — Wrapper around LM Studio, Groq API, and native llama.cpp for inference."""

from __future__ import annotations

import asyncio
import json
from typing import AsyncIterator, List, Dict, Optional, Any
import structlog
import aiohttp

from config import settings

logger = structlog.get_logger(__name__)


class LocalLLMClient:
    """Async client with 12-step fallback for robust inference."""

    def __init__(self):
        self.lm_studio_url = "http://localhost:1234/v1"
        self.groq_url = "https://api.groq.com/openai/v1"
        self.groq_api_key = settings.GROQ_API_KEY
        
        self.fallback_chain = [
            "groq_primary",
            "groq_secondary",
            "mixtral-8x7b-32768",
            "gemma2-9b-it",
            "llama3-70b-8192",
            "llama3-8b-8192",
            "lm_studio_primary",
            "lm_studio_conversation",
            "lm_studio_coding",
            "native_conversation",
            "native_coding",
            "local_echo_agent",
        ]

    async def _check_lm_studio(self) -> bool:
        """Check if LM Studio is running."""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{self.lm_studio_url}/models", timeout=5) as resp:
                    return resp.status == 200
        except Exception:
            return False

    async def get_loaded_models(self) -> list[str]:
        """Get list of currently loaded model IDs from LM Studio."""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{self.lm_studio_url}/models", timeout=5) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        return [m["id"] for m in data.get("data", [])]
        except Exception:
            pass
        return []

    async def _attempt_groq_inference(self, messages: list[dict[str, str]], model: str, temperature: float, max_tokens: int) -> str | None:
        """Attempt to get a completion from Groq."""
        if not self.groq_api_key:
            return None
        
        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": False
        }
        headers = {
            "Authorization": f"Bearer {self.groq_api_key}",
            "Content-Type": "application/json"
        }
        try:
            # Increased timeout for large completions
            async with aiohttp.ClientSession() as session:
                async with session.post(f"{self.groq_url}/chat/completions", json=payload, headers=headers, timeout=1200) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        return data["choices"][0]["message"]["content"]
                    else:
                        logger.warning("groq_error", model=model, status=resp.status)
        except Exception as e:
            logger.warning("groq_exception", model=model, error=str(e))
        return None

    async def _attempt_groq_stream_inference(self, messages: list[dict[str, str]], model: str, temperature: float, max_tokens: int) -> AsyncIterator[str] | None:
        """Attempt to get a streaming completion from Groq."""
        if not self.groq_api_key:
            return None
            
        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True
        }
        headers = {
            "Authorization": f"Bearer {self.groq_api_key}",
            "Content-Type": "application/json"
        }
        
        try:
            # We must return an async generator if successful, or None if it fails
            session = aiohttp.ClientSession()
            resp = await session.post(f"{self.groq_url}/chat/completions", json=payload, headers=headers, timeout=1200)
            
            if resp.status != 200:
                logger.warning("groq_stream_error", model=model, status=resp.status)
                resp.close()
                await session.close()
                return None

            async def stream_generator():
                try:
                    async for line in resp.content:
                        if not line:
                            continue
                        decoded_line = line.decode('utf-8').strip()
                        if decoded_line.startswith("data: "):
                            data_str = decoded_line[6:]
                            if data_str == "[DONE]":
                                break
                            try:
                                chunk = json.loads(data_str)
                                content = chunk["choices"][0].get("delta", {}).get("content", "")
                                if content:
                                    yield content
                            except json.JSONDecodeError:
                                pass
                finally:
                    resp.close()
                    await session.close()

            return stream_generator()
        except Exception as e:
            logger.warning("groq_stream_exception", model=model, error=str(e))
            if 'session' in locals() and not session.closed:
                await session.close()
            return None

    async def _attempt_lm_studio_inference(self, messages: list[dict[str, str]], model: str, temperature: float, max_tokens: int) -> str | None:
        """Attempt to get a completion from LM Studio."""
        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": False
        }
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(f"{self.lm_studio_url}/chat/completions", json=payload, timeout=1200) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        return data["choices"][0]["message"]["content"]
                    else:
                        logger.warning("lm_studio_error", model=model, status=resp.status)
        except Exception as e:
            logger.warning("lm_studio_exception", model=model, error=str(e))
        return None

    async def _attempt_lm_studio_stream_inference(self, messages: list[dict[str, str]], model: str, temperature: float, max_tokens: int) -> AsyncIterator[str] | None:
        """Attempt to get a streaming completion from LM Studio."""
        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True
        }
        try:
            session = aiohttp.ClientSession()
            resp = await session.post(f"{self.lm_studio_url}/chat/completions", json=payload, timeout=1200)
            
            if resp.status != 200:
                logger.warning("lm_studio_stream_error", model=model, status=resp.status)
                resp.close()
                await session.close()
                return None

            async def stream_generator():
                try:
                    async for line in resp.content:
                        if not line:
                            continue
                        decoded_line = line.decode('utf-8').strip()
                        if decoded_line.startswith("data: "):
                            data_str = decoded_line[6:]
                            if data_str == "[DONE]":
                                break
                            try:
                                chunk = json.loads(data_str)
                                content = chunk["choices"][0].get("delta", {}).get("content", "")
                                if content:
                                    yield content
                            except json.JSONDecodeError:
                                pass
                finally:
                    resp.close()
                    await session.close()
                    
            return stream_generator()
        except Exception as e:
            logger.warning("lm_studio_stream_exception", model=model, error=str(e))
            if 'session' in locals() and not session.closed:
                await session.close()
            return None

    async def _attempt_native_inference(self, messages: list[dict[str, str]], model: str, temperature: float, max_tokens: int) -> str | None:
        """Attempt native llama.cpp inference."""
        from core.model_manager import model_manager
        
        # Ensure model is loaded natively
        loaded = await model_manager.ensure_model(model)
        if not loaded or model_manager.llm is None:
            return None
            
        try:
            def infer():
                return model_manager.llm.create_chat_completion(
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    stream=False
                )
            resp = await asyncio.to_thread(infer)
            return resp["choices"][0]["message"]["content"]
        except Exception as e:
            logger.warning("native_inference_failed", model=model, error=str(e))
        return None

    async def _attempt_native_stream_inference(self, messages: list[dict[str, str]], model: str, temperature: float, max_tokens: int) -> AsyncIterator[str] | None:
        """Attempt native llama.cpp streaming inference."""
        from core.model_manager import model_manager
        
        loaded = await model_manager.ensure_model(model)
        if not loaded or model_manager.llm is None:
            return None
            
        try:
            def infer_stream():
                return model_manager.llm.create_chat_completion(
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    stream=True
                )
            
            gen = await asyncio.to_thread(infer_stream)
            
            def safe_next(g):
                try:
                    return next(g)
                except StopIteration:
                    return None
                    
            async def stream_generator():
                while True:
                    chunk = await asyncio.to_thread(safe_next, gen)
                    if chunk is None:
                        break
                    delta = chunk["choices"][0].get("delta", {})
                    content = delta.get("content", "")
                    if content:
                        yield content
            return stream_generator()
        except Exception as e:
            logger.warning("native_stream_inference_failed", model=model, error=str(e))
        return None

    def _resolve_model_for_step(self, step: str, target_model: str) -> str | None:
        """Resolve the specific model ID for a given fallback step."""
        if step == "groq_primary":
            return target_model if target_model.startswith("llama") or target_model.startswith("mixtral") or target_model.startswith("gemma") else settings.GROQ_MODEL_CONVERSATION
        elif step == "groq_secondary":
            primary = self._resolve_model_for_step("groq_primary", target_model)
            return settings.GROQ_MODEL_CONVERSATION if primary == settings.GROQ_MODEL_CODING else settings.GROQ_MODEL_CODING
        elif step in ["mixtral-8x7b-32768", "gemma2-9b-it", "llama3-70b-8192", "llama3-8b-8192"]:
            return step
        elif step == "lm_studio_primary":
            return target_model
        elif step == "lm_studio_conversation":
            return settings.MODEL_CONVERSATION
        elif step == "lm_studio_coding":
            return settings.MODEL_CODING
        elif step == "native_conversation":
            return settings.MODEL_CONVERSATION
        elif step == "native_coding":
            return settings.MODEL_CODING
        return None

    async def chat(
        self,
        messages: list[dict[str, str]],
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 512,
    ) -> str:
        """Send a non-streaming chat completion request with 12-step fallback."""
        target_model = model or settings.DEFAULT_MODEL
        lm_studio_alive = await self._check_lm_studio()

        for step in self.fallback_chain:
            logger.info("attempting_inference", step=step)
            
            if step == "local_echo_agent":
                return "System Offline: All local and remote AI models are currently unavailable. Please check your internet connection or start LM Studio."
                
            resolved_model = self._resolve_model_for_step(step, target_model)
            if not resolved_model:
                continue

            result = None
            if step.startswith("groq") or step in ["mixtral-8x7b-32768", "gemma2-9b-it", "llama3-70b-8192", "llama3-8b-8192"]:
                result = await self._attempt_groq_inference(messages, resolved_model, temperature, max_tokens)
            elif step.startswith("lm_studio"):
                if lm_studio_alive:
                    result = await self._attempt_lm_studio_inference(messages, resolved_model, temperature, max_tokens)
            elif step.startswith("native"):
                result = await self._attempt_native_inference(messages, resolved_model, temperature, max_tokens)
                
            if result is not None:
                logger.info("inference_successful", step=step, model=resolved_model)
                return result
                
        return "Error: All 12 fallback layers failed."

    async def chat_stream(
        self,
        messages: list[dict[str, str]],
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 512,
    ) -> AsyncIterator[str]:
        """Send a streaming chat completion request with 12-step fallback."""
        target_model = model or settings.DEFAULT_MODEL
        lm_studio_alive = await self._check_lm_studio()

        for step in self.fallback_chain:
            logger.info("attempting_stream_inference", step=step)
            
            if step == "local_echo_agent":
                yield "System Offline: All local and remote AI models are currently unavailable. Please check your internet connection or start LM Studio."
                return
                
            resolved_model = self._resolve_model_for_step(step, target_model)
            if not resolved_model:
                continue

            generator = None
            if step.startswith("groq") or step in ["mixtral-8x7b-32768", "gemma2-9b-it", "llama3-70b-8192", "llama3-8b-8192"]:
                generator = await self._attempt_groq_stream_inference(messages, resolved_model, temperature, max_tokens)
            elif step.startswith("lm_studio"):
                if lm_studio_alive:
                    generator = await self._attempt_lm_studio_stream_inference(messages, resolved_model, temperature, max_tokens)
            elif step.startswith("native"):
                generator = await self._attempt_native_stream_inference(messages, resolved_model, temperature, max_tokens)
                
            if generator is not None:
                has_yielded = False
                try:
                    async for chunk in generator:
                        has_yielded = True
                        yield chunk
                    if has_yielded:
                        logger.info("stream_inference_successful", step=step, model=resolved_model)
                        return
                except Exception as e:
                    logger.warning("stream_interrupted_during_yield", step=step, error=str(e))
                # If we yielded nothing, maybe it failed immediately, try next step
                
        yield "Error: All 12 fallback layers failed."

    async def embed(self, texts: list[str], model: str | None = None) -> list[list[float]]:
        """Generate embeddings using LM Studio."""
        target_model = model or settings.MODEL_EMBEDDINGS
        payload = {
            "model": target_model,
            "input": texts
        }
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(f"{self.lm_studio_url}/embeddings", json=payload, timeout=60) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        return [item["embedding"] for item in data.get("data", [])]
                    else:
                        logger.error("lm_studio_embed_error", status=resp.status)
                        return []
        except Exception as e:
            logger.error("embed_failed", error=str(e))
            return []

    async def analyze_image(self, image_path: str, prompt: str, model: str | None = None) -> str:
        """Analyze an image using a Vision LLM (primarily Groq, falling back to LM Studio)."""
        import base64
        import os
        
        if not os.path.exists(image_path):
            return f"Error: Image file not found at {image_path}"
            
        try:
            with open(image_path, "rb") as image_file:
                base64_image = base64.b64encode(image_file.read()).decode("utf-8")
        except Exception as e:
            return f"Error reading image file: {str(e)}"
            
        ext = os.path.splitext(image_path)[1].lower().replace(".", "")
        if ext not in ["png", "jpeg", "jpg", "webp"]:
            ext = "jpeg"
        if ext == "jpg":
            ext = "jpeg"
            
        mime_type = f"image/{ext}"
        
        # 1. Attempt Groq Vision
        groq_model = model or "llama-3.2-11b-vision-preview"
        if self.groq_api_key:
            logger.info("attempting_groq_vision", model=groq_model)
            payload = {
                "model": groq_model,
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:{mime_type};base64,{base64_image}"
                                }
                            }
                        ]
                    }
                ],
                "max_tokens": 512
            }
            headers = {
                "Authorization": f"Bearer {self.groq_api_key}",
                "Content-Type": "application/json"
            }
            try:
                async with aiohttp.ClientSession() as session:
                    async with session.post(f"{self.groq_url}/chat/completions", json=payload, headers=headers, timeout=25) as resp:
                        if resp.status == 200:
                            data = await resp.json()
                            logger.info("groq_vision_successful")
                            return data["choices"][0]["message"]["content"]
                        else:
                            logger.warning("groq_vision_failed", status=resp.status)
            except Exception as e:
                logger.warning("groq_vision_exception", error=str(e))
                
        # 2. Fallback to LM Studio
        lm_studio_model = settings.MODEL_VISION
        logger.info("attempting_lm_studio_vision", model=lm_studio_model)
        payload = {
            "model": lm_studio_model,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{mime_type};base64,{base64_image}"
                            }
                        }
                    ]
                }
            ],
            "max_tokens": 512
        }
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(f"{self.lm_studio_url}/chat/completions", json=payload, timeout=60) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        logger.info("lm_studio_vision_successful")
                        return data["choices"][0]["message"]["content"]
                    else:
                        logger.warning("lm_studio_vision_failed", status=resp.status)
        except Exception as e:
            logger.warning("lm_studio_vision_exception", error=str(e))
            
        return "Error: Both Groq and LM Studio Vision models failed to analyze the image."


# Singleton instance
lm_client = LocalLLMClient()

"""Model Swap Manager — handles single-model-at-a-time constraint of LM Studio."""

from __future__ import annotations

import asyncio
import time
from enum import Enum
from typing import Callable, Awaitable

import httpx
import structlog

from llama_cpp import Llama
from pathlib import Path
import os
import psutil
from config import settings

logger = structlog.get_logger(__name__)


class SwapState(str, Enum):
    IDLE = "idle"
    SWAPPING = "swapping"
    LOADING = "loading"
    READY = "ready"
    ERROR = "error"


class ModelSwapManager:
    """Manages model loading/unloading natively with llama-cpp-python."""

    def __init__(self) -> None:
        self.current_model: str = ""
        self.llm: Llama | None = None
        self.swap_state: SwapState = SwapState.IDLE
        self.swap_progress: float = 0.0
        self._queue: asyncio.Queue[tuple[str, asyncio.Event]] = asyncio.Queue()
        self._lock = asyncio.Lock()
        self._last_specialist_use: float = 0.0
        self._listeners: list[Callable[[str, SwapState, float], Awaitable[None]]] = []
        self._cooldown_task: asyncio.Task[None] | None = None

    def on_swap_event(self, callback: Callable[[str, SwapState, float], Awaitable[None]]) -> None:
        """Register a listener for model swap state changes."""
        self._listeners.append(callback)

    async def _notify(self, model: str, state: SwapState, progress: float) -> None:
        """Notify all listeners of state change."""
        self.swap_state = state
        self.swap_progress = progress
        for listener in self._listeners:
            try:
                await listener(model, state, progress)
            except Exception as e:
                logger.error("swap_listener_error", error=str(e))

    async def ensure_model(self, required_model: str) -> bool:
        """Ensure the required model is loaded. Swaps if necessary."""
        # Bypass native loading for cloud API models (Groq/OpenAI/etc)
        if required_model.startswith("llama-") or required_model.startswith("mixtral") or required_model.startswith("gemma2"):
            logger.info("bypassing_swap_for_api_model", model=required_model)
            return True

        if self.current_model == required_model and self.llm is not None:
            return True

        async with self._lock:
            # Re-check after acquiring lock
            if self.current_model == required_model and self.llm is not None:
                return True

            logger.info("model_swap_start", from_model=self.current_model, to_model=required_model)
            await self._notify(required_model, SwapState.SWAPPING, 0.0)

            success = await self._load_model(required_model)

            if success:
                self.current_model = required_model
                self._last_specialist_use = time.time()
                await self._notify(required_model, SwapState.READY, 1.0)

                # Schedule cooldown swap back to default if this is a specialist model
                if required_model != settings.DEFAULT_MODEL:
                    self._schedule_cooldown()

                logger.info("model_swap_complete", model=required_model)
            else:
                await self._notify(required_model, SwapState.ERROR, 0.0)
                logger.error("model_swap_failed", model=required_model)

            return success

    def _find_model_file(self, model_id: str) -> Path | None:
        """Not used when connecting to LM Studio. Returns dummy path."""
        return Path(settings.LOCAL_MODELS_DIR) / f"{model_id}.gguf"

    async def _load_model(self, model_id: str) -> bool:
        """Load the model natively using llama-cpp-python if the file exists, otherwise simulate loading for LM Studio."""
        try:
            await self._notify(model_id, SwapState.LOADING, 0.1)
            
            # Clean up old model to free memory
            if self.llm is not None:
                logger.info("unloading_previous_model", model=self.current_model)
                self.llm = None
                import gc
                gc.collect()

            # Find the model file
            model_path = Path(settings.LOCAL_MODELS_DIR) / f"{model_id}.gguf"
            if not model_path.exists():
                # Search recursively inside the local models directory
                for path in Path(settings.LOCAL_MODELS_DIR).glob(f"**/{model_id}.gguf"):
                    model_path = path
                    break

            if model_path.exists():
                logger.info("loading_gguf_natively", path=str(model_path))
                def load():
                    return Llama(
                        model_path=str(model_path),
                        n_ctx=2048,
                        n_threads=max(1, psutil.cpu_count(logical=False) or 4),
                        n_gpu_layers=0, # CPU-only safe default
                        verbose=False
                    )
                self.llm = await asyncio.to_thread(load)
                logger.info("gguf_loaded_natively_successfully", model=model_id)
            else:
                logger.warning("gguf_not_found_locally_for_native_load", model=model_id, searched_dir=str(settings.LOCAL_MODELS_DIR))
                
            await self._notify(model_id, SwapState.LOADING, 1.0)
            return True
        except Exception as e:
            logger.error("model_load_error", model=model_id, error=str(e))
            # Return True so the app can still try to connect to LM Studio as fallback
            return True

    def _schedule_cooldown(self) -> None:
        """Schedule a swap back to default model after cooldown period."""
        if self._cooldown_task and not self._cooldown_task.done():
            self._cooldown_task.cancel()

        self._cooldown_task = asyncio.create_task(self._cooldown_swap())

    async def _cooldown_swap(self) -> None:
        """Wait for cooldown then swap back to default model."""
        await asyncio.sleep(settings.MODEL_SWAP_COOLDOWN_S)

        # Only swap back if no recent specialist use
        elapsed = time.time() - self._last_specialist_use
        if elapsed >= settings.MODEL_SWAP_COOLDOWN_S and self.current_model != settings.DEFAULT_MODEL:
            logger.info("cooldown_swap_to_default", from_model=self.current_model)
            await self.ensure_model(settings.DEFAULT_MODEL)

    def get_status(self) -> dict:
        """Get current swap manager status."""
        return {
            "current_model": self.current_model,
            "swap_state": self.swap_state.value,
            "swap_progress": self.swap_progress,
            "default_model": settings.DEFAULT_MODEL,
        }


# Singleton
model_manager = ModelSwapManager()

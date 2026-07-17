"""JARVIS-X Backend Configuration"""

from __future__ import annotations

import os
from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # ── Paths ──
    BASE_DIR: Path = Path(__file__).resolve().parent
    DATA_DIR: Path = BASE_DIR / "data"
    MODELS_DIR: Path = BASE_DIR.parent / "models"

    # ── Local Inference ──
    LOCAL_MODELS_DIR: Path = Path.home() / ".lmstudio" / "models"

    # ── Model Roster ──
    MODEL_CONVERSATION: str = "qwen2.5-0.5b-instruct-q4_k_m"
    MODEL_CODING: str = "Llama-3.2-1B-Instruct-Q4_K_M"
    MODEL_ROUTER: str = "qwen2.5-0.5b-instruct-q4_k_m"
    MODEL_VISION: str = "Qwen2.5-VL-7B-Instruct-Q4_K_M"
    MODEL_EMBEDDINGS: str = "nomic-embed-text-v1.5.Q4_K_M"
    DEFAULT_MODEL: str = "qwen2.5-0.5b-instruct-q4_k_m"

    # ── Groq API ──
    GROQ_API_KEY: str = ""
    GROQ_MODEL_CONVERSATION: str = "llama-3.1-8b-instant"
    GROQ_MODEL_CODING: str = "llama-3.3-70b-versatile"
    GROQ_MODEL_ROUTER: str = "llama-3.1-8b-instant"

    # ── Server ──
    HOST: str = "0.0.0.0"
    PORT: int = 8002
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:5174"]

    # ── Memory ──
    CHROMA_PERSIST_DIR: str = str(BASE_DIR / "data" / "chroma")
    SQLITE_DB_PATH: str = str(BASE_DIR / "data" / "jarvis.db")

    # ── Voice ──
    WAKE_WORD_MODEL: str = "hey_jarvis"
    STT_MODEL: str = "tiny"
    TTS_VOICE: str = "af_heart"
    VAD_SENSITIVITY: int = 7  # 1 (most sensitive) to 10 (most strict)

    # ── Unsplash API (for PPT image downloads) ──
    # Get your own keys: https://unsplash.com/developers
    UNSPLASH_ACCESS_KEY: str = "U7nqaPYJPn3GuRN0V35a4yF_587epAih8Ub9IY2j4yo"
    UNSPLASH_SECRET_KEY: str = "G-La4-2W-gYT0SGakN_hu3HmcL1oifGSRXbhG_Vsc-o"  # Reserved for future OAuth use

    # ── Swap Manager ──
    MODEL_SWAP_COOLDOWN_S: int = 30
    MODEL_SWAP_TIMEOUT_S: int = 30

    class Config:
        env_prefix = "JARVIS_"
        env_file = ".env"
        extra = "ignore"


settings = Settings()

# Ensure data directories exist
os.makedirs(settings.DATA_DIR, exist_ok=True)
os.makedirs(settings.CHROMA_PERSIST_DIR, exist_ok=True)

"""Astryx Backend Configuration — Ultra-Advanced AI & OS Integration"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Load local .env or fallback to Jarvis .env
BACKEND_DIR = Path(__file__).resolve().parent
load_dotenv(BACKEND_DIR / ".env")
if not os.environ.get("GROQ_API_KEY"):
    load_dotenv(Path("C:/My_Project/Jarvis/backend/.env"))

# ── Security & Network ──
# LOCAL_ONLY = False unlocks internet search, live web browsing, real-time scraping, and cloud hybrid AI
LOCAL_ONLY = os.environ.get("LOCAL_ONLY", "false").lower() == "true"

# ── AI Endpoints ──
LM_STUDIO_URL = os.environ.get("LM_STUDIO_URL", "http://localhost:1234/v1/chat/completions")
LM_STUDIO_MODELS_URL = os.environ.get("LM_STUDIO_MODELS_URL", "http://localhost:1234/v1/models")
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434/api")

# ── Ultra-Fast Groq Cloud LLM (Instant failover / Primary high-intelligence engine) ──
GROQ_API_KEY = os.environ.get("GROQ_API_KEY") or os.environ.get("JARVIS_GROQ_API_KEY", "")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODELS = [
    "qwen/qwen3.8-27b",
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b"
]

# ── System Permissions ──
FULL_COMPUTER_ACCESS = True
ALLOW_COMMAND_EXECUTION = True
ALLOW_PYTHON_EXECUTION = True
ALLOW_FILE_SYSTEM_ACCESS = True
ALLOW_WEB_BROWSING = True

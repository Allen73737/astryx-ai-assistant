import sys

print("Importing uuid...")
import uuid
print("Importing asyncio...")
import asyncio
print("Importing structlog...")
import structlog
print("Importing config...")
from config import settings
print("Importing model_manager...")
from core.model_manager import model_manager, SwapState
print("Importing local_llm_client...")
from core.local_llm_client import lm_client
print("Importing tool_registry...")
from core.tool_registry import tool_registry
print("Importing voice_engine...")
from core.voice_engine import voice_engine
print("Importing websockets...")
from api.websockets import ws_manager
print("Importing orchestrator...")
from core.orchestrator import orchestrator
print("Done!")

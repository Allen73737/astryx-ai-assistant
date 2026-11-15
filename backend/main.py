"""Astryx Backend — Ultra-Advanced Sovereign Assistant & OS Control Server"""

import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json
import requests
import structlog

from config import (
    LOCAL_ONLY,
    LM_STUDIO_MODELS_URL,
    GROQ_API_KEY,
    FULL_COMPUTER_ACCESS
)
from voice_engine import VoiceEngine
from ai_engine import AIEngine
from tools import tool_registry

# ── Logging Setup ──
structlog.configure(
    processors=[
        structlog.stdlib.add_log_level,
        structlog.dev.ConsoleRenderer(colors=True),
    ],
    logger_factory=structlog.PrintLoggerFactory(),
)
logger = structlog.get_logger(__name__)

voice_engine = VoiceEngine()
ai_engine = AIEngine(voice_engine=voice_engine)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(
        "astryx_backend_starting",
        local_only=LOCAL_ONLY,
        tools_registered=len(tool_registry.tools),
        full_computer_access=FULL_COMPUTER_ACCESS,
        groq_cloud_enabled=bool(GROQ_API_KEY)
    )
    yield
    logger.info("astryx_backend_shutting_down")

app = FastAPI(
    title="Astryx Sovereign AI API",
    description="Full computer access, live web browsing, and multi-agent neural assistant.",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

active_websockets: list[WebSocket] = []

class ToolExecutionRequest(BaseModel):
    tool: str
    args: dict = {}

class ChatRequest(BaseModel):
    text: str
    language: str = "en"

class TTSRequest(BaseModel):
    text: str
    language: str = "en"


@app.get("/health")
async def health_check():
    """Reports status of all brain connections, tools, and computer access."""
    status = {
        "status": "online",
        "assistant": "Astryx Supreme",
        "local_only": LOCAL_ONLY,
        "full_computer_access": FULL_COMPUTER_ACCESS,
        "tools_count": len(tool_registry.tools),
        "groq_cloud": "available" if GROQ_API_KEY else "unconfigured",
    }
    
    # Check LM Studio
    try:
        resp = requests.get(LM_STUDIO_MODELS_URL, timeout=1.5)
        if resp.status_code == 200:
            status["lm_studio"] = "reachable"
            status["local_models"] = [m["id"] for m in resp.json().get("data", [])]
        else:
            status["lm_studio"] = f"status_{resp.status_code}"
    except Exception:
        status["lm_studio"] = "offline_or_idle"
    
    return status

@app.get("/tools")
async def list_tools():
    """Lists all available Astryx system tools and their schemas."""
    return {
        "tools_count": len(tool_registry.tools),
        "tools": tool_registry.get_tool_schemas()
    }

@app.post("/tools/execute")
async def execute_tool_endpoint(request: ToolExecutionRequest):
    """Directly executes a tool for external or UI invocation."""
    result = tool_registry.execute_tool(request.tool, request.args)
    return {"tool": request.tool, "result": result}

@app.post("/tts/test")
async def tts_test(request: TTSRequest):
    """Test endpoint for isolated TTS verification."""
    asyncio.create_task(voice_engine.speak(request.text))
    return {"status": "playing", "text": request.text, "language": request.language}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_websockets.append(websocket)
    logger.info("websocket_client_connected", total_clients=len(active_websockets))
    
    # Send welcome handshake with system readiness
    try:
        await websocket.send_json({
            "type": "system_ready",
            "payload": {
                "message": "Astryx Online • Full Computer Access Enabled • Web & Search Online",
                "tools_count": len(tool_registry.tools)
            }
        })
    except Exception:
        pass

    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                msg_type = msg.get("type")
                
                if msg_type == "audio_chunk":
                    audio_b64 = msg.get("payload", "")
                    if audio_b64:
                        asyncio.create_task(ai_engine.handle_audio_chunk(audio_b64, websocket))
                
                elif msg_type == "chat":
                    payload = msg.get("payload", {})
                    # Accept either string or dict payload
                    if isinstance(payload, str):
                        text = payload
                        lang = "en"
                    else:
                        text = payload.get("text", "")
                        lang = payload.get("lang", "en")
                        
                    if text:
                        asyncio.create_task(ai_engine.process_text_and_respond(text, lang, websocket))

                elif msg_type == "execute_tool":
                    payload = msg.get("payload", {})
                    tool_name = payload.get("tool", "")
                    tool_args = payload.get("args", {})
                    if tool_name:
                        result = tool_registry.execute_tool(tool_name, tool_args)
                        await websocket.send_json({
                            "type": "tool_result",
                            "payload": {"tool": tool_name, "result": result}
                        })

            except Exception as e:
                logger.error("ws_message_error", error=str(e))
                
    except WebSocketDisconnect:
        if websocket in active_websockets:
            active_websockets.remove(websocket)
        logger.info("websocket_client_disconnected", remaining_clients=len(active_websockets))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)

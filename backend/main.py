"""JARVIS-X Backend — FastAPI Application Entry Point."""

from __future__ import annotations

import sys
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except AttributeError:
        pass

import json
import asyncio
from contextlib import asynccontextmanager

import structlog
import psutil
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from core.local_llm_client import lm_client
from core.model_manager import model_manager
from core.memory import memory_core
from core.orchestrator import orchestrator
from core.voice_engine import voice_engine
from core.antigravity_ide import antigravity_ide
from api.websockets import ws_manager

# ── Structured logging setup ──
structlog.configure(
    processors=[
        structlog.stdlib.add_log_level,
        structlog.dev.ConsoleRenderer(colors=True),
    ],
    wrapper_class=structlog.stdlib.BoundLogger,
    context_class=dict,
    logger_factory=structlog.PrintLoggerFactory(),
)

logger = structlog.get_logger(__name__)


# ── Lifecycle (modern lifespan pattern) ──

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown lifecycle."""
    logger.info("jarvis_backend_starting", port=settings.PORT)

    # Check Local LLM Setup
    if settings.LOCAL_MODELS_DIR.exists():
        logger.info("local_models_dir_found", path=str(settings.LOCAL_MODELS_DIR))
        logger.info("preloading_llm_model", model=settings.DEFAULT_MODEL)
        asyncio.create_task(model_manager.ensure_model(settings.DEFAULT_MODEL))
    else:
        logger.warning("local_models_not_found", msg=f"Models directory not found at {settings.LOCAL_MODELS_DIR}")

    # Initialize Vector DB
    memory_core.initialize()

    # Start metrics broadcasting task
    asyncio.create_task(_metrics_loop())

    # Start voice engine listening loop for wake word
    await voice_engine.start_listening()

    # Start Proactive Monitor
    from core.proactive_monitor import monitor
    monitor.start()

    logger.info("jarvis_backend_ready")
    
    yield  # App is running
    
    # Shutdown
    logger.info("jarvis_backend_shutting_down")


# ── FastAPI App ──
app = FastAPI(
    title="JARVIS-X Backend",
    description="Local AI Desktop Assistant Backend",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for Electron compatibility
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Routes ──

@app.get("/health")
async def health_check() -> dict:
    """Health check endpoint."""
    return {
        "status": "ok",
        "local_llm": "ready" if settings.LOCAL_MODELS_DIR.exists() else "not_configured",
        "memory": memory_core.get_status(),
        "model": model_manager.get_status(),
    }


@app.get("/api/models")
async def get_models() -> dict:
    """Get model roster and current status."""
    return model_manager.get_status()


# ── WebSocket ──

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    """Main WebSocket endpoint for real-time communication."""
    try:
        await ws_manager.connect(websocket)

        # Send initial status
        await ws_manager.send_message("status", {
            "orb_state": "standby",
            "memory": memory_core.get_status(),
            "model": model_manager.get_status(),
        }, websocket)
    except Exception as setup_e:
        import traceback
        logger.error("ws_setup_error", error=str(setup_e), tb=traceback.format_exc())
        return

    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                msg_type = msg.get("type", "")
                payload = msg.get("payload", {})

                if msg_type == "chat":
                    message_text = payload.get("message", "")
                    if message_text:
                        asyncio.create_task(
                            orchestrator.handle_message(message_text)
                        )

                elif msg_type == "stop_execution":
                    asyncio.create_task(orchestrator.cancel_execution())

                elif msg_type == "model_swap":
                    target_model = payload.get("model", "")
                    if target_model:
                        asyncio.create_task(
                            model_manager.ensure_model(target_model)
                        )

                elif msg_type == "system":
                    action = payload.get("action", "")
                    if action == "get_status":
                        await ws_manager.send_message("status", {
                            "orb_state": "standby",
                            "memory": memory_core.get_status(),
                            "model": model_manager.get_status(),
                        }, websocket)

                # ── Browser Audio Capture Events ──
                elif msg_type == "clap_detected":
                    asyncio.create_task(voice_engine.handle_clap())

                elif msg_type == "audio_chunk":
                    audio_b64 = payload.get("audio", "")
                    sample_rate = payload.get("sampleRate", 16000)
                    if audio_b64:
                        asyncio.create_task(
                            voice_engine.handle_audio_chunk(audio_b64, sample_rate)
                        )

                elif msg_type == "manual_voice_toggle":
                    asyncio.create_task(voice_engine.toggle_manual_voice())

                elif msg_type == "voice_command":
                    audio_b64 = payload.get("audio", "")
                    sample_rate = payload.get("sampleRate", 16000)
                    if audio_b64:
                        asyncio.create_task(
                            voice_engine.handle_voice_command(audio_b64, sample_rate)
                        )

                elif msg_type == "silence_timeout":
                    asyncio.create_task(voice_engine.handle_silence_timeout())

                # ── Voice Management ──
                # ── VAD Sensitivity ──
                elif msg_type == "set_vad":
                    value = payload.get("sensitivity", 7)
                    voice_engine.set_vad_sensitivity(value)
                    await ws_manager.send_message("vad_config",
                        voice_engine.get_vad_config(), websocket)

                elif msg_type == "get_vad":
                    await ws_manager.send_message("vad_config",
                        voice_engine.get_vad_config(), websocket)

                # ── Voice Management ──
                elif msg_type == "list_voices":
                    voices = await voice_engine.list_voices()
                    await ws_manager.send_message("voices_list", {
                        "voices": voices,
                        "current": voice_engine.get_current_voice(),
                    }, websocket)

                elif msg_type == "set_voice":
                    voice_name = payload.get("voice", "")
                    if voice_name:
                        rate = payload.get("rate", None)
                        pitch = payload.get("pitch", None)
                        voice_engine.set_voice(voice_name, rate, pitch)
                        await ws_manager.send_message("voice_set", {
                            "voice": voice_name,
                            "rate": rate,
                            "pitch": pitch,
                            "success": True,
                        }, websocket)

                # ── Voice Learning Mode ──
                elif msg_type == "learning_mode":
                    active = payload.get("active", False)
                    from core.voice_learning import voice_learning
                    voice_learning.set_learning_active(active)
                    await ws_manager.send_message("learning_mode_status", {
                        "active": active,
                    }, websocket)

                elif msg_type == "learning_add_correction":
                    misheard = payload.get("misheard", "")
                    correct = payload.get("correct", "")
                    language = payload.get("language", "ml")
                    audio_b64 = payload.get("audio", None)
                    if misheard and correct:
                        from core.voice_learning import voice_learning
                        entry = voice_learning.add_correction(
                            misheard, correct, language, audio_b64
                        )
                        await ws_manager.send_message("learning_correction_added", {
                            "entry": entry.to_dict(),
                        }, websocket)

                elif msg_type == "learning_delete_correction":
                    entry_id = payload.get("id", "")
                    if entry_id:
                        from core.voice_learning import voice_learning
                        deleted = voice_learning.delete_correction(entry_id)
                        await ws_manager.send_message("learning_correction_deleted", {
                            "id": entry_id,
                            "deleted": deleted,
                        }, websocket)

                elif msg_type == "learning_get_corrections":
                    from core.voice_learning import voice_learning
                    corrections = voice_learning.get_all_corrections()
                    stats = voice_learning.get_stats()
                    await ws_manager.send_message("learning_corrections_list", {
                        "corrections": corrections,
                        "stats": stats,
                    }, websocket)

                elif msg_type == "learning_test_phrase":
                    audio_b64 = payload.get("audio", "")
                    sample_rate = payload.get("sampleRate", 16000)
                    if audio_b64:
                        from core.voice_learning import voice_learning
                        result = await voice_learning.test_transcribe(audio_b64, sample_rate)
                        await ws_manager.send_message("learning_test_result", result, websocket)

                elif msg_type == "learning_clear_all":
                    from core.voice_learning import voice_learning
                    voice_learning.clear_all()
                    await ws_manager.send_message("learning_cleared", {}, websocket)

                elif msg_type == "learning_get_stats":
                    from core.voice_learning import voice_learning
                    stats = voice_learning.get_stats()
                    await ws_manager.send_message("learning_stats", stats, websocket)

                elif msg_type == "learning_batch_import":
                    csv_text = payload.get("csv", "")
                    default_language = payload.get("default_language", "ml")
                    if csv_text:
                        from core.voice_learning import voice_learning
                        result = voice_learning.batch_import_corrections(csv_text, default_language)
                        await ws_manager.send_message("learning_batch_imported", result, websocket)

                elif msg_type == "learning_preview_csv":
                    csv_text = payload.get("csv", "")
                    default_language = payload.get("default_language", "ml")
                    if csv_text:
                        from core.voice_learning import voice_learning
                        preview = voice_learning.preview_csv(csv_text, default_language)
                        await ws_manager.send_message("learning_csv_preview", preview, websocket)

                # ── Pronunciation Editor ──
                elif msg_type == "pronunciation_add":
                    word = payload.get("word", "")
                    pronunciation = payload.get("pronunciation", "")
                    ptype = payload.get("type", "alias")
                    language = payload.get("language", "en")
                    if word and pronunciation:
                        from core.pronunciation import pronunciation_manager
                        entry = pronunciation_manager.add(word, pronunciation, ptype, language)
                        await ws_manager.send_message("pronunciation_added", {
                            "entry": entry.to_dict(),
                        }, websocket)

                elif msg_type == "pronunciation_delete":
                    entry_id = payload.get("id", "")
                    if entry_id:
                        from core.pronunciation import pronunciation_manager
                        deleted = pronunciation_manager.delete(entry_id)
                        await ws_manager.send_message("pronunciation_deleted", {
                            "id": entry_id,
                            "deleted": deleted,
                        }, websocket)

                elif msg_type == "pronunciation_list":
                    from core.pronunciation import pronunciation_manager
                    entries = pronunciation_manager.get_all()
                    stats = pronunciation_manager.get_stats()
                    await ws_manager.send_message("pronunciation_list", {
                        "entries": entries,
                        "stats": stats,
                    }, websocket)

                elif msg_type == "pronunciation_test":
                    sentence = payload.get("sentence", "")
                    if sentence:
                        from core.pronunciation import pronunciation_manager
                        result = pronunciation_manager.test_pronunciation(sentence)
                        await ws_manager.send_message("pronunciation_test_result",
                            result, websocket)

                elif msg_type == "pronunciation_clear_all":
                    from core.pronunciation import pronunciation_manager
                    pronunciation_manager.clear_all()
                    await ws_manager.send_message("pronunciation_cleared", {}, websocket)

                elif msg_type == "get_voice":
                    await ws_manager.send_message("current_voice",
                        voice_engine.get_current_voice(), websocket)

                elif msg_type == "webcam_permission_response":
                    session_id = payload.get("session_id")
                    allowed = payload.get("allowed", False)
                    ws_manager.resolve_permission(session_id, allowed)

                elif msg_type == "run_tool":
                    tag = payload.get("tag", "")
                    content = payload.get("content", "")
                    request_id = payload.get("requestId", "")
                    from core.tool_registry import tool_registry
                    if tag and tag in tool_registry.tools:
                        async def _run():
                            try:
                                result = await tool_registry.tools[tag](content)
                                await ws_manager.send_message("tool_result", {
                                    "tag": tag,
                                    "content": content,
                                    "result": result,
                                    "requestId": request_id,
                                }, websocket)
                            except Exception as err:
                                await ws_manager.send_message("tool_result", {
                                    "tag": tag,
                                    "content": content,
                                    "error": str(err),
                                    "requestId": request_id,
                                }, websocket)
                        asyncio.create_task(_run())

                # ── Antigravity IDE Endpoints ──
                elif msg_type == "ide_list_dir":
                    path_str = payload.get("path", "")
                    res = await antigravity_ide.list_directory(path_str)
                    await ws_manager.send_message("ide_dir_result", res, websocket)

                elif msg_type == "ide_read_file":
                    path_str = payload.get("path", "")
                    res = await antigravity_ide.read_file(path_str)
                    await ws_manager.send_message("ide_file_result", res, websocket)

                elif msg_type == "ide_write_file":
                    path_str = payload.get("path", "")
                    content = payload.get("content", "")
                    res = await antigravity_ide.write_file(path_str, content)
                    await ws_manager.send_message("ide_write_result", res, websocket)

                elif msg_type == "ide_create_item":
                    path_str = payload.get("path", "")
                    is_dir = payload.get("isDir", False)
                    res = await antigravity_ide.create_file(path_str, is_dir)
                    await ws_manager.send_message("ide_create_result", res, websocket)

                elif msg_type == "ide_delete_item":
                    path_str = payload.get("path", "")
                    res = await antigravity_ide.delete_item(path_str)
                    await ws_manager.send_message("ide_delete_result", res, websocket)

                elif msg_type == "ide_exec_cmd":
                    cmd = payload.get("command", "")
                    cwd = payload.get("cwd", "")
                    res = await antigravity_ide.execute_terminal(cmd, cwd)
                    await ws_manager.send_message("ide_exec_result", res, websocket)

                elif msg_type == "ide_git_status":
                    repo = payload.get("repo", "")
                    res = await antigravity_ide.git_status(repo)
                    await ws_manager.send_message("ide_git_status_result", res, websocket)

                elif msg_type == "ide_git_log":
                    repo = payload.get("repo", "")
                    res = await antigravity_ide.git_log(repo)
                    await ws_manager.send_message("ide_git_log_result", res, websocket)

                elif msg_type == "ide_git_commit":
                    repo = payload.get("repo", "")
                    msg_txt = payload.get("message", "")
                    res = await antigravity_ide.git_commit(repo, msg_txt)
                    await ws_manager.send_message("ide_git_commit_result", res, websocket)

                elif msg_type == "ide_ai_action":
                    action = payload.get("action", "")
                    code = payload.get("code", "")
                    lang = payload.get("language", "typescript")
                    prompt_txt = payload.get("prompt", "")
                    res = await antigravity_ide.ai_code_action(action, code, lang, prompt_txt)
                    await ws_manager.send_message("ide_ai_result", res, websocket)

                elif msg_type == "ide_agent_swarm":
                    task_txt = payload.get("task", "")
                    code_txt = payload.get("code", "")
                    repo_txt = payload.get("repo", "")
                    res = await antigravity_ide.run_agent_swarm(task_txt, code_txt, repo_txt)
                    await ws_manager.send_message("ide_swarm_result", res, websocket)

                else:
                    pass  # Silently ignore unknown types (reduces log noise)

            except json.JSONDecodeError:
                logger.error("invalid_ws_json", data=data[:100])

    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as e:
        logger.error("ws_error", error=str(e))
        ws_manager.disconnect(websocket)


# ── Background Tasks ──

async def _metrics_loop() -> None:
    """Broadcast system metrics every 5 seconds."""
    import time
    try:
        last_net_io = psutil.net_io_counters()
    except Exception:
        last_net_io = None
    last_net_time = time.time()
    
    while True:
        try:
            if ws_manager.active_connections:
                cpu = psutil.cpu_percent(interval=0)
                ram = psutil.virtual_memory()
                try:
                    disk = psutil.disk_usage('/')
                    disk_pct = disk.percent
                except Exception:
                    disk_pct = 0
                
                # Network calculations
                now = time.time()
                try:
                    current_net_io = psutil.net_io_counters()
                except Exception:
                    current_net_io = None
                    
                dt = now - last_net_time
                if dt > 0 and last_net_io and current_net_io:
                    net_up = (current_net_io.bytes_sent - last_net_io.bytes_sent) / dt
                    net_down = (current_net_io.bytes_recv - last_net_io.bytes_recv) / dt
                else:
                    net_up = 0
                    net_down = 0
                    
                last_net_io = current_net_io
                last_net_time = now
                
                # GPU / VRAM calculations (lightweight non-blocking check for NVIDIA GPU)
                gpu_usage = 0
                vram_usage = 0
                
                async def get_gpu():
                    try:
                        proc = await asyncio.create_subprocess_exec(
                            "nvidia-smi", "--query-gpu=utilization.gpu,memory.used,memory.total", "--format=csv,nounits,noheader",
                            stdout=asyncio.subprocess.PIPE,
                            stderr=asyncio.subprocess.PIPE
                        )
                        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=1.0)
                        if proc.returncode == 0:
                            parts = stdout.decode().strip().split(",")
                            if len(parts) >= 3:
                                g_util = float(parts[0])
                                m_used = float(parts[1])
                                m_total = float(parts[2])
                                v_util = (m_used / m_total) * 100
                                return int(g_util), int(v_util)
                    except Exception:
                        pass
                    return 0, 0
                    
                gpu_usage, vram_usage = await get_gpu()
                from core.security import security_manager

                metrics = {
                    "cpuUsage": cpu,
                    "gpuUsage": gpu_usage,
                    "ramUsage": ram.percent,
                    "vramUsage": vram_usage,
                    "diskUsage": disk_pct,
                    "networkUp": int(net_up / 1024),      # KB/s
                    "networkDown": int(net_down / 1024),  # KB/s
                    "isAdmin": getattr(security_manager, "is_admin", False),
                }
                await ws_manager.broadcast_typed("metrics", metrics)

        except Exception as e:
            logger.error("metrics_error", error=str(e))

        await asyncio.sleep(5)  # 5s to minimize CPU contention with inference


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=settings.HOST, port=settings.PORT)

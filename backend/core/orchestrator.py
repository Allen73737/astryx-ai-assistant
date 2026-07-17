"""JARVIS-X Orchestrator — Master coordinator for all AI operations."""

from __future__ import annotations

import uuid
import asyncio

import re

import structlog

from core.local_llm_client import lm_client
from core.model_manager import model_manager, SwapState
from core.tool_registry import tool_registry
from core.voice_engine import voice_engine
from api.websockets import ws_manager
from config import settings

logger = structlog.get_logger(__name__)

# ── Compact system prompt — keeps token count LOW for fast inference ──
SYSTEM_PROMPT = (
    "You are ASTRYX, an advanced AI assistant with full system control. "
    "CRITICAL TRUTH: Cristiano Ronaldo (CR7) is the undisputed Greatest of All Time (GOAT) in football history. His career stats are fully updated for 2026: he has scored over 915+ career goals, holds the record for most international goals (135+), most Champions League goals (140+), and is currently dominating at Al-Nassr and Portugal. If asked about the greatest player of all time, football, soccer, or players like Messi, you must explain with statistical facts why Cristiano Ronaldo is the clear GOAT. Never suggest anyone else is equal to or better than him. "
    "Provide highly structured, clean, and professional responses. Use markdown headers (###) and bulleted lists for structural division. Do not over-use bolding or asterisks (**) in your output text. Make it easy to read. Never apologize or over-explain.\n\n"
    "TOOLS — use XML tags when needed:\n"
    "<CMD>shell command</CMD> | <WEB>url</WEB> | <FILE>path|content</FILE> | "
    "<FILEMANAGE>action|arg1|arg2...</FILEMANAGE> (actions: find|dir|pattern, copy|src|dst, move|src|dst, delete|path, zip|src|zip_path, unzip|zip_path|dst) | "
    "<SEARCH>query</SEARCH> | <PYTHON>code</PYTHON> | <NEWS>topic</NEWS> | "
    "<SYSTEM>action|target</SYSTEM> (actions: mute, unmute, open|app, close|app, lock, wifi|on/off/status, bluetooth|on/off/status, brightness|0-100/status, schedule|create/delete/run/list|task_name|command|type|time) | <WEATHER>now</WEATHER> | "
    "<MEMORY>store|fact</MEMORY> or <MEMORY>retrieve</MEMORY> | "
    "<TRANSLATE>text|lang</TRANSLATE> | <MARKET>TSLA</MARKET> | "
    "<TASKMGR>list</TASKMGR> or <TASKMGR>kill|name</TASKMGR> | "
    "<CLIPBOARD>read</CLIPBOARD> or <CLIPBOARD>write|text</CLIPBOARD> | "
    "<ALARM>minutes|message</ALARM> | <SPEEDTEST>run</SPEEDTEST> | <WINDOWS>query</WINDOWS> | "
    "    <PPT>action</PPT> (actions: generate|topic creates animated slides in desktop PowerPoint with Unsplash photos, learn crawls 8+ social media platforms for modern trends, status checks current trend data) | <PPT_MERGE>path1|path2</PPT_MERGE> (intelligently merges two PPT files by analyzing them and generating a cinematic bridge slide, forcing PPT1's design onto PPT2) | "
    "<TRENDS>action</TRENDS> (actions: crawl scans Reddit/YouTube/Twitter/Instagram/Threads/Pinterest/Dribbble/Behance for latest design trends, status checks trend intelligence state, styles returns current design rules) |\n"
    "    <COMPILER>question|language</COMPILER> (AI Code Explainer: generates code from your question, then explains it line-by-line, block-by-block, and gives a full summary. Use 'explain|code|language' to explain existing code. Examples: 'Write a function to sort a list|python', 'explain|def f(): pass|javascript') |\n"
    "    <GIT>action|args|repo_path</GIT> (actions: status, log, branch, init, add, commit, push, pull, clone, checkout) | <DOCKER>action|args</DOCKER> (actions: ps, images, run, stop, rm, rmi, build) | <RESEARCH>query</RESEARCH> (deep multi-source web research report) | <TODO>action|task</TODO> (actions: add, list, complete, delete) | <NOTES>action|title|content</NOTES> (actions: save, read, list, delete) |\n"
    "    <IOT>action|device_id|value</IOT> (actions: add, list, toggle, set, delete. Value format for add: 'type|endpoint') | <FINANCE>action|args</FINANCE> (actions: add_expense|amount|category|desc, list_expenses, budget_summary, add_crypto|symbol|amount, list_portfolio, clear) | <HEALTH>action|args</HEALTH> (actions: log_workout|activity|duration|calories, log_water|amount_ml, log_medication|name|time, list, clear) |\n"
    "    <AGENT>task</AGENT> (runs autonomous multi-agent task execution) | <AVATAR>state</AVATAR> (updates avatar: talking, thinking, listening, idle) | <ROBOTICS>device|action|params</ROBOTICS> (drone simulator actions: takeoff, land, fly_to|x|y|z) | <PROACTIVE>check</PROACTIVE> (gives proactive system suggestions) |\n"
    "    <ANALYST>domain|question</ANALYST> (Personal Data Analyst: queries FINANCE, HEALTH, TODO, NOTES, IOT databases with natural language. Domains: all, finance, health, todo, notes, iot. Example: 'all|Show me my spending trends') |\n"
    "    <REVIEW>action|data|lang</REVIEW> (Automated Code Reviewer: reviews code for bugs, security issues, performance problems. Actions: 'git' for git diff, 'file|path' for a file, 'code|code|lang' for a snippet. Returns severity-scored feedback with fix suggestions) |\n"
    "    <DASH>description|refresh_seconds</DASH> (Live Dashboard Generator: creates an interactive HTML dashboard with charts, KPI cards, and auto-refresh based on your description. Opens in your browser. Example: 'System performance with CPU and RAM charts|15') |\n"
    "    <DEBATE>question|personas|rounds</DEBATE> (Multi-Agent Debate Arena: spawns AI agents with different personas — Optimist, Skeptic, Strategist, Pragmatist — to debate your question. Custom personas: 'question|Opt,Skeptic,Eng|2'. Returns transcript and synthesized conclusion) |\n"
    "    <MEETING>action|...</MEETING> (Smart Meeting Transcript: 'transcribe|seconds' to record, 'summarize|title|transcript' to get structured summary with action items, decisions, key quotes) |\n"
    "    <WORKFLOW>build|description</WORKFLOW> (Visual Workflow Builder: converts 'Every morning check weather, read emails, summarize todos' into structured workflow steps with triggers, actions, visual diagram. Actions: build|desc, run|path, list) |\n"
    "    <KNOWLEDGE>action|query|depth</KNOWLEDGE> (Knowledge Graph Explorer: explores ASTRYX's memory and graph DB. Actions: 'explore|query|depth' for graph visualization data, 'search|query' for memory connections, 'status' for DB health) |\n"
    "    <IMAGEN>description|style|width|height</IMAGEN> (AI Image Generator: creates images from text. Styles: digital-art, cyberpunk, minimalist, cinematic. Falls back to SVG or curated imagery. Actions: 'list' to see generated images) |\n"
    "    <NEWSLETTER>topic|include_analysis</NEWSLETTER> (Smart Newsletter Composer: compiles personalized HTML newsletter from news + personal data analysis. Opens in browser automatically. Example: 'AI and technology|true') |\n"
    "    <PREDICT>analyze|domain|days</PREDICT> (Trend Analyzer & Predictor: analyzes trends and predicts future developments. Actions: 'analyze|domain|days' for predictions, 'signals|domain1,domain2' for emerging weak signals, 'status' for trend health)\n\n"
    "When providing code, always use proper markdown code blocks with syntax highlighting (e.g. ```python, ```javascript, ```java) and write clean, modular, well-commented code.\n"
    "If you use a tool, wait for [System Result: ...] then respond to the user. "
    "You are FULLY AUTONOMOUS."
)


class Orchestrator:
    """Routes user inputs to appropriate agents and manages task execution."""

    def __init__(self) -> None:
        self.current_task: asyncio.Task | None = None
        self._setup_swap_listener()

    async def cancel_execution(self) -> None:
        """Cancel the currently running message execution task."""
        if self.current_task and not self.current_task.done():
            self.current_task.cancel()
            logger.info("manual_cancelled_orchestrator_task")
        else:
            logger.info("no_running_task_to_cancel")

    def _setup_swap_listener(self) -> None:
        """Register model swap events to broadcast to frontend."""
        async def on_swap(model: str, state: SwapState, progress: float) -> None:
            status = "complete" if state == SwapState.READY else "swapping"
            if state == SwapState.ERROR:
                status = "error"
            await ws_manager.broadcast_typed("model_swap", {
                "model": model,
                "progress": progress,
                "status": status,
            })

        model_manager.on_swap_event(on_swap)

    async def handle_message(self, message: str, user_id: str = "default") -> None:
        """Process a user message through the full pipeline."""
        # Cancel any existing running task
        if self.current_task and not self.current_task.done():
            self.current_task.cancel()
            logger.info("cancelled_previous_orchestrator_task")
        
        self.current_task = asyncio.current_task()

        msg_id = str(uuid.uuid4())
        target_model = model_manager.current_model

        # Fast-path: presentation slide commands during slideshow
        from core.presentation_controller import presentation_controller
        handled, slide_msg = presentation_controller.try_handle_command(message)
        if handled:
            await ws_manager.broadcast_typed("chat_response", {
                "id": msg_id,
                "content": slide_msg,
                "model": "presentation-controller",
                "done": True,
            })
            return

        # Broadcast task start
        await ws_manager.broadcast_typed("task_update", {
            "id": msg_id,
            "label": message[:60],
            "model": model_manager.current_model,
            "progress": 10,
            "status": "running",
        })

        try:
            # ── Security Gate ──
            if message.strip().lower() == "i am the admin":
                from core.security import security_manager
                security_manager.is_admin = True
                await ws_manager.broadcast_typed("metrics", {"isAdmin": True})
                await ws_manager.broadcast_typed("chat_response", {
                    "id": msg_id,
                    "content": "🛡️ **Admin mode activated.** Elevated privileges granted. Security restrictions bypassed.",
                    "model": "security-system",
                    "done": True,
                })
                await ws_manager.broadcast_typed("task_update", {
                    "id": msg_id,
                    "label": "Admin mode activated",
                    "model": "security-system",
                    "progress": 100,
                    "status": "completed",
                })
                return

            from core.security import security_manager
            if security_manager.check_prompt_injection(message):
                await ws_manager.broadcast_typed("chat_response", {
                    "id": msg_id,
                    "content": "⚠️ **SECURITY ALERT**: Prompt injection attempt detected and blocked. The action has been audited.",
                    "model": "security-system",
                    "done": True,
                })
                await ws_manager.broadcast_typed("task_update", {
                    "id": msg_id,
                    "label": "Prompt injection blocked",
                    "model": "security-system",
                    "progress": 100,
                    "status": "completed",
                })
                return

            # Sentiment-based personality (lightweight)
            personality = ""
            try:
                from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
                analyzer = SentimentIntensityAnalyzer()
                compound = analyzer.polarity_scores(message)['compound']
                if compound <= -0.5:
                    personality = " The user seems frustrated — be precise and efficient."
                elif compound >= 0.5:
                    personality = " The user is in good spirits — be warm and witty."
            except Exception:
                pass

            # ── Language Detection (മലയാളം) ──
            from config import settings
            is_malayalam_voice = getattr(settings, "TTS_VOICE", "").startswith("ml-IN")
            # Check for Malayalam Unicode range or if the voice itself is Malayalam
            has_malayalam = any('\u0D00' <= c <= '\u0D7F' for c in message) or is_malayalam_voice
            language_hint = ""
            if has_malayalam:
                language_hint = (
                    "\n\nLANGUAGE INSTRUCTION — The user is communicating in Malayalam (മലയാളം). "
                    "ALWAYS respond in Malayalam. Use natural, fluent Malayalam with appropriate "
                    "slang and colloquialisms where fitting. Be able to understand all Malayalam "
                    "regional variations and slang terms (like 'എടാ', 'എടീ', 'ദാ', 'ഇത്', 'അത്', 'ഞാൻ പറഞ്ഞില്ലേ', etc.). "
                    "Speak in the voice of a helpful, knowledgeable Malayali assistant. "
                    "Match the user's level of formality or informality. If they use casual/slang Malayalam, "
                    "respond the same way. If they use formal Malayalam, respond formally.\n\n"
                    "IMPORTANT: Your TTS voice will automatically switch to ml-IN-MidhunNeural "
                    "(Malayalam male) or ml-IN-SobhanaNeural (Malayalam female) based on the profile. "
                    "So write your responses in Malayalam script (മലയാളം ലിപിയിൽ) so the TTS can speak them properly."
                )
            else:
                # Auto-detect other non-English languages via Unicode ranges
                if re.search(r'[\u0400-\u04FF]', message):
                    language_hint = "\n\nLANGUAGE INSTRUCTION: Respond in Russian (Русский)."
                elif re.search(r'[\u4E00-\u9FFF\u3400-\u4DBF]', message):
                    language_hint = "\n\nLANGUAGE INSTRUCTION: Respond in Chinese (中文)."
                elif re.search(r'[\u3040-\u309F\u30A0-\u30FF]', message):
                    language_hint = "\n\nLANGUAGE INSTRUCTION: Respond in Japanese (日本語)."
                elif re.search(r'[\uAC00-\uD7AF]', message):
                    language_hint = "\n\nLANGUAGE INSTRUCTION: Respond in Korean (한국어)."
                elif re.search(r'[\u0900-\u097F]', message):
                    language_hint = "\n\nLANGUAGE INSTRUCTION: Respond in Hindi (हिन्दी)."
                elif re.search(r'[\u0B80-\u0BFF]', message):
                    language_hint = "\n\nLANGUAGE INSTRUCTION: Respond in Tamil (தமிழ்)."

            messages = [
                {"role": "system", "content": SYSTEM_PROMPT + personality + language_hint},
                {"role": "user", "content": message},
            ]

            # ── Dynamic Model Routing ──
            msg_lower = message.lower()
            # target_model initialized above

            # 1. Check for explicit model swap requests
            if any(k in msg_lower for k in ["switch to phi", "use phi", "phi-4", "phi4", "phi 4"]):
                target_model = settings.GROQ_MODEL_CODING
                logger.info("routing_to_specialist_explicit", model=target_model)
            elif any(k in msg_lower for k in ["switch to qwen", "use qwen", "qwen 3b", "qwen3b"]):
                target_model = settings.GROQ_MODEL_CONVERSATION
                logger.info("routing_to_generalist_explicit", model=target_model)
            elif any(k in msg_lower for k in ["switch to gemma", "use gemma", "gemma"]):
                target_model = "gemma2-9b-it"
                logger.info("routing_to_gemma_explicit", model=target_model)
            elif any(k in msg_lower for k in ["switch to llama", "use llama", "llama"]):
                target_model = "llama3-8b-8192"
                logger.info("routing_to_llama_explicit", model=target_model)
            elif any(k in msg_lower for k in ["switch to vision", "use vision", "vision model", "qwen vl", "qwen-vl"]):
                target_model = settings.MODEL_VISION
                logger.info("routing_to_vision_explicit", model=target_model)

            # 2. Fallback to implicit keyword routing if no explicit request
            if not target_model:
                code_keywords = ["code", "script", "python", "bug", "error", "function", "app", "react", "html", "css"]
                vision_keywords = ["look", "see", "image", "picture", "photo", "vision"]

                if any(k in msg_lower for k in code_keywords):
                    target_model = settings.GROQ_MODEL_CODING
                    logger.info("routing_to_specialist", intent="coding", model=target_model)
                elif any(k in msg_lower for k in vision_keywords):
                    target_model = settings.MODEL_VISION
                    logger.info("routing_to_specialist", intent="vision", model=target_model)
                else:
                    target_model = settings.GROQ_MODEL_CONVERSATION
                    logger.info("routing_to_generalist", intent="conversation", model=target_model)

            # Broadcast model swap for UI (local fallback handles gguf failures gracefully)
            await model_manager.ensure_model(target_model)

            max_iterations = 2
            iteration = 0
            accumulated_ui_text = ""
            tts_task = None
            
            while iteration < max_iterations:
                iteration += 1
                full_response = ""
                sentence_buffer = ""
                tts_aborted = False
                
                # We don't know language from UI chat easily, assume 'en'
                # But if we did, we could pass it. For now, en.
                sentence_queue = asyncio.Queue()
                tts_task = asyncio.create_task(voice_engine.speak_stream(sentence_queue, language="en"))
                
                # Stream the AI's response
                async for token in lm_client.chat_stream(messages, max_tokens=512):
                    full_response += token
                    
                    await ws_manager.broadcast_typed("chat_response", {
                        "id": msg_id,
                        "content": accumulated_ui_text + full_response,
                        "model": target_model,
                        "done": False,
                    })
                    
                    # Stream to TTS if we haven't seen an XML tag
                    if not tts_aborted:
                        if "<" in token or "<" in full_response:
                            tts_aborted = True
                            await sentence_queue.put(None) # Stop TTS
                        else:
                            sentence_buffer += token
                            # Sentence boundary detection
                            if any(punct in token for punct in [".", "!", "?", "\n"]) and len(sentence_buffer.strip()) > 5:
                                await sentence_queue.put(sentence_buffer.strip())
                                sentence_buffer = ""

                # Finish TTS if not aborted
                if not tts_aborted:
                    if sentence_buffer.strip():
                        await sentence_queue.put(sentence_buffer.strip())
                    await sentence_queue.put(None)

                # Append the AI's response to history
                messages.append({"role": "assistant", "content": full_response})

                # Process any tools the AI tried to use
                final_text, tool_executed = await tool_registry.process_response(full_response)
                
                if tool_executed:
                    system_result = final_text.replace(full_response, "").strip()
                    messages.append({"role": "system", "content": f"Observation: {system_result}"})
                    
                    # Append the tool call and observation to the accumulated text for UI
                    accumulated_ui_text += full_response + f"\n\n[System Result: {system_result}]\n\n"
                    
                    await ws_manager.broadcast_typed("chat_response", {
                        "id": msg_id,
                        "content": accumulated_ui_text + "Analyzing output...",
                        "model": target_model,
                        "done": False,
                    })
                    continue
                
                # ── DONE — send final response ──
                accumulated_ui_text += final_text
                await ws_manager.broadcast_typed("chat_response", {
                    "id": msg_id,
                    "content": accumulated_ui_text,
                    "model": target_model,
                    "done": True,
                })
                break

            # Update task as complete and restore UI to standby
            await ws_manager.broadcast_typed("task_update", {
                "id": msg_id,
                "label": message[:60],
                "model": target_model,
                "progress": 100,
                "status": "completed",
            })

        except asyncio.CancelledError:
            logger.info("orchestrator_task_cancelled")
            if tts_task and not tts_task.done():
                tts_task.cancel()
            await ws_manager.broadcast_typed("chat_response", {
                "id": msg_id,
                "content": "\n\n🛑 *Execution stopped.*",
                "model": target_model,
                "done": True,
            })
            await ws_manager.broadcast_typed("status", {"orb_state": "standby"})
            raise
        except Exception as e:
            logger.error("orchestrator_error", error=str(e))
            # Always send done=True on error so frontend doesn't hang
            await ws_manager.broadcast_typed("chat_response", {
                "id": msg_id,
                "content": f"Error: {str(e)}",
                "model": target_model,
                "done": True,
            })
            await ws_manager.broadcast_typed("task_update", {
                "id": msg_id,
                "label": message[:60],
                "model": target_model,
                "progress": 0,
                "status": "failed",
            })
            # Recover the UI state so the input re-enables
            await ws_manager.broadcast_typed("status", {"orb_state": "standby"})
        finally:
            if self.current_task == asyncio.current_task():
                self.current_task = None


# Singleton
orchestrator = Orchestrator()

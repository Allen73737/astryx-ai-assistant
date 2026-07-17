"""Tool Registry for routing intent to specific functions."""

from __future__ import annotations

import re
import json
from typing import Callable, Awaitable, Any
import structlog
from agents.automation import automation

logger = structlog.get_logger(__name__)

class ToolRegistry:
    def __init__(self):
        self.tools = {
            "CMD": automation.execute_command,
            "WEB": automation.open_url,
            "FILE": self._handle_file_write,
            "FILEMANAGE": self._handle_filemanage,
            "NEWS": self._handle_news,
            "PYTHON": automation.execute_python,
            "SANDBOX": automation.execute_sandbox,
            "SEARCH": automation.search_web,
            "DELEGATE": self._handle_delegate,
            "SYSTEM": self._handle_system,
            "VISION": self._handle_vision,
            "MEMORY": self._handle_memory,
            "WEATHER": self._handle_weather,
            "GHOST": self._handle_ghost,
            "MARKET": automation.fetch_market_data,
            "COMPILER": self._handle_compiler,
            "CHART": automation.generate_chart,
            "SCRAPE": automation.deep_scrape,
            "CLIPBOARD": self._handle_clipboard,
            "TRANSLATE": self._handle_translate,
            "CALENDAR": self._handle_calendar,
            "MAIL": self._handle_mail,
            "NETWORK": self._handle_network,
            "INDEX": automation.index_search,
            "DEBUG": self._handle_debug,
            "CAMERA": self._handle_camera,
            "YOUTUBE": self._handle_youtube,
            "PDF": self._handle_pdf,
            "BLUETOOTH": self._handle_bluetooth,
            "RECORD": self._handle_record,
            "SPEEDTEST": self._handle_speedtest,
            "TASKMGR": self._handle_taskmgr,
            "ALARM": self._handle_alarm,
            "DICTATE": self._handle_dictate,
            "CRYPTO": self._handle_crypto,
            "FACERECOG": self._handle_facerecog,
            "SPOTIFY": self._handle_spotify,
            "SMS": self._handle_sms,
            "ROUTER": self._handle_router,
            "SELFDESTRUCT": self._handle_selfdestruct,
            "WINDOWS": automation.list_windows,
            "GIT": self._handle_git,
            "DOCKER": self._handle_docker,
            "RESEARCH": self._handle_research,
            "TODO": self._handle_todo,
            "NOTES": self._handle_notes,
            "IOT": self._handle_iot,
            "FINANCE": self._handle_finance,
            "HEALTH": self._handle_health,
            "AGENT": self._handle_agent,
            "AVATAR": self._handle_avatar,
            "ROBOTICS": self._handle_robotics,
            "PROACTIVE": self._handle_proactive,
            "PPT": self._handle_ppt,
            "TRENDS": self._handle_trends,
            "ANALYST": self._handle_analyst,
            "REVIEW": self._handle_review,
            "DASH": self._handle_dash,
            "DEBATE": self._handle_debate,
            "MEETING": self._handle_meeting,
            "WORKFLOW": self._handle_workflow,
            "KNOWLEDGE": self._handle_knowledge,
            "IMAGEN": self._handle_imagen,
            "NEWSLETTER": self._handle_newsletter,
            "PREDICT": self._handle_predict,
            "WEATHERLAB": self._handle_weather_lab,
            "STOCKS": self._handle_stocks,
            "PARTICLES": self._handle_particles,
            "AGENTFORGE": self._handle_agent_forge,
            "PPT_MERGE": self._handle_ppt_merge,
            "IDE": self._handle_ide,
            "ANTIGRAVITY": self._handle_ide
        }
        
    async def _handle_file_write(self, data: str) -> str:
        # Expected format: "path|content"
        parts = data.split("|", 1)
        if len(parts) == 2:
            return await automation.write_file(parts[0], parts[1])
        return "Invalid file write format. Expected path|content"

    async def _handle_filemanage(self, data: str) -> str:
        # Expected format: "action|arg1|arg2..."
        parts = [p.strip() for p in data.split("|")]
        if not parts or not parts[0]:
            return "Invalid FILEMANAGE format. Expected action|arg1|arg2..."
        
        action = parts[0].lower()
        if action == "find":
            if len(parts) >= 3:
                return await automation.find_file(parts[1], parts[2])
            return "Invalid find format. Expected FILEMANAGE: find|directory|pattern"
        elif action == "copy":
            if len(parts) >= 3:
                return await automation.copy_file(parts[1], parts[2])
            return "Invalid copy format. Expected FILEMANAGE: copy|source|destination"
        elif action == "move":
            if len(parts) >= 3:
                return await automation.move_file(parts[1], parts[2])
            return "Invalid move format. Expected FILEMANAGE: move|source|destination"
        elif action == "delete":
            if len(parts) >= 2:
                return await automation.delete_file(parts[1])
            return "Invalid delete format. Expected FILEMANAGE: delete|path"
        elif action == "zip":
            if len(parts) >= 3:
                return await automation.zip_files(parts[1], parts[2])
            return "Invalid zip format. Expected FILEMANAGE: zip|source_dir|zip_path"
        elif action == "unzip":
            if len(parts) >= 3:
                return await automation.extract_zip(parts[1], parts[2])
            return "Invalid unzip format. Expected FILEMANAGE: unzip|zip_path|extract_dir"
        
        return f"Unknown FILEMANAGE action: {action}"

    async def _handle_news(self, data: str) -> str:
        topic = data.strip() if data else "general"
        import asyncio
        from core.news_engine import curate_news
        # Run news curation in a background task so it doesn't block the AI response stream
        asyncio.create_task(curate_news(topic))
        return f"Compiling the latest edition of the Astryx Daily for topic: {topic}. It will appear on your display shortly."

    async def _handle_delegate(self, data: str) -> str:
        # Expected format: "ResearchAgent|Find out who won the cup"
        parts = data.split("|", 1)
        if len(parts) == 2:
            agent_role = parts[0].strip()
            task = parts[1].strip()
            logger.info("delegating_task_to_subagent", role=agent_role, task=task[:50])
            
            from core.local_llm_client import lm_client
            
            # Use the currently loaded model as the sub-agent to prevent memory crashes
            
            agent_prompt = [
                {"role": "system", "content": f"You are the ASTRYX {agent_role} Sub-Agent. Your goal is to thoroughly research or analyze the following task and return a complete, detailed report back to the Master Orchestrator."},
                {"role": "user", "content": task}
            ]
            
            full_response = ""
            async for token in lm_client.chat_stream(agent_prompt):
                full_response += token
                
            return f"[{agent_role} Report]:\n{full_response}"
            
        return "Invalid DELEGATE format. Expected AgentRole|Task description"

    async def _handle_system(self, data: str) -> str:
        parts = data.split("|", 1)
        if len(parts) == 2:
            return await automation.system_control(parts[0].strip(), parts[1].strip())
        return await automation.system_control(data.strip(), "")

    async def _handle_vision(self, data: str) -> str:
        return await automation.analyze_screen(data.strip())

    async def _handle_memory(self, data: str) -> str:
        parts = data.split("|", 1)
        if len(parts) == 2:
            return await automation.manage_memory(parts[0].strip(), parts[1].strip())
        return await automation.manage_memory("retrieve", "")

    async def _handle_weather(self, data: str) -> str:
        return await automation.get_weather()

    async def _handle_ghost(self, data: str) -> str:
        return await automation.ghost_control(data)

    async def _handle_clipboard(self, data: str) -> str:
        parts = data.split("|", 1)
        if len(parts) == 2:
            return await automation.manage_clipboard(parts[0].strip(), parts[1].strip())
        return await automation.manage_clipboard(data.strip())

    async def _handle_translate(self, data: str) -> str:
        parts = data.split("|", 1)
        if len(parts) == 2:
            return await automation.translate_text(parts[0].strip(), parts[1].strip())
        return "Invalid TRANSLATE format. Expected text|lang_code"

    async def _handle_calendar(self, data: str) -> str:
        parts = data.split("|", 1)
        if len(parts) == 2:
            return await automation.manage_calendar(parts[0].strip(), parts[1].strip())
        return await automation.manage_calendar(data.strip())

    async def _handle_mail(self, data: str) -> str:
        return await automation.read_emails()

    async def _handle_network(self, data: str) -> str:
        return await automation.scan_network()

    async def _handle_debug(self, data: str) -> str:
        return await automation.self_diagnostics()

    async def _handle_camera(self, data: str) -> str:
        return await automation.camera_surveillance(data.strip())

    async def _handle_youtube(self, data: str) -> str:
        return await automation.youtube_extract(data.strip())

    async def _handle_pdf(self, data: str) -> str:
        return await automation.read_pdf(data.strip())

    async def _handle_bluetooth(self, data: str) -> str:
        return await automation.scan_bluetooth()

    async def _handle_record(self, data: str) -> str:
        return await automation.screen_recording(data.strip())

    async def _handle_speedtest(self, data: str) -> str:
        return await automation.speed_test()

    async def _handle_taskmgr(self, data: str) -> str:
        parts = data.split("|", 1)
        if len(parts) == 2:
            return await automation.task_manager(parts[0].strip(), parts[1].strip())
        return await automation.task_manager(data.strip())

    async def _handle_alarm(self, data: str) -> str:
        parts = data.split("|", 1)
        if len(parts) == 2:
            return await automation.set_alarm(parts[0].strip(), parts[1].strip())
        return "Invalid ALARM format. Expected minutes|message"

    async def _handle_dictate(self, data: str) -> str:
        return await automation.dictation(data.strip())

    async def _handle_crypto(self, data: str) -> str:
        parts = data.split("|", 1)
        if len(parts) == 2:
            return await automation.crypto_gen(parts[0].strip(), parts[1].strip())
        return await automation.crypto_gen(data.strip())

    async def _handle_facerecog(self, data: str) -> str:
        return await automation.face_recognition()

    async def _handle_spotify(self, data: str) -> str:
        return await automation.spotify_control(data.strip())

    async def _handle_sms(self, data: str) -> str:
        parts = data.split("|", 1)
        if len(parts) == 2:
            return await automation.send_sms(parts[0].strip(), parts[1].strip())
        return "Invalid SMS format. Expected number|message"

    async def _handle_router(self, data: str) -> str:
        return await automation.router_scan()

    async def _handle_selfdestruct(self, data: str) -> str:
        return await automation.self_destruct()

    async def _handle_git(self, data: str) -> str:
        parts = data.split("|", 2)
        action = parts[0].strip()
        args = parts[1].strip() if len(parts) > 1 else ""
        repo_path = parts[2].strip() if len(parts) > 2 else "c:/My_Project/Jarvis"
        return await automation.git_control(action, args, repo_path)

    async def _handle_docker(self, data: str) -> str:
        parts = data.split("|", 1)
        action = parts[0].strip()
        args = parts[1].strip() if len(parts) > 1 else ""
        return await automation.docker_control(action, args)

    async def _handle_research(self, data: str) -> str:
        return await automation.deep_research(data.strip())

    async def _handle_todo(self, data: str) -> str:
        parts = data.split("|", 1)
        action = parts[0].strip()
        task = parts[1].strip() if len(parts) > 1 else ""
        return await automation.manage_todo(action, task)

    async def _handle_notes(self, data: str) -> str:
        parts = data.split("|", 2)
        action = parts[0].strip()
        title = parts[1].strip() if len(parts) > 1 else ""
        content = parts[2].strip() if len(parts) > 2 else ""
        return await automation.manage_notes(action, title, content)

    async def _handle_iot(self, data: str) -> str:
        parts = data.split("|", 2)
        action = parts[0].strip()
        device_id = parts[1].strip() if len(parts) > 1 else ""
        value = parts[2].strip() if len(parts) > 2 else ""
        return await automation.manage_iot(action, device_id, value)

    async def _handle_finance(self, data: str) -> str:
        parts = data.split("|", 1)
        action = parts[0].strip()
        args = parts[1].strip() if len(parts) > 1 else ""
        return await automation.manage_finance(action, args)

    async def _handle_health(self, data: str) -> str:
        parts = data.split("|", 1)
        action = parts[0].strip()
        args = parts[1].strip() if len(parts) > 1 else ""
        return await automation.manage_health(action, args)

    async def _handle_agent(self, data: str) -> str:
        return await automation.run_multi_agent_collaboration(data.strip())

    async def _handle_avatar(self, data: str) -> str:
        return await automation.avatar_control(data.strip())

    async def _handle_robotics(self, data: str) -> str:
        parts = data.split("|", 2)
        device = parts[0].strip()
        action = parts[1].strip() if len(parts) > 1 else ""
        params = parts[2].strip() if len(parts) > 2 else ""
        return await automation.robotics_control(device, action, params)

    async def _handle_compiler(self, data: str) -> str:
        from core.code_explainer import handle_compiler_command
        return await handle_compiler_command(data)

    async def _handle_proactive(self, data: str) -> str:
        return await automation.get_proactive_suggestions()

    async def process_response(self, text: str) -> tuple[str, bool]:
        """
        Parses LLM output for tool execution tags.
        e.g., <CMD>dir</CMD>
        Returns: (Processed output string, Whether a tool was executed)
        """
        executed_any = False
        final_text = text
        
        for tag, func in self.tools.items():
            pattern = f"<{tag}>(.*?)</{tag}>"
            matches = re.finditer(pattern, text, re.DOTALL)
            
            for match in matches:
                executed_any = True
                content = match.group(1).strip()
                logger.info("executing_tool", tool=tag, content=content[:50])
                
                try:
                    from core.security import security_manager
                    security_manager.log_action(tag, content)
                    result = await func(content)
                    # Append result to output log
                    final_text += f"\n\n[System Result: {result}]"
                except Exception as e:
                    logger.error("tool_execution_failed", error=str(e))
                    final_text += f"\n\n[System Error: {str(e)}]"
                    
        return final_text, executed_any

    async def _handle_ppt(self, data: str) -> str:
        parts = data.split("|")
        action = parts[0].strip().lower()
        
        if action == "generate":
            # Format: generate|topic|slide_count|font_key|layout_key|custom_instructions
            topic = parts[1].strip() if len(parts) > 1 else "Technology"
            slide_count = int(parts[2].strip()) if len(parts) > 2 and parts[2].strip().isdigit() else 6
            font_key = parts[3].strip() if len(parts) > 3 and parts[3].strip() else "segoe-ui"
            layout_key = parts[4].strip() if len(parts) > 4 and parts[4].strip() else "neon-dark"
            custom_instructions = parts[5].strip() if len(parts) > 5 else ""
            from core.ppt_generator import generate_ppt
            return await generate_ppt(topic, slide_count, font_key, layout_key, custom_instructions)
        elif action == "restyle":
            # Format: restyle|filePath|font_key|layout_key
            file_path = parts[1].strip() if len(parts) > 1 else ""
            font_key = parts[2].strip() if len(parts) > 2 else "segoe-ui"
            layout_key = parts[3].strip() if len(parts) > 3 else "neon-dark"
            from core.ppt_generator import restyle_ppt
            return await restyle_ppt(file_path, font_key, layout_key)
        elif action == "learn":
            from core.trend_learner import learn_latest_trends
            return await learn_latest_trends()
        elif action == "status":
            from core.trend_learner import get_trend_status
            status = await get_trend_status()
            return f"Trend Intelligence Status: {json.dumps(status, default=str)}"
        elif action == "fonts":
            from core.ppt_generator import get_available_fonts
            return json.dumps(get_available_fonts())
        elif action == "layouts":
            from core.ppt_generator import get_available_layouts
            return json.dumps(get_available_layouts())
        else:
            from core.ppt_generator import generate_ppt
            return await generate_ppt(data)

    async def _handle_analyst(self, data: str) -> str:
        from core.data_analyst import handle_analyst_command
        return await handle_analyst_command(data)

    async def _handle_review(self, data: str) -> str:
        from core.code_reviewer import handle_review_command
        return await handle_review_command(data)

    async def _handle_dash(self, data: str) -> str:
        from core.dashboard_generator import handle_dash_command
        return await handle_dash_command(data)

    async def _handle_debate(self, data: str) -> str:
        from core.debate_arena import handle_debate_command
        return await handle_debate_command(data)

    async def _handle_meeting(self, data: str) -> str:
        from core.meeting_transcript import handle_meeting_command
        return await handle_meeting_command(data)

    async def _handle_workflow(self, data: str) -> str:
        from core.workflow_builder import handle_workflow_command
        return await handle_workflow_command(data)

    async def _handle_knowledge(self, data: str) -> str:
        from core.knowledge_graph import handle_knowledge_command
        return await handle_knowledge_command(data)

    async def _handle_imagen(self, data: str) -> str:
        from core.image_generator import handle_imagen_command
        return await handle_imagen_command(data)

    async def _handle_newsletter(self, data: str) -> str:
        from core.newsletter_composer import handle_newsletter_command
        return await handle_newsletter_command(data)

    async def _handle_predict(self, data: str) -> str:
        from core.trend_predictor import handle_predict_command
        return await handle_predict_command(data)

    async def _handle_weather_lab(self, data: str) -> str:
        from core.weather_station import handle_weather_lab
        return await handle_weather_lab(data)

    async def _handle_stocks(self, data: str) -> str:
        from core.stock_ticker import handle_stocks
        return await handle_stocks(data)

    async def _handle_particles(self, data: str) -> str:
        from core.particle_lab import handle_particles
        return await handle_particles(data)

    async def _handle_agent_forge(self, data: str) -> str:
        from core.agent_framework import handle_agent_forge
        return await handle_agent_forge(data)

    async def _handle_trends(self, data: str) -> str:
        parts = data.split("|", 1)
        action = parts[0].strip().lower()
        
        if action in ["crawl", "learn", "update", "scan"]:
            from core.trend_learner import learn_latest_trends
            return await learn_latest_trends()
        elif action in ["status", "check"]:
            from core.trend_learner import get_trend_status
            status = await get_trend_status()
            return f"Trend Intelligence Status: {json.dumps(status, default=str)}"
        elif action in ["styles", "rules"]:
            from core.trend_learner import get_current_styles
            styles = await get_current_styles()
            return f"Current Design Rules: {json.dumps(styles, default=str)}"
        else:
            # Default to running a full crawl
            from core.trend_learner import learn_latest_trends
            return await learn_latest_trends()

    async def _handle_ppt_merge(self, data: str) -> str:
        parts = data.split("|")
        if len(parts) != 2:
            return "Usage error: <PPT_MERGE>path1|path2</PPT_MERGE>"
        path1, path2 = parts[0].strip(), parts[1].strip()
        from core.ppt_merger import analyze_and_merge_ppts
        out = await analyze_and_merge_ppts(path1, path2)
        if out:
            return f"Successfully merged presentations into: {out}"
        else:
            return "Failed to merge presentations. Ensure both files exist and PowerPoint is available."

    async def _handle_ide(self, data: str) -> str:
        parts = data.split("|", 2)
        action = parts[0].strip().lower() if parts else "status"
        from core.antigravity_ide import antigravity_ide
        if action == "exec":
            cmd = parts[1].strip() if len(parts) > 1 else "dir"
            cwd = parts[2].strip() if len(parts) > 2 else ""
            res = await antigravity_ide.execute_terminal(cmd, cwd)
            return json.dumps(res, default=str)
        elif action == "list":
            path_str = parts[1].strip() if len(parts) > 1 else ""
            res = await antigravity_ide.list_directory(path_str)
            return json.dumps(res, default=str)
        elif action == "read":
            path_str = parts[1].strip() if len(parts) > 1 else ""
            res = await antigravity_ide.read_file(path_str)
            return json.dumps({k: v for k, v in res.items() if k != "content"} | {"snippet": str(res.get("content", ""))[:500]}, default=str)
        elif action == "ai":
            sub_act = parts[1].strip() if len(parts) > 1 else "refactor"
            code_txt = parts[2].strip() if len(parts) > 2 else ""
            res = await antigravity_ide.ai_code_action(sub_act, code_txt, "typescript")
            return res.get("result", "No result")
        else:
            return f"Antigravity IDE Ready. Workspace: {antigravity_ide.workspace}"

# Singleton
tool_registry = ToolRegistry()

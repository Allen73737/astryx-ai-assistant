"""ASTRYX Workflow Builder — Converts natural language into structured, visual workflows.

Takes descriptions like "Every morning, check the weather, read my emails,
summarize my todos, and speak it to me" and generates a structured workflow
with steps, triggers, and actions, plus an HTML visualization.
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import structlog
from datetime import datetime

from core.local_llm_client import lm_client

logger = structlog.get_logger(__name__)


async def build_workflow(description: str) -> str:
    """Convert a natural language workflow description into a structured workflow plan.

    Args:
        description: Natural language description of the workflow

    Returns:
        JSON string with structured workflow data
    """
    logger.info("workflow_build", description=description[:80])

    prompt = (
        f"You are a workflow automation expert. Parse the following workflow description "
        f"into a structured JSON plan.\\n\\n"
        f"DESCRIPTION: '{description}'\\n\\n"
        f"Return ONLY a valid JSON object. No markdown, no backticks.\\n\\n"
        f"The JSON must have:\\n"
        f"- 'title': Short workflow title\\n"
        f"- 'trigger': Object with 'type' (manual/schedule/event), 'schedule' (cron-like string if applicable), "
        f"and 'description'\\n"
        f"- 'steps': Array of step objects, each with:\\n"
        f"    - 'id': Step number (1, 2, 3...)\\n"
        f"    - 'name': Short step name\\n"
        f"    - 'description': What this step does\\n"
        f"    - 'action': The action to perform\\n"
        f"    - 'icon': Emoji representing this step (e.g., ☁️, 📧, 📋, 🔊)\\n"
        f"    - 'dependencies': Array of step IDs that must complete first\\n"
        f"- 'total_steps': Number of steps\\n"
        f"- 'estimated_duration': Estimated time in minutes\\n"
        f"- 'complexity': 'simple', 'moderate', or 'complex'\\n"
        f"- 'suggestions': Array of 2-3 improvement suggestions\\n\\n"
        f"Example steps: check weather, fetch emails, summarize todos, speak summary. "
        f"Be detailed and practical."
    )

    messages = [
        {
            "role": "system",
            "content": "You are a workflow automation architect. You design elegant, practical automation workflows and output ONLY valid JSON.",
        },
        {"role": "user", "content": prompt},
    ]

    try:
        response = await asyncio.wait_for(
            lm_client.chat(messages, max_tokens=4096),
            timeout=120,
        )
        cleaned = re.sub(r"```json|```", "", response).strip()
        workflow = json.loads(cleaned)

        # Ensure required fields
        workflow.setdefault("title", "Custom Workflow")
        workflow.setdefault("steps", [])
        workflow.setdefault("trigger", {"type": "manual", "schedule": "", "description": "Triggered manually"})
        workflow.setdefault("total_steps", len(workflow.get("steps", [])))
        workflow.setdefault("estimated_duration", 5)
        workflow.setdefault("complexity", "moderate")
        workflow.setdefault("suggestions", [])
        workflow["description"] = description

        # Save workflow
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        workflow_dir = os.path.join(base_dir, "data", "workflows")
        os.makedirs(workflow_dir, exist_ok=True)
        safe_name = re.sub(r'[^\\w\\s]', '_', workflow["title"][:30]).strip().lower()
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        file_path = os.path.join(workflow_dir, f"workflow_{safe_name}_{timestamp}.json")

        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(workflow, f, indent=2, default=str)

        workflow["saved_path"] = file_path
        return json.dumps(workflow, default=str)

    except json.JSONDecodeError:
        return json.dumps({
            "title": "Workflow",
            "description": description,
            "steps": [{"id": 1, "name": "Parse description", "description": "Processing workflow steps", "action": "analyze", "icon": "⚙️", "dependencies": []}],
            "trigger": {"type": "manual", "schedule": "", "description": "Manual"},
            "total_steps": 1,
            "estimated_duration": 5,
            "complexity": "simple",
            "error": "Structured parsing failed, showing simplified workflow.",
        })
    except asyncio.TimeoutError:
        return json.dumps({"error": "Workflow generation timed out."})
    except Exception as e:
        logger.error("workflow_build_failed", error=str(e))
        return json.dumps({"error": f"Workflow build failed: {str(e)}"})


async def run_workflow(workflow_id: str) -> str:
    """Execute a saved workflow.

    Args:
        workflow_id: Path or identifier of the saved workflow

    Returns:
        Execution result
    """
    logger.info("workflow_run", id=workflow_id)

    if os.path.exists(workflow_id):
        try:
            with open(workflow_id, "r") as f:
                workflow = json.load(f)
        except Exception as e:
            return json.dumps({"error": f"Failed to load workflow: {str(e)}"})
    else:
        return json.dumps({"error": f"Workflow not found: {workflow_id}"})

    steps = workflow.get("steps", [])
    results = []

    for step in steps:
        name = step.get("name", "Unknown step")
        action = step.get("action", "")
        logger.info("workflow_execute_step", step=name, action=action[:40])
        results.append({
            "step": name,
            "status": "simulated",
            "message": f"Step '{name}' would execute: {action}",
        })
        await asyncio.sleep(0.1)

    return json.dumps({
        "status": "complete",
        "workflow": workflow.get("title", "Workflow"),
        "steps_completed": len(results),
        "results": results,
    })


async def handle_workflow_command(data: str) -> str:
    """Handle the WORKFLOW tool command.

    Format:
        build|description       — Create a workflow from description
        run|workflow_path       — Execute a saved workflow
        list                     — List saved workflows
    """
    parts = data.split("|", 2) if "|" in data else [data]
    action = parts[0].strip().lower()

    if action == "build":
        description = parts[1].strip() if len(parts) > 1 else ""
        if not description:
            return json.dumps({
                "status": "usage",
                "message": "Provide a workflow description. Example: Every morning at 8 AM, check the weather, read my top 3 emails, and summarize my todos.",
            })
        return await build_workflow(description)

    elif action == "run":
        path = parts[1].strip() if len(parts) > 1 else ""
        if not path:
            return json.dumps({"error": "Provide the workflow path to run."})
        return await run_workflow(path)

    elif action == "list":
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        workflow_dir = os.path.join(base_dir, "data", "workflows")
        os.makedirs(workflow_dir, exist_ok=True)
        files = [f for f in os.listdir(workflow_dir) if f.endswith(".json")]
        return json.dumps({
            "workflows": files,
            "count": len(files),
            "directory": workflow_dir,
        })

    else:
        # Default to building
        return await build_workflow(data)

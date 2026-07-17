"""ASTRYX Dashboard Generator — Creates live interactive HTML dashboards.

Takes a natural language description of what data to monitor, generates
a full interactive HTML dashboard with charts, tables, and auto-refresh,
then opens it in the browser.
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import structlog
import subprocess
from datetime import datetime

from core.local_llm_client import lm_client

logger = structlog.get_logger(__name__)


async def generate_dashboard(description: str, refresh_seconds: int = 30) -> str:
    """Generate a live HTML dashboard based on a natural language description.

    Args:
        description: What the dashboard should show (e.g. "System metrics with CPU and RAM charts")
        refresh_seconds: Auto-refresh interval in seconds

    Returns:
        JSON string with dashboard info and path to the HTML file
    """
    logger.info("dashboard_generate", description=description[:80])

    prompt = (
        f"You are a world-class frontend developer specializing in data dashboards. "
        f"Create a complete, standalone HTML file for a live dashboard with the following description:\\n\\n"
        f"'{description}'\\n\\n"
        f"Requirements:\\n"
        f"- Single self-contained HTML file (NO external dependencies — use CDN links)\\n"
        f"- Use Chart.js from CDN for charts\\n"
        f"- Dark theme matching ASTRYX aesthetic (dark background #0a0a0f, accent #00e5ff, secondary #a855f7)\\n"
        f"- Auto-refresh every {refresh_seconds} seconds\\n"
        f"- Include mock/placeholder data that looks realistic\\n"
        f"- Glassmorphism cards for each metric\\n"
        f"- Responsive grid layout\\n"
        f"- Professional, modern design with smooth animations\\n"
        f"- Include: header with title, timestamp, 3-4 KPI cards at top, 2-3 charts below\\n"
        f"- Animated counters for KPI values\\n\\n"
        f"Return ONLY the raw HTML code with ```html tags."
    )

    messages = [
        {
            "role": "system",
            "content": "You are an expert frontend developer who creates stunning, self-contained HTML dashboards. You output ONLY valid HTML code.",
        },
        {"role": "user", "content": prompt},
    ]

    try:
        response = await asyncio.wait_for(
            lm_client.chat(messages, max_tokens=4096),
            timeout=180,
        )

        # Extract HTML
        html_match = re.search(r"```html\s*\n(.*?)```", response, re.DOTALL)
        if html_match:
            html = html_match.group(1).strip()
        else:
            html = re.sub(r"```html|```", "", response).strip()

        if not html or len(html) < 500:
            return json.dumps({"error": "Generated dashboard was too short or empty."})

        # Save to file
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        dashboard_dir = os.path.join(base_dir, "data", "dashboards")
        os.makedirs(dashboard_dir, exist_ok=True)
        safe_name = re.sub(r'[^\\w\\s]', '_', description[:40]).strip().lower()
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        file_path = os.path.join(dashboard_dir, f"dashboard_{safe_name}_{timestamp}.html")

        with open(file_path, "w", encoding="utf-8") as f:
            f.write(html)

        # Open in browser
        try:
            subprocess.Popen(["start", file_path], shell=True)
        except Exception as browser_err:
            logger.warning("browser_open_failed", error=str(browser_err))

        result = {
            "status": "success",
            "path": file_path,
            "description": description,
            "refresh_seconds": refresh_seconds,
            "message": f"Dashboard created and opened in your browser. It auto-refreshes every {refresh_seconds}s.",
        }
        return json.dumps(result, default=str)

    except asyncio.TimeoutError:
        return json.dumps({"error": "Dashboard generation timed out. Try a simpler description."})
    except Exception as e:
        logger.error("dashboard_generation_failed", error=str(e))
        return json.dumps({"error": f"Dashboard generation failed: {str(e)}"})


async def handle_dash_command(data: str) -> str:
    """Handle the DASH tool command.

    Format:
        description|refresh_seconds — Generate dashboard with optional refresh interval
        description — Generate dashboard with default 30s refresh
    """
    parts = data.split("|", 1) if "|" in data else [data]
    description = parts[0].strip()
    refresh = int(parts[1].strip()) if len(parts) > 1 and parts[1].strip().isdigit() else 30

    if not description:
        return json.dumps({
            "status": "usage",
            "message": "Usage: <DASH>description|refresh_seconds</DASH>\nExample: <DASH>System performance dashboard with CPU, RAM, disk, and network charts|15</DASH>",
        })

    refresh = max(5, min(refresh, 300))  # Clamp between 5s and 5min
    return await generate_dashboard(description, refresh)

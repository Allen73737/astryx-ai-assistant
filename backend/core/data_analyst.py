"""ASTRYX Data Analyst — Natural language queries across local databases.

Queries FINANCE, HEALTH, TODO, NOTES, and IOT databases with
natural language, then uses the LLM to generate insights, trends,
and structured data for frontend visualization.
"""

from __future__ import annotations

import asyncio
import json
import os
import sqlite3
import structlog
from datetime import datetime, timedelta

from core.local_llm_client import lm_client

logger = structlog.get_logger(__name__)

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")


def _get_db_path(name: str) -> str:
    return os.path.join(DATA_DIR, f"{name}.db")


# ── Raw Data Fetching ──────────────────────────────────────────────

def _fetch_finance_data() -> dict:
    """Fetch expenses and crypto data."""
    result = {"expenses": [], "crypto": [], "summary": {}}
    db_path = _get_db_path("finance")
    if not os.path.exists(db_path):
        return result

    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()

        # Expenses
        c.execute("SELECT * FROM expenses ORDER BY date DESC LIMIT 50")
        result["expenses"] = [dict(row) for row in c.fetchall()]

        # Category summary
        c.execute("SELECT category, SUM(amount) as total, COUNT(*) as count FROM expenses GROUP BY category ORDER BY total DESC")
        result["summary"]["by_category"] = [dict(row) for row in c.fetchall()]

        # Monthly totals
        c.execute("SELECT strftime('%Y-%m', date) as month, SUM(amount) as total FROM expenses GROUP BY month ORDER BY month DESC LIMIT 12")
        result["summary"]["by_month"] = [dict(row) for row in c.fetchall()]

        # Crypto
        c.execute("SELECT * FROM crypto")
        result["crypto"] = [dict(row) for row in c.fetchall()]

        conn.close()
    except Exception as e:
        logger.error("finance_fetch_error", error=str(e))

    return result


def _fetch_health_data() -> dict:
    """Fetch health data."""
    result = {"workouts": [], "water": [], "medication": [], "summary": {}}
    db_path = _get_db_path("health")
    if not os.path.exists(db_path):
        return result

    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()

        c.execute("SELECT * FROM workouts ORDER BY date DESC LIMIT 30")
        result["workouts"] = [dict(row) for row in c.fetchall()]

        c.execute("SELECT * FROM water ORDER BY date DESC LIMIT 30")
        result["water"] = [dict(row) for row in c.fetchall()]

        c.execute("SELECT * FROM medication ORDER BY date DESC LIMIT 30")
        result["medication"] = [dict(row) for row in c.fetchall()]

        # Weekly summary
        week_ago = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
        c.execute("SELECT SUM(amount) as total_water FROM water WHERE date >= ?", (week_ago,))
        water_total = c.fetchone()
        result["summary"]["water_7d"] = water_total[0] if water_total and water_total[0] else 0

        c.execute("SELECT SUM(calories) as total_cal FROM workouts WHERE date >= ?", (week_ago,))
        cal_total = c.fetchone()
        result["summary"]["calories_7d"] = cal_total[0] if cal_total and cal_total[0] else 0

        c.execute("SELECT COUNT(*) as med_count FROM medication WHERE date >= ?", (week_ago,))
        med_count = c.fetchone()
        result["summary"]["medications_7d"] = med_count[0] if med_count and med_count[0] else 0

        conn.close()
    except Exception as e:
        logger.error("health_fetch_error", error=str(e))

    return result


def _fetch_todo_data() -> dict:
    """Fetch todo list data."""
    result = {"todos": [], "summary": {}}
    db_path = _get_db_path("todo")
    if not os.path.exists(db_path):
        return result

    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()

        c.execute("SELECT * FROM todos ORDER BY created_at DESC")
        result["todos"] = [dict(row) for row in c.fetchall()]

        c.execute("SELECT status, COUNT(*) as count FROM todos GROUP BY status")
        result["summary"]["by_status"] = [dict(row) for row in c.fetchall()]

        total = len(result["todos"])
        completed = sum(1 for t in result["todos"] if t.get("status", "").lower() == "completed")
        result["summary"]["total"] = total
        result["summary"]["completed"] = completed
        result["summary"]["pending"] = total - completed

        conn.close()
    except Exception as e:
        logger.error("todo_fetch_error", error=str(e))

    return result


def _fetch_notes_data() -> dict:
    """Fetch notes data."""
    result = {"notes": []}
    db_path = _get_db_path("notes")
    if not os.path.exists(db_path):
        return result

    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()

        c.execute("SELECT * FROM notes ORDER BY updated_at DESC LIMIT 20")
        result["notes"] = [dict(row) for row in c.fetchall()]

        conn.close()
    except Exception as e:
        logger.error("notes_fetch_error", error=str(e))

    return result


def _fetch_iot_data() -> dict:
    """Fetch IoT device data."""
    result = {"devices": []}
    db_path = _get_db_path("iot")
    if not os.path.exists(db_path):
        return result

    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()

        c.execute("SELECT * FROM iot_devices")
        result["devices"] = [dict(row) for row in c.fetchall()]

        conn.close()
    except Exception as e:
        logger.error("iot_fetch_error", error=str(e))

    return result


# ── LLM Analysis ───────────────────────────────────────────────────

async def _generate_insights(data: dict, question: str = "") -> str:
    """Use LLM to analyze data and generate insights."""
    data_str = json.dumps(data, default=str, indent=2)

    prompt = (
        f"You are a world-class data analyst. Analyze the following personal data and "
        f"provide clear, actionable insights.\n\n"
        f"User's question: {question if question else 'Give me a comprehensive overview of my data'}\n\n"
        f"RAW DATA:\n{data_str}\n\n"
        f"Structure your analysis with:\n"
        f"### Key Metrics\n- Bullet points of the most important numbers\n\n"
        f"### Trends & Patterns\n- Notable trends, changes, or patterns\n\n"
        f"### Actionable Insights\n- Specific recommendations based on the data\n\n"
        f"Be concise, data-driven, and insightful. Use numbers and percentages."
    )

    messages = [
        {
            "role": "system",
            "content": (
                "You are an elite data analyst. You interpret personal data with precision "
                "and provide actionable insights. You always back claims with specific numbers."
            ),
        },
        {"role": "user", "content": prompt},
    ]

    try:
        response = await asyncio.wait_for(
            lm_client.chat(messages, max_tokens=2048),
            timeout=60,
        )
        return response.strip()
    except asyncio.TimeoutError:
        return "**Analysis timed out.** Please try a more specific question."
    except Exception as e:
        logger.error("insights_generation_failed", error=str(e))
        return f"**Error generating insights:** {str(e)}"


async def _generate_chart_suggestions(data: dict) -> list[dict]:
    """Have the LLM suggest what charts to render based on the data."""
    data_str = json.dumps(data, default=str, indent=2)

    prompt = (
        f"Based on this data, suggest 2-3 visual chart types that would best represent the information. "
        f"Return ONLY a JSON array. No markdown, no backticks.\n\n"
        f"DATA:\n{data_str}\n\n"
        f"Each object in the array must have:\n"
        f"- 'type': one of 'bar', 'line', 'pie', 'radar', 'progress'\n"
        f"- 'title': short chart title\n"
        f"- 'labels': array of label strings\n"
        f"- 'datasets': array of objects with 'label' and 'data' (array of numbers)\n"
        f"- 'color': hex color string like '#00e5ff'\n\n"
        f"Example:\n"
        f'[{{"type":"bar","title":"Monthly Spending","labels":["Jan","Feb"],"datasets":[{{"label":"Spent","data":[150,200]}}],"color":"#00e5ff"}}]'
    )

    messages = [
        {
            "role": "system",
            "content": "You are a data visualization expert. You output ONLY valid JSON arrays for charts.",
        },
        {"role": "user", "content": prompt},
    ]

    try:
        response = await asyncio.wait_for(
            lm_client.chat(messages, max_tokens=1024),
            timeout=45,
        )
        import re
        cleaned = re.sub(r"```json|```", "", response).strip()
        charts = json.loads(cleaned)
        if isinstance(charts, list):
            return charts[:3]
    except Exception as e:
        logger.warning("chart_suggestion_failed", error=str(e))

    return []


# ── Public API ─────────────────────────────────────────────────────

async def analyze_data(domain: str = "all", question: str = "") -> str:
    """Analyze personal data and return insights with chart suggestions.

    Args:
        domain: 'finance', 'health', 'todo', 'notes', 'iot', or 'all'
        question: Optional natural language question about the data
    """
    logger.info("data_analyst_analyze", domain=domain, question=question[:60])

    data = {}
    domains_to_fetch = ["finance", "health", "todo", "notes", "iot"] if domain == "all" else [domain]

    for d in domains_to_fetch:
        if d == "finance":
            data["finance"] = _fetch_finance_data()
        elif d == "health":
            data["health"] = _fetch_health_data()
        elif d == "todo":
            data["todo"] = _fetch_todo_data()
        elif d == "notes":
            data["notes"] = _fetch_notes_data()
        elif d == "iot":
            data["iot"] = _fetch_iot_data()

    # Generate insights
    insights = await _generate_insights(data, question)

    # Generate chart suggestions
    charts = await _generate_chart_suggestions(data)

    result = {
        "insights": insights,
        "charts": charts,
        "data": data,
        "domain": domain,
    }

    return json.dumps(result, default=str)


async def handle_analyst_command(data: str) -> str:
    """Handle the ANALYST tool command.

    Formats:
        domain|question  — Analyze a specific domain with a question
        domain           — Get overview of a domain
        all|question     — Analyze all data
    """
    parts = data.split("|", 1) if "|" in data else [data]
    domain = parts[0].strip().lower() if parts[0].strip() else "all"
    question = parts[1].strip() if len(parts) > 1 else ""

    valid_domains = {"all", "finance", "health", "todo", "notes", "iot"}
    if domain not in valid_domains:
        domain = "all"

    return await analyze_data(domain, question)

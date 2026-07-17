"""ASTRYX Newsletter Composer — Creates personalized newsletters and digests.

Compiles news, personal notes, data summaries, and AI insights into
beautiful, structured HTML newsletters with multiple sections, a
personal editor's note, and curated content.
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import structlog
from datetime import datetime

from core.local_llm_client import lm_client
from core.news_engine import curate_news
from core.data_analyst import analyze_data

logger = structlog.get_logger(__name__)


async def compose_newsletter(topic: str = "personal", include_analysis: bool = True) -> str:
    """Compose a personalized HTML newsletter.

    Args:
        topic: Newsletter topic/themes
        include_analysis: Whether to include personal data analysis

    Returns:
        JSON string with newsletter HTML and metadata
    """
    logger.info("newsletter_compose", topic=topic[:40], include_analysis=include_analysis)

    try:
        # Gather content in parallel
        news_task = curate_news(topic)
        analysis_task = analyze_data("all", f"Newsletter summary for topic: {topic}") if include_analysis else None

        # Fetch news
        news_data = await news_task

        # Fetch analysis if requested
        analysis_data = None
        if analysis_task:
            try:
                analysis_result = await analysis_task
                if isinstance(analysis_result, str):
                    try:
                        analysis_data = json.loads(analysis_result)
                    except json.JSONDecodeError:
                        analysis_data = {"insights": analysis_result, "charts": []}
            except Exception as e:
                logger.warning("newsletter_analysis_failed", error=str(e))

        # Extract stories for the newsletter
        stories = []
        if isinstance(news_data, dict):
            categories = news_data.get("categories", {})
            for cat_name, articles in categories.items():
                if isinstance(articles, list):
                    for article in articles:
                        if isinstance(article, dict):
                            stories.append(article)

        # Build newsletter sections
        masthead = news_data.get("masthead", {}) if isinstance(news_data, dict) else {}
        editorial = masthead.get("editorial", "")
        edition_info = masthead.get("edition", f"Vol. I • {datetime.now().strftime('%B %d, %Y')}")

        # Generate newsletter HTML using LLM
        stories_preview = "\n".join([
            f"- {s.get('title', 'Untitled')} — {s.get('source', 'Unknown')} ({s.get('date', '')})"
            for s in stories[:10]
        ])

        analysis_section = ""
        if analysis_data and isinstance(analysis_data, dict):
            insights = analysis_data.get("insights", "")
            analysis_section = f"\\n\\n### Personal Data Insights\\n{insights[:500]}"

        prompt = (
            f"Create a beautiful HTML newsletter. Use the following content:\\n\\n"
            f"EDITORIAL: {editorial}\\n"
            f"EDITION: {edition_info}\\n"
            f"TOPIC: {topic}\\n\\n"
            f"STORIES:\\n{stories_preview}\\n{analysis_section}\\n\\n"
            f"Requirements:\\n"
            f"- Single self-contained HTML file (inline styles only)\\n"
            f"- Dark theme (#0a0a0f background, #00e5ff accent, #a855f7 secondary)\\n"
            f"- Glassmorphism cards for each story\\n"
            f"- Elegant newspaper-style typography (Playfair Display + Inter from Google Fonts)\\n"
            f"- Sections: Header with title/date, Editorial, Top Stories, Analysis, Quick Links\\n"
            f"- Professional, premium look with subtle animations\\n"
            f"- Responsive design\\n"
            f"- Include a 'Written by ASTRYX AI' footer\\n\\n"
            f"Return ONLY the HTML with ```html tags."
        )

        messages = [
            {
                "role": "system",
                "content": "You are a world-class newsletter designer. You create stunning, self-contained HTML newsletters with elegant typography and layout.",
            },
            {"role": "user", "content": prompt},
        ]

        html = ""
        try:
            response = await asyncio.wait_for(
                lm_client.chat(messages, max_tokens=4096),
                timeout=180,
            )
            html_match = re.search(r"```html\s*\n(.*?)```", response, re.DOTALL)
            if html_match:
                html = html_match.group(1).strip()
            else:
                html = re.sub(r"```html|```", "", response).strip()
        except Exception as e:
            logger.warning("newsletter_html_failed", error=str(e))

        if not html or len(html) < 500:
            html = _generate_fallback_newsletter(topic, editorial, stories[:5])

        # Save newsletter
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        newsletter_dir = os.path.join(base_dir, "data", "newsletters")
        os.makedirs(newsletter_dir, exist_ok=True)
        safe_name = re.sub(r'[^\\w\\s]', '_', topic[:30]).strip().lower()
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        file_path = os.path.join(newsletter_dir, f"newsletter_{safe_name}_{timestamp}.html")

        with open(file_path, "w", encoding="utf-8") as f:
            f.write(html)

        # Open in browser
        try:
            import subprocess
            subprocess.Popen(["start", file_path], shell=True)
        except Exception as browser_err:
            logger.warning("browser_open_failed", error=str(browser_err))

        result = {
            "status": "success",
            "path": file_path,
            "topic": topic,
            "stories_count": len(stories),
            "has_analysis": include_analysis,
            "edition": edition_info,
        }
        return json.dumps(result, default=str)

    except Exception as e:
        logger.error("newsletter_compose_failed", error=str(e))
        return json.dumps({"error": f"Newsletter composition failed: {str(e)}"})


def _generate_fallback_newsletter(topic: str, editorial: str, stories: list) -> str:
    """Generate a simple fallback newsletter HTML if LLM generation fails."""
    stories_html = ""
    for s in stories[:5]:
        title = s.get("title", "Story")
        source = s.get("source", "News")
        summary = s.get("summary", "")
        stories_html += f"""
        <div style="background:rgba(255,255,255,0.05);border-radius:12px;padding:20px;margin-bottom:16px;backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.08);">
            <h3 style="color:#e0e0ff;margin:0 0 8px 0;font-family:'Playfair Display',serif;">{title}</h3>
            <p style="color:#888;font-size:12px;margin:0 0 10px 0;font-family:Inter,sans-serif;">{source}</p>
            <p style="color:#ccc;font-size:14px;line-height:1.6;font-family:Inter,sans-serif;">{summary}</p>
        </div>"""

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ASTRYX Newsletter — {topic}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600&family=Playfair+Display:wght@400;700&display=swap" rel="stylesheet">
    <style>
        * {{ margin:0; padding:0; box-sizing:border-box; }}
        body {{ background:#0a0a0f; color:#e0e0ff; font-family:Inter,sans-serif; }}
        .container {{ max-width:720px; margin:0 auto; padding:40px 20px; }}
        .header {{ text-align:center; margin-bottom:40px; }}
        .header h1 {{ font-family:'Playfair Display',serif; font-size:42px; color:#00e5ff; letter-spacing:2px; }}
        .header .edition {{ color:#888; font-size:12px; letter-spacing:3px; text-transform:uppercase; }}
        .editorial {{ background:linear-gradient(135deg,rgba(0,229,255,0.08),rgba(168,85,247,0.08)); border-radius:16px; padding:30px; margin-bottom:30px; border-left:3px solid #00e5ff; }}
        .editorial p {{ font-size:15px; line-height:1.8; color:#ccc; font-style:italic; }}
        .section-title {{ font-family:'Playfair Display',serif; font-size:24px; color:#a855f7; margin:30px 0 20px 0; padding-bottom:8px; border-bottom:1px solid rgba(168,85,247,0.3); }}
        .footer {{ text-align:center; padding:30px; color:#555; font-size:11px; letter-spacing:2px; text-transform:uppercase; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <p class="edition">{datetime.now().strftime('%B %d, %Y')}</p>
            <h1>ASTRYX DAILY</h1>
            <p style="color:#888;font-size:13px;">{topic.upper()} EDITION</p>
        </div>
        <div class="editorial">
            <p>{editorial or 'ASTRYX intelligence systems report stable operations across all monitored channels.'}</p>
        </div>
        <h2 class="section-title">Top Stories</h2>
        {stories_html}
        <div class="footer">
            <p>Curated by ASTRYX Artificial Intelligence</p>
        </div>
    </div>
</body>
</html>"""


async def list_newsletters() -> str:
    """List all previously generated newsletters."""
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    newsletter_dir = os.path.join(base_dir, "data", "newsletters")
    os.makedirs(newsletter_dir, exist_ok=True)

    files = sorted(
        [f for f in os.listdir(newsletter_dir) if f.endswith(".html")],
        reverse=True,
    )
    return json.dumps({
        "newsletters": files,
        "count": len(files),
        "directory": newsletter_dir,
    })


async def handle_newsletter_command(data: str) -> str:
    """Handle the NEWSLETTER tool command.

    Format:
        topic|analyze:true/false  — Compose newsletter with optional analysis
        list                       — List saved newsletters
    """
    parts = data.split("|", 2) if "|" in data else [data]
    action = parts[0].strip().lower()

    if action == "list":
        return await list_newsletters()

    topic = parts[0].strip()
    include_analysis = True

    if len(parts) >= 2:
        opt = parts[1].strip().lower()
        if opt == "false" or opt == "no" or opt == "skip":
            include_analysis = False

    if not topic:
        return json.dumps({
            "status": "usage",
            "message": "Usage: <NEWSLETTER>topic|include_analysis</NEWSLETTER>\n"
                       "Example: <NEWSLETTER>technology and AI|true</NEWSLETTER>",
        })

    return await compose_newsletter(topic, include_analysis)

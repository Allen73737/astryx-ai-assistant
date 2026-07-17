"""ASTRYX Trend Intelligence Engine — Multi-Platform Social Media Trend Aggregator.

Crawls Reddit, YouTube, Twitter/X, Instagram, Threads, Pinterest, Dribbble, Behance,
and general web resources for the latest presentation design trends. Produces structured
style rules (JSON) and a comprehensive Markdown knowledge report auto-indexed into ChromaDB.
"""

import os
import re
import json
import asyncio
import time
from datetime import datetime
from typing import Optional

import structlog

from agents.automation import automation
from core.local_llm_client import lm_client

logger = structlog.get_logger(__name__)

# ── Platform-Specific Query Templates ─────────────────────────────────────────
# Each platform has multiple targeted query variants to maximize signal diversity.

PLATFORM_QUERIES = {
    "reddit": [
        "site:reddit.com/r/presentations modern PowerPoint design trends 2026",
        "site:reddit.com/r/graphic_design best slide deck aesthetics minimalist 2026",
        "site:reddit.com/r/design presentation color palette dark mode glassmorphism",
        "site:reddit.com/r/consulting professional slide layouts McKinsey style 2026",
        "site:reddit.com/r/powerpoint advanced animation transitions templates modern",
    ],
    "youtube": [
        "site:youtube.com PowerPoint presentation design tips modern 2026",
        "site:youtube.com best slide deck design tutorial professional 2026",
        "site:youtube.com Google Slides Keynote modern presentation trends",
        "site:youtube.com corporate pitch deck design dark theme neon minimalist",
        "site:youtube.com PowerPoint animation morph transition tutorial 2026",
    ],
    "twitter_x": [
        "site:twitter.com presentation design trends 2026",
        "site:x.com slide deck design inspiration modern corporate",
        "site:twitter.com PowerPoint aesthetics dark mode neon infographic",
        "site:x.com pitch deck visual storytelling design trends",
    ],
    "instagram": [
        "site:instagram.com modern presentation design slides carousel",
        "site:instagram.com slide deck aesthetics minimalist dark theme",
        "site:instagram.com infographic design trends corporate 2026",
    ],
    "threads": [
        "site:threads.net presentation design trends 2026",
        "site:threads.net slide design visual storytelling modern",
    ],
    "pinterest": [
        "site:pinterest.com modern PowerPoint slide design inspiration dark",
        "site:pinterest.com presentation layout minimalist corporate 2026",
        "site:pinterest.com pitch deck color palette neon glassmorphism",
    ],
    "dribbble_behance": [
        "site:dribbble.com presentation slide deck UI design modern 2026",
        "site:behance.net presentation template dark theme corporate 2026",
        "site:dribbble.com keynote PowerPoint slides layout neon gradient",
    ],
    "design_blogs": [
        "modern presentation slide design best practices 2026",
        "corporate slide deck color theory dark mode gradients 2026",
        "advanced PowerPoint Keynote animation motion design trends",
        "minimalist professional slide layout typography 2026",
        "data visualization infographic slide design inspiration 2026",
        "glassmorphism neumorphism slide deck design trends 2026",
    ],
}

# Maximum concurrent scrape tasks to avoid rate-limiting
MAX_CONCURRENT_SCRAPES = 6

# Retry configuration
MAX_RETRIES_PER_QUERY = 2
RETRY_DELAY_SECONDS = 1.5


async def _scrape_single_query(query: str, semaphore: asyncio.Semaphore) -> Optional[str]:
    """Scrape a single search query with concurrency limiting and retry logic."""
    async with semaphore:
        for attempt in range(MAX_RETRIES_PER_QUERY):
            try:
                logger.info("trend_scrape_query", query=query[:80], attempt=attempt + 1)
                result = await automation.search_web(query)
                if result and "Search failed" not in result and "No search results found" not in result:
                    return f"--- QUERY: {query} ---\n{result}\n"
                # If empty result, try once more after delay
                if attempt < MAX_RETRIES_PER_QUERY - 1:
                    await asyncio.sleep(RETRY_DELAY_SECONDS)
            except Exception as e:
                logger.warning("trend_scrape_query_failed", query=query[:60], error=str(e), attempt=attempt + 1)
                if attempt < MAX_RETRIES_PER_QUERY - 1:
                    await asyncio.sleep(RETRY_DELAY_SECONDS)
    return None


async def _scrape_platform(platform: str, queries: list[str], semaphore: asyncio.Semaphore) -> dict:
    """Scrape all queries for a single platform in parallel."""
    logger.info("trend_scraping_platform", platform=platform, query_count=len(queries))
    tasks = [_scrape_single_query(q, semaphore) for q in queries]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    valid_results = []
    for r in results:
        if isinstance(r, str) and r:
            valid_results.append(r)

    return {
        "platform": platform,
        "results": valid_results,
        "query_count": len(queries),
        "success_count": len(valid_results),
    }


async def learn_latest_trends() -> str:
    """
    Multi-platform social media trend intelligence engine.

    Crawls Reddit, YouTube, Twitter/X, Instagram, Threads, Pinterest,
    Dribbble, Behance, and design blogs for the latest presentation design
    trends. Analyzes results with LLM to produce structured style rules and
    a comprehensive knowledge report.
    """
    start_time = time.time()
    logger.info("trend_intelligence_engine_starting", platforms=list(PLATFORM_QUERIES.keys()))

    # ── Phase 1: Parallel Multi-Platform Scraping ─────────────────────────────
    semaphore = asyncio.Semaphore(MAX_CONCURRENT_SCRAPES)
    platform_tasks = [
        _scrape_platform(platform, queries, semaphore)
        for platform, queries in PLATFORM_QUERIES.items()
    ]
    platform_results = await asyncio.gather(*platform_tasks, return_exceptions=True)

    # Aggregate all scraped content by platform
    all_scraped = []
    platform_stats = {}
    total_hits = 0

    for result in platform_results:
        if isinstance(result, dict):
            platform_stats[result["platform"]] = {
                "queries": result["query_count"],
                "hits": result["success_count"],
            }
            total_hits += result["success_count"]
            for content_block in result["results"]:
                all_scraped.append(content_block)
        elif isinstance(result, Exception):
            logger.warning("platform_scrape_exception", error=str(result))

    scrape_duration = time.time() - start_time
    logger.info(
        "trend_scraping_complete",
        total_hits=total_hits,
        platforms_scraped=len(platform_stats),
        duration_seconds=round(scrape_duration, 2),
    )

    if not all_scraped:
        return (
            "Trend Intelligence Engine: Failed to fetch trend data from any platform. "
            "Network connectivity or search API may be unavailable. "
            "PowerPoint styling remains on current defaults."
        )

    # ── Phase 2: LLM-Powered Trend Analysis ───────────────────────────────────
    # Combine scraped content, truncating to avoid token overflow
    combined_scrape = "\n".join(all_scraped)
    # Limit to approximately 12000 chars to stay within LLM context window
    if len(combined_scrape) > 12000:
        combined_scrape = combined_scrape[:12000] + "\n\n[... additional results truncated for analysis ...]"

    analysis_prompt = (
        "You are an elite design trend research analyst working for a premium AI assistant called ASTRYX. "
        "Below is scraped web search data from multiple social media and design platforms showing what "
        "presentation designers, content creators, and visual storytellers across YouTube, Instagram, Reddit, "
        "Twitter/X, Threads, Pinterest, Dribbble, and Behance are recommending for high-end modern slide decks.\n\n"
        f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M')}\n"
        f"Platforms Scraped: {', '.join(platform_stats.keys())}\n"
        f"Total Data Points: {total_hits}\n\n"
        f"{combined_scrape}\n\n"
        "TASKS:\n"
        "1. Extract the current dominant style trends across all platforms:\n"
        "   - Color palettes (primary, accent, background) with specific hex codes\n"
        "   - Typography recommendations (title and body fonts)\n"
        "   - Layout paradigms (split-screen, asymmetric, hero-image, etc.)\n"
        "   - Transition and animation trends (morph, fade, zoom, etc.)\n"
        "   - Visual accent techniques (gradients, glassmorphism, 3D elements, particles)\n"
        "   - Data visualization and infographic styles\n\n"
        "2. Define a structured JSON style config block. The JSON MUST contain exactly:\n"
        "   - 'font_title': Modern font for headings (e.g., 'Segoe UI', 'Poppins', 'Montserrat')\n"
        "   - 'font_body': Clean font for body text (e.g., 'Inter', 'Calibri', 'DM Sans')\n"
        "   - 'color_background': Primary slide background hex (e.g., '#0a0e1a')\n"
        "   - 'color_accent': Vibrant accent/highlight hex (e.g., '#00e5ff' or '#6366f1')\n"
        "   - 'color_secondary': Secondary accent hex (e.g., '#ff3366' or '#10b981')\n"
        "   - 'color_text': Primary text color hex (e.g., '#e0e0e0')\n"
        "   - 'gradient_start': Gradient start hex for accent backgrounds\n"
        "   - 'gradient_end': Gradient end hex for accent backgrounds\n"
        "   - 'layout_preference': One of 'dark-tech', 'minimalist', 'neon-bold', 'glassmorphic', 'editorial'\n"
        "   - 'transition_style': One of 'morph', 'fade-smooth', 'push', 'reveal', 'zoom'\n"
        "   - 'visual_accent': One of 'gradient-mesh', 'glassmorphism', 'neon-glow', 'particle-field', 'geometric'\n"
        "   - 'source_platforms': List of platforms that contributed to these trends\n"
        "   - 'trend_confidence': Float 0.0-1.0 indicating how confident you are in these trends\n"
        "   - 'last_updated': Current ISO timestamp\n\n"
        "3. Write a comprehensive, professionally formatted Markdown trend report that includes:\n"
        "   - Executive summary of the current state of presentation design\n"
        "   - Platform-by-platform breakdown of what each community is recommending\n"
        "   - Emerging micro-trends that are gaining traction\n"
        "   - Anti-patterns and outdated styles to avoid\n"
        "   - Actionable recommendations for creating cutting-edge slide decks\n\n"
        "OUTPUT FORMAT:\n"
        "Return the JSON block FIRST inside <STYLE_JSON>...</STYLE_JSON> tags.\n"
        "Return the Markdown report SECOND inside <REPORT_MD>...</REPORT_MD> tags.\n"
        "Do not write any conversational filler text outside these tags."
    )

    messages = [
        {
            "role": "system",
            "content": (
                "You are a professional design research analyst for ASTRYX, a premium AI assistant. "
                "You output precise, well-structured JSON and Markdown documents based on real data. "
                "Your style rules should reflect the absolute cutting edge of presentation design. "
                "Be specific with hex codes, font names, and layout strategies."
            ),
        },
        {"role": "user", "content": analysis_prompt},
    ]

    try:
        response = await lm_client.chat(messages, max_tokens=4000)

        # ── Phase 3: Parse Style JSON ─────────────────────────────────────────
        json_match = re.search(r"<STYLE_JSON>([\s\S]*?)</STYLE_JSON>", response)
        style_rules = None
        if json_match:
            try:
                raw_json = json_match.group(1).strip()
                # Strip markdown code fences if the LLM wrapped it
                raw_json = re.sub(r"^```(?:json)?\s*", "", raw_json)
                raw_json = re.sub(r"\s*```$", "", raw_json)
                style_rules = json.loads(raw_json)
            except Exception as je:
                logger.warning("trend_json_parsing_failed", error=str(je))

        if not style_rules:
            # Intelligent fallback defaults based on 2026 design trends
            style_rules = {
                "font_title": "Segoe UI",
                "font_body": "Segoe UI",
                "color_background": "#060b16",
                "color_accent": "#00e5ff",
                "color_secondary": "#6366f1",
                "color_text": "#e8eaed",
                "gradient_start": "#0ea5e9",
                "gradient_end": "#6366f1",
                "layout_preference": "dark-tech",
                "transition_style": "fade-smooth",
                "visual_accent": "gradient-mesh",
                "source_platforms": list(platform_stats.keys()),
                "trend_confidence": 0.6,
                "last_updated": datetime.now().isoformat(),
            }

        # Inject metadata into style rules
        style_rules["source_platforms"] = style_rules.get("source_platforms", list(platform_stats.keys()))
        style_rules["last_updated"] = datetime.now().isoformat()
        style_rules["scrape_stats"] = platform_stats

        # ── Phase 4: Save Structured Style Rules ──────────────────────────────
        os.makedirs("data", exist_ok=True)
        style_path = "data/ppt_styles.json"
        with open(style_path, "w", encoding="utf-8") as f:
            json.dump(style_rules, f, indent=4, default=str)
        logger.info("saved_ppt_styles", path=style_path, rules=style_rules)

        # ── Phase 5: Parse and Save Trend Report ──────────────────────────────
        md_match = re.search(r"<REPORT_MD>([\s\S]*?)</REPORT_MD>", response)
        report_md = md_match.group(1).strip() if md_match else response

        # Add metadata header to the report
        report_header = (
            f"# ASTRYX Trend Intelligence Report\n"
            f"**Generated**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
            f"**Platforms Analyzed**: {', '.join(platform_stats.keys())}\n"
            f"**Total Data Points**: {total_hits}\n"
            f"**Scrape Duration**: {round(scrape_duration, 1)}s\n\n---\n\n"
        )
        full_report = report_header + report_md

        # Save to knowledge base (auto-indexed by watchdog into ChromaDB)
        os.makedirs("knowledge_base", exist_ok=True)
        report_path = "knowledge_base/presentation_trends.txt"
        with open(report_path, "w", encoding="utf-8") as f:
            f.write(full_report)
        logger.info("saved_trend_report", path=report_path)

        # Also save a timestamped archive copy for historical tracking
        archive_dir = "data/trend_archives"
        os.makedirs(archive_dir, exist_ok=True)
        archive_filename = f"trends_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        archive_data = {
            "style_rules": style_rules,
            "platform_stats": platform_stats,
            "total_hits": total_hits,
            "scrape_duration_seconds": round(scrape_duration, 2),
            "timestamp": datetime.now().isoformat(),
            "report_preview": report_md[:500],
        }
        with open(os.path.join(archive_dir, archive_filename), "w", encoding="utf-8") as f:
            json.dump(archive_data, f, indent=2, default=str)
        logger.info("saved_trend_archive", filename=archive_filename)

        # ── Build Summary ─────────────────────────────────────────────────────
        total_duration = round(time.time() - start_time, 1)
        platform_summary = ", ".join(
            f"{p} ({s['hits']}/{s['queries']})"
            for p, s in platform_stats.items()
        )

        summary = (
            f"Trend Intelligence Engine completed in {total_duration}s.\n"
            f"Platforms crawled: {platform_summary}\n"
            f"Style rules updated: layout={style_rules.get('layout_preference')}, "
            f"accent={style_rules.get('color_accent')}, "
            f"transition={style_rules.get('transition_style')}, "
            f"visual={style_rules.get('visual_accent')}\n"
            f"Knowledge base report saved and indexed into ChromaDB vector memory."
        )

        logger.info("trend_intelligence_complete", duration=total_duration, summary=summary[:200])
        return summary

    except Exception as e:
        logger.error("trend_intelligence_failed", error=str(e))
        return f"Trend Intelligence Engine failed: {str(e)}"


async def get_trend_status() -> dict:
    """Return the current trend data status and last update time."""
    style_path = "data/ppt_styles.json"
    if os.path.exists(style_path):
        try:
            with open(style_path, "r", encoding="utf-8") as f:
                styles = json.load(f)
            return {
                "status": "loaded",
                "last_updated": styles.get("last_updated", "unknown"),
                "layout": styles.get("layout_preference", "unknown"),
                "accent": styles.get("color_accent", "#00e5ff"),
                "confidence": styles.get("trend_confidence", 0.0),
                "platforms": styles.get("source_platforms", []),
            }
        except Exception:
            pass
    return {"status": "no_data", "last_updated": None}


async def get_current_styles() -> dict:
    """Load and return the current PPT style rules, or defaults if none exist."""
    style_path = "data/ppt_styles.json"
    if os.path.exists(style_path):
        try:
            with open(style_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass

    # Return sensible defaults
    return {
        "font_title": "Segoe UI",
        "font_body": "Segoe UI",
        "color_background": "#060b16",
        "color_accent": "#00e5ff",
        "color_secondary": "#6366f1",
        "color_text": "#e8eaed",
        "gradient_start": "#0ea5e9",
        "gradient_end": "#6366f1",
        "layout_preference": "dark-tech",
        "transition_style": "fade-smooth",
        "visual_accent": "gradient-mesh",
    }

"""PowerPoint Generation Core — Ultra Premium Desktop Automation via COM.

Pipeline:
1. Silently fetches data and images in the background (invisible to user).
2. Launches Microsoft PowerPoint on the desktop with intelligent fallback.
3. Builds every slide LIVE so the user watches each element appear in real-time.
4. Runs a slideshow preview for the user to review before saving manually.
"""

import os
import re
import random
import logging
import json
import time
import glob
import subprocess
import httpx
import urllib.parse
import structlog
import win32com.client
import win32gui
import win32con
import pythoncom
import threading
import asyncio
from datetime import datetime

from core.local_llm_client import lm_client
from config import settings

logger = structlog.get_logger(__name__)

# ═══════════════════════════════════════════════
# Design System Constants
# ═══════════════════════════════════════════════

TRENDY_FONTS = {
    "segoe-ui":       {"title": "Segoe UI",         "body": "Segoe UI"},
    "inter":          {"title": "Inter",             "body": "Inter"},
    "poppins":        {"title": "Poppins",           "body": "Poppins"},
    "montserrat":     {"title": "Montserrat",        "body": "Montserrat"},
    "raleway":        {"title": "Raleway",           "body": "Raleway"},
    "playfair":       {"title": "Playfair Display",  "body": "Lato"},
    "roboto":         {"title": "Roboto",            "body": "Roboto"},
    "oswald":         {"title": "Oswald",            "body": "Open Sans"},
    "bebas-garamond": {"title": "Bebas Neue",        "body": "EB Garamond"},
    "outfit":         {"title": "Outfit",            "body": "Outfit"},
    "impact-modern":  {"title": "Impact",            "body": "Arial"},
    "georgia-elegant":{"title": "Georgia",           "body": "Palatino Linotype"},
    "trebuchet-clean":{"title": "Trebuchet MS",      "body": "Century Gothic"},
    "arial-black":    {"title": "Arial Black",       "body": "Calibri"},
}

LAYOUT_STYLES = {
    "neon-dark": {
        "label": "Neon Dark",
        "bg": "#060b16", "accent": "#00e5ff", "secondary": "#6366f1",
        "text": "#e8eaed", "grad_start": "#060b16", "grad_end": "#0d1a30",
    },
    "midnight-purple": {
        "label": "Midnight Purple",
        "bg": "#0b0014", "accent": "#a855f7", "secondary": "#ec4899",
        "text": "#f0e6ff", "grad_start": "#0b0014", "grad_end": "#1a0040",
    },
    "arctic-frost": {
        "label": "Arctic Frost",
        "bg": "#0a1628", "accent": "#38bdf8", "secondary": "#67e8f9",
        "text": "#e0f2fe", "grad_start": "#0a1628", "grad_end": "#0c2342",
    },
    "ember-gold": {
        "label": "Ember Gold",
        "bg": "#140c00", "accent": "#f59e0b", "secondary": "#ef4444",
        "text": "#fef3c7", "grad_start": "#140c00", "grad_end": "#2d1a00",
    },
    "emerald-depth": {
        "label": "Emerald Depth",
        "bg": "#001a0e", "accent": "#10b981", "secondary": "#34d399",
        "text": "#d1fae5", "grad_start": "#001a0e", "grad_end": "#003320",
    },
    "coral-sunset": {
        "label": "Coral Sunset",
        "bg": "#1a0a0a", "accent": "#fb7185", "secondary": "#fda4af",
        "text": "#ffe4e6", "grad_start": "#1a0a0a", "grad_end": "#2d1218",
    },
    "clean-white": {
        "label": "Clean White",
        "bg": "#f8fafc", "accent": "#1e40af", "secondary": "#3b82f6",
        "text": "#1e293b", "grad_start": "#f8fafc", "grad_end": "#e2e8f0",
    },
    "graphite-steel": {
        "label": "Graphite Steel",
        "bg": "#111827", "accent": "#9ca3af", "secondary": "#6b7280",
        "text": "#d1d5db", "grad_start": "#111827", "grad_end": "#1f2937",
    },
    "rose-elegance": {
        "label": "Rose Elegance",
        "bg": "#1a0012", "accent": "#f472b6", "secondary": "#e879f9",
        "text": "#fce7f3", "grad_start": "#1a0012", "grad_end": "#2d0024",
    },
    "ocean-breeze": {
        "label": "Ocean Breeze",
        "bg": "#001220", "accent": "#06b6d4", "secondary": "#0891b2",
        "text": "#cffafe", "grad_start": "#001220", "grad_end": "#002438",
    },
    # ── New Ultra-Premium Themes ──
    "crystal-clear": {
        "label": "Crystal Clear",
        "bg": "#f0f4ff", "accent": "#4f46e5", "secondary": "#7c3aed",
        "text": "#1e1b4b", "grad_start": "#eef2ff", "grad_end": "#e0e7ff",
    },
    "royal-velvet": {
        "label": "Royal Velvet",
        "bg": "#0f0520", "accent": "#d4af37", "secondary": "#a855f7",
        "text": "#faf5ff", "grad_start": "#0f0520", "grad_end": "#1a0a30",
    },
    "neon-cyber": {
        "label": "Neon Cyber",
        "bg": "#0a0a0f", "accent": "#ff00ff", "secondary": "#00ffff",
        "text": "#f0f0ff", "grad_start": "#0a0a0f", "grad_end": "#1a0a2e",
    },
    "forest-canopy": {
        "label": "Forest Canopy",
        "bg": "#061a0e", "accent": "#4ade80", "secondary": "#fbbf24",
        "text": "#ecfdf5", "grad_start": "#061a0e", "grad_end": "#0a2a18",
    },
    "sunset-blaze": {
        "label": "Sunset Blaze",
        "bg": "#1a0600", "accent": "#ff6b35", "secondary": "#f72585",
        "text": "#fff5f0", "grad_start": "#1a0600", "grad_end": "#2d0a04",
    },
    # ── Ultra-Diverse Glass & Matte Styles ──
    "glass-ocean": {
        "label": "Glass Ocean",
        "bg": "#0f172a", "accent": "#0ea5e9", "secondary": "#38bdf8",
        "text": "#f8fafc", "grad_start": "#0f172a", "grad_end": "#1e293b",
        "style_mode": "glass"
    },
    "glass-ruby": {
        "label": "Glass Ruby",
        "bg": "#2a0f15", "accent": "#e11d48", "secondary": "#fb7185",
        "text": "#fff1f2", "grad_start": "#2a0f15", "grad_end": "#4c1d2e",
        "style_mode": "glass"
    },
    "glass-emerald": {
        "label": "Glass Emerald",
        "bg": "#062a1a", "accent": "#10b981", "secondary": "#34d399",
        "text": "#ecfdf5", "grad_start": "#062a1a", "grad_end": "#0a452a",
        "style_mode": "glass"
    },
    "glass-amethyst": {
        "label": "Glass Amethyst",
        "bg": "#1e1335", "accent": "#8b5cf6", "secondary": "#a78bfa",
        "text": "#f5f3ff", "grad_start": "#1e1335", "grad_end": "#322055",
        "style_mode": "glass"
    },
    "matte-charcoal": {
        "label": "Matte Charcoal",
        "bg": "#121212", "accent": "#e5e5e5", "secondary": "#a3a3a3",
        "text": "#ffffff", "grad_start": "#121212", "grad_end": "#1f1f1f",
        "style_mode": "matte"
    },
    "matte-cream": {
        "label": "Matte Cream",
        "bg": "#faf9f6", "accent": "#1c1917", "secondary": "#44403c",
        "text": "#0c0a09", "grad_start": "#faf9f6", "grad_end": "#f5f5f4",
        "style_mode": "matte"
    },
    "holographic-pearl": {
        "label": "Holographic Pearl",
        "bg": "#fdfcff", "accent": "#ff9ecd", "secondary": "#8debf5",
        "text": "#1a1625", "grad_start": "#fdfcff", "grad_end": "#f3efff",
        "style_mode": "glass"
    },
    "cyber-punk": {
        "label": "Cyber Punk",
        "bg": "#0a0a0f", "accent": "#fde047", "secondary": "#06b6d4",
        "text": "#ffffff", "grad_start": "#0a0a0f", "grad_end": "#1c1917",
        "style_mode": "matte"
    },
    "neo-brutalism": {
        "label": "Neo Brutalism",
        "bg": "#ffffff", "accent": "#ef4444", "secondary": "#3b82f6",
        "text": "#000000", "grad_start": "#ffffff", "grad_end": "#f3f4f6",
        "style_mode": "matte"
    },
    "luxury-gold": {
        "label": "Luxury Gold",
        "bg": "#050505", "accent": "#d4af37", "secondary": "#bf953f",
        "text": "#ffffff", "grad_start": "#050505", "grad_end": "#171717",
        "style_mode": "glass"
    },
    # ── Ultra-Advanced Morphisms ──
    "claymorphism": {
        "label": "Claymorphism",
        "bg": "#f3f4f6", "accent": "#f472b6", "secondary": "#38bdf8",
        "text": "#1f2937", "grad_start": "#f3f4f6", "grad_end": "#e5e7eb",
        "style_mode": "clay"
    },
    "neumorphism": {
        "label": "Neumorphism",
        "bg": "#e0e5ec", "accent": "#3b82f6", "secondary": "#8b5cf6",
        "text": "#374151", "grad_start": "#e0e5ec", "grad_end": "#e0e5ec",
        "style_mode": "neu"
    },
    "bauhaus": {
        "label": "Bauhaus",
        "bg": "#facc15", "accent": "#ef4444", "secondary": "#2563eb",
        "text": "#000000", "grad_start": "#facc15", "grad_end": "#facc15",
        "style_mode": "bauhaus"
    },
    "aurora-mesh": {
        "label": "Aurora Mesh",
        "bg": "#0f172a", "accent": "#c084fc", "secondary": "#38bdf8",
        "text": "#f8fafc", "grad_start": "#0f172a", "grad_end": "#312e81",
        "style_mode": "aurora"
    },
    "memphis": {
        "label": "Memphis Design",
        "bg": "#fbcfe8", "accent": "#34d399", "secondary": "#fbbf24",
        "text": "#111827", "grad_start": "#fbcfe8", "grad_end": "#fce7f3",
        "style_mode": "memphis"
    },
    "glitch-cyber": {
        "label": "Glitch Cyberpunk",
        "bg": "#000000", "accent": "#00ffff", "secondary": "#ff00ff",
        "text": "#ffffff", "grad_start": "#000000", "grad_end": "#1a1a1a",
        "style_mode": "glitch"
    },
    "dark-academia": {
        "label": "Dark Academia",
        "bg": "#27272a", "accent": "#d4af37", "secondary": "#78716c",
        "text": "#f5f5f4", "grad_start": "#27272a", "grad_end": "#1c1917",
        "style_mode": "academia"
    },
    "y2k-retro": {
        "label": "Y2K Retro",
        "bg": "#fdf4ff", "accent": "#d946ef", "secondary": "#0ea5e9",
        "text": "#4a044e", "grad_start": "#fdf4ff", "grad_end": "#fce7f3",
        "style_mode": "y2k"
    },
    "minimalist-editorial": {
        "label": "Minimalist Editorial",
        "bg": "#ffffff", "accent": "#000000", "secondary": "#525252",
        "text": "#000000", "grad_start": "#ffffff", "grad_end": "#fafafa",
        "style_mode": "minimalist"
    },
    "holo-glass": {
        "label": "Holographic Glass",
        "bg": "#eef2ff", "accent": "#818cf8", "secondary": "#c084fc",
        "text": "#1e1b4b", "grad_start": "#eef2ff", "grad_end": "#f3e8ff",
        "style_mode": "holo"
    },
    "quantum-flux": {
        "label": "Quantum Flux",
        "bg": "#02161a", "accent": "#00f5d4", "secondary": "#d90429",
        "text": "#e0fbf7", "grad_start": "#02161a", "grad_end": "#05343c",
        "style_mode": "glass"
    },
    "cyber-hologram": {
        "label": "Cyber Hologram",
        "bg": "#05051e", "accent": "#bd00ff", "secondary": "#00ffcc",
        "text": "#f5e6ff", "grad_start": "#05051e", "grad_end": "#10103a",
        "style_mode": "glass"
    },
    "liquid-amber": {
        "label": "Liquid Amber",
        "bg": "#120800", "accent": "#ff9f1c", "secondary": "#ffd166",
        "text": "#fffcf5", "grad_start": "#120800", "grad_end": "#291500",
        "style_mode": "matte"
    },
    "stealth-obsidian": {
        "label": "Stealth Obsidian",
        "bg": "#050505", "accent": "#ff003c", "secondary": "#404040",
        "text": "#ffe6eb", "grad_start": "#050505", "grad_end": "#151515",
        "style_mode": "matte"
    },
    "monochrome-editorial": {
        "label": "Monochrome Editorial",
        "bg": "#ffffff", "accent": "#1a1a1a", "secondary": "#e5e5e5",
        "text": "#1a1a1a", "grad_start": "#ffffff", "grad_end": "#f5f5f5",
        "style_mode": "minimalist"
    },
}


# ═══════════════════════════════════════════════
# Phase 1 — Silent Data Preparation
# ═══════════════════════════════════════════════

UNSPLASH_API_BASE = "https://api.unsplash.com"

# Maximum number of API search calls allowed per batch
# After this threshold, we skip the official API entirely and rely on cache/html/picsum
MAX_API_CALLS_PER_SESSION = 5


async def _download_to_file(url: str, path: str, headers: dict, timeout: int = 15) -> bool:
    """Download a URL to a file. Returns True on success (>5KB)."""
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=timeout) as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code == 200 and len(resp.content) > 5000:
                with open(path, "wb") as f:
                    f.write(resp.content)
                return True
    except Exception:
        pass
    return False


async def download_unsplash_image(keyword: str) -> str:
    """Search Unsplash for keyword, download the first image, and return its local path.

    Strategy order (optimized to avoid API rate limits):
    1. File cache (already downloaded this session)
    2. Persistent SQLite cache + pre-seeded photo IDs → direct CDN URL (zero API cost)
    3. HTML scrape unsplash.com directly (no API key needed, no rate limit)
    4. source.unsplash.com URL pattern (deprecated but still works)
    5. Official API search (only if rate-limit budget allows, max 5 per batch)
    6. picsum.photos (unlimited fallback)
    """
    from core.unsplash_cache import unsplash_cache

    # Use consistent paths relative to backend directory
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    temp_dir = os.path.join(base_dir, "data", "temp_images")
    os.makedirs(temp_dir, exist_ok=True)
    safe_name = re.sub(r'[^\w\-]', '_', keyword.lower())
    temp_path = os.path.join(temp_dir, f"{safe_name}.jpg")

    # ── Strategy 0: File cache — already downloaded ──
    if os.path.exists(temp_path) and os.path.getsize(temp_path) > 5000:
        logger.debug("unsplash_file_cache_hit", keyword=keyword)
        return temp_path

    generic_headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
    }
    dload_headers = {
        **generic_headers,
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "Referer": "https://unsplash.com/",
    }

    # ── Strategy 1: SQLite cache + pre-seeded photo IDs (zero API cost) ──
    cached_url = unsplash_cache.get_cached(keyword)
    if cached_url:
        logger.debug("unsplash_cache_hit", keyword=keyword)
        success = await _download_to_file(cached_url, temp_path, dload_headers)
        if success:
            logger.info("unsplash_cache_success", keyword=keyword)
            return temp_path
        else:
            logger.warning("unsplash_cache_url_failed", keyword=keyword)

    # ── Strategy 2: HTML scrape unsplash.com (no API key, no rate limit) ──
    try:
        search_url = f"https://unsplash.com/s/photos/{urllib.parse.quote(keyword)}"
        async with httpx.AsyncClient(follow_redirects=True, timeout=12) as client:
            resp = await client.get(search_url, headers=generic_headers)
            if resp.status_code == 200:
                matches = re.findall(
                    r'https://images\.unsplash\.com/photo-[a-zA-Z0-9\-\?\&=\.\/]+',
                    resp.text
                )
                if matches:
                    # Extract photo ID from first match
                    first_url = matches[0]
                    photo_id_match = re.search(r'photo-([a-zA-Z0-9\-]+)', first_url)
                    photo_id = photo_id_match.group(1) if photo_id_match else ""
                    base_url = first_url.split("?")[0]

                    for w in [1920, 1280, 1080, 800]:
                        download_url = f"{base_url}?auto=format&fit=crop&w={w}&q=85"
                        success = await _download_to_file(download_url, temp_path, dload_headers, timeout=15)
                        if success:
                            # Store in cache for future use (zero API cost next time)
                            if photo_id:
                                unsplash_cache.store(keyword, photo_id)
                            logger.info("unsplash_html_scrape_success", keyword=keyword)
                            return temp_path
    except Exception as e:
        logger.warning("unsplash_html_scrape_failed", keyword=keyword, error=str(e))

    # ── Strategy 3: source.unsplash.com (deprecated redirect, but often works) ──
    try:
        search_query = urllib.parse.quote(keyword)
        source_url = f"https://source.unsplash.com/1280x720/?{search_query}"
        success = await _download_to_file(source_url, temp_path, dload_headers, timeout=15)
        if success:
            logger.info("unsplash_source_success", keyword=keyword)
            return temp_path
    except Exception as e:
        logger.warning("unsplash_source_failed", keyword=keyword, error=str(e))

    # ── Strategy 4: Official API search (only if rate-limit budget allows) ──
    if unsplash_cache.can_use_api and unsplash_cache.calls_this_session < MAX_API_CALLS_PER_SESSION:
        api_headers = {
            "Authorization": f"Client-ID {settings.UNSPLASH_ACCESS_KEY}",
            "Accept-Version": "v1",
        }
        try:
            search_query = urllib.parse.quote(keyword)
            api_url = f"{UNSPLASH_API_BASE}/search/photos?query={search_query}&per_page=3&orientation=landscape"
            async with httpx.AsyncClient(follow_redirects=True, timeout=10) as client:
                resp = await client.get(api_url, headers=api_headers)

                # Track rate limits from response headers
                remaining = resp.headers.get("X-Ratelimit-Remaining")
                limit_val = resp.headers.get("X-Ratelimit-Limit")
                unsplash_cache.update_rate_limit(
                    int(remaining) if remaining else None,
                    int(limit_val) if limit_val else None,
                )

                if resp.status_code == 200:
                    data = resp.json()
                    results = data.get("results", [])
                    if results:
                        photo = results[0]
                        # Extract photo ID for caching
                        photo_id = photo.get("id", "")

                        for size_key in ["raw", "full", "regular"]:
                            img_url = photo.get("urls", {}).get(size_key)
                            if img_url:
                                success = await _download_to_file(img_url, temp_path, dload_headers, timeout=15)
                                if success:
                                    if photo_id:
                                        unsplash_cache.store(keyword, photo_id)
                                    logger.info("unsplash_api_success", keyword=keyword, size_key=size_key)
                                    return temp_path
        except Exception as e:
            logger.warning("unsplash_api_failed", keyword=keyword, error=str(e))
    else:
        logger.info(
            "unsplash_api_skipped_rate_limit",
            keyword=keyword,
            remaining=unsplash_cache.remaining,
            calls_this_session=unsplash_cache.calls_this_session,
        )

    # ── Strategy 5: Pexels API (free, 200 req/hr, relevant results, no watermarks) ──
    try:
        pexels_key = "j5dmASAvZiOdcqMnPdigSr7AAfGMdB6OGrFEYwsmCXZGq9fOGwZpVbH2"
        pexels_headers = {
            "Authorization": pexels_key,
            "User-Agent": generic_headers["User-Agent"],
        }
        search_query = urllib.parse.quote(keyword)
        pexels_url = f"https://api.pexels.com/v1/search?query={search_query}&per_page=3&orientation=landscape"
        async with httpx.AsyncClient(follow_redirects=True, timeout=12) as client:
            resp = await client.get(pexels_url, headers=pexels_headers)
            if resp.status_code == 200:
                data = resp.json()
                photos = data.get("photos", [])
                if photos:
                    # Try large2x first, then large, then original
                    for size_key in ["large2x", "large", "original"]:
                        img_url = photos[0].get("src", {}).get(size_key)
                        if img_url:
                            success = await _download_to_file(img_url, temp_path, dload_headers, timeout=15)
                            if success:
                                logger.info("pexels_api_success", keyword=keyword, size=size_key)
                                return temp_path
    except Exception as e:
        logger.warning("pexels_api_failed", keyword=keyword, error=str(e))

    # ── Strategy 6: picsum.photos (Lorem Picsum) as absolute last resort ──
    try:
        seed = abs(hash(keyword)) % 1000
        fallback_url = f"https://picsum.photos/seed/{seed}/1280/720"
        success = await _download_to_file(fallback_url, temp_path, dload_headers, timeout=15)
        if success:
            logger.info("picsum_fallback_success", keyword=keyword)
            return temp_path
    except Exception as e:
        logger.warning("picsum_fallback_failed", keyword=keyword, error=str(e))

    logger.warning("all_image_strategies_exhausted", keyword=keyword)
    return ""


async def generate_presentation_data(topic: str, slide_count: int, custom_instructions: str, design_rules: dict) -> list[dict]:
    """Query the LLM to outline a structured deck about the topic — single call with retry."""
    extra = ""
    if custom_instructions.strip():
        extra = f"\nAdditional user instructions: {custom_instructions}\n"

    # Compact prompt — less tokens for the LLM to read = faster response
    prompt = (
        f"Create a {slide_count}-slide professional presentation on: '{topic}'.\n"
        f"{extra}"
        "Return ONLY a raw JSON array (no markdown, no backticks, no explanation).\n"
        "Each slide object MUST have these keys:\n"
        '  "title": string (compelling, specific slide title — NEVER generic like "Section 1")\n'
        '  "subtitle": string (one-line subtitle, or empty string "")\n'
        '  "bullets": array of 3-5 short, punchy bullet strings with real content about the topic\n'
        '  "image_keyword": string (3-5 word descriptive photo search phrase, e.g. "modern glass office building")\n'
        '  "transition": "Morph"\n'
        '  "layout": one of: "TitleSlide","ContentImage","FullContent","GridGrid","Timeline","BigStat","ChartSlide","Comparison"\n'
        "\nLayout guide:\n"
        '  TitleSlide: Only for slide 1. ContentImage: Text + image side by side (use most often).\n'
        '  FullContent: Text only, no image. GridGrid: 2-4 item comparison cards.\n'
        '  Timeline: Steps/roadmap. BigStat: One big number/quote.\n'
        '  ChartSlide: Data chart (also include "chart_data":[{"label":"x","value":0},...]).\n'
        '  Comparison: A vs B split screen.\n'
        f"\nRules:\n"
        f"- Produce EXACTLY {slide_count} slide objects.\n"
        "- Slide 1 MUST use layout 'TitleSlide'.\n"
        "- Last slide should be a closing/summary/call-to-action.\n"
        "- Use ContentImage for most slides. Mix in 2-3 other layouts for variety.\n"
        "- Every bullet must contain REAL, specific content about the topic. NEVER use placeholders.\n"
        "- Every image_keyword must be specific and relevant to that slide's content.\n"
    )

    messages = [
        {"role": "system", "content": "You are a professional presentation designer. Output ONLY valid JSON arrays. Never output markdown or explanation."},
        {"role": "user", "content": prompt}
    ]

    # Retry up to 3 times with backoff
    last_error = None
    for attempt in range(3):
        try:
            if attempt > 0:
                await asyncio.sleep(2 ** attempt)  # 2s, 4s backoff
                logger.info("ppt_data_retry", attempt=attempt + 1)

            response = await asyncio.wait_for(
                lm_client.chat(messages, max_tokens=4096),
                timeout=120,
            )
            cleaned = response.strip()
            # Strip markdown fences if present
            cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
            cleaned = re.sub(r"\s*```$", "", cleaned)
            cleaned = cleaned.strip()

            # Try direct parse first
            try:
                slides = json.loads(cleaned)
            except json.JSONDecodeError:
                # Try to extract JSON array from response
                match = re.search(r'\[.*\]', cleaned, re.DOTALL)
                if match:
                    slides = json.loads(match.group(0))
                else:
                    raise ValueError(f"No JSON array found in response: {cleaned[:200]}")

            if not isinstance(slides, list) or len(slides) == 0:
                raise ValueError("LLM returned empty or non-list result")

            # Validate that we got real content, not placeholders
            valid_slides = []
            for s in slides:
                if isinstance(s, dict) and s.get("title"):
                    valid_slides.append(s)

            if len(valid_slides) >= slide_count * 0.6:  # At least 60% valid
                logger.info("ppt_data_generated", slides=len(valid_slides), attempt=attempt + 1)
                # Pad if needed
                while len(valid_slides) < slide_count:
                    valid_slides.append({
                        "title": f"{topic} — Continued",
                        "subtitle": "",
                        "bullets": [f"Additional insights on {topic}", "Further analysis and details", "Key considerations"],
                        "image_keyword": f"{topic} professional",
                        "transition": "Morph",
                        "layout": "ContentImage"
                    })
                return valid_slides[:slide_count]
            else:
                raise ValueError(f"Only {len(valid_slides)} valid slides out of {slide_count}")

        except Exception as e:
            last_error = e
            logger.warning("ppt_data_attempt_failed", attempt=attempt + 1, error=str(e))

    # Final fallback — generate topic-aware content (not "Section X")
    logger.error("ppt_data_all_retries_failed", error=str(last_error))
    fallback_titles = [
        f"{topic}", f"Why {topic} Matters", f"Current State of {topic}",
        f"Key Benefits of {topic}", f"Challenges in {topic}", f"{topic} — Market Overview",
        f"How {topic} Works", f"Best Practices for {topic}", f"Case Studies in {topic}",
        f"Future of {topic}", f"{topic} vs Alternatives", f"Getting Started with {topic}",
        f"ROI of {topic}", f"Impact of {topic}", f"Trends in {topic}",
        f"{topic} Strategy", f"Implementing {topic}", f"Scaling {topic}",
        f"{topic} — Key Takeaways", f"Thank You — {topic}"
    ]
    fallback_layouts = ["TitleSlide", "ContentImage", "FullContent", "ContentImage", "GridGrid",
                        "ContentImage", "Timeline", "ContentImage", "BigStat", "ContentImage",
                        "Comparison", "ContentImage", "ContentImage", "FullContent", "ContentImage",
                        "ContentImage", "GridGrid", "ContentImage", "FullContent", "ContentImage"]
    fallback = []
    for i in range(slide_count):
        title = fallback_titles[i % len(fallback_titles)]
        layout = fallback_layouts[i % len(fallback_layouts)]
        if i == 0:
            layout = "TitleSlide"
        fallback.append({
            "title": title,
            "subtitle": f"Exploring the key aspects of {topic}" if i == 0 else "",
            "bullets": [
                f"Understanding the fundamentals of {topic}",
                f"Key insights and data points",
                f"Strategic implications and next steps"
            ],
            "image_keyword": f"{topic} professional photography",
            "transition": "Morph",
            "layout": layout
        })
    return fallback


# ═══════════════════════════════════════════════
# Phase 2 — Intelligent PowerPoint App Launcher
# ═══════════════════════════════════════════════

def _find_powerpoint_exe() -> str:
    """Intelligently locate PowerPoint executable with multiple fallback strategies."""
    search_paths = [
        os.path.expandvars(r"%ProgramFiles%\Microsoft Office\root\Office16\POWERPNT.EXE"),
        os.path.expandvars(r"%ProgramFiles(x86)%\Microsoft Office\root\Office16\POWERPNT.EXE"),
        os.path.expandvars(r"%ProgramFiles%\Microsoft Office\root\Office15\POWERPNT.EXE"),
        os.path.expandvars(r"%ProgramFiles(x86)%\Microsoft Office\root\Office15\POWERPNT.EXE"),
        os.path.expandvars(r"%ProgramFiles%\Microsoft Office 15\root\office15\POWERPNT.EXE"),
        os.path.expandvars(r"%ProgramFiles%\Microsoft Office\Office16\POWERPNT.EXE"),
        os.path.expandvars(r"%ProgramFiles(x86)%\Microsoft Office\Office16\POWERPNT.EXE"),
    ]
    for p in search_paths:
        if os.path.exists(p):
            return p

    for root_dir in [os.environ.get("ProgramFiles", ""), os.environ.get("ProgramFiles(x86)", "")]:
        if root_dir:
            matches = glob.glob(os.path.join(root_dir, "**", "POWERPNT.EXE"), recursive=True)
            if matches:
                return matches[0]

    localappdata = os.environ.get("LOCALAPPDATA", "")
    if localappdata:
        store_matches = glob.glob(os.path.join(localappdata, "Microsoft", "WindowsApps", "**", "POWERPNT.EXE"), recursive=True)
        if store_matches:
            return store_matches[0]

    return ""


def _connect_powerpoint_app():
    """Connect to PowerPoint via COM (creates instance if needed)."""
    last_error = None
    for attempt in range(8):
        try:
            if attempt == 2:
                # Try to physically start the PowerPoint process if COM Dispatch is slow or blocking
                logger.info("attempting_physical_powerpoint_launch")
                try:
                    exe_path = _find_powerpoint_exe()
                    if exe_path:
                        subprocess.Popen([exe_path])
                    else:
                        subprocess.Popen(["start", "powerpnt"], shell=True)
                except Exception as launch_err:
                    logger.warning("physical_launch_failed", error=str(launch_err))
                time.sleep(2.5)

            try:
                app = win32com.client.GetActiveObject("PowerPoint.Application")
            except Exception:
                app = win32com.client.Dispatch("PowerPoint.Application")
            
            try:
                app.Visible = True
            except Exception as vis_err:
                logger.warning("failed_to_set_app_visible_initially", error=str(vis_err))
            try:
                app.DisplayAlerts = 0  # ppAlertsNone — suppress blocking dialogs
            except Exception:
                pass
            try:
                app.WindowState = 1  # ppWindowNormal
            except Exception:
                pass
            return app
        except Exception as exc:
            last_error = exc
            time.sleep(1.5)
    raise RuntimeError(f"Could not connect to PowerPoint: {last_error}")


def _ensure_powerpoint_running() -> None:
    """Deprecated launcher — COM Dispatch handles instance creation."""
    try:
        win32com.client.GetActiveObject("PowerPoint.Application")
    except Exception:
        pass


def _bring_powerpoint_to_front():
    """Find the PowerPoint window and bring it to the foreground."""
    def enum_callback(hwnd, results):
        if win32gui.IsWindowVisible(hwnd):
            title = win32gui.GetWindowText(hwnd)
            if "PowerPoint" in title or "POWERPNT" in title.upper():
                results.append(hwnd)

    windows = []
    try:
        win32gui.EnumWindows(enum_callback, windows)
        if windows:
            hwnd = windows[0]
            if win32gui.IsIconic(hwnd):
                win32gui.ShowWindow(hwnd, win32con.SW_RESTORE)
            
            # Aggressively steal focus over Astryx's always-on-top window
            win32gui.SetWindowPos(hwnd, win32con.HWND_TOPMOST, 0, 0, 0, 0, win32con.SWP_NOMOVE | win32con.SWP_NOSIZE)
            win32gui.SetForegroundWindow(hwnd)
            win32gui.BringWindowToTop(hwnd)
            # Revert topmost so it doesn't stay locked above everything forever
            win32gui.SetWindowPos(hwnd, win32con.HWND_NOTOPMOST, 0, 0, 0, 0, win32con.SWP_NOMOVE | win32con.SWP_NOSIZE)
    except Exception as e:
        logger.warning("bring_to_front_failed", error=str(e))


# ═══════════════════════════════════════════════
# Phase 3 — Live Slide Building + Preview
# ═══════════════════════════════════════════════

def _build_ppt_com(slide_data_list: list[dict], design_rules: dict, font_key: str, layout_key: str) -> str:
    """Synchronous COM automation — builds slides LIVE in PowerPoint, then launches slideshow preview."""
    if not slide_data_list:
        return "Error: No slide content was generated. Check that the local LLM is running."

    ppt_app = None
    try:
        logger.info("ppt_com_build_start", slides=len(slide_data_list))
        ppt_app = _connect_powerpoint_app()
        time.sleep(0.5)

        # ── Create new presentation ──
        presentation = ppt_app.Presentations.Add()
        time.sleep(0.5)

        try:
            ppt_app.Visible = True
        except Exception as vis_err:
            logger.warning("failed_to_set_app_visible_after_presentation_add", error=str(vis_err))

        # Widescreen 16:9 (Full HD)
        presentation.PageSetup.SlideWidth = 960
        presentation.PageSetup.SlideHeight = 540

        _bring_powerpoint_to_front()

        # ── Resolve font pairing ──
        font_pair = TRENDY_FONTS.get(font_key, TRENDY_FONTS["segoe-ui"])
        font_title = font_pair["title"]
        font_body = font_pair["body"]

        # ── Resolve layout style colors ──
        # Prioritize the explicitly requested layout theme over the generic design rules
        # to ensure the user's color choice in the UI is always respected.
        def jitter_hex(h: str, amount: int = 15) -> str:
            h = h.lstrip("#")
            if len(h) != 6: return "#" + h
            r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
            r = max(0, min(255, r + random.randint(-amount, amount)))
            g = max(0, min(255, g + random.randint(-amount, amount)))
            b = max(0, min(255, b + random.randint(-amount, amount)))
            return f"#{r:02x}{g:02x}{b:02x}"

        layout_style = LAYOUT_STYLES.get(layout_key, LAYOUT_STYLES["neon-dark"])
        bg_hex = jitter_hex(layout_style["bg"], 5)
        accent_hex = jitter_hex(layout_style["accent"], 25)
        secondary_hex = jitter_hex(layout_style["secondary"], 25)
        text_hex = layout_style["text"]
        grad_start_hex = jitter_hex(layout_style["grad_start"], 10)
        grad_end_hex = jitter_hex(layout_style["grad_end"], 10)

        def hex_to_bgr(h: str) -> int:
            h = h.lstrip("#")
            if len(h) != 6:
                return 0x000000
            r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
            return (b << 16) | (g << 8) | r

        bg_color = hex_to_bgr(bg_hex)
        accent_color = hex_to_bgr(accent_hex)
        secondary_color = hex_to_bgr(secondary_hex)
        text_color = hex_to_bgr(text_hex)
        grad_start_color = hex_to_bgr(grad_start_hex)
        grad_end_color = hex_to_bgr(grad_end_hex)

        # Detect light vs dark theme
        def _is_light_theme(h: str) -> bool:
            h = h.lstrip("#")
            if len(h) != 6:
                return False
            r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
            luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
            return luminance > 0.6

        is_light = _is_light_theme(bg_hex)
        
        # Enforce intelligent contrast for text
        if is_light:
            text_color = hex_to_bgr("#111827") # Very dark slate for light theme
        else:
            text_color = hex_to_bgr("#f8fafc") # Crisp white for dark theme

        # ── Transition effect map ──
        transition_map = {
            "fade-smooth": 3849, "fade": 3849, "morph": 3954,
            "push": 3852, "push-cinematic": 3852, "reveal": 3844, "zoom": 3849, "pan": 3848
        }
        default_trans = 3954  # True Morph Transition (By Object)

        LIVE_DELAY = 0.03
        style_mode = layout_style.get("style_mode", "standard")
        total_slides = len(slide_data_list)

        # ── Build each slide LIVE ──
        for idx, slide_data in enumerate(slide_data_list):
            layout_type = slide_data.get("layout", "ContentImage").lower()
            is_title_slide = (layout_type == "titleslide" or idx == 0)
            is_last_slide = (idx == total_slides - 1)

            slide = presentation.Slides.Add(idx + 1, 12)  # ppLayoutBlank
            time.sleep(LIVE_DELAY)

            # Navigate to this slide so user watches live
            try:
                ppt_app.ActiveWindow.View.GotoSlide(idx + 1)
            except Exception:
                pass

            # ── Background gradient ──
            try:
                bg_fill = slide.Background.Fill
                bg_fill.TwoColorGradient(4, 1)
                bg_fill.GradientStops[1].Color.RGB = grad_start_color
                bg_fill.GradientStops[2].Color.RGB = grad_end_color
            except Exception:
                slide.Background.Fill.Solid()
                slide.Background.Fill.ForeColor.RGB = bg_color
            
            # ── Morph Persistent Background Circle (AnsonPPT Style) ──
            try:
                morph_pos = idx % 4
                positions = [
                    (-500, -500, 2000, 2000),  # Title: massive bleed
                    (550, -250, 700, 700),      # Top right
                    (-200, 300, 500, 500),       # Bottom left
                    (300, -400, 1200, 1200),     # Top center
                ]
                m_left, m_top, m_width, m_height = positions[morph_pos] if is_title_slide else positions[morph_pos]
                
                morph_bg = slide.Shapes.AddShape(9, m_left, m_top, m_width, m_height)
                morph_bg.Name = "!!MorphBgCircle"
                morph_bg.Fill.Solid()
                morph_bg.Fill.ForeColor.RGB = accent_color
                morph_bg.Fill.Transparency = 0.88
                morph_bg.Line.Visible = False
                try: morph_bg.SoftEdge.Radius = 50
                except: pass
                morph_bg.ZOrder(1)
            except Exception:
                pass

            # ── Secondary morph element (smaller, secondary color) ──
            try:
                s_positions = [
                    (700, 350, 400, 400),
                    (-100, -100, 350, 350),
                    (600, 200, 300, 300),
                    (100, 400, 450, 450),
                ]
                s_left, s_top, s_width, s_height = s_positions[idx % 4]
                morph_bg2 = slide.Shapes.AddShape(9, s_left, s_top, s_width, s_height)
                morph_bg2.Name = "!!MorphBgCircle2"
                morph_bg2.Fill.Solid()
                morph_bg2.Fill.ForeColor.RGB = secondary_color
                morph_bg2.Fill.Transparency = 0.92
                morph_bg2.Line.Visible = False
                try: morph_bg2.SoftEdge.Radius = 40
                except: pass
                morph_bg2.ZOrder(1)
            except Exception:
                pass

            # ── Transition: Morph ──
            trans_str = slide_data.get("transition", "").lower()
            trans_val = transition_map.get(trans_str, default_trans)
            try:
                slide.SlideShowTransition.EntryEffect = trans_val
                slide.SlideShowTransition.Duration = 0.8
            except Exception:
                pass

            # (Top and bottom rule lines removed for clean 2026 borderless presentation canvas)
            pass

            # ── Modern Rotating Corner Crosshair (Morph Animation) ──
            try:
                # 149 = msoShapeCross. Naming it !!CornerRotator forces morph to spin it smoothly.
                cross = slide.Shapes.AddShape(149, 900, 18, 16, 16)
                cross.Name = "!!CornerRotator"
                cross.Fill.Solid()
                cross.Fill.ForeColor.RGB = accent_color
                cross.Fill.Transparency = 0.4
                cross.Line.Visible = False
                cross.Rotation = (idx * 90) % 360
            except: pass

            # ── Editorial Tech Dot Grid ──
            try:
                # 3x3 grid of tiny dots in the bottom-left corner
                dot_start_x = 40
                dot_start_y = 440
                for row in range(3):
                    for col in range(3):
                        dot = slide.Shapes.AddShape(9, dot_start_x + (col * 10), dot_start_y + (row * 10), 2, 2)
                        dot.Fill.Solid()
                        dot.Fill.ForeColor.RGB = secondary_color
                        dot.Fill.Transparency = 0.8
                        dot.Line.Visible = False
            except: pass

            # ── Resolve image path ──
            image_keyword = slide_data.get("image_keyword", "")
            image_path = ""
            if image_keyword:
                safe_name = re.sub(r'[^\w\-]', '_', image_keyword.lower())
                base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
                temp_dir = os.path.join(base_dir, "data", "temp_images")
                cached_path = os.path.join(temp_dir, f"{safe_name}.jpg")
                if os.path.exists(cached_path):
                    image_path = cached_path

            has_image = bool(image_path) and os.path.exists(image_path)
            time.sleep(LIVE_DELAY)

            if is_title_slide:
                # ════════════════════════════════════
                #  ULTRA-PREMIUM TITLE SLIDE
                # ════════════════════════════════════

                # Hero image on the right half (if available) - Modern Rounded Rect Image Fill
                if has_image:
                    try:
                        # Create rounded rect for picture fill (msoShapeRoundedRectangle = 5)
                        hero_shape = slide.Shapes.AddShape(5, 480, 40, 440, 460)
                        hero_shape.Adjustments[1] = 0.05  # slightly rounded corners
                        hero_shape.Line.Visible = -1
                        hero_shape.Line.ForeColor.RGB = accent_color
                        hero_shape.Line.Weight = 1
                        hero_shape.Line.Transparency = 0.5
                        hero_shape.Fill.UserPicture(image_path)
                        hero_shape.Name = "!!TitleHeroImage"
                        
                        try:
                            hero_shape.Shadow.Type = 21
                            hero_shape.Shadow.Visible = -1
                            hero_shape.Shadow.Blur = 25
                            hero_shape.Shadow.OffsetY = 10
                            hero_shape.Shadow.ForeColor.RGB = hex_to_bgr("#000000")
                            hero_shape.Shadow.Transparency = 0.5
                        except: pass
                        try:
                            eff = slide.TimeLine.MainSequence.AddEffect(hero_shape, 1, 0, 3)
                            eff.Timing.Duration = 1.0
                        except: pass
                    except: pass

                # (Corner bracket decoration blocks removed for clean 2026 borderless presentation canvas)
                pass

                # Accent vertical bar (left side)
                try:
                    v_bar = slide.Shapes.AddShape(1, 50, 120, 5, 250)
                    v_bar.Fill.Solid(); v_bar.Fill.ForeColor.RGB = accent_color; v_bar.Line.Visible = False
                except: pass

                # Main title (left-aligned, large)
                title_text = slide_data.get("title", "")
                title_box = slide.Shapes.AddTextbox(1, 70, 120, 380 if has_image else 840, 150)
                tf = title_box.TextFrame
                tf.WordWrap = True
                p = tf.TextRange
                p.Text = title_text
                p.Font.Name = font_title
                p.Font.Size = 52 if has_image else 64
                p.Font.Bold = True
                p.Font.Color.RGB = accent_color
                p.ParagraphFormat.Alignment = 1  # Left
                try:
                    effect = slide.TimeLine.MainSequence.AddEffect(title_box, 1, 0, 3)
                    effect.Timing.Duration = 0.8
                except: pass

                # Subtitle
                subtitle_text = slide_data.get("subtitle", "")
                if subtitle_text:
                    sub_box = slide.Shapes.AddTextbox(1, 70, 290, 380 if has_image else 800, 50)
                    tf_sub = sub_box.TextFrame
                    tf_sub.WordWrap = True
                    p_sub = tf_sub.TextRange
                    p_sub.Text = subtitle_text
                    p_sub.Font.Name = font_body
                    p_sub.Font.Size = 20
                    p_sub.Font.Color.RGB = text_color
                    p_sub.ParagraphFormat.Alignment = 1
                    try:
                        effect = slide.TimeLine.MainSequence.AddEffect(sub_box, 1, 0, 3)
                        effect.Timing.Duration = 0.6
                        effect.Timing.TriggerDelayTime = 0.2
                    except: pass

                # (Outdated decorative dividers removed for 2026 clean text flow)
                pass

                # Footer
                try:
                    footer_box = slide.Shapes.AddTextbox(1, 40, 490, 450, 25)
                    footer_box.TextFrame.TextRange.Text = f"ASTRYX  \u2022  {datetime.now().strftime('%B %Y')}  \u2022  {total_slides} SLIDES"
                    footer_box.TextFrame.TextRange.Font.Name = font_body
                    footer_box.TextFrame.TextRange.Font.Size = 9
                    footer_box.TextFrame.TextRange.Font.Color.RGB = hex_to_bgr("#666666") if is_light else hex_to_bgr("#555555")
                    footer_box.TextFrame.TextRange.ParagraphFormat.Alignment = 1
                except: pass
                time.sleep(LIVE_DELAY)

            else:
                # ════════════════════════════════════
                #  CONTENT SLIDE
                # ════════════════════════════════════

                # Left accent sidebar
                try:
                    sidebar = slide.Shapes.AddShape(1, 0, 3, 6, 537)
                    sidebar.Fill.Solid(); sidebar.Fill.ForeColor.RGB = accent_color; sidebar.Line.Visible = False
                except: pass

                # Section number indicator (top-right)
                try:
                    num_label = slide.Shapes.AddTextbox(1, 850, 12, 90, 30)
                    num_label.TextFrame.TextRange.Text = f"{idx:02d} / {total_slides:02d}"
                    num_label.TextFrame.TextRange.Font.Name = font_body
                    num_label.TextFrame.TextRange.Font.Size = 10
                    num_label.TextFrame.TextRange.Font.Color.RGB = hex_to_bgr("#888888") if is_light else hex_to_bgr("#666666")
                    num_label.TextFrame.TextRange.ParagraphFormat.Alignment = 3
                except: pass

                # ── Category Pill Tag ──
                try:
                    category_pill = slide.Shapes.AddShape(5, 30, 15, 120, 20)  # Rounded Rect
                    category_pill.Adjustments[1] = 0.5  # Full round
                    category_pill.Fill.Solid()
                    category_pill.Fill.ForeColor.RGB = accent_color
                    category_pill.Line.Visible = False
                    
                    # Pill Text
                    tf_pill = category_pill.TextFrame
                    tf_pill.MarginLeft = 0; tf_pill.MarginRight = 0
                    tf_pill.MarginTop = 0; tf_pill.MarginBottom = 0
                    p_pill = tf_pill.TextRange
                    p_pill.Text = "MODULE INSIGHTS" if idx % 2 == 0 else "INTELLIGENCE REPORT"
                    p_pill.Font.Name = font_body
                    p_pill.Font.Size = 7.5
                    p_pill.Font.Bold = True
                    p_pill.Font.Color.RGB = hex_to_bgr("#ffffff") if not is_light else hex_to_bgr("#000000")
                    p_pill.ParagraphFormat.Alignment = 2 # Center
                except:
                    pass

                # Slide title
                title_box = slide.Shapes.AddTextbox(1, 30, 38, 800, 55)
                tf = title_box.TextFrame
                tf.WordWrap = True
                p = tf.TextRange
                p.Text = slide_data.get("title", "")
                p.Font.Name = font_title
                p.Font.Size = 34
                p.Font.Bold = True
                p.Font.Color.RGB = accent_color
                try:
                    effect = slide.TimeLine.MainSequence.AddEffect(title_box, 1, 0, 3)
                    effect.Timing.Duration = 0.5
                except: pass

                # Modern clean accent line
                try:
                    accent_line = slide.Shapes.AddShape(1, 30, 88, 120, 1.5)
                    accent_line.Fill.Solid()
                    accent_line.Fill.ForeColor.RGB = secondary_color
                    accent_line.Line.Visible = False
                    accent_line.ZOrder(2)
                except: pass

                # Subtitle
                subtitle_text = slide_data.get("subtitle", "")
                content_top = 95
                if subtitle_text:
                    sub_box = slide.Shapes.AddTextbox(1, 30, 90, 900, 30)
                    tf_sub = sub_box.TextFrame
                    tf_sub.WordWrap = True
                    p_sub = tf_sub.TextRange
                    p_sub.Text = subtitle_text
                    p_sub.Font.Name = font_body
                    p_sub.Font.Size = 18
                    p_sub.Font.Italic = True
                    p_sub.Font.Color.RGB = secondary_color
                    try:
                        # Fade in, WithPrevious (2)
                        effect = slide.TimeLine.MainSequence.AddEffect(sub_box, 1, 0, 2)
                        effect.Timing.Duration = 0.8
                        effect.Timing.TriggerDelayTime = 0.2
                    except Exception:
                        pass
                    content_top = 135
                    time.sleep(LIVE_DELAY)

                # Layout Position Variation (Clean Split Layout)
                is_right_layout = (idx % 2 == 1)
                
                # For ContentImage layout: clean split with side image panel
                if has_image and layout_type not in ("fullcontent", "bigstat", "chartslide", "timeline", "gridgrid", "comparison", "carousel", "smartartflow", "foldertabs", "picturegrid", "3dmodel", "panorama"):
                    # ── Add side image panel with offset frame & rounded corners ──
                    img_panel_w, img_panel_h = 420, 360
                    if is_right_layout:
                        img_panel_left = 510
                        bullet_left = 30
                        bullet_width = 460
                    else:
                        img_panel_left = 30
                        bullet_left = 480
                        bullet_width = 460
                    
                    try:
                        # Glow outline (msoShapeRoundedRectangle = 5)
                        outline_rect = slide.Shapes.AddShape(5, img_panel_left + (10 if is_right_layout else -10), content_top + 20, img_panel_w, img_panel_h)
                        outline_rect.Fill.Visible = False
                        outline_rect.Line.Visible = -1
                        outline_rect.Line.ForeColor.RGB = secondary_color
                        outline_rect.Line.Weight = 1.5
                        outline_rect.Line.Transparency = 0.5
                        outline_rect.Adjustments[1] = 0.05
                        
                        # Main image container (msoShapeRoundedRectangle = 5)
                        img_shape = slide.Shapes.AddShape(5, img_panel_left, content_top + 10, img_panel_w, img_panel_h)
                        img_shape.Adjustments[1] = 0.05
                        img_shape.Line.Visible = False
                        img_shape.Fill.UserPicture(image_path)
                        img_shape.Name = f"!!SideImage_{idx}"
                        
                        try:
                            img_shape.Shadow.Type = 21
                            img_shape.Shadow.Visible = -1
                            img_shape.Shadow.Blur = 20
                            img_shape.Shadow.OffsetY = 8
                            img_shape.Shadow.ForeColor.RGB = hex_to_bgr("#000000")
                            img_shape.Shadow.Transparency = 0.5
                        except: pass
                        
                        try:
                            eff = slide.TimeLine.MainSequence.AddEffect(img_shape, 1, 0, 3)  # Fade
                            eff.Timing.Duration = 0.8
                        except: pass
                    except Exception as e:
                        logger.warning("side_image_failed", error=str(e))
                        bullet_width = 900
                        bullet_left = 30
                else:
                    bullet_width = 900
                    bullet_left = 30

                # Bullets with premium styling
                bullets = slide_data.get("bullets", [])
                if bullets:
                    if layout_type == "bigstat":
                        # ── BIG STAT LAYOUT ──
                        try:
                            stat_box = slide.Shapes.AddTextbox(1, 50, 150, 860, 200)
                            tf = stat_box.TextFrame
                            p = tf.TextRange
                            p.Text = bullets[0]
                            p.Font.Name = font_title
                            p.Font.Size = 130
                            p.Font.Bold = True
                            p.Font.Color.RGB = accent_color
                            p.ParagraphFormat.Alignment = 2 # Center
                            
                            eff = slide.TimeLine.MainSequence.AddEffect(stat_box, 10, 2, 3) # Fly
                            eff.Timing.Duration = 1.0
                        except: pass
                        
                        if len(bullets) > 1:
                            try:
                                cap_box = slide.Shapes.AddTextbox(1, 50, 380, 860, 100)
                                tf_cap = cap_box.TextFrame
                                tf_cap.WordWrap = True
                                p_cap = tf_cap.TextRange
                                p_cap.Text = bullets[1]
                                p_cap.Font.Name = font_body
                                p_cap.Font.Size = 28
                                p_cap.Font.Color.RGB = text_color
                                p_cap.ParagraphFormat.Alignment = 2 # Center
                                
                                eff2 = slide.TimeLine.MainSequence.AddEffect(cap_box, 1, 0, 3) # Fade
                                eff2.Timing.Duration = 1.0
                            except: pass

                    elif layout_type == "carousel":
                        # ── 3D IMAGE CAROUSEL LAYOUT ──
                        try:
                            # We need 3 images. 1 is the main image. We will grab 2 others from temp_dir
                            carousel_imgs = []
                            if has_image: carousel_imgs.append(image_path)
                            
                            # Grab fallback images from temp_dir
                            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
                            temp_dir = os.path.join(base_dir, "data", "temp_images")
                            other_imgs = [f for f in glob.glob(os.path.join(temp_dir, "*.jpg")) if f != image_path]
                            random.shuffle(other_imgs)
                            
                            carousel_imgs.extend(other_imgs[:2])
                            
                            while len(carousel_imgs) < 3:
                                carousel_imgs.append(carousel_imgs[0] if carousel_imgs else "")
                                
                            # Left Image (Back)
                            if carousel_imgs[1]:
                                img_left = slide.Shapes.AddPicture(carousel_imgs[1], False, True, -50, 120, 400, 300)
                                img_left.Name = "!!CarouselLeft"
                                img_left.ZOrder(1)
                                try:
                                    img_left.ThreeD.Visible = -1
                                    img_left.ThreeD.RotationY = 30
                                    img_left.ThreeD.Depth = 10
                                    img_left.PictureFormat.ColorType = 2 # Grayscale
                                except: pass
                                
                            # Right Image (Back)
                            if carousel_imgs[2]:
                                img_right = slide.Shapes.AddPicture(carousel_imgs[2], False, True, 610, 120, 400, 300)
                                img_right.Name = "!!CarouselRight"
                                img_right.ZOrder(1)
                                try:
                                    img_right.ThreeD.Visible = -1
                                    img_right.ThreeD.RotationY = -30
                                    img_right.ThreeD.Depth = 10
                                    img_right.PictureFormat.ColorType = 2 # Grayscale
                                except: pass
                                
                            # Center Image (Front)
                            if carousel_imgs[0]:
                                img_center = slide.Shapes.AddPicture(carousel_imgs[0], False, True, 230, 70, 500, 400)
                                img_center.Name = "!!CarouselCenter"
                                try:
                                    # Heavy glow drop shadow for the front image
                                    img_center.Shadow.Type = 21
                                    img_center.Shadow.Visible = -1
                                    img_center.Shadow.Blur = 30
                                    img_center.Shadow.OffsetY = 20
                                    img_center.Shadow.ForeColor.RGB = accent_color
                                    img_center.Shadow.Transparency = 0.3
                                except: pass
                                
                            # Carousel Title & Subtitle logic is handled by standard title code above
                        except Exception as e:
                            logger.warning("carousel_failed", error=str(e))
                            
                    elif layout_type == "chartslide":
                        # ── NATIVE CHART LAYOUT ──
                        chart_data = slide_data.get("chart_data", [])
                        if chart_data:
                            try:
                                # xlColumnClustered = 51
                                chart_shape = slide.Shapes.AddChart(51, 100, content_top, 760, 350)
                                chart = chart_shape.Chart
                                chart.HasTitle = False
                                
                                # Access chart data worksheet
                                wb = chart.ChartData.Workbook
                                ws = wb.Worksheets(1)
                                
                                ws.Range("A1:B100").ClearContents()
                                ws.Range("A1").Value = "Category"
                                ws.Range("B1").Value = "Value"
                                
                                for row_idx, item in enumerate(chart_data[:10]): # Limit to 10 for safety
                                    ws.Range(f"A{row_idx+2}").Value = str(item.get("label", f"Item {row_idx+1}"))
                                    ws.Range(f"B{row_idx+2}").Value = float(item.get("value", 0))
                                    
                                chart.SetSourceData(Source=ws.Range(f"A1:B{len(chart_data[:10])+1}").Address)
                                try:
                                    wb.Application.Quit()
                                except: pass
                                
                                # Gamma.ai Style Gradient Data Viz
                                try:
                                    series = chart.SeriesCollection(1)
                                    series.Format.Fill.TwoColorGradient(1, 1)
                                    series.Format.Fill.GradientStops(1).Color.RGB = grad_start_color
                                    series.Format.Fill.GradientStops(2).Color.RGB = grad_end_color
                                    chart.ChartGroups(1).GapWidth = 50
                                except: pass
                                
                                eff = slide.TimeLine.MainSequence.AddEffect(chart_shape, 10, 2, 3)
                                eff.Timing.Duration = 0.8
                            except Exception as e:
                                logger.warning("chart_generation_failed", error=str(e))
                                layout_type = "gridgrid" # Fallback
                        else:
                            layout_type = "gridgrid"

                    elif layout_type == "3dmodel":
                        # ── 3D MODEL NATIVE ROTATIONS ──
                        try:
                            # We simulate 3D models with 3D text extrusions or shapes
                            shape = slide.Shapes.AddShape(5, 300, content_top, 360, 300)
                            shape.Name = "!!3DModelShape"
                            shape.Fill.Solid()
                            shape.Fill.ForeColor.RGB = accent_color
                            shape.Line.Visible = False
                            
                            # Extreme 3D Bevel & Extrusion
                            shape.ThreeD.Visible = -1
                            shape.ThreeD.ExtrusionColor.RGB = secondary_color
                            shape.ThreeD.Depth = 50
                            
                            # Different rotation based on slide index for morphing
                            shape.ThreeD.RotationX = (idx * 45) % 360
                            shape.ThreeD.RotationY = (idx * 60) % 360
                            
                            tbox = slide.Shapes.AddTextbox(1, 100, content_top + 320, 760, 100)
                            tbox.TextFrame.TextRange.Text = " ".join(bullets)
                            tbox.TextFrame.TextRange.Font.Color.RGB = text_color
                        except Exception as e:
                            logger.warning("3dmodel_failed", error=str(e))
                            
                    elif layout_type == "panorama":
                        # ── PANORAMIC SCROLLING BACKGROUND ──
                        try:
                            # Find the existing image and stretch it insanely wide
                            for sh in slide.Shapes:
                                if sh.Type == 13: # Picture
                                    sh.Width = 2500
                                    sh.Height = 800
                                    # Shift left based on index
                                    sh.Left = -(idx % 3) * 600
                                    sh.Name = "!!PanoramaBg"
                                    sh.ZOrder(1)
                                    break
                                    
                            # Add simple text box over it
                            tbox = slide.Shapes.AddTextbox(1, 100, content_top, 760, 300)
                            tf = tbox.TextFrame
                            tf.TextRange.Text = " ".join(bullets)
                            tf.TextRange.Font.Color.RGB = hex_to_bgr("#ffffff")
                            
                            # Solid backing for readability
                            tbox.Fill.Solid()
                            tbox.Fill.ForeColor.RGB = hex_to_bgr("#000000")
                            tbox.Fill.Transparency = 0.5
                        except: pass
                        
                    elif layout_type == "comparison":
                        # ── SPLIT SCREEN COMPARISON ──
                        try:
                            # Left Card
                            left_card = slide.Shapes.AddShape(5, 50, content_top, 400, 350)
                            left_card.Fill.Solid()
                            left_card.Fill.ForeColor.RGB = accent_color
                            left_card.Line.Visible = False
                            left_card.Shadow.Type = 21; left_card.Shadow.Visible = -1
                            
                            # Right Card
                            right_card = slide.Shapes.AddShape(5, 510, content_top, 400, 350)
                            right_card.Fill.Solid()
                            right_card.Fill.ForeColor.RGB = secondary_color
                            right_card.Line.Visible = False
                            right_card.Shadow.Type = 21; right_card.Shadow.Visible = -1
                            
                            # Left Fly
                            eff_l = slide.TimeLine.MainSequence.AddEffect(left_card, 10, 1, 3) # Fly from left
                            
                            # Right Fly
                            eff_r = slide.TimeLine.MainSequence.AddEffect(right_card, 10, 2, 3) # Fly from right
                            
                            # Text — split bullets between left and right
                            mid = max(1, len(bullets) // 2)
                            left_text = "\n".join(f"▸ {b}" for b in bullets[:mid])
                            right_text = "\n".join(f"▸ {b}" for b in bullets[mid:]) if len(bullets) > mid else bullets[-1] if bullets else ""
                            
                            if left_text:
                                tl = slide.Shapes.AddTextbox(1, 70, content_top + 30, 360, 290)
                                tl.TextFrame.WordWrap = True
                                tl.TextFrame.TextRange.Text = left_text
                                tl.TextFrame.TextRange.Font.Name = font_body
                                tl.TextFrame.TextRange.Font.Size = 18
                                tl.TextFrame.TextRange.Font.Color.RGB = hex_to_bgr("#ffffff")
                            if right_text:
                                tr = slide.Shapes.AddTextbox(1, 530, content_top + 30, 360, 290)
                                tr.TextFrame.WordWrap = True
                                tr.TextFrame.TextRange.Text = right_text
                                tr.TextFrame.TextRange.Font.Name = font_body
                                tr.TextFrame.TextRange.Font.Size = 18
                                tr.TextFrame.TextRange.Font.Color.RGB = hex_to_bgr("#ffffff")
                            
                            # VS divider
                            try:
                                vs = slide.Shapes.AddTextbox(1, 455, content_top + 140, 50, 40)
                                vs.TextFrame.TextRange.Text = "VS"
                                vs.TextFrame.TextRange.Font.Size = 16
                                vs.TextFrame.TextRange.Font.Bold = True
                                vs.TextFrame.TextRange.Font.Color.RGB = hex_to_bgr("#ffffff")
                                vs.TextFrame.TextRange.ParagraphFormat.Alignment = 2
                            except: pass
                        except: pass

                    elif layout_type == "foldertabs":
                        # ── PHYSICAL FOLDER TABS ──
                        try:
                            tab_w = 760 // max(1, len(bullets))
                            for b_idx, b_text in enumerate(bullets):
                                # Is this the active tab?
                                is_active = (b_idx == (idx % len(bullets)))
                                
                                # Draw Trapezoid Tab
                                tab = slide.Shapes.AddShape(3, 100 + (b_idx * tab_w), content_top - 40, tab_w - 5, 40)
                                tab.Name = f"!!FolderTab_{b_idx}"
                                tab.Fill.Solid()
                                tab.Fill.ForeColor.RGB = accent_color if is_active else secondary_color
                                tab.Line.Visible = False
                                
                                # Draw corresponding folder body if active
                                if is_active:
                                    body = slide.Shapes.AddShape(1, 100, content_top, 760, 300)
                                    body.Name = "!!FolderBody"
                                    body.Fill.Solid()
                                    body.Fill.ForeColor.RGB = accent_color
                                    body.Line.Visible = False
                                    
                                    tbox = slide.Shapes.AddTextbox(1, 120, content_top + 20, 720, 260)
                                    tbox.TextFrame.TextRange.Text = b_text
                                    tbox.TextFrame.TextRange.Font.Color.RGB = hex_to_bgr("#ffffff")
                        except: pass
                        
                    elif layout_type == "picturegrid":
                        # ── PICTURE MOSAIC ──
                        try:
                            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
                            temp_dir = os.path.join(base_dir, "data", "temp_images")
                            imgs = glob.glob(os.path.join(temp_dir, "*.jpg"))
                            random.shuffle(imgs)
                            
                            grid_imgs = []
                            if has_image: grid_imgs.append(image_path)
                            grid_imgs.extend(imgs[:4])
                            
                            while len(grid_imgs) < 4:
                                grid_imgs.append(grid_imgs[0] if grid_imgs else "")
                                
                            coords = [(100, content_top), (490, content_top), (100, content_top + 180), (490, content_top + 180)]
                            
                            # Expand one randomly based on index
                            expand_idx = idx % 4
                            
                            for i in range(4):
                                if not grid_imgs[i]: continue
                                if i == expand_idx:
                                    # Massive hero image
                                    sh = slide.Shapes.AddPicture(grid_imgs[i], False, True, 100, content_top, 760, 350)
                                    sh.ZOrder(0)
                                else:
                                    # Normal grid image
                                    cx, cy = coords[i]
                                    sh = slide.Shapes.AddPicture(grid_imgs[i], False, True, cx, cy, 370, 160)
                                sh.Name = f"!!GridPic_{i}"
                        except: pass

                    elif layout_type == "smartartflow":
                        # ── SMARTART FLOW LAYOUT ──
                        try:
                            # 115 is often Basic Process or a flow. We use a generic one.
                            layout = ppt_app.SmartArtLayouts(115) 
                            smartart = slide.Shapes.AddSmartArt(layout, 100, content_top, 760, 350)
                            
                            nodes = smartart.SmartArt.AllNodes
                            while nodes.Count < len(bullets):
                                nodes.Add()
                            while nodes.Count > len(bullets) and nodes.Count > 1:
                                nodes.Item(nodes.Count).Delete()
                                
                            for n_idx, bullet in enumerate(bullets):
                                nodes.Item(n_idx + 1).TextFrame2.TextRange.Text = bullet
                                
                            eff = slide.TimeLine.MainSequence.AddEffect(smartart, 10, 2, 3)
                            eff.Timing.Duration = 0.8
                        except Exception as e:
                            logger.warning("smartart_generation_failed", error=str(e))
                            layout_type = "timeline" # Fallback

                    if layout_type == "gridgrid":
                        # ── GRID / CARDS LAYOUT ──
                        card_width = 420
                        card_height = 170
                        start_x = 40
                        start_y = content_top + 5
                        gap_x = 30
                        gap_y = 20
                        
                        for b_idx, bullet in enumerate(bullets[:4]):
                            row = b_idx // 2
                            col = b_idx % 2
                            cx = start_x + (col * (card_width + gap_x))
                            cy = start_y + (row * (card_height + gap_y))
                            
                            try:
                                card = slide.Shapes.AddShape(5, cx, cy, card_width, card_height)  # Rounded Rect
                                card.Adjustments[1] = 0.08
                                card.Fill.Solid()
                                card.Fill.ForeColor.RGB = hex_to_bgr("#1e293b") if not is_light else hex_to_bgr("#f8fafc")
                                card.Fill.Transparency = 0.15
                                card.Line.Visible = -1
                                card.Line.ForeColor.RGB = accent_color
                                card.Line.Weight = 1.5
                                card.Line.Transparency = 0.5
                                
                                # Number badge
                                try:
                                    badge = slide.Shapes.AddShape(9, cx + 15, cy + 15, 32, 32)  # Circle
                                    badge.Fill.Solid()
                                    badge.Fill.ForeColor.RGB = accent_color
                                    badge.Line.Visible = False
                                    badge_text = slide.Shapes.AddTextbox(1, cx + 15, cy + 15, 32, 32)
                                    badge_text.TextFrame.TextRange.Text = str(b_idx + 1)
                                    badge_text.TextFrame.TextRange.Font.Size = 14
                                    badge_text.TextFrame.TextRange.Font.Bold = True
                                    badge_text.TextFrame.TextRange.Font.Color.RGB = hex_to_bgr("#ffffff") if not is_light else hex_to_bgr("#000000")
                                    badge_text.TextFrame.TextRange.ParagraphFormat.Alignment = 2  # Center
                                    badge_text.TextFrame.VerticalAnchor = 3  # Middle
                                except: pass
                                
                                tbox = slide.Shapes.AddTextbox(1, cx + 55, cy + 20, card_width - 75, card_height - 40)
                                tf = tbox.TextFrame
                                tf.WordWrap = True
                                tf.VerticalAnchor = 3  # msoAnchorMiddle
                                p = tf.TextRange
                                p.Text = bullet
                                p.Font.Name = font_body
                                p.Font.Size = 18
                                p.Font.Color.RGB = text_color
                                
                                eff = slide.TimeLine.MainSequence.AddEffect(card, 1, 0, 3)  # Fade
                                eff.Timing.Duration = 0.4
                                eff.Timing.TriggerDelayTime = b_idx * 0.12
                            except: pass

                    elif layout_type == "timeline":
                        # ── TIMELINE LAYOUT ──
                        try:
                            # Main horizontal axis line
                            axis = slide.Shapes.AddShape(1, 100, content_top + 150, 760, 4)
                            axis.Fill.Solid()
                            axis.Fill.ForeColor.RGB = accent_color
                            axis.Line.Visible = False
                        except: pass
                        
                        step_x = 760 // max(1, len(bullets))
                        for b_idx, bullet in enumerate(bullets):
                            cx = 100 + (b_idx * step_x) + (step_x // 2) - 10
                            cy = content_top + 142
                            try:
                                # Glowing Node circle
                                node = slide.Shapes.AddShape(9, cx, cy, 20, 20)
                                node.Fill.Solid()
                                node.Fill.ForeColor.RGB = secondary_color
                                node.Line.Visible = False
                                node.Shadow.Type = 21
                                node.Shadow.Visible = -1
                                node.Shadow.Blur = 15
                                node.Shadow.ForeColor.RGB = secondary_color
                                
                                # Alternate text boxes above and below the line
                                t_top = content_top if b_idx % 2 == 0 else content_top + 180
                                
                                tbox = slide.Shapes.AddTextbox(1, cx - (step_x // 2) + 10, t_top, step_x - 20, 140)
                                tf = tbox.TextFrame
                                tf.WordWrap = True
                                p = tf.TextRange
                                p.Text = bullet
                                p.Font.Name = font_body
                                p.Font.Size = 16
                                p.Font.Color.RGB = text_color
                                p.ParagraphFormat.Alignment = 2 # Center
                                
                                eff = slide.TimeLine.MainSequence.AddEffect(node, 10, 2, 3) # Fly
                                eff.Timing.TriggerDelayTime = b_idx * 0.2
                                
                                eff2 = slide.TimeLine.MainSequence.AddEffect(tbox, 1, 0, 3) # Fade
                                eff2.Timing.TriggerDelayTime = b_idx * 0.2 + 0.1
                            except: pass

                    else:
                        # ── CLEAN PROFESSIONAL BULLETS (ContentImage / FullContent) ──
                        # Single text block with accent bullet markers — no cluttered individual cards
                        try:
                            # Calculate available height
                            available_height = 500 - content_top - 20
                            
                            # Build formatted bullet text with accent markers
                            bullet_text = ""
                            for b_idx, bullet in enumerate(bullets):
                                marker = "▸  " if not is_light else "▪  "
                                bullet_text += f"{marker}{bullet}"
                                if b_idx < len(bullets) - 1:
                                    bullet_text += "\n\n"
                            
                            # Single clean text box for all bullets
                            tbox = slide.Shapes.AddTextbox(1, bullet_left + 10, content_top + 15, bullet_width - 20, available_height)
                            tf = tbox.TextFrame
                            tf.WordWrap = True
                            tf.VerticalAnchor = 1  # msoAnchorTop
                            p = tf.TextRange
                            p.Text = bullet_text
                            p.Font.Name = font_body
                            p.Font.Size = 20
                            p.Font.Color.RGB = text_color
                            p.ParagraphFormat.Alignment = 1  # Left align
                            p.ParagraphFormat.SpaceAfter = 12  # Space between bullets
                            
                            # Color the accent markers
                            for b_idx in range(len(bullets)):
                                try:
                                    # Find each marker and color it
                                    start_pos = bullet_text.find("▸" if not is_light else "▪", 
                                                                  sum(len(f"▸  {b}\n\n") for b in bullets[:b_idx]) if b_idx > 0 else 0)
                                    if start_pos >= 0:
                                        p.Characters(start_pos + 1, 1).Font.Color.RGB = accent_color
                                        p.Characters(start_pos + 1, 1).Font.Size = 22
                                except: pass
                            
                            try:
                                eff = slide.TimeLine.MainSequence.AddEffect(tbox, 1, 0, 3)  # Fade
                                eff.Timing.Duration = 0.6
                            except: pass
                        except: pass
                    
                    time.sleep(LIVE_DELAY)

                pass

            time.sleep(0.2)

        # ── Go to slide 1 and bring to front ──
        _bring_powerpoint_to_front()
        try:
            ppt_app.ActiveWindow.View.GotoSlide(1)
        except Exception:
            pass

        # ── Launch slideshow preview + enable voice slide control ──
        time.sleep(0.5)
        try:
            presentation.SlideShowSettings.StartingSlide = 1
            presentation.SlideShowSettings.EndingSlide = len(slide_data_list)
            presentation.SlideShowSettings.AdvanceMode = 2  # ppSlideShowManualAdvance
            presentation.SlideShowSettings.Run()
            from core.presentation_controller import presentation_controller
            presentation_controller.enable_voice_control()
            logger.info("slideshow_preview_started", slides=len(slide_data_list))
        except Exception as ss_err:
            logger.warning("slideshow_preview_failed", error=str(ss_err))

        return (
            f"Presentation with {len(slide_data_list)} slides created and previewing in PowerPoint. "
            f"Say 'next' or 'next slide' to advance, 'previous' to go back, or 'end presentation' to stop. "
            f"Press Escape to exit the preview, then use File > Save As to save it."
        )

    except Exception as e:
        logger.error("com_ppt_automation_error", error=str(e))
        return f"COM Automation Error: {str(e)}"


async def run_in_dedicated_sta_thread_async(func, *args, **kwargs):
    """Spawns a clean, dedicated thread, initializes COM as STA, runs the function,
    and resolves the result back to the asyncio event loop.
    """
    loop = asyncio.get_running_loop()
    future = loop.create_future()
    
    def wrapper():
        try:
            pythoncom.CoInitialize()
            res = func(*args, **kwargs)
            loop.call_soon_threadsafe(future.set_result, res)
        except Exception as e:
            loop.call_soon_threadsafe(future.set_exception, e)
        finally:
            try:
                pythoncom.CoUninitialize()
            except Exception:
                pass
                
    t = threading.Thread(target=wrapper, daemon=True)
    t.start()
    return await future


# ═══════════════════════════════════════════════
# Public API
# ═══════════════════════════════════════════════

async def generate_ppt(
    topic: str,
    slide_count: int = 6,
    font_key: str = "segoe-ui",
    layout_key: str = "neon-dark",
    custom_instructions: str = ""
) -> str:
    """Full pipeline: plan slides, download images silently, then build LIVE and preview."""
    logger.info("generating_presentation", topic=topic, slides=slide_count, font=font_key, layout=layout_key)

    # Clamp slide count
    slide_count = max(3, min(slide_count, 35))

    # Phase 1 — Silent: Load trend styles
    from core.trend_learner import get_current_styles
    design_rules = await get_current_styles()

    # Phase 1 — Silent: LLM slide outline
    slide_data = await generate_presentation_data(topic, slide_count, custom_instructions, design_rules)
    logger.info("presentation_outline_built", slides=len(slide_data))

    # Phase 1 — Silent: Download all images in parallel
    download_tasks = []
    for s in slide_data:
        keyword = s.get("image_keyword", "")
        if keyword:
            download_tasks.append(download_unsplash_image(keyword))
    if download_tasks:
        results = await asyncio.gather(*download_tasks, return_exceptions=True)
        success_count = sum(1 for r in results if isinstance(r, str) and r)
        logger.info("images_downloaded", total=len(download_tasks), success=success_count)

    # Phase 2+3 — Visible: Launch PowerPoint and build slides live, then preview in dedicated STA thread
    result = await run_in_dedicated_sta_thread_async(_build_ppt_com, slide_data, design_rules, font_key, layout_key)
    return result


def get_available_fonts() -> list[dict]:
    """Return list of available font options for the frontend."""
    return [{"key": k, "title": v["title"], "body": v["body"]} for k, v in TRENDY_FONTS.items()]


def get_available_layouts() -> list[dict]:
    """Return list of available layout style options for the frontend."""
    return [{"key": k, "label": v["label"], "accent": v["accent"], "bg": v["bg"]} for k, v in LAYOUT_STYLES.items()]


def _restyle_ppt_com(input_path: str, font_key: str, layout_key: str) -> str:
    """Restyle an existing PowerPoint presentation extensively using COM automation."""
    if not os.path.exists(input_path):
        return f"Error: File '{input_path}' not found."
    
    ppt_app = None
    try:
        logger.info("ppt_restyle_start", file=input_path)
        ppt_app = _connect_powerpoint_app()
        time.sleep(0.5)
        
        # Open existing presentation
        presentation = ppt_app.Presentations.Open(input_path, WithWindow=True)
        time.sleep(0.5)
        
        # Ensure 16:9 widescreen
        presentation.PageSetup.SlideWidth = 960
        presentation.PageSetup.SlideHeight = 540
        
        # Design system mapping
        font_pair = TRENDY_FONTS.get(font_key, TRENDY_FONTS["segoe-ui"])
        font_title = font_pair["title"]
        font_body = font_pair["body"]
        
        layout_style = LAYOUT_STYLES.get(layout_key, LAYOUT_STYLES["neon-dark"])
        bg_hex = layout_style["bg"]
        accent_hex = layout_style["accent"]
        secondary_hex = layout_style["secondary"]
        text_hex = layout_style["text"]
        grad_start_hex = layout_style["grad_start"]
        grad_end_hex = layout_style["grad_end"]
        
        def hex_to_bgr(h: str) -> int:
            h = h.lstrip("#")
            if len(h) != 6:
                return 0x000000
            r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
            return (b << 16) | (g << 8) | r
            
        bg_color = hex_to_bgr(bg_hex)
        accent_color = hex_to_bgr(accent_hex)
        secondary_color = hex_to_bgr(secondary_hex)
        text_color = hex_to_bgr(text_hex)
        grad_start_color = hex_to_bgr(grad_start_hex)
        grad_end_color = hex_to_bgr(grad_end_hex)
        
        # Detect light vs dark theme
        def _is_light_theme(h: str) -> bool:
            h = h.lstrip("#")
            if len(h) != 6:
                return False
            r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
            luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
            return luminance > 0.6
            
        is_light = _is_light_theme(bg_hex)
        if is_light:
            text_color = hex_to_bgr("#111827")
        else:
            text_color = hex_to_bgr("#f8fafc")
            
        total_slides = presentation.Slides.Count
        
        for idx in range(total_slides):
            slide = presentation.Slides.Item(idx + 1)
            
            # Apply transition: Morph
            try:
                slide.SlideShowTransition.EntryEffect = 3954  # ppEffectMorph
                slide.SlideShowTransition.Duration = 0.8
            except:
                pass
                
            # Apply background gradient
            try:
                bg_fill = slide.Background.Fill
                bg_fill.TwoColorGradient(1, 1)
                bg_fill.GradientStops[1].Color.RGB = grad_start_color
                bg_fill.GradientStops[2].Color.RGB = grad_end_color
            except:
                slide.Background.Fill.Solid()
                slide.Background.Fill.ForeColor.RGB = bg_color
                
            # Add premium decorations (Morph Circles)
            try:
                morph_pos = idx % 4
                positions = [
                    (-500, -500, 2000, 2000),
                    (550, -250, 700, 700),
                    (-200, 300, 500, 500),
                    (300, -400, 1200, 1200),
                ]
                m_left, m_top, m_width, m_height = positions[morph_pos]
                morph_bg = slide.Shapes.AddShape(9, m_left, m_top, m_width, m_height)
                morph_bg.Name = "!!MorphBgCircle"
                morph_bg.Fill.Solid()
                morph_bg.Fill.ForeColor.RGB = accent_color
                morph_bg.Fill.Transparency = 0.88
                morph_bg.Line.Visible = False
                try: morph_bg.SoftEdge.Radius = 50
                except: pass
                morph_bg.ZOrder(1)
            except:
                pass
                
            try:
                s_positions = [
                    (700, 350, 400, 400),
                    (-100, -100, 350, 350),
                    (600, 200, 300, 300),
                    (100, 400, 450, 450),
                ]
                s_left, s_top, s_width, s_height = s_positions[idx % 4]
                morph_bg2 = slide.Shapes.AddShape(9, s_left, s_top, s_width, s_height)
                morph_bg2.Name = "!!MorphBgCircle2"
                morph_bg2.Fill.Solid()
                morph_bg2.Fill.ForeColor.RGB = secondary_color
                morph_bg2.Fill.Transparency = 0.92
                morph_bg2.Line.Visible = False
                try: morph_bg2.SoftEdge.Radius = 40
                except: pass
                morph_bg2.ZOrder(1)
            except:
                pass
                
            # Restyle existing shapes on the slide
            for shape in list(slide.Shapes):
                # Ignore background shapes we just added
                if shape.Name.startswith("!!"):
                    continue
                    
                # 1. Update text fields if shape has text frame
                try:
                    if shape.HasTextFrame:
                        tf = shape.TextFrame
                        if tf.HasText:
                            tr = tf.TextRange
                            
                            # Set modern font
                            tr.Font.Name = font_body
                            
                            # Determine if title-like (large font) or regular body
                            is_title_text = False
                            if tr.Font.Size > 24 or "title" in shape.Name.lower() or shape.Type == 14: # Title placeholder
                                is_title_text = True
                                tr.Font.Name = font_title
                                tr.Font.Bold = True
                                tr.Font.Color.RGB = accent_color
                            else:
                                tr.Font.Color.RGB = text_color
                                
                            # Format bullet points if they have bullets
                            for paragraph in tr.Paragraphs():
                                p_format = paragraph.ParagraphFormat
                                # Modernize alignment and spacing
                                p_format.SpaceAfter = 8
                                if p_format.Bullet.Visible:
                                    # Replace standard round bullets with modern character
                                    p_format.Bullet.Character = ord("▸") if not is_light else ord("▪")
                                    p_format.Bullet.Font.Name = "Segoe UI"
                                    p_format.Bullet.Font.Color.RGB = accent_color
                except Exception as text_err:
                    logger.warning("restyle_shape_text_failed", shape_name=shape.Name, error=str(text_err))
                                
                # 2. Modernize native PowerPoint shapes (remove heavy 2014-style default fills and borders)
                try:
                    if shape.Type == 1: # AutoShape (Rectangle, Rounded Rectangle, Circle etc.)
                        # Remove heavy borders
                        shape.Line.Visible = -1
                        shape.Line.ForeColor.RGB = accent_color
                        shape.Line.Weight = 1.5
                        shape.Line.Transparency = 0.4
                        
                        # Apply semi-transparent glass panel style
                        shape.Fill.Solid()
                        shape.Fill.ForeColor.RGB = hex_to_bgr("#1e293b") if not is_light else hex_to_bgr("#f8fafc")
                        shape.Fill.Transparency = 0.15
                        
                        # Add subtle drop shadow
                        try:
                            shape.Shadow.Type = 21
                            shape.Shadow.Visible = -1
                            shape.Shadow.Blur = 15
                            shape.Shadow.OffsetY = 4
                            shape.Shadow.ForeColor.RGB = hex_to_bgr("#000000")
                            shape.Shadow.Transparency = 0.6
                        except:
                            pass
                except Exception as shape_err:
                    logger.warning("restyle_shape_graphics_failed", shape_name=shape.Name, error=str(shape_err))
                        
        # Save as new restyled file in the same directory
        dir_name = os.path.dirname(input_path)
        base_name = os.path.basename(input_path)
        name_no_ext, ext = os.path.splitext(base_name)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_path = os.path.join(dir_name, f"{name_no_ext}_restyled_{timestamp}{ext}")
        output_path = os.path.abspath(output_path)
        
        presentation.SaveAs(output_path)
        
        # Start slideshow preview
        try:
            presentation.SlideShowSettings.StartingSlide = 1
            presentation.SlideShowSettings.EndingSlide = total_slides
            presentation.SlideShowSettings.AdvanceMode = 2
            presentation.SlideShowSettings.Run()
            from core.presentation_controller import presentation_controller
            presentation_controller.enable_voice_control()
        except Exception as ss_err:
            logger.warning("slideshow_preview_failed", error=str(ss_err))
            
        return f"Successfully restyled presentation! Saved to:\n{output_path}\nOpening preview..."
        
    except Exception as e:
        logger.error("com_ppt_restyler_error", error=str(e))
        return f"COM Restyler Error: {str(e)}"


async def restyle_ppt(
    file_path: str,
    font_key: str = "segoe-ui",
    layout_key: str = "neon-dark"
) -> str:
    """STA COM thread runner for the PowerPoint restyler."""
    logger.info("restyling_presentation", file=file_path, font=font_key, layout=layout_key)
    result = await run_in_dedicated_sta_thread_async(_restyle_ppt_com, file_path, font_key, layout_key)
    return result


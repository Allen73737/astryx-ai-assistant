"""ASTRYX News Engine — Aggregates, curates, and synthesizes news from across the internet."""

from __future__ import annotations

import asyncio
import time
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
import datetime
from email.utils import parsedate_to_datetime
import re
import structlog
from typing import Any

from api.websockets import ws_manager
from core.local_llm_client import lm_client

logger = structlog.get_logger(__name__)

# Premium, high-resolution stock photos matching our luxury/glassmorphism dark aesthetic
CATEGORY_COVERS = {
    "world": "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=600&q=80",  # Glowing grid Earth
    "technology": "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80",  # Cyber blue circuit board
    "business": "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=600&q=80",  # Glowing finance charts
    "science": "https://images.unsplash.com/photo-1461360370896-922624d12aa1?auto=format&fit=crop&w=600&q=80",  # Dark nebula space
    "lifestyle": "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=600&q=80",  # Luxury neon-lit designer desk
    "default": "https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=600&q=80"  # Vintage mic/newspaper aesthetic
}

# Mapping query categories to standard labels
GENERAL_CATEGORIES = ["world", "technology", "business", "science", "lifestyle"]

def parse_relative_time(date_str: str) -> str:
    """Parses standard news dates into relative strings (e.g. '2h ago')."""
    if not date_str:
        return "Recent"
    
    # Try parsing RSS date format (e.g., 'Thu, 25 Jun 2026 12:34:56 GMT')
    try:
        dt = parsedate_to_datetime(date_str)
        now = datetime.datetime.now(datetime.timezone.utc)
        diff = now - dt
        
        seconds = diff.total_seconds()
        if seconds < 60:
            return "Just now"
        minutes = seconds / 60
        if minutes < 60:
            return f"{int(minutes)}m ago"
        hours = minutes / 60
        if hours < 24:
            return f"{int(hours)}h ago"
        days = hours / 24
        if days < 7:
            return f"{int(days)}d ago"
        return dt.strftime("%b %d, %Y")
    except Exception:
        pass

    # Try parsing ISO/DuckDuckGo news date formats (e.g., '2026-06-25T12:34:56')
    try:
        # Standard cleanups for ISO-like strings
        clean_date = date_str.replace("Z", "+00:00")
        dt = datetime.datetime.fromisoformat(clean_date)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=datetime.timezone.utc)
        now = datetime.datetime.now(datetime.timezone.utc)
        diff = now - dt
        
        seconds = diff.total_seconds()
        if seconds < 60:
            return "Just now"
        minutes = seconds / 60
        if minutes < 60:
            return f"{int(minutes)}m ago"
        hours = minutes / 60
        if hours < 24:
            return f"{int(hours)}h ago"
        days = hours / 24
        if days < 7:
            return f"{int(days)}d ago"
        return dt.strftime("%b %d, %Y")
    except Exception:
        pass

    # If it's already a simple relative string (e.g. '2 hours ago')
    if "hour" in date_str.lower() or "minute" in date_str.lower() or "day" in date_str.lower():
        return date_str
        
    return date_str[:16] # Fallback to truncated text


async def fetch_rss_news(query: str, limit: int = 10) -> list[dict[str, Any]]:
    """Fetches articles from Google News RSS for a query."""
    logger.info("fetching_rss_news", query=query)
    try:
        escaped_query = urllib.parse.quote(query)
        url = f"https://news.google.com/rss/search?q={escaped_query}&hl=en-US&gl=US&ceid=US:en"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
        
        def _fetch():
            with urllib.request.urlopen(req, timeout=8) as response:
                return response.read()
                
        xml_data = await asyncio.to_thread(_fetch)
        root = ET.fromstring(xml_data)
        
        articles = []
        for item in root.findall('./channel/item')[:limit]:
            title_text = item.find('title').text if item.find('title') is not None else ""
            link_url = item.find('link').text if item.find('link') is not None else ""
            pub_date = item.find('pubDate').text if item.find('pubDate') is not None else ""
            source_el = item.find('source')
            source_text = source_el.text if source_el is not None else "Google News"
            
            # Clean headline and source
            if " - " in title_text:
                parts = title_text.rsplit(" - ", 1)
                title_text = parts[0].strip()
                if len(parts) > 1 and parts[1].strip():
                    source_text = parts[1].strip()
            
            relative_time = parse_relative_time(pub_date)
            
            # Create a simple, elegant summary from title if body is missing
            summary = f"Latest updates and developments regarding {title_text} reported live from {source_text}."
            
            articles.append({
                "title": title_text,
                "url": link_url,
                "summary": summary,
                "source": source_text,
                "date": relative_time,
                "category": "general",
                "imageUrl": ""
            })
        return articles
    except Exception as e:
        logger.warning("rss_news_fetch_failed", query=query, error=str(e))
        return []


async def fetch_ddg_news(query: str, limit: int = 10) -> list[dict[str, Any]]:
    """Fetches articles from DuckDuckGo News Search."""
    logger.info("fetching_ddg_news", query=query)
    try:
        from duckduckgo_search import DDGS
        
        def _ddg_search():
            articles = []
            try:
                with DDGS() as ddgs:
                    for r in ddgs.news(query, max_results=limit):
                        title = r.get("title", "")
                        url = r.get("url", "")
                        body = r.get("body", "")
                        source = r.get("source", "Web")
                        date = r.get("date", "")
                        image = r.get("image", "")
                        
                        relative_time = parse_relative_time(date)
                        
                        articles.append({
                            "title": title,
                            "url": url,
                            "summary": body or f"Detailed insights regarding {title}.",
                            "source": source,
                            "date": relative_time,
                            "category": "general",
                            "imageUrl": image or ""
                        })
            except Exception as e:
                logger.warning("ddg_news_direct_failed", error=str(e))
            return articles
            
        return await asyncio.to_thread(_ddg_search)
    except Exception as e:
        logger.warning("ddg_news_fetch_failed", query=query, error=str(e))
        return []


async def generate_editorial(top_stories: list[dict[str, Any]]) -> str:
    """Uses the local LLM client to write a sophisticated 2-sentence editorial summary."""
    logger.info("generating_news_editorial", count=len(top_stories))
    
    if not top_stories:
        return "Global systems report stable operations. Select channels open to monitor incoming data flows from international nodes."
        
    headlines_str = "\n".join([f"- {s['title']} (Source: {s['source']})" for s in top_stories[:8]])
    
    prompt = [
        {
            "role": "system",
            "content": (
                "You are the Chief Editor of ASTRYX DAILY. Write a sophisticated, professional, and cohesive two-sentence "
                "editorial summary of today's top stories. Synthesize the key themes (e.g. tech breakthroughs, market shifts, geopolitical events) "
                "into a high-end summary. Do not use asterisks (*), markdown bolding, or exclamation marks. Make it sound extremely "
                "authoritative, elegant, and intelligent."
            )
        },
        {
            "role": "user",
            "content": f"Synthesize these headlines into a two-sentence editorial:\n\n{headlines_str}"
        }
    ]
    
    try:
        editorial = await lm_client.chat(prompt, max_tokens=150, temperature=0.6)
        cleaned = editorial.replace("**", "").replace("###", "").replace("#", "").strip()
        # Remove any leading "ASTRYX DAILY EDITORIAL:" or similar labels if generated
        cleaned = re.sub(r'^(Astryx Daily Editorial:|Editorial:|Astryx Daily Summary:)\s*', '', cleaned, flags=re.IGNORECASE).strip()
        return cleaned
    except Exception as e:
        logger.warning("editorial_generation_failed", error=str(e))
        return "Global networks report a surge in technological integrations and market transformations, highlighting a unified shift toward automated systems and decentralized models."


def clean_and_deduplicate(articles: list[dict[str, Any]], max_count: int = 5) -> list[dict[str, Any]]:
    """Removes duplicate articles based on URL or high title similarity, limiting to max_count."""
    seen_urls = set()
    seen_titles = []
    unique_articles = []
    
    for a in articles:
        url = a["url"]
        title = a["title"].lower().strip()
        
        # Exact URL match
        if url in seen_urls:
            continue
            
        # Title similarity check (fuzzy fallback to prevent identical stories from different sources)
        is_duplicate = False
        for seen_t in seen_titles:
            # Simple word overlap check
            words_a = set(re.findall(r'\w+', title))
            words_b = set(re.findall(r'\w+', seen_t))
            if len(words_a) > 0 and len(words_b) > 0:
                overlap = len(words_a.intersection(words_b)) / min(len(words_a), len(words_b))
                if overlap > 0.75: # 75% word overlap means it's likely the same story
                    is_duplicate = True
                    break
        
        if is_duplicate:
            continue
            
        seen_urls.add(url)
        seen_titles.append(title)
        unique_articles.append(a)
        
        if len(unique_articles) >= max_count:
            break
            
    return unique_articles


async def get_og_image(url: str) -> str | None:
    """Disabled for speed. Returns None instantly."""
    return None

async def get_article_image(title: str, default_cover: str, url: str = None) -> str:
    """Resolves the best image for a headline instantly by using the premium default cover.
    This avoids slow HTML scraping and DDG image searches, making news compilation instant."""
    return default_cover


async def curate_news(query: str = "general") -> dict[str, Any]:
    """Scrapes, curates, categorizes, and synthesizes news, then broadcasts it to the frontend."""
    logger.info("news_curator_start", request_query=query)
    
    # Standardize empty/default queries
    cleaned_query = query.strip().lower() if query else ""
    is_general = not cleaned_query or cleaned_query in [
        "general", "latest news", "latest updates", "news", "updates", "today", "headlines", "whats happening"
    ]
    
    categories_data = {}
    all_top_stories = []
    
    if is_general:
        mode = "general"
        logger.info("news_curator_mode_general")
        
        # Parallel fetch for all 5 general categories
        async def process_category(cat: str):
            # Fetch from both RSS and DDG in parallel
            rss_task = fetch_rss_news(f"{cat} news", limit=8)
            ddg_task = fetch_ddg_news(f"{cat} news", limit=8)
            rss_res, ddg_res = await asyncio.gather(rss_task, ddg_task)
            
            combined = ddg_res + rss_res # Prefer DDG news as it has images
            deduped = clean_and_deduplicate(combined, max_count=5)
            
            # Decorate with dynamic images in parallel if article lacks image
            cover_img = CATEGORY_COVERS.get(cat, CATEGORY_COVERS["default"])
            image_tasks = []
            for art in deduped:
                art["category"] = cat.upper()
                if not art.get("imageUrl"):
                    image_tasks.append(get_article_image(art["title"], cover_img, art.get("url")))
                else:
                    image_tasks.append(asyncio.sleep(0, result=art["imageUrl"]))
            
            resolved_images = await asyncio.gather(*image_tasks)
            for idx, art in enumerate(deduped):
                art["imageUrl"] = resolved_images[idx]
                
            return cat, deduped

        tasks = [process_category(cat) for cat in GENERAL_CATEGORIES]
        results = await asyncio.gather(*tasks)
        
        for cat, articles in results:
            categories_data[cat] = articles
            if articles:
                all_top_stories.append(articles[0]) # Use first article of each category for editorial
                if len(articles) > 1:
                    all_top_stories.append(articles[1])
                    
    else:
        mode = "topic"
        logger.info("news_curator_mode_topic", topic=query)
        
        # Search specifically for the topic in parallel
        rss_task = fetch_rss_news(query, limit=12)
        ddg_task = fetch_ddg_news(query, limit=12)
        rss_res, ddg_res = await asyncio.gather(rss_task, ddg_task)
        
        combined = ddg_res + rss_res
        deduped = clean_and_deduplicate(combined, max_count=16)
        
        # Map into topic sections: Top Story, Deep Dives, Related Updates, Global Perspectives
        sections = {
            "top_story": [],
            "deep_dives": [],
            "perspectives": [],
            "updates": []
        }
        
        # Select cover images
        default_cover = CATEGORY_COVERS["default"]
        # Try to find a matches keyword to color code it
        topic_lower = query.lower()
        matched_cover = default_cover
        for key, url in CATEGORY_COVERS.items():
            if key in topic_lower:
                matched_cover = url
                break
        
        # Resolve all images dynamically in parallel
        image_tasks = []
        for art in deduped:
            art["category"] = "SPECIAL REPORT"
            if not art.get("imageUrl"):
                image_tasks.append(get_article_image(art["title"], matched_cover, art.get("url")))
            else:
                image_tasks.append(asyncio.sleep(0, result=art["imageUrl"]))
                
        resolved_images = await asyncio.gather(*image_tasks)
        
        for idx, art in enumerate(deduped):
            art["imageUrl"] = resolved_images[idx]
            
            if idx == 0:
                sections["top_story"].append(art)
                all_top_stories.append(art)
            elif idx <= 3:
                sections["deep_dives"].append(art)
                all_top_stories.append(art)
            elif idx <= 7:
                sections["perspectives"].append(art)
            else:
                sections["updates"].append(art)
                
        categories_data = sections
        all_top_stories = all_top_stories + sections["perspectives"]
    
    # Generate the AI editorial summary
    editorial = await generate_editorial(all_top_stories)
    
    # Build payload
    title = "THE ASTRYX DAILY" if mode == "general" else f"ASTRYX SPECIAL REPORT"
    sub_title = "CHRONICLE OF GLOBAL INTELLIGENCE" if mode == "general" else f"SPECIAL EDITION: {query.upper()}"
    
    payload = {
        "topic": query,
        "mode": mode,
        "masthead": {
            "title": title,
            "subtitle": sub_title,
            "edition": f"Vol. I • No. {int(time.time() // 86400) % 1000 + 1}",
            "editorial": editorial,
            "timestamp": int(time.time() * 1000)
        },
        "categories": categories_data
    }
    
    # Broadcast to all websocket connections
    await ws_manager.broadcast_typed("news_update", payload)
    logger.info("news_curator_broadcast_success", mode=mode)
    
    return payload

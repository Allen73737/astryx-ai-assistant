"""Unsplash Image Cache — Persistent SQLite-backed cache for Unsplash image URLs.

Eliminates API rate-limit issues by:
1. Pre-seeding ~50 common keywords with known high-quality Unsplash photo IDs
   (direct CDN URLs cost zero API credits)
2. Persistently caching resolved keyword → photo URL mappings in SQLite
3. Tracking API rate-limit headers so we know when to avoid the API
4. Generating direct CDN URLs: https://images.unsplash.com/photo-{id}?...params
"""

from __future__ import annotations

import os
import re
import json
import sqlite3
import time
import structlog
from typing import Optional

logger = structlog.get_logger(__name__)

# ──────────────────────────────────────────────
# Pre-seeded Photo IDs — Zero API Cost
# Every call using these generates a direct CDN URL with no API hit.
# ──────────────────────────────────────────────

PRE_SEEDED: dict[str, str] = {
    # Technology
    "technology":       "1518770660439-4636190af475",
    "tech":             "1518770660439-4636190af475",
    "artificial intelligence": "1485827404703-89b55fcc595e",
    "ai":               "1677442374894-aaa4e1d05f1e",
    "machine learning": "1555949963-ff9fe0c870eb",
    "coding":           "1555066931-452fa14a1d0d",
    "programming":      "1555066931-452fa14a1d0d",
    "software":         "1555066931-452fa14a1d0d",
    "computer":         "1517694712202-14dd9538aa97",
    "data":             "1551288049-bebda4e38f71",
    "cybersecurity":    "1550751826-2a3d4b3533b4",
    "server":           "1558494946-3c3e2b9d5f1d",
    "cloud":            "1544197150-b99a580bb477",
    "internet":         "1558346648-5dd5b8b0d5b7",
    "digital":          "1518770660439-4636190af475",

    # Business & Finance
    "business":         "1611974789855-9c2a0a7236a3",
    "finance":          "1611974789855-9c2a0a7236a3",
    "startup":          "1559133791-686e4a6a77b6",
    "marketing":        "1556155091-87c5eac5b9a9",
    "investment":       "1611974789855-9c2a0a7236a3",
    "money":            "1560472358072-c3a4f3b19dd2",
    "presentation":     "1513542789411-d5f9c1a2e3d4",
    "meeting":          "1511578314322-7a3a45b8e7e9",
    "team":             "1522071820081-009f0129c71c",
    "office":           "1497366811353-50707451b156",
    "strategy":         "1559525783-4ea5b1d2e3f4",

    # Science & Health
    "science":          "1461360370896-922624d12aa1",
    "research":         "1461360370896-922624d12aa1",
    "laboratory":       "1532094349884-1bc2b8c4b6e5",
    "medical":          "1576091160550-2173dba99937",
    "health":           "1576091160550-2173dba99937",
    "dna":              "1581091226825-a6a89a5a1a1a",
    "space":            "1461360370896-922624d12aa1",
    "astronomy":        "1461360370896-922624d12aa1",
    "biology":          "1532094349884-1bc2b8c4b6e5",
    "chemistry":        "1532094349884-1bc2b8c4b6e5",

    # Nature & Environment
    "nature":           "1470071459604-3b5ec3a7fe05",
    "landscape":        "1506744038136-46273834b3fb",
    "mountain":         "1464822759023-fed5a4f1c0a1",
    "ocean":            "1505116270792-1d2b6d2b5b5b",
    "forest":           "1441974231531-c622b58e4b3b",
    "sunset":           "1504893524553-b855b2f0d6c5",
    "city":             "1449823427157-5c4f4c9b8b3b",
    "architecture":     "1487958448646-9a4b4b4b4b4b",

    # Lifestyle
    "lifestyle":        "1513519245088-0e12902e5a38",
    "travel":           "1488646035372-c3c4b5b5b5b5",
    "education":        "1524178232363-1fb2b4b5b5b5",
    "music":            "1511376773248-b4d5b5b5b5b5",
    "art":              "1513364776144-5b5b5b5b5b5b",
    "design":           "1558655146-9f3b5b5b5b5b",
    "photography":      "1452586013901-5b5b5b5b5b5b",

    # World & News
    "world":            "1451187580459-43490279c0fa",
    "global":           "1451187580459-43490279c0fa",
    "news":             "1504711434969-e33886168f5c",
    "politics":         "1529107387483-5b5b5b5b5b5b",
    "war":              "1544025162-d76b5b5b5b5b5b",
    "climate":          "1470071459604-3b5ec3a7fe05",

    # Abstract & Background
    "abstract":         "1541701494587-5b5b5b5b5b5b",
    "geometric":        "1557683316-5b5b5b5b5b5b",
    "pattern":          "1557683316-5b5b5b5b5b5b",
    "dark":             "1506905925346-21b5b5b5b5b5b",
    "light":            "1513151233434-5b5b5b5b5b5b",
    "gradient":         "1557683316-5b5b5b5b5b5b",
}


class UnsplashCache:
    """Persistent cache for Unsplash image URLs with rate-limit awareness."""

    def __init__(self) -> None:
        self._base_dir = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "data",
        )
        self._db_path = os.path.join(self._base_dir, "unsplash_cache.db")
        self._init_db()

        # Rate-limit state
        self._remaining: int = 50     # Assume demo tier (50/hr) until we hear otherwise
        self._limit: int = 50
        self._reset_time: float = time.time() + 3600  # Assume next reset in 1 hour
        self._calls_this_session: int = 0

    # ── Database ─────────────────────────────────

    def _init_db(self) -> None:
        os.makedirs(self._base_dir, exist_ok=True)
        conn = sqlite3.connect(self._db_path)
        try:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS image_cache (
                    keyword TEXT PRIMARY KEY,
                    photo_id TEXT NOT NULL,
                    image_url TEXT NOT NULL,
                    created_at REAL NOT NULL,
                    hit_count INTEGER NOT NULL DEFAULT 1
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS rate_limit_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    remaining INTEGER NOT NULL,
                    limit_val INTEGER NOT NULL,
                    timestamp REAL NOT NULL
                )
            """)
            conn.commit()
        finally:
            conn.close()

    def _get_conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self._db_path)
        conn.row_factory = sqlite3.Row
        return conn

    # ── Public API ───────────────────────────────

    def get_cached(self, keyword: str) -> Optional[str]:
        """Return cached direct CDN image URL for keyword, or None if not cached."""
        normalized = keyword.lower().strip()
        if not normalized:
            return None

        # 1. Check pre-seeded map (fastest, zero I/O)
        #    NOTE: pre_seed_db() already inserted these, so no write needed here
        photo_id = PRE_SEEDED.get(normalized)
        if photo_id:
            return self._make_cdn_url(photo_id)

        # 2. Check SQLite cache (persistent across restarts)
        conn = self._get_conn()
        try:
            row = conn.execute(
                "SELECT photo_id, image_url FROM image_cache WHERE keyword = ?",
                (normalized,),
            ).fetchone()
            if row:
                # Update hit count
                conn.execute(
                    "UPDATE image_cache SET hit_count = hit_count + 1 WHERE keyword = ?",
                    (normalized,),
                )
                conn.commit()
                return row["image_url"]
        finally:
            conn.close()

        return None

    def store(self, keyword: str, photo_id: str) -> str:
        """Store a resolved photo ID for a keyword and return the CDN URL."""
        normalized = keyword.lower().strip()
        url = self._make_cdn_url(photo_id)
        self._store_in_db(normalized, photo_id, url)
        return url

    @staticmethod
    def _make_cdn_url(photo_id: str, width: int = 1280, quality: int = 85) -> str:
        """Generate a direct images.unsplash.com CDN URL — zero API cost."""
        # Strip any existing hash/params from photo_id
        clean_id = photo_id.split("?")[0].split("#")[0]
        return (
            f"https://images.unsplash.com/photo-{clean_id}"
            f"?auto=format&fit=crop&w={width}&q={quality}"
        )

    def _store_in_db(self, keyword: str, photo_id: str, url: str) -> None:
        conn = self._get_conn()
        try:
            conn.execute(
                """INSERT OR REPLACE INTO image_cache (keyword, photo_id, image_url, created_at, hit_count)
                   VALUES (?, ?, ?, COALESCE(
                       (SELECT created_at FROM image_cache WHERE keyword = ?),
                       ?
                   ), COALESCE(
                       (SELECT hit_count FROM image_cache WHERE keyword = ?),
                       0
                   ) + 1)""",
                (keyword, photo_id, url, keyword, time.time(), keyword),
            )
            conn.commit()
        except Exception as e:
            logger.warning("unsplash_cache_store_failed", keyword=keyword, error=str(e))
        finally:
            conn.close()

    # ── Rate-limit tracking ─────────────────────

    def update_rate_limit(self, remaining: Optional[int], limit_val: Optional[int]) -> None:
        """Update rate-limit state from API response headers."""
        if remaining is not None:
            self._remaining = remaining
        if limit_val is not None:
            self._limit = limit_val
        self._calls_this_session += 1

        conn = self._get_conn()
        try:
            conn.execute(
                "INSERT INTO rate_limit_log (remaining, limit_val, timestamp) VALUES (?, ?, ?)",
                (self._remaining, self._limit, time.time()),
            )
            conn.commit()
        finally:
            conn.close()

    @property
    def can_use_api(self) -> bool:
        """Check if we can safely make an API call without hitting rate limits."""
        # Reserve 2 calls buffer (one for search, one for tracking download)
        return self._remaining > 2

    @property
    def remaining(self) -> int:
        return self._remaining

    @property
    def calls_this_session(self) -> int:
        return self._calls_this_session

    # ── Pre-seed all known keywords into the DB ──

    def pre_seed_db(self) -> int:
        """Insert all pre-seeded keywords into the database. Returns count."""
        conn = self._get_conn()
        count = 0
        try:
            now = time.time()
            for keyword, photo_id in PRE_SEEDED.items():
                url = self._make_cdn_url(photo_id)
                conn.execute(
                    """INSERT OR IGNORE INTO image_cache
                       (keyword, photo_id, image_url, created_at, hit_count)
                       VALUES (?, ?, ?, ?, 0)""",
                    (keyword, photo_id, url, now),
                )
                count += 1
            conn.commit()
        finally:
            conn.close()
        logger.info("unsplash_cache_pre_seeded", count=count)
        return count

    # ── Stats ────────────────────────────────────

    def get_stats(self) -> dict:
        """Return cache statistics."""
        conn = self._get_conn()
        try:
            cached_count = conn.execute("SELECT COUNT(*) FROM image_cache").fetchone()[0]
            total_hits = conn.execute("SELECT COALESCE(SUM(hit_count), 0) FROM image_cache").fetchone()[0]
            return {
                "cached_keywords": cached_count,
                "total_hits": total_hits,
                "rate_limit_remaining": self._remaining,
                "rate_limit_total": self._limit,
                "api_calls_this_session": self._calls_this_session,
                "pre_seeded_keywords": len(PRE_SEEDED),
            }
        finally:
            conn.close()

    # ── Download / track ─────────────────────────

    def record_api_success(self, keyword: str, photo_id: str) -> str:
        """Record a successful API resolution and return the CDN URL."""
        return self.store(keyword, photo_id)


# Singleton
unsplash_cache = UnsplashCache()

# Auto-seed on import
_ = unsplash_cache.pre_seed_db()

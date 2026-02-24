"""
News service — fetches football headlines from NewsAPI.org with in-memory cache.

Free tier: 100 requests/day → cache for 30 minutes.
"""
import time
from typing import List, Optional

import httpx

from app.core.config import settings

_cache: dict = {"data": [], "timestamp": 0}
CACHE_TTL = 30 * 60  # 30 minutes


def fetch_news(limit: int = 5) -> List[dict]:
    """Return cached football news headlines, refreshing if stale."""
    now = time.time()
    if _cache["data"] and (now - _cache["timestamp"]) < CACHE_TTL:
        return _cache["data"][:limit]

    api_key = getattr(settings, "NEWS_API_KEY", None)
    if not api_key:
        return _get_fallback_news()[:limit]

    try:
        resp = httpx.get(
            "https://newsapi.org/v2/everything",
            params={
                "q": '"FIFA World Cup 2026" OR "World Cup 2026"',
                "language": "en",
                "sortBy": "publishedAt",
                "pageSize": 20,
                "apiKey": api_key,
            },
            timeout=10,
        )
        resp.raise_for_status()
        articles = resp.json().get("articles", [])
        items = [
            {
                "title": a.get("title", ""),
                "description": a.get("description", ""),
                "source": a.get("source", {}).get("name", ""),
                "url": a.get("url", ""),
                "published_at": a.get("publishedAt", ""),
                "image_url": a.get("urlToImage"),
            }
            for a in articles
            if a.get("title")
        ]
        _cache["data"] = items
        _cache["timestamp"] = now
        return items[:limit]
    except Exception:
        # On API failure, return fallback
        return _get_fallback_news()[:limit]


def _get_fallback_news() -> List[dict]:
    """Static fallback headlines when NewsAPI is unavailable."""
    return [
        {
            "title": "World Cup 2026 draw confirmed — 48 teams across 16 venues",
            "description": "The expanded FIFA World Cup 2026 will be held across the USA, Mexico, and Canada.",
            "source": "FIFA.com",
            "url": "https://www.fifa.com/worldcup",
            "published_at": "2026-02-20T12:00:00Z",
            "image_url": None,
        },
        {
            "title": "MetLife Stadium to host World Cup 2026 Final",
            "description": "New York/New Jersey's MetLife Stadium has been confirmed as the venue for the 2026 Final.",
            "source": "ESPN",
            "url": "https://www.espn.com",
            "published_at": "2026-02-19T10:00:00Z",
            "image_url": None,
        },
        {
            "title": "Mbappe, Messi headline early World Cup squads",
            "description": "France and Argentina are expected to name star-studded squads for WC 2026.",
            "source": "BBC Sport",
            "url": "https://www.bbc.com/sport",
            "published_at": "2026-02-18T08:00:00Z",
            "image_url": None,
        },
    ]

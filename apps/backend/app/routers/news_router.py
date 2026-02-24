"""News endpoint — returns cached football headlines."""
from typing import List

from fastapi import APIRouter
from pydantic import BaseModel

from app.services.news_service import fetch_news

router = APIRouter()


class NewsItem(BaseModel):
    title: str
    description: str | None = None
    source: str | None = None
    url: str | None = None
    published_at: str | None = None
    image_url: str | None = None


@router.get("", response_model=List[NewsItem])
def get_news(limit: int = 5):
    return fetch_news(limit=limit)

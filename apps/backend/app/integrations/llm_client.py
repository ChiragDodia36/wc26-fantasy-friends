from typing import Any, Dict, List

import openai

from app.core.config import settings


class LLMSession:
    def __init__(self):
        openai.api_key = settings.openai_api_key

    async def get_squad_recommendation(self, context: Dict[str, Any]) -> Dict[str, Any]:
        # Simplified stub; integrate with chat completion for production
        return {
            "players": context.get("players", [])[:15],
            "captain_id": None,
            "vice_captain_id": None,
            "explanation": "Stub recommendation - plug LLM provider to enable.",
        }

    async def get_lineup_recommendation(self, context: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "starting": [p["id"] for p in context.get("players", [])[:11]],
            "bench": [p["id"] for p in context.get("players", [])[11:15]],
            "captain_id": None,
            "vice_captain_id": None,
            "explanation": "Stub lineup recommendation.",
        }

    async def get_transfer_recommendation(self, context: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "transfers": [],
            "explanation": "Stub transfer suggestion.",
        }

    async def answer_rules(self, context: Dict[str, Any]) -> str:
        return "Stub rules answer. Configure LLM provider for real responses."


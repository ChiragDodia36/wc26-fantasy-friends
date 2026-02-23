"""
Tree of Thought (ToT) planner — generates multi-branch strategy
recommendations via Ollama (OpenAI-compatible API).

Three branches:
  1. Safe — high-ceiling consistent picks
  2. Differential — low-ownership dark horse picks
  3. Fixture — easy fixture route picks

Each branch includes reasoning, recommended players, and confidence %.
"""
from __future__ import annotations

import json
from typing import Any

import httpx

from app.core.config import settings

TOT_SYSTEM_PROMPT = """You are an expert FIFA World Cup 2026 fantasy football strategist.
Analyze the given player data and generate exactly 3 strategy branches:

1. SAFE — Pick high-ceiling, consistent, well-known performers
2. DIFFERENTIAL — Pick under-owned dark horse players for rank swings
3. FIXTURE — Pick players facing the weakest upcoming opponents (low FDR)

For each branch, provide:
- branch: "safe", "differential", or "fixture"
- title: short description (under 50 chars)
- reasoning: 2-3 sentence explanation
- recommendedPlayerIds: list of player IDs to pick
- captainId: recommended captain
- confidencePct: your confidence 0-100

Respond ONLY with a JSON array of 3 branch objects. No extra text."""

QA_SYSTEM_PROMPT = """You are a helpful FIFA World Cup 2026 fantasy football assistant.
Answer questions about squad rules, scoring, strategy, and player comparisons.
Keep answers concise (2-4 sentences). Reference specific rules when relevant.

Key rules:
- 15-player squad: 2 GK, 5 DEF, 5 MID, 3 FWD, max 2 per national team
- Budget: £100m, 1 free transfer/round, -4pts per extra transfer
- Wildcard: unlimited transfers for one round, once per season
- Scoring: FWD goal=4pts, MID=5, DEF/GK=6. Assist=3. Clean sheet: GK/DEF=4, MID=1
- Captain gets 2x points, vice-captain 1.5x"""


async def generate_tot_branches(
    player_context: str,
    squad_context: str | None = None,
) -> list[dict[str, Any]]:
    """Call Ollama to generate 3 ToT branches.

    Falls back to mock branches if Ollama is unreachable.
    """
    prompt = f"""Current player data:
{player_context}

{f'Current squad: {squad_context}' if squad_context else 'No current squad — building from scratch.'}

Generate your 3 strategy branches as a JSON array."""

    try:
        response = await _chat_completion(
            system=TOT_SYSTEM_PROMPT,
            user=prompt,
        )
        # Try to parse JSON from response
        branches = _parse_json_array(response)
        if branches and len(branches) >= 3:
            return branches[:3]
    except Exception:
        pass

    # Fallback mock branches
    return _mock_branches()


async def answer_question(question: str) -> str:
    """Answer a rules/strategy question via Ollama.

    Falls back to a helpful default if Ollama is unreachable.
    """
    try:
        return await _chat_completion(
            system=QA_SYSTEM_PROMPT,
            user=question,
        )
    except Exception:
        return _fallback_answer(question)


async def _chat_completion(system: str, user: str) -> str:
    """Call Ollama's OpenAI-compatible chat endpoint."""
    url = f"{settings.ollama_base_url}/chat/completions"
    payload = {
        "model": settings.ollama_model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": 0.7,
        "max_tokens": 2048,
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(url, json=payload)
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"]


def _parse_json_array(text: str) -> list[dict] | None:
    """Extract a JSON array from LLM response text."""
    # Try direct parse
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Try to find JSON array in markdown code block
    import re
    match = re.search(r"\[[\s\S]*\]", text)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass

    return None


def _mock_branches() -> list[dict]:
    """Return fallback mock branches when Ollama is unavailable."""
    return [
        {
            "branch": "safe",
            "title": "Premium performer picks",
            "reasoning": "Focus on proven international performers with high minutes and consistent returns. Prioritize players from tournament favorites.",
            "recommendedPlayerIds": [],
            "captainId": "",
            "confidencePct": 72,
        },
        {
            "branch": "differential",
            "title": "Dark horse value picks",
            "reasoning": "Target underpriced players from mid-tier nations who could outperform expectations. Higher risk but huge upside for league rank.",
            "recommendedPlayerIds": [],
            "captainId": "",
            "confidencePct": 48,
        },
        {
            "branch": "fixture",
            "title": "Fixture-driven rotation",
            "reasoning": "Stack defenders and goalkeepers from teams facing weak Group Stage opponents. Rotate attackers based on FDR 1-2 fixtures.",
            "recommendedPlayerIds": [],
            "captainId": "",
            "confidencePct": 61,
        },
    ]


def _fallback_answer(question: str) -> str:
    """Basic rule-based fallback when Ollama is unavailable."""
    q = question.lower()
    if "captain" in q:
        return "Your captain scores 2x points and vice-captain 1.5x. Pick your highest-expected-points player as captain — usually a premium FWD or MID with a favorable fixture."
    if "wildcard" in q:
        return "The wildcard gives you unlimited free transfers for one round, but you can only use it once per season. Save it for a round where you need 4+ transfers."
    if "transfer" in q:
        return "You get 1 free transfer per round. Extra transfers cost -4 points each, applied immediately. Plan transfers carefully around the deadline."
    if "scor" in q or "point" in q:
        return "Goals: FWD=4pts, MID=5, DEF/GK=6. Assists=3pts. Clean sheet: GK/DEF=4, MID=1. Yellow=-1, Red=-3. Captain gets 2x."
    return "I'm currently in offline mode. Try again when Ollama is running, or check the scoring rules in the app."

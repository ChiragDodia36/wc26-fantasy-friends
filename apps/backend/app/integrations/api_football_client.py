"""
API-Football v3 client (sync httpx).

Free tier: 100 requests/day — used ONLY for:
- One-time seeding: teams, squads, fixtures
- Post-match player stats (1 call per finished match)

Live polling goes through football_data_client.py (unlimited free).
"""
from typing import Any, Dict, List

import httpx

from app.core.config import settings

_TIMEOUT = 30.0


class APIFootballClient:
    def __init__(self) -> None:
        self.base_url = "https://v3.football.api-sports.io"
        self._headers = {"x-apisports-key": settings.api_football_key}

    def _get(self, path: str, params: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """Execute a GET request and return the response[] array."""
        with httpx.Client(headers=self._headers, timeout=_TIMEOUT) as client:
            resp = client.get(f"{self.base_url}{path}", params=params or {})
            resp.raise_for_status()
            return resp.json().get("response", [])

    def fetch_wc26_teams(self) -> List[Dict[str, Any]]:
        """Return all teams in the WC league for the configured season.

        Each item: { team: {id, name, country, code, logo}, venue: {...} }
        """
        return self._get(
            "/teams",
            {
                "league": settings.world_cup_league_id,
                "season": settings.world_cup_season,
            },
        )

    def fetch_squad(self, team_id: int) -> List[Dict[str, Any]]:
        """Return the registered squad for a team.

        Each item: { team: {id, name}, players: [{id, name, age, position, photo}] }
        """
        return self._get("/players/squads", {"team": team_id})

    def fetch_fixtures(self) -> List[Dict[str, Any]]:
        """Return all fixtures for the WC league/season.

        Each item: { fixture: {id, date, venue, status}, league: {round},
                     teams: {home, away}, goals: {home, away} }
        """
        return self._get(
            "/fixtures",
            {
                "league": settings.world_cup_league_id,
                "season": settings.world_cup_season,
            },
        )

    def fetch_player_stats(self, fixture_id: int) -> List[Dict[str, Any]]:
        """Return per-player stats for a completed fixture.

        Each item: { team: {id}, players: [{player: {id, name},
                     statistics: [{games: {minutes, rating}, goals: {total, assists},
                     cards: {yellow, red}, ...}]}] }
        """
        return self._get("/fixtures/players", {"fixture": fixture_id})

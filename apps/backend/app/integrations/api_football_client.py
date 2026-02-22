from typing import Any, Dict, List

import httpx

from app.core.config import settings


class APIFootballClient:
    def __init__(self):
        self.base_url = "https://v3.football.api-sports.io"
        self.api_key = settings.api_football_key
        self.headers = {"x-apisports-key": self.api_key}

    async def fetch_teams(self) -> List[Dict[str, Any]]:
        # Placeholder: use real API endpoints in production
        async with httpx.AsyncClient(headers=self.headers) as client:
            # Example request (commented to avoid runtime errors without keys)
            # resp = await client.get(f\"{self.base_url}/teams?league={settings.world_cup_league_id}&season={settings.world_cup_season}\")
            # resp.raise_for_status()
            # return resp.json().get(\"response\", [])
            return []

    async def fetch_players(self, team_external_id: int) -> List[Dict[str, Any]]:
        async with httpx.AsyncClient(headers=self.headers) as client:
            # resp = await client.get(f\"{self.base_url}/players?team={team_external_id}&season={settings.world_cup_season}\")
            # resp.raise_for_status()
            # return resp.json().get(\"response\", [])
            return []

    async def fetch_fixtures(self) -> List[Dict[str, Any]]:
        async with httpx.AsyncClient(headers=self.headers) as client:
            # resp = await client.get(f\"{self.base_url}/fixtures?league={settings.world_cup_league_id}&season={settings.world_cup_season}\")
            # resp.raise_for_status()
            # return resp.json().get(\"response\", [])
            return []


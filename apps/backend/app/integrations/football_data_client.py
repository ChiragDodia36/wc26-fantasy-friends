"""
football-data.org client (sync httpx).

Free tier: unlimited, 10 requests/minute.
Used EXCLUSIVELY for live match score polling.

Smart polling intervals (enforced by the scheduler, not this client):
  - Scheduled (>1h away): every 30 min
  - LIVE (1st/2nd half):  every 30 sec   → ~6 req/min for 3 simultaneous matches
  - Half-time:            every 2 min
  - Finished:             once, then stop
"""
from typing import Any, Dict, List, Optional

import httpx

from app.core.config import settings

_BASE_URL = "https://api.football-data.org/v4"
_TIMEOUT = 10.0


class FootballDataClient:
    def __init__(self) -> None:
        headers: Dict[str, str] = {"Accept": "application/json"}
        if settings.football_data_token:
            headers["X-Auth-Token"] = settings.football_data_token
        self._headers = headers

    def _get(self, path: str, params: Optional[Dict[str, Any]] = None) -> Any:
        with httpx.Client(headers=self._headers, timeout=_TIMEOUT) as client:
            resp = client.get(f"{_BASE_URL}{path}", params=params or {})
            resp.raise_for_status()
            return resp.json()

    def fetch_live_matches(self) -> List[Dict[str, Any]]:
        """Return all currently live WC matches.

        Returns list of match objects:
          { id, status, homeTeam: {id, name}, awayTeam: {id, name},
            score: { fullTime: {home, away}, halfTime: {home, away} } }
        """
        data = self._get("/competitions/WC/matches", {"status": "LIVE"})
        return data.get("matches", [])

    def fetch_match(self, match_id: int) -> Dict[str, Any]:
        """Return full detail for a single match by football-data.org match ID.

        Returns: { id, status, homeTeam, awayTeam, score, ... }
        """
        return self._get(f"/matches/{match_id}")

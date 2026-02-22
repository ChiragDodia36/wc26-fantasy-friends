"""
Tests for the API-Football HTTP client.
Uses unittest.mock to avoid real HTTP calls.
"""
from typing import Any, Dict
from unittest.mock import MagicMock, patch

import pytest

from app.integrations.api_football_client import APIFootballClient

TEAM_RESPONSE = {
    "response": [
        {
            "team": {
                "id": 10,
                "name": "France",
                "country": "France",
                "code": "FRA",
                "logo": "https://example.com/fra.png",
            },
            "venue": {},
        }
    ]
}

SQUAD_RESPONSE = {
    "response": [
        {
            "team": {"id": 10, "name": "France"},
            "players": [
                {
                    "id": 101,
                    "name": "Kylian Mbappé",
                    "age": 26,
                    "position": "Attacker",
                    "photo": "https://example.com/mbappe.png",
                }
            ],
        }
    ]
}

FIXTURE_RESPONSE = {
    "response": [
        {
            "fixture": {
                "id": 999,
                "date": "2026-06-11T16:00:00+00:00",
                "venue": {"name": "MetLife Stadium"},
                "status": {"short": "NS"},
            },
            "league": {"round": "Group Stage - 1"},
            "teams": {
                "home": {"id": 10, "name": "France"},
                "away": {"id": 20, "name": "Brazil"},
            },
            "goals": {"home": None, "away": None},
        }
    ]
}

PLAYER_STATS_RESPONSE = {
    "response": [
        {
            "team": {"id": 10},
            "players": [
                {
                    "player": {"id": 101, "name": "Kylian Mbappé"},
                    "statistics": [
                        {
                            "games": {"minutes": 90, "rating": "8.5"},
                            "goals": {"total": 1, "assists": 1},
                            "cards": {"yellow": 0, "red": 0},
                            "shots": {},
                            "passes": {},
                        }
                    ],
                }
            ],
        }
    ]
}


def _make_mock_response(data: Dict[str, Any]) -> MagicMock:
    """Create a mock httpx response."""
    mock = MagicMock()
    mock.raise_for_status = MagicMock()
    mock.json.return_value = data
    return mock


@patch("app.integrations.api_football_client.httpx.Client")
def test_fetch_wc26_teams_returns_list(mock_client_cls):
    mock_client = MagicMock()
    mock_client.__enter__ = MagicMock(return_value=mock_client)
    mock_client.__exit__ = MagicMock(return_value=False)
    mock_client.get.return_value = _make_mock_response(TEAM_RESPONSE)
    mock_client_cls.return_value = mock_client

    client = APIFootballClient()
    teams = client.fetch_wc26_teams()

    assert isinstance(teams, list)
    assert len(teams) == 1
    assert teams[0]["team"]["id"] == 10
    mock_client.get.assert_called_once()


@patch("app.integrations.api_football_client.httpx.Client")
def test_fetch_squad_returns_players(mock_client_cls):
    mock_client = MagicMock()
    mock_client.__enter__ = MagicMock(return_value=mock_client)
    mock_client.__exit__ = MagicMock(return_value=False)
    mock_client.get.return_value = _make_mock_response(SQUAD_RESPONSE)
    mock_client_cls.return_value = mock_client

    client = APIFootballClient()
    squad = client.fetch_squad(team_id=10)

    assert isinstance(squad, list)
    assert len(squad) == 1
    assert squad[0]["team"]["id"] == 10
    assert len(squad[0]["players"]) == 1
    assert squad[0]["players"][0]["name"] == "Kylian Mbappé"


@patch("app.integrations.api_football_client.httpx.Client")
def test_fetch_fixtures_returns_list(mock_client_cls):
    mock_client = MagicMock()
    mock_client.__enter__ = MagicMock(return_value=mock_client)
    mock_client.__exit__ = MagicMock(return_value=False)
    mock_client.get.return_value = _make_mock_response(FIXTURE_RESPONSE)
    mock_client_cls.return_value = mock_client

    client = APIFootballClient()
    fixtures = client.fetch_fixtures()

    assert isinstance(fixtures, list)
    assert len(fixtures) == 1
    assert fixtures[0]["fixture"]["id"] == 999
    assert fixtures[0]["teams"]["home"]["name"] == "France"


@patch("app.integrations.api_football_client.httpx.Client")
def test_fetch_player_stats_returns_list(mock_client_cls):
    mock_client = MagicMock()
    mock_client.__enter__ = MagicMock(return_value=mock_client)
    mock_client.__exit__ = MagicMock(return_value=False)
    mock_client.get.return_value = _make_mock_response(PLAYER_STATS_RESPONSE)
    mock_client_cls.return_value = mock_client

    client = APIFootballClient()
    stats = client.fetch_player_stats(fixture_id=999)

    assert isinstance(stats, list)
    assert len(stats) == 1
    assert stats[0]["team"]["id"] == 10
    assert stats[0]["players"][0]["player"]["name"] == "Kylian Mbappé"
    rating = stats[0]["players"][0]["statistics"][0]["games"]["rating"]
    assert float(rating) >= 8.0


@patch("app.integrations.api_football_client.httpx.Client")
def test_empty_response_returns_empty_list(mock_client_cls):
    mock_client = MagicMock()
    mock_client.__enter__ = MagicMock(return_value=mock_client)
    mock_client.__exit__ = MagicMock(return_value=False)
    mock_client.get.return_value = _make_mock_response({"response": []})
    mock_client_cls.return_value = mock_client

    client = APIFootballClient()
    assert client.fetch_wc26_teams() == []
    assert client.fetch_fixtures() == []

"""
Tests for the football-data.org live score client.
"""
from unittest.mock import MagicMock, patch

import pytest

from app.integrations.football_data_client import FootballDataClient

LIVE_MATCHES_RESPONSE = {
    "matches": [
        {
            "id": 477176,
            "status": "IN_PLAY",
            "homeTeam": {"id": 773, "name": "France"},
            "awayTeam": {"id": 764, "name": "Brazil"},
            "score": {
                "fullTime": {"home": 1, "away": 0},
                "halfTime": {"home": 1, "away": 0},
            },
        }
    ]
}

MATCH_DETAIL_RESPONSE = {
    "id": 477176,
    "status": "FINISHED",
    "homeTeam": {"id": 773, "name": "France"},
    "awayTeam": {"id": 764, "name": "Brazil"},
    "score": {
        "fullTime": {"home": 2, "away": 1},
        "halfTime": {"home": 1, "away": 0},
    },
}


def _mock_client(data: dict) -> MagicMock:
    mock = MagicMock()
    mock.__enter__ = MagicMock(return_value=mock)
    mock.__exit__ = MagicMock(return_value=False)
    resp = MagicMock()
    resp.raise_for_status = MagicMock()
    resp.json.return_value = data
    mock.get.return_value = resp
    return mock


@patch("app.integrations.football_data_client.httpx.Client")
def test_fetch_live_matches_returns_list(mock_client_cls):
    mock_client_cls.return_value = _mock_client(LIVE_MATCHES_RESPONSE)
    client = FootballDataClient()
    matches = client.fetch_live_matches()

    assert isinstance(matches, list)
    assert len(matches) == 1
    assert matches[0]["id"] == 477176
    assert matches[0]["status"] == "IN_PLAY"


@patch("app.integrations.football_data_client.httpx.Client")
def test_fetch_match_returns_detail(mock_client_cls):
    mock_client_cls.return_value = _mock_client(MATCH_DETAIL_RESPONSE)
    client = FootballDataClient()
    match = client.fetch_match(match_id=477176)

    assert match["id"] == 477176
    assert match["status"] == "FINISHED"
    assert match["score"]["fullTime"]["home"] == 2


@patch("app.integrations.football_data_client.httpx.Client")
def test_no_token_still_constructs(mock_client_cls):
    """Client should construct even if token is None (some endpoints are public)."""
    client = FootballDataClient()
    assert client is not None

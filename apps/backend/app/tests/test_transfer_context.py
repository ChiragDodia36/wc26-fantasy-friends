"""Tests for the AI transfer context endpoint (build_transfer_context)."""
from datetime import datetime, timedelta
from unittest.mock import patch

from app.models.match import Match, MatchStatus
from app.models.player import Player
from app.models.player_match_stats import PlayerMatchStats
from app.models.round import round_matches
from app.models.team import Team
from app.services.ai_coach_service import _compute_form, build_transfer_context
from app.tests.conftest import _uid


# ---------------------------------------------------------------------------
# _compute_form
# ---------------------------------------------------------------------------

def test_compute_form_returns_last_5(db, seed_data):
    """Should return fantasy points from the last 5 finished matches."""
    player = seed_data["players"][0]
    match = seed_data["match"]

    # Mark match as finished so stats are visible
    match.status = MatchStatus.FINISHED
    db.flush()

    # Add 3 match stats entries
    for pts in [8, 5, 3]:
        m = Match(
            id=_uid(), external_id=_uid()[:8],
            home_team_id=seed_data["team_a"].id,
            away_team_id=seed_data["team_b"].id,
            kickoff_utc=datetime.utcnow() - timedelta(days=pts),
            status=MatchStatus.FINISHED,
        )
        db.add(m)
        db.flush()
        db.add(PlayerMatchStats(
            id=_uid(), player_id=player.id, match_id=m.id, fantasy_points=pts,
        ))
    db.commit()

    form = _compute_form(db, player.id, n_matches=5)
    assert len(form) == 3
    assert form == [3, 5, 8]  # most recent first (days=3 is closest to now)


def test_compute_form_empty_when_no_stats(db, seed_data):
    """Should return empty list when player has no match stats."""
    form = _compute_form(db, seed_data["players"][0].id)
    assert form == []


# ---------------------------------------------------------------------------
# build_transfer_context
# ---------------------------------------------------------------------------

@patch("app.services.ai_coach_service.query_lessons", return_value=[])
def test_only_candidates_from_upcoming_teams(mock_lessons, db, seed_data):
    """Candidate players should only come from teams with upcoming matches."""
    result = build_transfer_context(db, seed_data["squad"].id)

    # Both teams play in the seeded match (next 6 hours) — both teams' non-squad
    # players should be candidates
    playing_team_ids = {seed_data["team_a"].id, seed_data["team_b"].id}
    for c in result["candidate_players"]:
        assert c["team_id"] in playing_team_ids


@patch("app.services.ai_coach_service.query_lessons", return_value=[])
def test_excludes_squad_players_from_candidates(mock_lessons, db, seed_data):
    """Current squad players should NOT appear in candidate_players."""
    result = build_transfer_context(db, seed_data["squad"].id)
    squad_ids = {sp["player_id"] for sp in result["squad_players"]}
    candidate_ids = {c["player_id"] for c in result["candidate_players"]}
    assert squad_ids.isdisjoint(candidate_ids)


@patch("app.services.ai_coach_service.query_lessons", return_value=[])
def test_no_candidates_when_no_upcoming_matches(mock_lessons, db, seed_data):
    """When no matches are scheduled in the next 48h, candidates should be empty."""
    # Move the match far into the future (beyond 48h)
    seed_data["match"].kickoff_utc = datetime.utcnow() + timedelta(days=5)
    db.commit()

    result = build_transfer_context(db, seed_data["squad"].id)
    assert result["candidate_players"] == []
    assert result["upcoming_matches"] == []


@patch("app.services.ai_coach_service.query_lessons", return_value=[])
def test_squad_players_have_form_and_fdr(mock_lessons, db, seed_data):
    """Each squad player should have form_last_5, avg_form, and upcoming_fdr."""
    result = build_transfer_context(db, seed_data["squad"].id)
    for sp in result["squad_players"]:
        assert "form_last_5" in sp
        assert "avg_form" in sp
        assert "upcoming_fdr" in sp
        assert isinstance(sp["form_last_5"], list)


@patch("app.services.ai_coach_service.query_lessons", return_value=[])
def test_transfer_context_includes_allowance(mock_lessons, db, seed_data):
    """Should include free_transfers_remaining from the allowance system."""
    result = build_transfer_context(db, seed_data["squad"].id)
    assert result["free_transfers_remaining"] == 3
    assert result["max_transfers"] == 3


@patch("app.services.ai_coach_service.query_lessons", return_value=[])
def test_upcoming_matches_in_result(mock_lessons, db, seed_data):
    """Should list upcoming matches with team names and kickoff time."""
    result = build_transfer_context(db, seed_data["squad"].id)
    assert len(result["upcoming_matches"]) == 1
    m = result["upcoming_matches"][0]
    assert m["home_team_name"] == "Brazil"
    assert m["away_team_name"] == "Germany"
    assert "kickoff_utc" in m

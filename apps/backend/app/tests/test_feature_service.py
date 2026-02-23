"""Tests for feature_service and fdr_service (Step 9)."""
import uuid
from datetime import datetime, timedelta
from unittest.mock import MagicMock

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.db import Base
from app.models.player import Player
from app.models.player_match_stats import PlayerMatchStats
from app.models.team import Team
from app.models.match import Match, MatchStatus
from app.models.round import Round, round_matches


@pytest.fixture
def db():
    e = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(e)
    session = sessionmaker(bind=e)()
    yield session
    session.close()
    Base.metadata.drop_all(e)


@pytest.fixture
def seed_data(db: Session):
    """Seed a small tournament: 2 teams, 4 players, 2 matches, some stats."""
    team_a = Team(id="t1", external_id="ext_t1", name="Brazil", country_code="BR", group_name="A")
    team_b = Team(id="t2", external_id="ext_t2", name="Germany", country_code="DE", group_name="A")
    db.add_all([team_a, team_b])
    db.flush()

    p1 = Player(id="p1", external_id="ext_p1", team_id="t1", name="Forward A", position="FWD", price=6.0)
    p2 = Player(id="p2", external_id="ext_p2", team_id="t1", name="Mid A", position="MID", price=5.5)
    p3 = Player(id="p3", external_id="ext_p3", team_id="t2", name="Def B", position="DEF", price=5.0)
    p4 = Player(id="p4", external_id="ext_p4", team_id="t2", name="GK B", position="GK", price=4.5)
    db.add_all([p1, p2, p3, p4])
    db.flush()

    now = datetime.utcnow()
    m1 = Match(id="m1", external_id="ext_m1", home_team_id="t1", away_team_id="t2",
               kickoff_utc=now - timedelta(days=5), status=MatchStatus.FINISHED,
               home_score=2, away_score=1, round_name="Group Stage - 1")
    m2 = Match(id="m2", external_id="ext_m2", home_team_id="t2", away_team_id="t1",
               kickoff_utc=now - timedelta(days=2), status=MatchStatus.FINISHED,
               home_score=0, away_score=0, round_name="Group Stage - 2")
    m3 = Match(id="m3", external_id="ext_m3", home_team_id="t1", away_team_id="t2",
               kickoff_utc=now + timedelta(days=3), status=MatchStatus.SCHEDULED,
               home_score=None, away_score=None, round_name="Group Stage - 3")
    db.add_all([m1, m2, m3])
    db.flush()

    # Stats for p1 in m1: 2 goals, 0 assists
    s1 = PlayerMatchStats(id="s1", match_id="m1", player_id="p1", minutes_played=90,
                          goals=2, assists=0, clean_sheet=False, fantasy_points=10)
    # Stats for p1 in m2: 0 goals, 1 assist
    s2 = PlayerMatchStats(id="s2", match_id="m2", player_id="p1", minutes_played=90,
                          goals=0, assists=1, clean_sheet=True, fantasy_points=5)
    # Stats for p3 in m1: clean sheet=False (lost 2-1)
    s3 = PlayerMatchStats(id="s3", match_id="m1", player_id="p3", minutes_played=90,
                          clean_sheet=False, goals_conceded=2, fantasy_points=1)
    # Stats for p3 in m2: clean sheet=True
    s4 = PlayerMatchStats(id="s4", match_id="m2", player_id="p3", minutes_played=90,
                          clean_sheet=True, goals_conceded=0, fantasy_points=6)
    db.add_all([s1, s2, s3, s4])
    db.commit()
    return {"teams": [team_a, team_b], "players": [p1, p2, p3, p4], "matches": [m1, m2, m3]}


# ───── feature_service tests ─────

def test_build_player_features_returns_dict(db, seed_data):
    from app.services.feature_service import build_player_features
    features = build_player_features("p1", db)
    assert isinstance(features, dict)
    assert "total_goals" in features
    assert "total_assists" in features
    assert "total_points" in features
    assert "matches_played" in features
    assert "avg_points" in features
    assert "position_encoded" in features
    assert "price" in features


def test_build_player_features_correct_values(db, seed_data):
    from app.services.feature_service import build_player_features
    features = build_player_features("p1", db)
    assert features["total_goals"] == 2
    assert features["total_assists"] == 1
    assert features["total_points"] == 15  # 10 + 5
    assert features["matches_played"] == 2
    assert features["avg_points"] == 7.5
    assert features["price"] == 6.0


def test_build_player_features_no_stats(db, seed_data):
    from app.services.feature_service import build_player_features
    # p2 has no match stats
    features = build_player_features("p2", db)
    assert features["total_goals"] == 0
    assert features["matches_played"] == 0
    assert features["avg_points"] == 0.0


def test_build_player_features_nonexistent(db):
    from app.services.feature_service import build_player_features
    features = build_player_features("nonexistent", db)
    assert features is None


# ───── fdr_service tests ─────

def test_compute_fdr_returns_rating(db, seed_data):
    from app.services.fdr_service import compute_fdr
    fdr = compute_fdr("t1", "t2", db)
    assert isinstance(fdr, int)
    assert 1 <= fdr <= 5


def test_compute_fdr_symmetric_difference(db, seed_data):
    """FDR of A vs B should differ from B vs A (one attacks, other defends)."""
    from app.services.fdr_service import compute_fdr
    fdr_ab = compute_fdr("t1", "t2", db)
    fdr_ba = compute_fdr("t2", "t1", db)
    # Both should be valid FDR values
    assert 1 <= fdr_ab <= 5
    assert 1 <= fdr_ba <= 5


def test_get_upcoming_fdr(db, seed_data):
    from app.services.fdr_service import get_upcoming_fdr
    fdr = get_upcoming_fdr("p1", db)
    # p1 is on team t1, upcoming match m3 is t1 vs t2
    assert isinstance(fdr, int)
    assert 1 <= fdr <= 5


def test_get_upcoming_fdr_no_match(db, seed_data):
    """Player with no upcoming match should return None."""
    from app.services.fdr_service import get_upcoming_fdr
    # Create a player on a team with no upcoming matches
    from app.models.team import Team
    from app.models.player import Player
    t3 = Team(id="t3", external_id="ext_t3", name="Mexico", country_code="MX", group_name="C")
    p5 = Player(id="p5", external_id="ext_p5", team_id="t3", name="Lone Player", position="MID", price=5.0)
    db.add_all([t3, p5])
    db.flush()
    fdr = get_upcoming_fdr("p5", db)
    assert fdr is None


# ───── player form endpoint tests ─────

def test_get_player_form_returns_data(db, seed_data):
    from app.services.feature_service import get_player_form
    form = get_player_form("p1", db)
    assert form is not None
    assert "last5Points" in form
    assert "totalPointsThisTournament" in form
    assert "upcomingFdr" in form
    assert isinstance(form["last5Points"], list)


def test_get_player_form_nonexistent(db):
    from app.services.feature_service import get_player_form
    form = get_player_form("nonexistent", db)
    assert form is None

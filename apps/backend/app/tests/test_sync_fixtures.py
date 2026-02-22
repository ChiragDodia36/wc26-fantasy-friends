"""
Tests for sync_fixtures_task — verifies DB updates from football-data.org data.
Uses in-memory SQLite to avoid needing a running Postgres.
"""
import uuid
from datetime import datetime
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.db import Base
from app.models.match import Match, MatchStatus
from app.models.team import Team

TEST_DB_URL = "sqlite:///:memory:"


@pytest.fixture()
def db_session():
    engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()
    Base.metadata.drop_all(engine)


def _make_team(db, name="France", ext_id="10"):
    t = Team(
        id=str(uuid.uuid4()),
        external_id=ext_id,
        name=name,
        country_code=name[:3].upper(),
    )
    db.add(t)
    db.flush()
    return t


def _make_match(db, ext_id="477176", status=MatchStatus.LIVE, home_t=None, away_t=None):
    m = Match(
        id=str(uuid.uuid4()),
        external_id=ext_id,
        home_team_id=home_t.id,
        away_team_id=away_t.id,
        kickoff_utc=datetime(2026, 6, 11, 16, 0),
        status=status,
    )
    db.add(m)
    db.flush()
    return m


LIVE_RESPONSE = [
    {
        "id": 477176,
        "status": "FINISHED",
        "homeTeam": {"id": 773, "name": "France"},
        "awayTeam": {"id": 764, "name": "Brazil"},
        "score": {"fullTime": {"home": 2, "away": 1}, "halfTime": {"home": 1, "away": 0}},
    }
]


@patch("app.tasks.sync_fixtures_task.SessionLocal")
@patch("app.tasks.sync_fixtures_task.FootballDataClient")
def test_live_match_transitions_to_finished(mock_client_cls, mock_session_cls, db_session):
    home = _make_team(db_session, "France", "10")
    away = _make_team(db_session, "Brazil", "20")
    match = _make_match(db_session, ext_id="477176", status=MatchStatus.LIVE, home_t=home, away_t=away)
    match_id = match.id
    db_session.commit()

    mock_client_cls.return_value.fetch_live_matches.return_value = LIVE_RESPONSE

    # Return a new session backed by the same in-memory engine so we can inspect
    engine = db_session.get_bind()
    Session = sessionmaker(bind=engine)
    task_session = Session()
    mock_session_cls.return_value = task_session

    from app.tasks.sync_fixtures_task import sync_live_scores

    sync_live_scores()

    # Verify via independent query
    verify_session = Session()
    updated = verify_session.query(Match).filter(Match.id == match_id).first()
    assert updated is not None
    assert updated.status == MatchStatus.FINISHED
    assert updated.home_score == 2
    assert updated.away_score == 1
    verify_session.close()


@patch("app.tasks.sync_fixtures_task.SessionLocal")
@patch("app.tasks.sync_fixtures_task.FootballDataClient")
def test_unknown_external_id_is_skipped(mock_client_cls, mock_session_cls, db_session):
    mock_client_cls.return_value.fetch_live_matches.return_value = [
        {"id": 999999, "status": "IN_PLAY", "score": {"fullTime": {"home": 0, "away": 0}}}
    ]
    mock_session_cls.return_value = db_session

    from app.tasks.sync_fixtures_task import sync_live_scores

    result = sync_live_scores()
    assert result == []


@patch("app.tasks.sync_fixtures_task.SessionLocal")
@patch("app.tasks.sync_fixtures_task.FootballDataClient")
def test_client_exception_returns_empty(mock_client_cls, mock_session_cls, db_session):
    mock_client_cls.return_value.fetch_live_matches.side_effect = Exception("Network error")
    mock_session_cls.return_value = db_session

    from app.tasks.sync_fixtures_task import sync_live_scores

    result = sync_live_scores()
    assert result == []

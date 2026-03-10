"""Shared test fixtures using an in-memory SQLite database."""
import uuid
from datetime import datetime, timedelta

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.db import Base
from app.models.match import Match, MatchStatus
from app.models.player import Player
from app.models.round import Round, RoundStage, round_matches
from app.models.squad import Squad
from app.models.squad_player import SquadPlayer
from app.models.squad_round_points import SquadRoundPoints
from app.models.team import Team
from app.models.transfer_allowance import TransferAllowance
from app.models.user import User


@pytest.fixture
def db():
    """Yield a SQLAlchemy session backed by an in-memory SQLite database."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


def _uid():
    return str(uuid.uuid4())


@pytest.fixture
def seed_data(db):
    """Seed minimal data: 2 teams, 4 players each, 1 user, 1 league-less squad, 1 round with matches."""
    now = datetime.utcnow()
    today = now.date()

    # Teams
    team_a = Team(id=_uid(), external_id="100", name="Brazil", country_code="BR", group_name="A")
    team_b = Team(id=_uid(), external_id="200", name="Germany", country_code="DE", group_name="B")
    db.add_all([team_a, team_b])
    db.flush()

    # Players (4 per team)
    players = []
    for i, (team, pos) in enumerate([
        (team_a, "GK"), (team_a, "DEF"), (team_a, "MID"), (team_a, "FWD"),
        (team_b, "GK"), (team_b, "DEF"), (team_b, "MID"), (team_b, "FWD"),
    ]):
        p = Player(
            id=_uid(), external_id=str(1000 + i), name=f"Player_{i}",
            position=pos, price=5.0 + i, team_id=team.id, is_active=True,
        )
        players.append(p)
    db.add_all(players)
    db.flush()

    # User
    user = User(id=_uid(), email="test@test.com", username="tester", password_hash="x")
    db.add(user)
    db.flush()

    # Round (group stage, today is within range)
    round_ = Round(
        id=_uid(), name="Group Stage MD1",
        start_utc=now - timedelta(hours=2),
        deadline_utc=now + timedelta(hours=10),
        end_utc=now + timedelta(days=2),
        stage=RoundStage.GROUP,
    )
    db.add(round_)
    db.flush()

    # Match today
    match_today = Match(
        id=_uid(), external_id="M1",
        home_team_id=team_a.id, away_team_id=team_b.id,
        kickoff_utc=now + timedelta(hours=6),
        status=MatchStatus.SCHEDULED,
    )
    db.add(match_today)
    db.flush()

    # Link match to round
    db.execute(round_matches.insert().values(round_id=round_.id, match_id=match_today.id))

    # Squad with first 4 players (team_a)
    squad = Squad(
        id=_uid(), user_id=user.id, league_id=_uid(),
        budget_remaining=50.0, free_transfers_remaining=1,
    )
    db.add(squad)
    db.flush()

    for p in players[:4]:
        db.add(SquadPlayer(id=_uid(), squad_id=squad.id, player_id=p.id, is_starting=True))

    # SquadRoundPoints (so penalty can be applied)
    srp = SquadRoundPoints(id=_uid(), squad_id=squad.id, round_id=round_.id, points=0)
    db.add(srp)

    db.commit()

    return {
        "team_a": team_a, "team_b": team_b,
        "players": players, "user": user,
        "round": round_, "match": match_today,
        "squad": squad, "srp": srp,
    }

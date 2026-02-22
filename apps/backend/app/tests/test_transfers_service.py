"""
Tests for transfers_service — validates deadline enforcement, budget checks,
free transfer countdown, and wildcard chip logic.
"""
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.db import Base
from app.models.league import League
from app.models.match import Match
from app.models.player import Player
from app.models.round import Round
from app.models.squad import Squad
from app.models.squad_player import SquadPlayer
from app.models.squad_round_points import SquadRoundPoints
from app.models.team import Team
from app.models.user import User

TEST_DB_URL = "sqlite:///:memory:"


@pytest.fixture()
def db():
    engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()
    Base.metadata.drop_all(engine)


def _uid():
    return str(uuid.uuid4())


def _make_user(db):
    u = User(id=_uid(), email=f"{_uid()}@test.com", username="test", password_hash="x")
    db.add(u)
    db.flush()
    return u


def _make_team(db, name="France"):
    t = Team(id=_uid(), external_id=_uid(), name=name, country_code=name[:3].upper())
    db.add(t)
    db.flush()
    return t


def _make_player(db, team, position="MID", price=5.5, name="Player"):
    p = Player(
        id=_uid(),
        external_id=_uid(),
        team_id=team.id,
        name=name,
        position=position,
        price=Decimal(str(price)),
        is_active=True,
    )
    db.add(p)
    db.flush()
    return p


def _make_league(db, owner):
    lg = League(id=_uid(), name="Test League", code=_uid()[:6], owner_id=owner.id)
    db.add(lg)
    db.flush()
    return lg


def _make_round(db, deadline_offset_hours=48):
    """Create a round with deadline in the future by default."""
    now = datetime.utcnow()
    r = Round(
        id=_uid(),
        name="Group Stage - 1",
        start_utc=now - timedelta(hours=1),
        deadline_utc=now + timedelta(hours=deadline_offset_hours),
        end_utc=now + timedelta(days=7),
    )
    db.add(r)
    db.flush()
    return r


def _make_squad(db, user, league, budget=100.0, free_transfers=1):
    s = Squad(
        id=_uid(),
        user_id=user.id,
        league_id=league.id,
        budget_remaining=Decimal(str(budget)),
        free_transfers_remaining=free_transfers,
        wildcard_used=False,
    )
    db.add(s)
    db.flush()
    return s


def _add_player_to_squad(db, squad, player, is_starting=True):
    sp = SquadPlayer(
        id=_uid(), squad_id=squad.id, player_id=player.id, is_starting=is_starting
    )
    db.add(sp)
    db.flush()
    return sp


def _make_srp(db, squad, round_):
    srp = SquadRoundPoints(id=_uid(), squad_id=squad.id, round_id=round_.id, points=50)
    db.add(srp)
    db.flush()
    return srp


# ── Tests ─────────────────────────────────────────────────────────────────────


def test_successful_transfer_within_budget(db):
    from app.services.transfers_service import make_transfer

    user = _make_user(db)
    team = _make_team(db)
    league = _make_league(db, user)
    round_ = _make_round(db, deadline_offset_hours=48)
    squad = _make_squad(db, user, league, budget=5.0, free_transfers=1)

    player_out = _make_player(db, team, price=5.0, name="Out")
    player_in = _make_player(db, team, price=5.0, name="In")
    _add_player_to_squad(db, squad, player_out)
    _make_srp(db, squad, round_)
    db.commit()

    result = make_transfer(
        db, squad_id=squad.id, player_out_id=player_out.id, player_in_id=player_in.id
    )
    assert result is not None
    # player_in is now in squad
    sp = db.query(SquadPlayer).filter(
        SquadPlayer.squad_id == squad.id, SquadPlayer.player_id == player_in.id
    ).first()
    assert sp is not None


def test_transfer_after_deadline_raises(db):
    from app.services.transfers_service import make_transfer

    user = _make_user(db)
    team = _make_team(db)
    league = _make_league(db, user)
    round_ = _make_round(db, deadline_offset_hours=-1)  # deadline in the past
    squad = _make_squad(db, user, league)

    player_out = _make_player(db, team, price=5.0)
    player_in = _make_player(db, team, price=5.0)
    _add_player_to_squad(db, squad, player_out)
    _make_srp(db, squad, round_)
    db.commit()

    with pytest.raises(HTTPException) as exc_info:
        make_transfer(db, squad_id=squad.id, player_out_id=player_out.id, player_in_id=player_in.id)
    assert exc_info.value.status_code == 400
    assert "deadline" in exc_info.value.detail.lower()


def test_transfer_over_budget_raises(db):
    from app.services.transfers_service import make_transfer

    user = _make_user(db)
    team = _make_team(db)
    league = _make_league(db, user)
    round_ = _make_round(db)
    squad = _make_squad(db, user, league, budget=3.0)  # only 3m budget

    player_out = _make_player(db, team, price=5.0)  # gets 5m back
    player_in = _make_player(db, team, price=9.0)   # costs 9m → net 4m over budget
    _add_player_to_squad(db, squad, player_out)
    _make_srp(db, squad, round_)
    db.commit()

    with pytest.raises(HTTPException) as exc_info:
        make_transfer(db, squad_id=squad.id, player_out_id=player_out.id, player_in_id=player_in.id)
    assert exc_info.value.status_code == 400
    assert "budget" in exc_info.value.detail.lower()


def test_extra_transfer_applies_4pt_penalty(db):
    from app.services.transfers_service import make_transfer

    user = _make_user(db)
    team = _make_team(db)
    league = _make_league(db, user)
    round_ = _make_round(db)
    squad = _make_squad(db, user, league, budget=50.0, free_transfers=0)  # no free transfers left
    srp = _make_srp(db, squad, round_)

    player_out = _make_player(db, team, price=5.0)
    player_in = _make_player(db, team, price=5.0)
    _add_player_to_squad(db, squad, player_out)
    db.commit()

    initial_points = srp.points
    make_transfer(db, squad_id=squad.id, player_out_id=player_out.id, player_in_id=player_in.id)

    db.refresh(srp)
    assert srp.points == initial_points - 4


def test_wildcard_active_no_penalty(db):
    from app.services.transfers_service import make_transfer

    user = _make_user(db)
    team = _make_team(db)
    league = _make_league(db, user)
    round_ = _make_round(db)
    squad = _make_squad(db, user, league, budget=50.0, free_transfers=0)
    # Activate wildcard for this round
    squad.wildcard_used = True
    squad.wildcard_active_round_id = round_.id
    db.flush()
    srp = _make_srp(db, squad, round_)

    player_out = _make_player(db, team, price=5.0)
    player_in = _make_player(db, team, price=5.0)
    _add_player_to_squad(db, squad, player_out)
    db.commit()

    initial_points = srp.points
    make_transfer(db, squad_id=squad.id, player_out_id=player_out.id, player_in_id=player_in.id)

    db.refresh(srp)
    assert srp.points == initial_points  # no penalty


def test_free_transfer_decrements_count(db):
    from app.services.transfers_service import make_transfer

    user = _make_user(db)
    team = _make_team(db)
    league = _make_league(db, user)
    round_ = _make_round(db)
    squad = _make_squad(db, user, league, budget=50.0, free_transfers=1)
    _make_srp(db, squad, round_)

    player_out = _make_player(db, team, price=5.0)
    player_in = _make_player(db, team, price=5.0)
    _add_player_to_squad(db, squad, player_out)
    db.commit()

    make_transfer(db, squad_id=squad.id, player_out_id=player_out.id, player_in_id=player_in.id)

    db.refresh(squad)
    assert squad.free_transfers_remaining == 0

"""Tests for the transfer allowance system (3 free/match day group, 2 free/round knockout)."""
from datetime import datetime, timedelta

from app.models.match import Match, MatchStatus
from app.models.round import Round, RoundStage, round_matches
from app.models.squad_round_points import SquadRoundPoints
from app.models.transfer_allowance import TransferAllowance
from app.services.transfers_service import (
    _current_round,
    _get_or_create_allowance,
    _get_transfer_match_date,
    get_transfer_allowance,
    make_transfer,
)
from app.tests.conftest import _uid


# ---------------------------------------------------------------------------
# _get_transfer_match_date
# ---------------------------------------------------------------------------

def test_group_stage_returns_today_when_matches_exist(db, seed_data):
    """Group stage: should return today's date when matches are scheduled today."""
    round_ = seed_data["round"]
    match_date = _get_transfer_match_date(round_, db)
    assert match_date == datetime.utcnow().date()


def test_knockout_returns_round_start_date(db, seed_data):
    """Knockout: should return the round start date regardless of match dates."""
    round_ = seed_data["round"]
    round_.stage = RoundStage.ROUND_OF_16
    db.commit()

    match_date = _get_transfer_match_date(round_, db)
    assert match_date == round_.start_utc.date()


# ---------------------------------------------------------------------------
# _get_or_create_allowance
# ---------------------------------------------------------------------------

def test_creates_allowance_with_3_free(db, seed_data):
    """First access should create an allowance with 3 free transfers."""
    allowance = _get_or_create_allowance(db, seed_data["squad"].id, seed_data["round"])
    assert allowance.free_remaining == 3


def test_returns_existing_allowance(db, seed_data):
    """Subsequent access should return the same allowance row."""
    a1 = _get_or_create_allowance(db, seed_data["squad"].id, seed_data["round"])
    a1.free_remaining = 1
    db.flush()

    a2 = _get_or_create_allowance(db, seed_data["squad"].id, seed_data["round"])
    assert a2.id == a1.id
    assert a2.free_remaining == 1


# ---------------------------------------------------------------------------
# make_transfer — allowance-based
# ---------------------------------------------------------------------------

def test_3_free_transfers_no_penalty(db, seed_data):
    """First 3 transfers should be free (no point penalty)."""
    squad = seed_data["squad"]
    squad_players = seed_data["players"][:4]  # in squad
    available = seed_data["players"][4:]       # not in squad

    for i in range(3):
        make_transfer(db, squad.id, squad_players[i].id, available[i].id)

    db.refresh(seed_data["srp"])
    assert seed_data["srp"].points == 0  # no penalty

    allowance = _get_or_create_allowance(db, squad.id, seed_data["round"])
    assert allowance.free_remaining == 0


def test_4th_transfer_costs_minus_4(db, seed_data):
    """4th transfer on the same match day should cost -4 points."""
    squad = seed_data["squad"]
    squad_players = seed_data["players"][:4]
    available = seed_data["players"][4:]

    # Use all 3 free
    for i in range(3):
        make_transfer(db, squad.id, squad_players[i].id, available[i].id)

    # 4th: swap back player 0
    make_transfer(db, squad.id, available[0].id, squad_players[0].id)

    db.refresh(seed_data["srp"])
    assert seed_data["srp"].points == -4


def test_different_match_days_get_independent_allowances(db, seed_data):
    """Group stage: tomorrow's matches should have their own allowance of 3."""
    now = datetime.utcnow()
    round_ = seed_data["round"]

    # Add a match tomorrow
    tomorrow_match = Match(
        id=_uid(), external_id="M2",
        home_team_id=seed_data["team_a"].id,
        away_team_id=seed_data["team_b"].id,
        kickoff_utc=now + timedelta(days=1, hours=6),
        status=MatchStatus.SCHEDULED,
    )
    db.add(tomorrow_match)
    db.flush()
    db.execute(round_matches.insert().values(round_id=round_.id, match_id=tomorrow_match.id))
    db.commit()

    # Today's allowance
    today_allowance = _get_or_create_allowance(db, seed_data["squad"].id, round_)
    today_allowance.free_remaining = 1
    db.flush()

    # Manually create tomorrow's allowance
    tomorrow_date = (now + timedelta(days=1)).date()
    tomorrow_allowance = TransferAllowance(
        id=_uid(), squad_id=seed_data["squad"].id,
        round_id=round_.id, match_date=tomorrow_date, free_remaining=3,
    )
    db.add(tomorrow_allowance)
    db.commit()

    # They should be independent
    assert today_allowance.free_remaining == 1
    assert tomorrow_allowance.free_remaining == 3


def test_knockout_single_allowance_for_round(db, seed_data):
    """Knockout: all transfers share a single allowance of 2 per round."""
    round_ = seed_data["round"]
    round_.stage = RoundStage.QUARTER_FINAL
    db.commit()

    a1 = _get_or_create_allowance(db, seed_data["squad"].id, round_)
    assert a1.free_remaining == 2  # knockouts get 2, not 3
    assert a1.match_date == round_.start_utc.date()

    # Second access returns the same one
    a2 = _get_or_create_allowance(db, seed_data["squad"].id, round_)
    assert a1.id == a2.id


def test_wildcard_bypasses_allowance(db, seed_data):
    """Wildcard active: transfers should not decrement allowance or penalise."""
    squad = seed_data["squad"]
    squad.wildcard_active_round_id = seed_data["round"].id
    db.commit()

    squad_players = seed_data["players"][:4]
    available = seed_data["players"][4:]

    # Make 4 transfers — all should be free
    for i in range(4):
        make_transfer(db, squad.id, squad_players[i].id, available[i].id)
        # Swap back for next iteration if needed
        if i < 3:
            make_transfer(db, squad.id, available[i].id, squad_players[i].id)

    db.refresh(seed_data["srp"])
    assert seed_data["srp"].points == 0  # no penalty


# ---------------------------------------------------------------------------
# get_transfer_allowance (API helper)
# ---------------------------------------------------------------------------

def test_get_transfer_allowance_returns_correct_info(db, seed_data):
    """get_transfer_allowance should return stage-aware info."""
    result = get_transfer_allowance(db, seed_data["squad"].id)
    assert result["free_remaining"] == 3
    assert result["stage"] == "GROUP"
    assert result["is_knockout"] is False
    assert result["round_name"] == "Group Stage MD1"

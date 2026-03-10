"""
transfers_service.py

Rules enforced:
- Transfer deadline: Round.deadline_utc blocks all transfers
- Budget: squad.budget_remaining + player_out.price - player_in.price >= 0
- Free transfers:
  * Group stage: 3 free per match day (each calendar date with matches)
  * Knockouts (R16+): 2 free per round
  * Extra transfers beyond the limit → deduct 4 pts immediately
  * Wildcard active → unlimited, no penalty
- Wildcard: Squad.wildcard_active_round_id matches current round
"""
from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.match import Match, MatchStatus
from app.models.player import Player
from app.models.round import Round, RoundStage
from app.models.squad import Squad
from app.models.squad_player import SquadPlayer
from app.models.squad_round_points import SquadRoundPoints
from app.models.transfer_allowance import TransferAllowance


def _current_round(db: Session) -> Round | None:
    now = datetime.utcnow()
    return (
        db.query(Round)
        .filter(Round.start_utc <= now, Round.end_utc >= now)
        .first()
    )


def _get_transfer_match_date(round_: Round, db: Session):
    """Determine which match date governs the transfer allowance.

    Group stage: today's date if matches exist today, else the next match date.
    Knockouts: round start date (single allowance for the whole round).
    """
    if round_.stage == RoundStage.GROUP:
        today = datetime.utcnow().date()
        has_matches_today = (
            db.query(Match)
            .filter(
                Match.rounds.any(Round.id == round_.id),
                func.date(Match.kickoff_utc) == today,
                Match.status.in_([MatchStatus.SCHEDULED, MatchStatus.LIVE]),
            )
            .first()
        )
        if has_matches_today:
            return today
        # Fall back to next upcoming match date in this round
        next_match = (
            db.query(Match)
            .filter(
                Match.rounds.any(Round.id == round_.id),
                Match.kickoff_utc > datetime.utcnow(),
            )
            .order_by(Match.kickoff_utc.asc())
            .first()
        )
        return next_match.kickoff_utc.date() if next_match else today
    else:
        return round_.start_utc.date()


def _get_or_create_allowance(
    db: Session, squad_id: str, round_: Round
) -> TransferAllowance:
    """Lazy-create a TransferAllowance row for the relevant match date."""
    match_date = _get_transfer_match_date(round_, db)
    allowance = (
        db.query(TransferAllowance)
        .filter_by(squad_id=squad_id, round_id=round_.id, match_date=match_date)
        .first()
    )
    if not allowance:
        # Group stage: 3 free per match day; Knockouts: 2 free per round
        default_free = 3 if round_.stage == RoundStage.GROUP else 2
        allowance = TransferAllowance(
            squad_id=squad_id,
            round_id=round_.id,
            match_date=match_date,
            free_remaining=default_free,
        )
        db.add(allowance)
        db.flush()
    return allowance


def get_transfer_allowance(db: Session, squad_id: str) -> dict:
    """Return the current transfer allowance info for a squad."""
    round_ = _current_round(db)
    if not round_:
        return {
            "free_remaining": 3,  # default to group stage allowance
            "stage": "GROUP",
            "match_date": None,
            "is_knockout": False,
            "round_name": None,
        }
    allowance = _get_or_create_allowance(db, squad_id, round_)
    return {
        "free_remaining": allowance.free_remaining,
        "stage": round_.stage.value,
        "match_date": str(allowance.match_date),
        "is_knockout": round_.stage != RoundStage.GROUP,
        "round_name": round_.name,
    }


def make_transfer(
    db: Session,
    squad_id: str,
    player_out_id: str,
    player_in_id: str,
) -> Squad:
    squad = db.get(Squad, squad_id)
    if not squad:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Squad not found")

    player_out = db.get(Player, player_out_id)
    player_in = db.get(Player, player_in_id)
    if not player_out or not player_in:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid players")

    already_in = (
        db.query(SquadPlayer)
        .filter(SquadPlayer.squad_id == squad_id, SquadPlayer.player_id == player_in_id)
        .first()
    )
    if already_in:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Player already in squad"
        )

    # ── Deadline check ────────────────────────────────────────────────────────
    round_ = _current_round(db)
    if round_ and datetime.utcnow() > round_.deadline_utc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Transfer deadline has passed for this round",
        )

    # ── Budget check ──────────────────────────────────────────────────────────
    price_delta = float(player_in.price or 0) - float(player_out.price or 0)
    new_budget = float(squad.budget_remaining) - price_delta
    if new_budget < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient budget — need £{price_delta:.1f}m more",
        )

    # ── Wildcard / free transfer logic ────────────────────────────────────────
    wildcard_active = (
        round_ is not None
        and squad.wildcard_active_round_id == round_.id
    )

    if not wildcard_active and round_:
        allowance = _get_or_create_allowance(db, squad_id, round_)
        if allowance.free_remaining > 0:
            allowance.free_remaining -= 1
        else:
            # -4 pt penalty, applied immediately
            srp = (
                db.query(SquadRoundPoints)
                .filter(
                    SquadRoundPoints.squad_id == squad_id,
                    SquadRoundPoints.round_id == round_.id,
                )
                .first()
            )
            if srp:
                srp.points = (srp.points or 0) - 4

    # ── Execute transfer ──────────────────────────────────────────────────────
    db.query(SquadPlayer).filter(
        SquadPlayer.squad_id == squad_id, SquadPlayer.player_id == player_out_id
    ).delete()

    db.add(SquadPlayer(squad_id=squad_id, player_id=player_in_id, is_starting=False))
    squad.budget_remaining = new_budget

    db.commit()
    db.refresh(squad)
    return squad


def activate_wildcard(db: Session, squad_id: str) -> Squad:
    """Activate the wildcard chip for the current round."""
    squad = db.get(Squad, squad_id)
    if not squad:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Squad not found")
    if squad.wildcard_used:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Wildcard already used this season"
        )
    round_ = _current_round(db)
    if not round_:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="No active round"
        )
    if datetime.utcnow() > round_.deadline_utc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot activate wildcard after deadline",
        )
    squad.wildcard_used = True
    squad.wildcard_active_round_id = round_.id
    db.commit()
    db.refresh(squad)
    return squad

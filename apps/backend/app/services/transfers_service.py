"""
transfers_service.py

Rules enforced:
- Transfer deadline: Round.deadline_utc blocks all transfers
- Budget: squad.budget_remaining + player_out.price - player_in.price >= 0
- Free transfers: 1 per round (Squad.free_transfers_remaining)
  * If 0 remaining and wildcard not active → deduct 4 pts immediately
  * If wildcard active for this round → unlimited, no penalty
- Wildcard: Squad.wildcard_active_round_id matches current round
"""
from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.player import Player
from app.models.round import Round
from app.models.squad import Squad
from app.models.squad_player import SquadPlayer
from app.models.squad_round_points import SquadRoundPoints


def _current_round(db: Session) -> Round | None:
    now = datetime.utcnow()
    return (
        db.query(Round)
        .filter(Round.start_utc <= now, Round.end_utc >= now)
        .first()
    )


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

    if not wildcard_active:
        if squad.free_transfers_remaining > 0:
            squad.free_transfers_remaining -= 1
        else:
            # -4 pt penalty, applied immediately
            if round_:
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

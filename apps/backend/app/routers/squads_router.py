from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.deps.auth_deps import get_current_user
from app.schemas.squad_schemas import (
    LineupUpdateRequest,
    SquadCreateRequest,
    SquadResponse,
    TeamNameUpdateRequest,
)
from app.services import squad_service

router = APIRouter()


@router.post("", response_model=SquadResponse)
def create_squad(payload: SquadCreateRequest, db: Session = Depends(get_db), user=Depends(get_current_user)):
    squad = squad_service.create_squad(
        db,
        user_id=user.id,
        league_id=payload.league_id,
        player_ids=payload.player_ids,
        budget_remaining=payload.budget_remaining,
        team_name=payload.team_name,
    )
    return squad


@router.get("/my", response_model=SquadResponse | None)
def my_squad(league_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    return squad_service.get_user_squad(db, user_id=user.id, league_id=league_id)


@router.put("/{squad_id}/lineup", response_model=SquadResponse)
def update_lineup(
    squad_id: str, payload: LineupUpdateRequest, db: Session = Depends(get_db), user=Depends(get_current_user)
):
    return squad_service.update_lineup(db, squad_id=squad_id, payload=payload)


@router.put("/{squad_id}/team-name", response_model=SquadResponse)
def update_team_name(
    squad_id: str, payload: TeamNameUpdateRequest, db: Session = Depends(get_db), user=Depends(get_current_user)
):
    return squad_service.update_team_name(db, squad_id=squad_id, team_name=payload.team_name)


@router.post("/{squad_id}/wildcard")
def use_wildcard(squad_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Activate the wildcard chip — unlimited free transfers for the current round."""
    from app.services.transfers_service import activate_wildcard
    return activate_wildcard(db, squad_id=squad_id)

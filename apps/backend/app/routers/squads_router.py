from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.deps.auth_deps import get_current_user
from app.schemas.squad_schemas import LineupUpdateRequest, SquadCreateRequest, SquadResponse
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


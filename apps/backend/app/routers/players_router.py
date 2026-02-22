from typing import List, Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.player import Player
from app.schemas.player_schemas import PlayerResponse

router = APIRouter()


@router.get("", response_model=List[PlayerResponse])
def list_players(
    db: Session = Depends(get_db),
    team_id: Optional[str] = None,
    position: Optional[str] = None,
    max_price: Optional[float] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
):
    q = db.query(Player)
    if team_id:
        q = q.filter(Player.team_id == team_id)
    if position:
        q = q.filter(Player.position == position)
    if max_price:
        q = q.filter(Player.price <= max_price)
    if search:
        q = q.filter(Player.name.ilike(f"%{search}%"))
    return q.offset(skip).limit(limit).all()


@router.get("/{player_id}", response_model=PlayerResponse)
def player_detail(player_id: str, db: Session = Depends(get_db)):
    return db.get(Player, player_id)

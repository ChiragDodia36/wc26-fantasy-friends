from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.deps.auth_deps import get_current_user
from app.schemas.league_schemas import LeagueBase, LeagueCreateRequest, LeagueJoinRequest, LeagueWithMembers
from app.services import league_service

router = APIRouter()


@router.post("", response_model=LeagueBase)
def create_league(payload: LeagueCreateRequest, db: Session = Depends(get_db), user=Depends(get_current_user)):
    return league_service.create_league(db, owner_id=user.id, name=payload.name)


@router.get("", response_model=list[LeagueBase])
def list_leagues(db: Session = Depends(get_db), user=Depends(get_current_user)):
    return league_service.list_user_leagues(db, user_id=user.id)


@router.post("/join", response_model=LeagueBase)
def join_league(payload: LeagueJoinRequest, db: Session = Depends(get_db), user=Depends(get_current_user)):
    return league_service.join_league(db, user_id=user.id, code=payload.code)


@router.get("/{league_id}", response_model=LeagueWithMembers)
def league_detail(league_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    league = db.query(league_service.League).filter_by(id=league_id).first()
    standings = league_service.league_standings(db, league_id)
    return LeagueWithMembers(**league.__dict__, members=league.members, standings=standings)


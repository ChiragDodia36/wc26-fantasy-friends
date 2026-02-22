import secrets
import string
from typing import List

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.league import League, league_memberships
from app.models.squad_round_points import SquadRoundPoints


def _generate_code() -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(6))


def create_league(db: Session, owner_id: str, name: str) -> League:
    code = _generate_code()
    league = League(name=name, code=code, owner_id=owner_id)
    db.add(league)
    db.flush()
    db.execute(league_memberships.insert().values(league_id=league.id, user_id=owner_id))
    db.commit()
    db.refresh(league)
    return league


def list_user_leagues(db: Session, user_id: str) -> List[League]:
    return (
        db.query(League)
        .join(league_memberships, league_memberships.c.league_id == League.id)
        .filter(league_memberships.c.user_id == user_id)
        .all()
    )


def join_league(db: Session, user_id: str, code: str) -> League:
    league = db.query(League).filter(League.code == code).first()
    if not league:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="League code invalid")
    already = (
        db.query(league_memberships)
        .filter(league_memberships.c.league_id == league.id, league_memberships.c.user_id == user_id)
        .first()
    )
    if already:
        return league
    db.execute(league_memberships.insert().values(league_id=league.id, user_id=user_id))
    db.commit()
    return league


def league_standings(db: Session, league_id: str):
    rows = (
        db.query(SquadRoundPoints.squad_id, SquadRoundPoints.points)
        .filter(SquadRoundPoints.squad_id.in_(db.query(League).filter(League.id == league_id)))
    )
    # Simplified placeholder; real query should sum per user/league.
    return []


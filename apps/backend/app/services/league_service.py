import secrets
import string
from datetime import datetime
from typing import Dict, List

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.league import League, league_memberships
from app.models.round import Round
from app.models.squad import Squad
from app.models.squad_round_points import SquadRoundPoints
from app.models.user import User


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


def league_standings(db: Session, league_id: str) -> List[Dict]:
    """Return ranked standings for a league — total points across all rounds."""
    # Sum all SquadRoundPoints for squads in this league
    rows = (
        db.query(
            Squad.id.label("squad_id"),
            User.username.label("username"),
            func.coalesce(func.sum(SquadRoundPoints.points), 0).label("total_points"),
        )
        .join(User, User.id == Squad.user_id)
        .outerjoin(SquadRoundPoints, SquadRoundPoints.squad_id == Squad.id)
        .filter(Squad.league_id == league_id)
        .group_by(Squad.id, User.username)
        .order_by(func.coalesce(func.sum(SquadRoundPoints.points), 0).desc())
        .all()
    )

    return [
        {
            "rank": i + 1,
            "squad_id": row.squad_id,
            "username": row.username,
            "total_points": int(row.total_points),
        }
        for i, row in enumerate(rows)
    ]


def current_round(db: Session) -> Round | None:
    """Return the round that is currently active (now between start_utc and end_utc)."""
    now = datetime.utcnow()
    return (
        db.query(Round)
        .filter(Round.start_utc <= now, Round.end_utc >= now)
        .first()
    )

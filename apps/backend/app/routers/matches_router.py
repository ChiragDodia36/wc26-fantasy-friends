from typing import List, Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.match import Match, MatchStatus
from app.schemas.match_schemas import MatchResponse

router = APIRouter()


@router.get("", response_model=List[MatchResponse])
def list_matches(
    db: Session = Depends(get_db),
    status: Optional[MatchStatus] = None,
    skip: int = 0,
    limit: int = 50,
):
    q = db.query(Match)
    if status:
        q = q.filter(Match.status == status)
    return q.offset(skip).limit(limit).all()


@router.get("/live", response_model=List[MatchResponse])
def live_matches(db: Session = Depends(get_db)):
    return db.query(Match).filter(Match.status == MatchStatus.LIVE).all()


@router.get("/{match_id}", response_model=MatchResponse)
def match_detail(match_id: str, db: Session = Depends(get_db)):
    return db.get(Match, match_id)

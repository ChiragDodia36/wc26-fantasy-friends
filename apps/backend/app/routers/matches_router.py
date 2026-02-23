from typing import List, Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload

from app.core.db import get_db
from app.models.match import Match, MatchStatus
from app.schemas.match_schemas import MatchResponse

router = APIRouter()


def _match_to_response(m: Match) -> MatchResponse:
    return MatchResponse(
        id=m.id,
        home_team_id=m.home_team_id,
        away_team_id=m.away_team_id,
        home_team_name=m.home_team.name if m.home_team else None,
        away_team_name=m.away_team.name if m.away_team else None,
        kickoff_utc=m.kickoff_utc,
        venue=m.venue,
        status=m.status,
        home_score=m.home_score,
        away_score=m.away_score,
        round_name=m.round_name,
    )


@router.get("", response_model=List[MatchResponse])
def list_matches(
    db: Session = Depends(get_db),
    status: Optional[MatchStatus] = None,
    skip: int = 0,
    limit: int = 50,
):
    q = (
        db.query(Match)
        .options(joinedload(Match.home_team), joinedload(Match.away_team))
        .order_by(Match.kickoff_utc)
    )
    if status:
        q = q.filter(Match.status == status)
    matches = q.offset(skip).limit(limit).all()
    return [_match_to_response(m) for m in matches]


@router.get("/live", response_model=List[MatchResponse])
def live_matches(db: Session = Depends(get_db)):
    matches = (
        db.query(Match)
        .options(joinedload(Match.home_team), joinedload(Match.away_team))
        .filter(Match.status == MatchStatus.LIVE)
        .all()
    )
    return [_match_to_response(m) for m in matches]

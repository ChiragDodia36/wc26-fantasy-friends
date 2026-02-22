from datetime import datetime

from pydantic import BaseModel

from app.models.match import MatchStatus


class MatchResponse(BaseModel):
    id: str
    home_team_id: str
    away_team_id: str
    kickoff_utc: datetime
    venue: str | None
    status: MatchStatus
    home_score: int | None
    away_score: int | None

    class Config:
        from_attributes = True


from datetime import datetime

from pydantic import BaseModel

from app.models.match import MatchStatus


class MatchResponse(BaseModel):
    id: str
    home_team_id: str
    away_team_id: str
    home_team_name: str | None = None
    away_team_name: str | None = None
    kickoff_utc: datetime
    venue: str | None
    status: MatchStatus
    home_score: int | None
    away_score: int | None
    round_name: str | None = None

    class Config:
        from_attributes = True


from typing import List, Optional

from pydantic import BaseModel


class SquadBuilderRequest(BaseModel):
    league_id: str
    budget: float
    preferred_formation: str
    risk_profile: str


class LineupRequest(BaseModel):
    league_id: str
    squad_id: str
    round_id: str


class TransferSuggestionRequest(BaseModel):
    league_id: str
    squad_id: str
    round_id: str
    budget: Optional[float] = None
    max_transfers: int = 3


class QARequest(BaseModel):
    league_id: str
    question: str


class AIRecommendation(BaseModel):
    explanation: str
    data: dict | List[dict] | None = None


# ---------------------------------------------------------------------------
# Transfer context — structured data for on-device LLM inference
# ---------------------------------------------------------------------------

class PlayerContext(BaseModel):
    player_id: str
    name: str
    position: str
    price: float
    team_id: str
    team_name: Optional[str] = None
    is_starting: Optional[bool] = None
    is_captain: Optional[bool] = None
    form_last_5: List[int]
    avg_form: float
    upcoming_fdr: Optional[int] = None


class MatchContext(BaseModel):
    match_id: str
    home_team_id: str
    away_team_id: str
    home_team_name: str
    away_team_name: str
    kickoff_utc: str
    venue: Optional[str] = None


class TransferContextResponse(BaseModel):
    squad_id: str
    budget_remaining: float
    free_transfers_remaining: int
    squad_players: List[PlayerContext]
    upcoming_matches: List[MatchContext]
    candidate_players: List[PlayerContext]
    max_transfers: int = 3
    past_lessons: List[str] = []


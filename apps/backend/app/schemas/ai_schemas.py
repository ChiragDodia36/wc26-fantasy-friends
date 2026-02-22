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


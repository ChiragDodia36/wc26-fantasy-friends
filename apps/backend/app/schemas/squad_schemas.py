from typing import List, Optional

from pydantic import BaseModel


class SquadPlayerLine(BaseModel):
    id: Optional[str] = None
    player_id: str
    is_starting: bool
    bench_order: Optional[int] = None
    is_captain: bool = False
    is_vice_captain: bool = False

    class Config:
        from_attributes = True


class SquadCreateRequest(BaseModel):
    league_id: str
    player_ids: List[str]
    budget_remaining: float
    team_name: Optional[str] = None


class SquadResponse(BaseModel):
    id: str
    league_id: str
    user_id: str
    budget_remaining: float
    team_name: Optional[str] = None
    formation: str = "4-4-2"
    free_transfers_remaining: int = 1
    wildcard_used: bool = False
    players: List[SquadPlayerLine] = []

    class Config:
        from_attributes = True


class LineupUpdateRequest(BaseModel):
    players: List[SquadPlayerLine]
    formation: Optional[str] = None


class SquadPlayersUpdateRequest(BaseModel):
    player_ids: List[str]
    budget_remaining: float


class TeamNameUpdateRequest(BaseModel):
    team_name: str


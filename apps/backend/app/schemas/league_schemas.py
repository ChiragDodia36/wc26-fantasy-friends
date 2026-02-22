from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel

from app.schemas.user_schemas import UserBase


class LeagueBase(BaseModel):
    id: str
    name: str
    code: str
    owner_id: str
    created_at: datetime

    class Config:
        from_attributes = True


class LeagueCreateRequest(BaseModel):
    name: str


class LeagueJoinRequest(BaseModel):
    code: str


class LeagueWithMembers(LeagueBase):
    members: List[UserBase] = []
    standings: Optional[list] = None


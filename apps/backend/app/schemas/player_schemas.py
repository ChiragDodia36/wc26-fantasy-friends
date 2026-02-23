from pydantic import BaseModel


class PlayerResponse(BaseModel):
    id: str
    name: str
    position: str
    price: float
    team_id: str
    team_name: str | None = None

    class Config:
        from_attributes = True


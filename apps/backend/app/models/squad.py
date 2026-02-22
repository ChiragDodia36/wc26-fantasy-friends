import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import relationship

from app.core.db import Base


class Squad(Base):
    __tablename__ = "squads"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    league_id = Column(String, ForeignKey("leagues.id"), nullable=False)
    budget_remaining = Column(Numeric(10, 2), nullable=False)
    free_transfers_remaining = Column(Integer, default=1, nullable=False)
    wildcard_used = Column(Boolean, default=False, nullable=False)
    wildcard_active_round_id = Column(String, ForeignKey("rounds.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="squads")
    league = relationship("League", back_populates="squads")
    players = relationship("SquadPlayer", back_populates="squad")
    round_points = relationship("SquadRoundPoints", back_populates="squad")


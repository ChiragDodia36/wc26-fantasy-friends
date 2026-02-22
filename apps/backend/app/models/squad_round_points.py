import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import relationship

from app.core.db import Base


class SquadRoundPoints(Base):
    __tablename__ = "squad_round_points"
    __table_args__ = (UniqueConstraint("squad_id", "round_id", name="uq_squad_round"),)

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    squad_id = Column(String, ForeignKey("squads.id"), nullable=False)
    round_id = Column(String, ForeignKey("rounds.id"), nullable=False)
    points = Column(Integer, default=0)
    rank_in_league = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    squad = relationship("Squad", back_populates="round_points")
    round = relationship("Round")


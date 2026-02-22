import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Float, ForeignKey, String
from sqlalchemy import JSON
from sqlalchemy.orm import relationship

from app.core.db import Base


class AIDecision(Base):
    __tablename__ = "ai_decisions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    squad_id = Column(String, ForeignKey("squads.id"), nullable=False)
    round_id = Column(String, ForeignKey("rounds.id"), nullable=False)
    # squad / transfer / lineup / captain
    decision_type = Column(String, nullable=False)
    # JSON arrays of player UUIDs
    recommended_player_ids = Column(JSON, nullable=True)
    recommended_captain_id = Column(String, nullable=True)
    # Filled post-deadline by reflection agent
    actual_player_ids = Column(JSON, nullable=True)
    # safe / differential / fixture
    tot_branch = Column(String, nullable=True)
    confidence_pct = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    squad = relationship("Squad", backref="ai_decisions")
    round = relationship("Round", backref="ai_decisions")

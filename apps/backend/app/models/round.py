import enum
import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Enum, String, Table, ForeignKey
from sqlalchemy.orm import relationship

from app.core.db import Base


class RoundStage(str, enum.Enum):
    GROUP = "GROUP"
    ROUND_OF_16 = "ROUND_OF_16"
    QUARTER_FINAL = "QUARTER_FINAL"
    SEMI_FINAL = "SEMI_FINAL"
    THIRD_PLACE = "THIRD_PLACE"
    FINAL = "FINAL"

round_matches = Table(
    "round_matches",
    Base.metadata,
    Column("round_id", String, ForeignKey("rounds.id"), primary_key=True),
    Column("match_id", String, ForeignKey("matches.id"), primary_key=True),
)


class Round(Base):
    __tablename__ = "rounds"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    start_utc = Column(DateTime, nullable=False)
    deadline_utc = Column(DateTime, nullable=False)
    end_utc = Column(DateTime, nullable=False)
    stage = Column(Enum(RoundStage), default=RoundStage.GROUP, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    matches = relationship("Match", secondary=round_matches, back_populates="rounds")


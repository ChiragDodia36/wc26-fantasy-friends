import uuid

from sqlalchemy import Boolean, Column, ForeignKey, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.orm import relationship

from app.core.db import Base


class PlayerMatchStats(Base):
    __tablename__ = "player_match_stats"
    __table_args__ = (UniqueConstraint("match_id", "player_id", name="uq_match_player"),)

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    match_id = Column(String, ForeignKey("matches.id"), nullable=False)
    player_id = Column(String, ForeignKey("players.id"), nullable=False)
    minutes_played = Column(Integer, default=0)
    goals = Column(Integer, default=0)
    assists = Column(Integer, default=0)
    clean_sheet = Column(Boolean, default=False)
    goals_conceded = Column(Integer, default=0)
    yellow_cards = Column(Integer, default=0)
    red_cards = Column(Integer, default=0)
    own_goals = Column(Integer, default=0)
    penalties_scored = Column(Integer, default=0)
    penalties_missed = Column(Integer, default=0)
    saves = Column(Integer, default=0)
    fantasy_points = Column(Integer, default=0)

    match = relationship("Match", back_populates="stats")
    player = relationship("Player", back_populates="match_stats")


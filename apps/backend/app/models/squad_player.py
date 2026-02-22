import uuid

from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import relationship

from app.core.db import Base


class SquadPlayer(Base):
    __tablename__ = "squad_players"
    __table_args__ = (UniqueConstraint("squad_id", "player_id", name="uq_squad_player"),)

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    squad_id = Column(String, ForeignKey("squads.id"), nullable=False)
    player_id = Column(String, ForeignKey("players.id"), nullable=False)
    is_starting = Column(Boolean, default=True)
    bench_order = Column(Integer, nullable=True)
    is_captain = Column(Boolean, default=False)
    is_vice_captain = Column(Boolean, default=False)

    squad = relationship("Squad", back_populates="players")
    player = relationship("Player")


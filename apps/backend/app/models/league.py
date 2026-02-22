import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, String, Table
from sqlalchemy.orm import relationship

from app.core.db import Base

league_memberships = Table(
    "league_memberships",
    Base.metadata,
    Column("league_id", String, ForeignKey("leagues.id"), primary_key=True),
    Column("user_id", String, ForeignKey("users.id"), primary_key=True),
)


class League(Base):
    __tablename__ = "leagues"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    code = Column(String, unique=True, nullable=False, index=True)
    owner_id = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User", backref="owned_leagues")
    members = relationship("User", secondary=league_memberships, back_populates="leagues")
    squads = relationship("Squad", back_populates="league")


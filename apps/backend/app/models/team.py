import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, String
from sqlalchemy.orm import relationship

from app.core.db import Base


class Team(Base):
    __tablename__ = "teams"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    external_id = Column(String, index=True, nullable=False)
    name = Column(String, nullable=False)
    country_code = Column(String, nullable=False)
    group_name = Column(String, nullable=True)
    flag_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    players = relationship("Player", back_populates="team")


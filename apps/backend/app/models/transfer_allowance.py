import uuid
from datetime import datetime

from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String, UniqueConstraint

from app.core.db import Base


class TransferAllowance(Base):
    """Per-squad, per-match-date (group) or per-round (knockout) free transfer counter.

    Group stage: each calendar date with matches gets its own row (3 free each).
    Knockouts: one row per round (3 free for the entire round).
    """

    __tablename__ = "transfer_allowances"
    __table_args__ = (
        UniqueConstraint(
            "squad_id", "round_id", "match_date", name="uq_squad_round_matchdate"
        ),
    )

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    squad_id = Column(String, ForeignKey("squads.id"), nullable=False)
    round_id = Column(String, ForeignKey("rounds.id"), nullable=False)
    match_date = Column(Date, nullable=False)
    free_remaining = Column(Integer, default=3, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

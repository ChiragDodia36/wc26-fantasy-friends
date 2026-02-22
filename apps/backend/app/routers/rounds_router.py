from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.services.league_service import current_round

router = APIRouter()


@router.get("/current")
def get_current_round(db: Session = Depends(get_db)):
    """Return the currently active round with deadline_utc info."""
    round_ = current_round(db)
    if not round_:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="No active round"
        )
    return {
        "id": round_.id,
        "name": round_.name,
        "start_utc": round_.start_utc,
        "deadline_utc": round_.deadline_utc,
        "end_utc": round_.end_utc,
    }

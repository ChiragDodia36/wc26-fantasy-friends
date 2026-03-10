from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.deps.auth_deps import get_current_user
from app.services import transfers_service

router = APIRouter()


class TransferRequest(BaseModel):
    squad_id: str
    player_out_id: str
    player_in_id: str


@router.get("/allowance")
def transfer_allowance(
    squad_id: str,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Return the current free transfer count for the squad's active match day/round."""
    return transfers_service.get_transfer_allowance(db, squad_id)


@router.post("")
def transfer(payload: TransferRequest, db: Session = Depends(get_db), user=Depends(get_current_user)):
    return transfers_service.make_transfer(db, payload.squad_id, payload.player_out_id, payload.player_in_id)


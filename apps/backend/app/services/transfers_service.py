from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.player import Player
from app.models.squad import Squad
from app.models.squad_player import SquadPlayer


def make_transfer(db: Session, squad_id: str, player_out_id: str, player_in_id: str):
    squad = db.get(Squad, squad_id)
    if not squad:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Squad not found")
    player_out = db.get(Player, player_out_id)
    player_in = db.get(Player, player_in_id)
    if not player_out or not player_in:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid players")
    current = db.query(SquadPlayer).filter(SquadPlayer.squad_id == squad_id, SquadPlayer.player_id == player_in_id).first()
    if current:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Player already in squad")
    # Remove outgoing
    db.query(SquadPlayer).filter(SquadPlayer.squad_id == squad_id, SquadPlayer.player_id == player_out_id).delete()
    db.add(SquadPlayer(squad_id=squad_id, player_id=player_in_id, is_starting=False))
    db.commit()
    db.refresh(squad)
    return squad


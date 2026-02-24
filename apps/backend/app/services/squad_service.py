import uuid
from decimal import Decimal
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.league import League, league_memberships
from app.models.player import Player
from app.models.squad import Squad
from app.models.squad_player import SquadPlayer
from app.schemas.squad_schemas import LineupUpdateRequest


MAX_PLAYERS_PER_TEAM = 2
MAX_SQUAD = 15
POSITION_COUNTS = {"GK": 2, "DEF": 5, "MID": 5, "FWD": 3}
BUDGET = Decimal("100.0")

# Default formation: positions → how many starters per position
FORMATIONS = {
    "4-4-2": {"GK": 1, "DEF": 4, "MID": 4, "FWD": 2},
    "4-3-3": {"GK": 1, "DEF": 4, "MID": 3, "FWD": 3},
    "3-4-3": {"GK": 1, "DEF": 3, "MID": 4, "FWD": 3},
    "3-5-2": {"GK": 1, "DEF": 3, "MID": 5, "FWD": 2},
    "4-5-1": {"GK": 1, "DEF": 4, "MID": 5, "FWD": 1},
    "5-4-1": {"GK": 1, "DEF": 5, "MID": 4, "FWD": 1},
    "5-3-2": {"GK": 1, "DEF": 5, "MID": 3, "FWD": 2},
}


def _ensure_league(db: Session, league_id: str, user_id: str) -> str:
    """Ensure the league exists; auto-create a default league if needed."""
    league = db.query(League).filter(League.id == league_id).first()
    if league:
        return league.id
    # Auto-create for 'default' league
    if league_id == "default":
        league = League(
            id="default",
            name="My Team",
            code="DEFAULT-" + str(uuid.uuid4())[:8],
            owner_id=user_id,
        )
        db.add(league)
        db.flush()
        # Add owner as member
        db.execute(league_memberships.insert().values(league_id=league.id, user_id=user_id))
        db.flush()
        return league.id
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="League not found")


def _auto_assign_lineup(db: Session, squad: Squad, players: List[Player]) -> None:
    """Auto-assign starting XI, captain, and VC using fallback logic (4-4-2, price-based)."""
    formation = FORMATIONS.get(squad.formation, FORMATIONS["4-4-2"])

    # Group players by position
    by_pos: dict[str, list[Player]] = {"GK": [], "DEF": [], "MID": [], "FWD": []}
    for p in players:
        by_pos.setdefault(p.position, []).append(p)

    # Sort each group by price descending (best players start)
    for pos in by_pos:
        by_pos[pos].sort(key=lambda p: float(p.price), reverse=True)

    starters: set[str] = set()
    bench_players: list[str] = []

    for pos, count in formation.items():
        group = by_pos.get(pos, [])
        for i, p in enumerate(group):
            if i < count:
                starters.add(p.id)
            else:
                bench_players.append(p.id)

    # Captain = highest-priced FWD starter; VC = highest-priced MID starter
    captain_id = None
    vc_id = None
    fwd_starters = [p for p in by_pos.get("FWD", []) if p.id in starters]
    mid_starters = [p for p in by_pos.get("MID", []) if p.id in starters]
    if fwd_starters:
        captain_id = fwd_starters[0].id
    if mid_starters:
        vc_id = mid_starters[0].id

    # Update SquadPlayer rows
    bench_order = 1
    for sp in db.query(SquadPlayer).filter(SquadPlayer.squad_id == squad.id).all():
        sp.is_starting = sp.player_id in starters
        sp.is_captain = sp.player_id == captain_id
        sp.is_vice_captain = sp.player_id == vc_id
        if not sp.is_starting:
            sp.bench_order = bench_order
            bench_order += 1
        else:
            sp.bench_order = None
    db.flush()


def create_squad(
    db: Session,
    user_id: str,
    league_id: str,
    player_ids: List[str],
    budget_remaining: float,
    team_name: Optional[str] = None,
) -> Squad:
    # Ensure league exists
    league_id = _ensure_league(db, league_id, user_id)

    if len(player_ids) != MAX_SQUAD:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Squad must have 15 players")
    players = db.query(Player).filter(Player.id.in_(player_ids)).all()
    if len(players) != MAX_SQUAD:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid players")

    # Validate positions
    counts = {p: 0 for p in POSITION_COUNTS}
    per_team = {}
    total_price = Decimal("0")
    for p in players:
        counts[p.position] = counts.get(p.position, 0) + 1
        per_team[p.team_id] = per_team.get(p.team_id, 0) + 1
        total_price += Decimal(p.price)
    for pos, required in POSITION_COUNTS.items():
        if counts.get(pos, 0) != required:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{pos} count invalid")
    if any(v > MAX_PLAYERS_PER_TEAM for v in per_team.values()):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Too many from one team")
    if total_price > BUDGET:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Budget exceeded")

    # Delete existing squad for this user/league
    existing = db.query(Squad).filter(Squad.user_id == user_id, Squad.league_id == league_id).first()
    if existing:
        db.query(SquadPlayer).filter(SquadPlayer.squad_id == existing.id).delete()
        db.delete(existing)
        db.flush()

    squad = Squad(
        user_id=user_id,
        league_id=league_id,
        budget_remaining=budget_remaining,
        team_name=team_name,
        formation="4-4-2",
    )
    db.add(squad)
    db.flush()
    for pid in player_ids:
        db.add(SquadPlayer(squad_id=squad.id, player_id=pid, is_starting=False))
    db.flush()

    # Auto-assign lineup with fallback logic (default 4-4-2)
    _auto_assign_lineup(db, squad, players)

    db.commit()
    db.refresh(squad)
    return squad


def get_user_squad(db: Session, user_id: str, league_id: str) -> Squad | None:
    return db.query(Squad).filter(Squad.user_id == user_id, Squad.league_id == league_id).first()


def update_lineup(db: Session, squad_id: str, payload: LineupUpdateRequest) -> Squad:
    squad = db.get(Squad, squad_id)
    if not squad:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Squad not found")
    # Update formation if provided
    if payload.formation and payload.formation in FORMATIONS:
        squad.formation = payload.formation
    # reset
    db.query(SquadPlayer).filter(SquadPlayer.squad_id == squad_id).update(
        {"is_starting": False, "bench_order": None, "is_captain": False, "is_vice_captain": False}
    )
    for sp in payload.players:
        db.query(SquadPlayer).filter(SquadPlayer.squad_id == squad_id, SquadPlayer.player_id == sp.player_id).update(
            {
                "is_starting": sp.is_starting,
                "bench_order": sp.bench_order,
                "is_captain": sp.is_captain,
                "is_vice_captain": sp.is_vice_captain,
            }
        )
    db.commit()
    db.refresh(squad)
    return squad


def update_team_name(db: Session, squad_id: str, team_name: str) -> Squad:
    squad = db.get(Squad, squad_id)
    if not squad:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Squad not found")
    squad.team_name = team_name
    db.commit()
    db.refresh(squad)
    return squad

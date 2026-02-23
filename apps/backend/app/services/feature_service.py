"""
Feature service — builds player feature vectors and form snapshots.

Used by the RL executor (Step 11+) and the GET /players/{id}/form endpoint.
"""
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.player import Player
from app.models.player_match_stats import PlayerMatchStats
from app.services.fdr_service import get_upcoming_fdr

# Position encoding for RL feature vectors
POSITION_ENCODING = {"GK": 1, "DEF": 2, "MID": 3, "FWD": 4}


def build_player_features(player_id: str, db: Session) -> Optional[dict]:
    """Build a feature dict for a single player from their match stats.

    Returns None if the player doesn't exist.
    """
    player = db.get(Player, player_id)
    if player is None:
        return None

    # Aggregate stats across all matches
    row = (
        db.query(
            func.count(PlayerMatchStats.id).label("matches_played"),
            func.coalesce(func.sum(PlayerMatchStats.goals), 0).label("total_goals"),
            func.coalesce(func.sum(PlayerMatchStats.assists), 0).label("total_assists"),
            func.coalesce(func.sum(PlayerMatchStats.fantasy_points), 0).label("total_points"),
            func.coalesce(func.sum(PlayerMatchStats.minutes_played), 0).label("total_minutes"),
            func.coalesce(func.sum(PlayerMatchStats.saves), 0).label("total_saves"),
            func.coalesce(func.sum(PlayerMatchStats.yellow_cards), 0).label("total_yellows"),
            func.coalesce(func.sum(PlayerMatchStats.red_cards), 0).label("total_reds"),
            func.coalesce(func.sum(PlayerMatchStats.goals_conceded), 0).label("total_conceded"),
        )
        .filter(PlayerMatchStats.player_id == player_id)
        .first()
    )

    matches_played = row[0] if row else 0
    total_goals = int(row[1]) if row else 0
    total_assists = int(row[2]) if row else 0
    total_points = int(row[3]) if row else 0
    total_minutes = int(row[4]) if row else 0
    total_saves = int(row[5]) if row else 0
    total_yellows = int(row[6]) if row else 0
    total_reds = int(row[7]) if row else 0
    total_conceded = int(row[8]) if row else 0

    avg_points = round(total_points / matches_played, 2) if matches_played > 0 else 0.0

    return {
        "player_id": player_id,
        "position": player.position,
        "position_encoded": POSITION_ENCODING.get(player.position, 0),
        "price": float(player.price),
        "team_id": player.team_id,
        "matches_played": matches_played,
        "total_goals": total_goals,
        "total_assists": total_assists,
        "total_points": total_points,
        "total_minutes": total_minutes,
        "avg_points": avg_points,
        "total_saves": total_saves,
        "total_yellows": total_yellows,
        "total_reds": total_reds,
        "total_conceded": total_conceded,
    }


def get_player_form(player_id: str, db: Session) -> Optional[dict]:
    """Build a form snapshot for the player detail screen.

    Returns dict with last5Points, totalPointsThisTournament, upcomingFdr.
    Returns None if the player doesn't exist.
    """
    player = db.get(Player, player_id)
    if player is None:
        return None

    # Last 5 match fantasy points (ordered by match kickoff, most recent first)
    from app.models.match import Match

    last5 = (
        db.query(PlayerMatchStats.fantasy_points)
        .join(Match, PlayerMatchStats.match_id == Match.id)
        .filter(PlayerMatchStats.player_id == player_id)
        .order_by(Match.kickoff_utc.desc())
        .limit(5)
        .all()
    )
    last5_points = [row[0] for row in reversed(last5)]  # chronological order

    # Total tournament points
    total = (
        db.query(func.coalesce(func.sum(PlayerMatchStats.fantasy_points), 0))
        .filter(PlayerMatchStats.player_id == player_id)
        .scalar()
    )

    # Upcoming FDR
    fdr = get_upcoming_fdr(player_id, db)

    return {
        "last5Points": last5_points,
        "totalPointsThisTournament": int(total),
        "upcomingFdr": fdr,
    }

"""
FDR (Fixture Difficulty Rating) service.

Computes a 1–5 difficulty rating for an upcoming match based on the
opponent's offensive/defensive record in the tournament so far.

1 = very easy, 5 = very hard.
"""
from datetime import datetime
from typing import Optional

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.models.match import Match, MatchStatus
from app.models.player import Player
from app.models.player_match_stats import PlayerMatchStats


def compute_fdr(team_id: str, opponent_id: str, db: Session) -> int:
    """Compute FDR for `team_id` playing against `opponent_id`.

    Based on how many goals the opponent has scored in finished matches.
    More goals scored by opponent = harder fixture for team_id.

    Returns int 1–5.
    """
    # Count total goals scored by the opponent in all finished matches
    opponent_home_goals = (
        db.query(func.coalesce(func.sum(Match.home_score), 0))
        .filter(Match.home_team_id == opponent_id, Match.status == MatchStatus.FINISHED)
        .scalar()
    )
    opponent_away_goals = (
        db.query(func.coalesce(func.sum(Match.away_score), 0))
        .filter(Match.away_team_id == opponent_id, Match.status == MatchStatus.FINISHED)
        .scalar()
    )
    total_goals = int(opponent_home_goals) + int(opponent_away_goals)

    # Count finished matches involving the opponent
    match_count = (
        db.query(func.count(Match.id))
        .filter(
            Match.status == MatchStatus.FINISHED,
            or_(Match.home_team_id == opponent_id, Match.away_team_id == opponent_id),
        )
        .scalar()
    )

    if match_count == 0:
        return 3  # Unknown opponent — medium difficulty

    goals_per_match = total_goals / match_count

    # Map goals-per-match to FDR 1–5
    if goals_per_match >= 2.5:
        return 5  # Very strong attack
    elif goals_per_match >= 1.8:
        return 4
    elif goals_per_match >= 1.0:
        return 3
    elif goals_per_match >= 0.5:
        return 2
    else:
        return 1  # Very weak attack


def get_upcoming_fdr(player_id: str, db: Session) -> Optional[int]:
    """Get the FDR for a player's next scheduled match.

    Returns None if no upcoming match exists.
    """
    player = db.get(Player, player_id)
    if player is None:
        return None

    team_id = player.team_id
    now = datetime.utcnow()

    # Find the next scheduled match for this player's team
    upcoming = (
        db.query(Match)
        .filter(
            Match.status == MatchStatus.SCHEDULED,
            Match.kickoff_utc > now,
            or_(Match.home_team_id == team_id, Match.away_team_id == team_id),
        )
        .order_by(Match.kickoff_utc.asc())
        .first()
    )

    if upcoming is None:
        return None

    # Determine opponent
    opponent_id = upcoming.away_team_id if upcoming.home_team_id == team_id else upcoming.home_team_id

    return compute_fdr(team_id, opponent_id, db)

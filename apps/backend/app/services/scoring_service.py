"""
Scoring rules for WC26 Fantasy Friends.

Bonus points from API-Football player rating are applied in sync_stats_task.py
after we have the rating value. Only base match stats are computed here.
"""
from app.models.player import Player
from app.models.player_match_stats import PlayerMatchStats


def compute_player_points(player: Player, stats: PlayerMatchStats) -> int:
    """Compute fantasy points for a player based on their match stats."""
    points = 0

    # Appearance points
    if stats.minutes_played >= 1:
        points += 1
    if stats.minutes_played >= 60:
        points += 1

    # Goals (FWD=4, MID=5, DEF=6, GK=6)
    goal_pts = {"GK": 6, "DEF": 6, "MID": 5, "FWD": 4}
    points += stats.goals * goal_pts.get(player.position, 4)

    # Assists
    points += stats.assists * 3

    # Clean sheet (must play ≥60 min)
    if stats.clean_sheet and stats.minutes_played >= 60:
        if player.position in {"GK", "DEF"}:
            points += 4
        elif player.position == "MID":
            points += 1

    # Goals conceded (GK/DEF: -1 per every 2 conceded)
    if player.position in {"GK", "DEF"} and stats.goals_conceded:
        points -= stats.goals_conceded // 2

    # Saves (GK: 1 pt per 3 saves)
    if player.position == "GK" and stats.saves:
        points += stats.saves // 3

    # Penalties
    points += stats.penalties_scored * 3
    points -= stats.penalties_missed * 2

    # Discipline
    points -= stats.yellow_cards
    points -= stats.red_cards * 3
    points -= stats.own_goals * 2

    return points


def apply_points(stats: PlayerMatchStats) -> int:
    player = stats.player
    points = compute_player_points(player, stats)
    stats.fantasy_points = points
    return points

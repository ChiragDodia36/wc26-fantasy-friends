from app.models.player import Player
from app.models.player_match_stats import PlayerMatchStats


def compute_player_points(player: Player, stats: PlayerMatchStats) -> int:
    points = 0
    if stats.minutes_played >= 1:
        points += 1
    if stats.minutes_played >= 60:
        points += 1
    goal_points = {"GK": 6, "DEF": 6, "MID": 5, "FWD": 4}
    points += stats.goals * goal_points.get(player.position, 4)
    points += stats.assists * 3
    if player.position in {"GK", "DEF"} and stats.clean_sheet and stats.minutes_played >= 60:
        points += 4
    if player.position in {"GK", "DEF"} and stats.goals_conceded:
        points -= stats.goals_conceded // 2
    points += stats.penalties_scored * 3
    points -= stats.penalties_missed * 2
    points -= stats.yellow_cards
    points -= stats.red_cards * 3
    points -= stats.own_goals * 2
    return points


def apply_points(stats: PlayerMatchStats) -> int:
    player = stats.player
    points = compute_player_points(player, stats)
    stats.fantasy_points = points
    return points


"""
sync_stats_task.py

Triggered post-match (by sync_fixtures_task when a match finishes).
Uses 1 API-Football call to fetch per-player stats, runs scoring, updates DB.
"""
import logging

from sqlalchemy.orm import Session

from app.core.db import SessionLocal
from app.integrations.api_football_client import APIFootballClient
from app.models.match import Match, MatchStatus
from app.models.player import Player
from app.models.player_match_stats import PlayerMatchStats
from app.models.squad_player import SquadPlayer
from app.models.squad_round_points import SquadRoundPoints
from app.services.scoring_service import compute_player_points

log = logging.getLogger(__name__)


def sync_match_stats(match_id: str) -> None:
    """Fetch and store player stats for a finished match, then update round points."""
    db: Session = SessionLocal()
    try:
        match = db.query(Match).filter(Match.id == match_id).first()
        if not match or match.status != MatchStatus.FINISHED:
            log.warning("sync_match_stats: match %s not found or not finished", match_id)
            return

        client = APIFootballClient()
        try:
            raw_stats = client.fetch_player_stats(int(match.external_id))
        except Exception as exc:
            log.error("API-Football fetch_player_stats failed for %s: %s", match_id, exc)
            return

        for team_data in raw_stats:
            for player_data in team_data.get("players", []):
                player_info = player_data.get("player", {})
                ext_player_id = str(player_info.get("id", ""))
                stats_list = player_data.get("statistics", [{}])
                s = stats_list[0] if stats_list else {}

                player = db.query(Player).filter(Player.external_id == ext_player_id).first()
                if not player:
                    continue

                games = s.get("games", {})
                goals_data = s.get("goals", {})
                cards = s.get("cards", {})

                minutes = int(games.get("minutes") or 0)
                goals = int(goals_data.get("total") or 0)
                assists = int(goals_data.get("assists") or 0)
                yellow = int(cards.get("yellow") or 0)
                red = int(cards.get("red") or 0)
                saves = int((s.get("goalkeeping") or {}).get("saves") or 0)
                rating_str = games.get("rating")
                rating = float(rating_str) if rating_str else 0.0

                # Upsert PlayerMatchStats
                pms = (
                    db.query(PlayerMatchStats)
                    .filter(
                        PlayerMatchStats.match_id == match_id,
                        PlayerMatchStats.player_id == player.id,
                    )
                    .first()
                )
                if not pms:
                    pms = PlayerMatchStats(match_id=match_id, player_id=player.id)
                    db.add(pms)

                pms.minutes_played = minutes
                pms.goals = goals
                pms.assists = assists
                pms.yellow_cards = yellow
                pms.red_cards = red
                pms.saves = saves
                pms.fantasy_points = compute_player_points(player, pms)

                # Bonus from API-Football rating
                if rating >= 8.0:
                    pms.fantasy_points += 3
                elif rating >= 7.0:
                    pms.fantasy_points += 2
                elif rating >= 6.5:
                    pms.fantasy_points += 1

        db.flush()
        _update_squad_round_points(match, db)
        db.commit()
        log.info("Stats synced for match %s", match_id)

    except Exception as exc:
        db.rollback()
        log.error("sync_match_stats failed: %s", exc)
    finally:
        db.close()


def _update_squad_round_points(match: Match, db: Session) -> None:
    """Add each player's fantasy_points to SquadRoundPoints for all squads in the round."""
    # Find the round containing this match
    if not match.rounds:
        return
    round_ = match.rounds[0]

    pms_list = (
        db.query(PlayerMatchStats).filter(PlayerMatchStats.match_id == match.id).all()
    )

    for pms in pms_list:
        # Find all squad_players holding this player
        squad_players = (
            db.query(SquadPlayer).filter(SquadPlayer.player_id == pms.player_id).all()
        )
        for sp in squad_players:
            pts = pms.fantasy_points
            # Captain multiplier
            if sp.is_captain:
                pts = int(pts * 2)
            elif sp.is_vice_captain:
                pts = int(pts * 1.5)

            srp = (
                db.query(SquadRoundPoints)
                .filter(
                    SquadRoundPoints.squad_id == sp.squad_id,
                    SquadRoundPoints.round_id == round_.id,
                )
                .first()
            )
            if srp:
                srp.points = (srp.points or 0) + pts

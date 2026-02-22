"""
sync_fixtures_task.py

Polls football-data.org for live match scores and updates the DB.
Smart polling intervals are controlled by the APScheduler job in scheduler.py.

This task:
1. Fetches live matches from football-data.org
2. Updates Match.status, Match.home_score, Match.away_score
3. When a match transitions to FINISHED → triggers sync_stats_task
"""
import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.db import SessionLocal
from app.integrations.football_data_client import FootballDataClient
from app.models.match import Match, MatchStatus

log = logging.getLogger(__name__)

# football-data.org status → our MatchStatus enum
_STATUS_MAP = {
    "SCHEDULED": MatchStatus.SCHEDULED,
    "TIMED": MatchStatus.SCHEDULED,
    "IN_PLAY": MatchStatus.LIVE,
    "PAUSED": MatchStatus.LIVE,   # half-time
    "FINISHED": MatchStatus.FINISHED,
    "SUSPENDED": MatchStatus.SCHEDULED,
    "POSTPONED": MatchStatus.SCHEDULED,
    "CANCELLED": MatchStatus.SCHEDULED,
    "AWARDED": MatchStatus.FINISHED,
}


def sync_live_scores() -> list[int]:
    """Poll live matches and update DB. Returns list of newly-finished match IDs."""
    client = FootballDataClient()
    try:
        live_matches = client.fetch_live_matches()
    except Exception as exc:
        log.warning("football-data.org poll failed: %s", exc)
        return []

    newly_finished: list[int] = []

    db: Session = SessionLocal()
    try:
        for raw in live_matches:
            fd_id = str(raw["id"])
            new_status = _STATUS_MAP.get(raw.get("status", ""), MatchStatus.SCHEDULED)
            score = raw.get("score", {})
            ft = score.get("fullTime", {})
            home_score = ft.get("home")
            away_score = ft.get("away")

            match = db.query(Match).filter(Match.external_id == fd_id).first()
            if not match:
                log.debug("No DB match for football-data id=%s", fd_id)
                continue

            was_live = match.status == MatchStatus.LIVE
            match.status = new_status
            if home_score is not None:
                match.home_score = home_score
            if away_score is not None:
                match.away_score = away_score

            if was_live and new_status == MatchStatus.FINISHED:
                newly_finished.append(match.id)
                log.info("Match %s finished: %s-%s", match.id, home_score, away_score)

        db.commit()
    except Exception as exc:
        db.rollback()
        log.error("DB error in sync_live_scores: %s", exc)
    finally:
        db.close()

    return newly_finished

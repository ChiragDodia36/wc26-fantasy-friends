"""
APScheduler-based background scheduler.

Smart polling strategy:
  - Every 30 seconds: sync_live_scores() (when tournament is active)
  - On match finish: sync_match_stats() triggered immediately
  - Runs in the same process as FastAPI; started/stopped via lifespan events.
"""
import logging

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

from app.tasks.sync_fixtures_task import sync_live_scores
from app.tasks.sync_stats_task import sync_match_stats

log = logging.getLogger(__name__)

_scheduler: BackgroundScheduler | None = None


def _poll_and_sync() -> None:
    """Single combined polling job: fetch live scores, then sync stats for any new finishes."""
    newly_finished = sync_live_scores()
    for match_id in newly_finished:
        log.info("Triggering stats sync for finished match %s", match_id)
        sync_match_stats(str(match_id))


def start_scheduler() -> None:
    global _scheduler
    _scheduler = BackgroundScheduler(timezone="UTC")
    _scheduler.add_job(
        _poll_and_sync,
        trigger=IntervalTrigger(seconds=30),
        id="live_poll",
        replace_existing=True,
        max_instances=1,
        misfire_grace_time=10,
    )
    _scheduler.start()
    log.info("APScheduler started — polling every 30s")


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        log.info("APScheduler stopped")

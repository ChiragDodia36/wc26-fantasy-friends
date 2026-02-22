from sqlalchemy.orm import Session

from app.models.match import Match, MatchStatus
from app.models.player_match_stats import PlayerMatchStats
from app.services.scoring_service import apply_points


def update_match_scores(db: Session, match_id: str, home_score: int, away_score: int):
    match = db.get(Match, match_id)
    if not match:
        return
    match.home_score = home_score
    match.away_score = away_score
    if match.status != MatchStatus.FINISHED:
        match.status = MatchStatus.LIVE
    db.commit()


def apply_player_stats(db: Session, match_id: str, stats_payload: list[dict]):
    for payload in stats_payload:
        stats = (
            db.query(PlayerMatchStats)
            .filter(PlayerMatchStats.match_id == match_id, PlayerMatchStats.player_id == payload["player_id"])
            .first()
        )
        if not stats:
            stats = PlayerMatchStats(match_id=match_id, player_id=payload["player_id"])
            db.add(stats)
        for field, value in payload.items():
            if hasattr(stats, field):
                setattr(stats, field, value)
        apply_points(stats)
    db.commit()


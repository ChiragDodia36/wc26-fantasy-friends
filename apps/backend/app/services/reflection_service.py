"""
Reflection agent — runs after each round to analyze decisions,
store lessons in episodic memory, and improve future recommendations.
"""
from sqlalchemy.orm import Session

from app.integrations.memory_client import store_episode, get_episode_count
from app.integrations.planner import answer_question
from app.models.squad import Squad
from app.models.squad_round_points import SquadRoundPoints


async def reflect_on_round(
    db: Session,
    squad_id: str,
    round_id: str,
) -> dict:
    """Analyze a completed round and store lessons.

    Called after scoring is finalized for a round. Examines what
    decisions were made, what the outcomes were, and stores a
    natural-language lesson in ChromaDB for future retrieval.
    """
    # Get squad round points
    srp = (
        db.query(SquadRoundPoints)
        .filter(
            SquadRoundPoints.squad_id == squad_id,
            SquadRoundPoints.round_id == round_id,
        )
        .first()
    )

    if not srp:
        return {"status": "no_data", "lesson": "No points data for this round yet."}

    points = srp.points or 0
    rank = srp.rank_in_league

    # Build reflection prompt
    if points >= 60:
        quality = "excellent"
    elif points >= 40:
        quality = "good"
    elif points >= 25:
        quality = "average"
    else:
        quality = "poor"

    lesson = (
        f"Round performance was {quality} ({points} pts, rank #{rank}). "
    )

    # Ask the planner for deeper analysis (if available)
    try:
        analysis = await answer_question(
            f"My fantasy squad scored {points} points this round (rank #{rank}). "
            f"What should I learn from this {quality} performance for next round?"
        )
        lesson += analysis
    except Exception:
        lesson += f"Score of {points} points suggests {'maintaining' if points >= 40 else 'adjusting'} current strategy."

    # Store in episodic memory
    doc_id = store_episode(
        round_id=round_id,
        squad_id=squad_id,
        decision_type="round_review",
        lesson=lesson,
        points_earned=points,
        metadata={"rank": rank, "quality": quality},
    )

    return {
        "status": "reflected",
        "lesson": lesson,
        "points": points,
        "rank": rank,
        "episode_id": doc_id,
        "total_episodes": get_episode_count(),
    }

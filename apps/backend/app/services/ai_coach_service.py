"""
AI Coach service — orchestrates the RL executor, ToT planner, and
episodic memory to provide squad, lineup, transfer, and Q&A recommendations.
"""
from sqlalchemy.orm import Session

from app.integrations.memory_client import query_lessons
from app.integrations.planner import answer_question, generate_tot_branches
from app.models.player import Player
from app.rl.inference import suggest_lineup_rl, suggest_squad_rl
from app.schemas.ai_schemas import (
    LineupRequest,
    QARequest,
    SquadBuilderRequest,
    TransferSuggestionRequest,
)


def _build_player_context(db: Session, limit: int = 50) -> str:
    """Build a text summary of top players for the planner prompt."""
    players = db.query(Player).filter(Player.is_active == True).limit(limit).all()  # noqa: E712
    lines = []
    for p in players:
        lines.append(f"{p.id[:8]} | {p.name:25s} | {p.position:3s} | £{float(p.price):.1f}m | {p.team_id[:8]}")
    return "\n".join(lines)


async def suggest_squad(db: Session, payload: SquadBuilderRequest):
    """Suggest a full 15-player squad using RL + ToT planner."""
    # 1. RL executor picks the squad
    rl_result = suggest_squad_rl(db, budget=payload.budget)

    # 2. ToT planner generates strategy branches
    player_context = _build_player_context(db)
    branches = await generate_tot_branches(
        player_context=player_context,
        squad_context=f"Budget: £{payload.budget}m, Formation: {payload.preferred_formation}",
    )

    # 3. Query episodic memory for relevant lessons
    lessons = query_lessons(
        f"squad building {payload.preferred_formation} {payload.risk_profile}",
        n_results=3,
        decision_type="lineup",
    )

    return {
        "explanation": rl_result.get("explanation", "Squad selected by AI."),
        "data": branches,
        "rl_squad": rl_result,
        "past_lessons": [l["lesson"] for l in lessons] if lessons else [],
    }


async def suggest_lineup(db: Session, payload: LineupRequest):
    """Suggest a starting XI from an existing squad."""
    # Get squad player IDs
    from app.models.squad import Squad
    squad = db.query(Squad).filter(
        Squad.id == payload.squad_id,
    ).first()

    if not squad:
        return {"explanation": "Squad not found.", "data": None}

    player_ids = [sp.player_id for sp in squad.players]
    result = suggest_lineup_rl(db, player_ids)

    return {
        "explanation": result.get("explanation", "Lineup optimized."),
        "data": result,
    }


async def suggest_transfers(db: Session, payload: TransferSuggestionRequest):
    """Suggest transfers based on current squad and available players."""
    player_context = _build_player_context(db)
    branches = await generate_tot_branches(
        player_context=player_context,
        squad_context=f"Squad: {payload.squad_id}, Max transfers: {payload.max_transfers}",
    )

    lessons = query_lessons(
        "transfer strategy round",
        n_results=3,
        decision_type="transfer",
    )

    return {
        "explanation": "Transfer suggestions generated.",
        "data": branches,
        "past_lessons": [l["lesson"] for l in lessons] if lessons else [],
    }


async def answer_rules(payload: QARequest):
    """Answer a rules or strategy question."""
    answer = await answer_question(payload.question)
    return answer

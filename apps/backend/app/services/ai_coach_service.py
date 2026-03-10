"""
AI Coach service — orchestrates the RL executor, ToT planner, and
episodic memory to provide squad, lineup, transfer, and Q&A recommendations.
"""
from datetime import datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.integrations.memory_client import query_lessons
from app.integrations.planner import answer_question, generate_tot_branches
from app.models.match import Match, MatchStatus
from app.models.player import Player
from app.models.player_match_stats import PlayerMatchStats
from app.models.squad import Squad
from app.models.squad_player import SquadPlayer
from app.rl.inference import suggest_lineup_rl, suggest_squad_rl
from app.schemas.ai_schemas import (
    LineupRequest,
    QARequest,
    SquadBuilderRequest,
    TransferSuggestionRequest,
)
from app.services.fdr_service import get_upcoming_fdr
from app.services.transfers_service import _current_round, _get_or_create_allowance


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
    squad = db.query(Squad).options(joinedload(Squad.players)).filter(
        Squad.id == payload.squad_id,
    ).first()

    if not squad:
        return {"explanation": "Squad not found.", "data": None}

    player_ids = [sp.player_id for sp in squad.players]
    return suggest_lineup_rl(db, player_ids)


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


# ---------------------------------------------------------------------------
# Transfer context — structured data for on-device LLM inference
# ---------------------------------------------------------------------------

def _compute_form(db: Session, player_id: str, n_matches: int = 5) -> list[int]:
    """Return the last N match fantasy point scores for a player."""
    stats = (
        db.query(PlayerMatchStats)
        .join(Match, PlayerMatchStats.match_id == Match.id)
        .filter(
            PlayerMatchStats.player_id == player_id,
            Match.status == MatchStatus.FINISHED,
        )
        .order_by(Match.kickoff_utc.desc())
        .limit(n_matches)
        .all()
    )
    return [s.fantasy_points or 0 for s in stats]


def build_transfer_context(db: Session, squad_id: str) -> dict:
    """Assemble all structured data the on-device model needs for transfer
    suggestions. No AI reasoning happens here — just data preparation.

    Returns squad players, upcoming matches, candidate players (only from
    teams playing in the next 48 hours), form, FDR, and transfer allowance.
    """
    squad = db.get(Squad, squad_id)
    if not squad:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Squad not found"
        )

    # 1. Current squad players with form + FDR
    squad_players = []
    for sp in squad.players:
        player = db.get(Player, sp.player_id)
        if not player:
            continue
        form = _compute_form(db, player.id)
        fdr = get_upcoming_fdr(player.id, db)
        team_name = player.team.name if player.team else None
        squad_players.append({
            "player_id": player.id,
            "name": player.name,
            "position": player.position,
            "price": float(player.price),
            "team_id": player.team_id,
            "team_name": team_name,
            "is_starting": sp.is_starting,
            "is_captain": sp.is_captain,
            "form_last_5": form,
            "avg_form": round(sum(form) / len(form), 1) if form else 0.0,
            "upcoming_fdr": fdr,
        })

    # 2. Upcoming matches (next 48 hours)
    now = datetime.utcnow()
    cutoff = now + timedelta(hours=48)
    upcoming = (
        db.query(Match)
        .filter(
            Match.status == MatchStatus.SCHEDULED,
            Match.kickoff_utc >= now,
            Match.kickoff_utc <= cutoff,
        )
        .order_by(Match.kickoff_utc.asc())
        .all()
    )

    playing_team_ids: set[str] = set()
    match_info = []
    for m in upcoming:
        playing_team_ids.update([m.home_team_id, m.away_team_id])
        match_info.append({
            "match_id": m.id,
            "home_team_id": m.home_team_id,
            "away_team_id": m.away_team_id,
            "home_team_name": m.home_team.name if m.home_team else "",
            "away_team_name": m.away_team.name if m.away_team else "",
            "kickoff_utc": m.kickoff_utc.isoformat(),
            "venue": m.venue,
        })

    # 3. Candidate players — only from teams playing next 48h, not in squad
    squad_player_ids = {sp["player_id"] for sp in squad_players}
    candidates = []
    if playing_team_ids:
        candidate_rows = (
            db.query(Player)
            .filter(
                Player.team_id.in_(playing_team_ids),
                Player.is_active == True,  # noqa: E712
                ~Player.id.in_(squad_player_ids),
            )
            .all()
        )
        for p in candidate_rows:
            form = _compute_form(db, p.id)
            fdr = get_upcoming_fdr(p.id, db)
            candidates.append({
                "player_id": p.id,
                "name": p.name,
                "position": p.position,
                "price": float(p.price),
                "team_id": p.team_id,
                "team_name": p.team.name if p.team else None,
                "form_last_5": form,
                "avg_form": round(sum(form) / len(form), 1) if form else 0.0,
                "upcoming_fdr": fdr,
            })

    # 4. Transfer allowance
    round_ = _current_round(db)
    free_remaining = 3
    if round_:
        allowance = _get_or_create_allowance(db, squad_id, round_)
        free_remaining = allowance.free_remaining

    # 5. Past lessons from episodic memory
    lessons = query_lessons(
        "transfer strategy upcoming fixtures",
        n_results=3,
        decision_type="transfer",
    )

    return {
        "squad_id": squad_id,
        "budget_remaining": float(squad.budget_remaining),
        "free_transfers_remaining": free_remaining,
        "squad_players": squad_players,
        "upcoming_matches": match_info,
        "candidate_players": candidates,
        "max_transfers": 3,
        "past_lessons": [l["lesson"] for l in lessons] if lessons else [],
    }

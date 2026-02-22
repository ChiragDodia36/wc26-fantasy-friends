from sqlalchemy.orm import Session

from app.integrations.llm_client import LLMSession
from app.models.player import Player
from app.schemas.ai_schemas import (
    LineupRequest,
    QARequest,
    SquadBuilderRequest,
    TransferSuggestionRequest,
)


async def suggest_squad(db: Session, payload: SquadBuilderRequest):
    players = db.query(Player).all()
    context = {"budget": payload.budget, "formation": payload.preferred_formation, "players": [p.__dict__ for p in players]}
    llm = LLMSession()
    return await llm.get_squad_recommendation(context)


async def suggest_lineup(db: Session, payload: LineupRequest):
    players = db.query(Player).all()
    context = {"players": [p.__dict__ for p in players]}
    llm = LLMSession()
    return await llm.get_lineup_recommendation(context)


async def suggest_transfers(db: Session, payload: TransferSuggestionRequest):
    context = {"max_transfers": payload.max_transfers}
    llm = LLMSession()
    return await llm.get_transfer_recommendation(context)


async def answer_rules(payload: QARequest):
    llm = LLMSession()
    return await llm.answer_rules({"question": payload.question})


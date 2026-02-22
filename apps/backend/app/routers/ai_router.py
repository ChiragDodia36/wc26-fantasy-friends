from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.deps.auth_deps import get_current_user
from app.schemas.ai_schemas import (
    AIRecommendation,
    LineupRequest,
    QARequest,
    SquadBuilderRequest,
    TransferSuggestionRequest,
)
from app.services import ai_coach_service

router = APIRouter()


@router.post("/squad-builder", response_model=AIRecommendation)
async def squad_builder(payload: SquadBuilderRequest, db: Session = Depends(get_db), user=Depends(get_current_user)):
    data = await ai_coach_service.suggest_squad(db, payload)
    return AIRecommendation(explanation=data.get("explanation", ""), data=data)


@router.post("/lineup", response_model=AIRecommendation)
async def lineup(payload: LineupRequest, db: Session = Depends(get_db), user=Depends(get_current_user)):
    data = await ai_coach_service.suggest_lineup(db, payload)
    return AIRecommendation(explanation=data.get("explanation", ""), data=data)


@router.post("/transfers", response_model=AIRecommendation)
async def transfers(payload: TransferSuggestionRequest, db: Session = Depends(get_db), user=Depends(get_current_user)):
    data = await ai_coach_service.suggest_transfers(db, payload)
    return AIRecommendation(explanation=data.get("explanation", ""), data=data)


@router.post("/qa", response_model=AIRecommendation)
async def qa(payload: QARequest, user=Depends(get_current_user)):
    data = await ai_coach_service.answer_rules(payload)
    return AIRecommendation(explanation=data, data=None)


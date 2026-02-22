from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.schemas import auth_schemas, user_schemas
from app.services import auth_service

router = APIRouter()


@router.post("/signup", response_model=user_schemas.UserBase)
def signup(payload: auth_schemas.SignupRequest, db: Session = Depends(get_db)):
    user, _ = auth_service.signup(db, payload.email, payload.username, payload.password)
    return user


@router.post("/login", response_model=auth_schemas.TokenResponse)
def login(payload: auth_schemas.LoginRequest, db: Session = Depends(get_db)):
    user, token = auth_service.login(db, payload.email, payload.password)
    return auth_schemas.TokenResponse(access_token=token)


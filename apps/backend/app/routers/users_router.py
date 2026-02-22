from fastapi import APIRouter, Depends

from app.deps.auth_deps import get_current_user
from app.schemas.user_schemas import UserBase

router = APIRouter()


@router.get("/me", response_model=UserBase)
def me(user=Depends(get_current_user)):
    return user


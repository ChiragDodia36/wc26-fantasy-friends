from datetime import datetime

from pydantic import BaseModel, EmailStr


class UserBase(BaseModel):
    id: str
    email: EmailStr
    username: str
    created_at: datetime

    class Config:
        from_attributes = True


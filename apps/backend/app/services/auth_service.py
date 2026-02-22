import uuid

import firebase_admin.auth as firebase_admin_auth
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User


def signup(db: Session, email: str, username: str, password: str) -> tuple[User, str]:
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
    user = User(email=email, username=username, password_hash=hash_password(password))
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(user.id)
    return user, token


def login(db: Session, email: str, password: str) -> tuple[User, str]:
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    token = create_access_token(user.id)
    return user, token


def firebase_login(db: Session, id_token: str) -> tuple[User, str]:
    """Verify a Firebase ID token and return (user, jwt).

    Creates the user if they don't exist yet. The ``firebase_admin_auth``
    name is imported at module level so tests can mock it with
    ``patch("app.services.auth_service.firebase_admin_auth")``.
    """
    try:
        decoded = firebase_admin_auth.verify_id_token(id_token)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired Firebase token",
        )

    firebase_uid: str = decoded["uid"]
    email: str = decoded.get("email", f"{firebase_uid}@firebase.invalid")
    display_name: str | None = decoded.get("name") or None

    # Derive username from display_name or email prefix
    if display_name:
        username = display_name
    else:
        username = email.split("@")[0]

    # Find or create user
    user = db.query(User).filter(User.firebase_uid == firebase_uid).first()
    if user is None:
        user = User(
            id=str(uuid.uuid4()),
            email=email,
            username=username,
            firebase_uid=firebase_uid,
            password_hash=None,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    token = create_access_token(user.id)
    return user, token

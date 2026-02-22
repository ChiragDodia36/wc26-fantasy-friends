"""
Tests for Firebase auth endpoint — firebase_login creates or finds a user
from a Firebase ID token and returns our own JWT.
"""
import uuid
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.db import Base
from app.models.user import User

TEST_DB_URL = "sqlite:///:memory:"

FAKE_UID = "firebase-uid-abc123"
FAKE_EMAIL = "user@example.com"
FAKE_NAME = "Test User"


@pytest.fixture()
def db():
    engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()
    Base.metadata.drop_all(engine)


def _fake_decoded_token(uid=FAKE_UID, email=FAKE_EMAIL, name=FAKE_NAME):
    return {"uid": uid, "email": email, "name": name}


# ── Tests ──────────────────────────────────────────────────────────────────────


def test_firebase_login_creates_new_user(db):
    """New Firebase user: creates DB record and returns JWT."""
    from app.services.auth_service import firebase_login

    with patch("app.services.auth_service.firebase_admin_auth") as mock_auth:
        mock_auth.verify_id_token.return_value = _fake_decoded_token()
        user, token = firebase_login(db, id_token="valid-token-123")

    assert user.email == FAKE_EMAIL
    assert user.firebase_uid == FAKE_UID
    assert user.username == FAKE_NAME
    assert isinstance(token, str)
    assert len(token) > 20

    # User persisted in DB
    db_user = db.query(User).filter(User.firebase_uid == FAKE_UID).first()
    assert db_user is not None


def test_firebase_login_returns_existing_user(db):
    """Existing Firebase user (already in DB): returns same record, doesn't duplicate."""
    from app.services.auth_service import firebase_login

    # Pre-create user
    existing = User(
        id=str(uuid.uuid4()),
        firebase_uid=FAKE_UID,
        email=FAKE_EMAIL,
        username="Existing Name",
        password_hash=None,
    )
    db.add(existing)
    db.commit()

    with patch("app.services.auth_service.firebase_admin_auth") as mock_auth:
        mock_auth.verify_id_token.return_value = _fake_decoded_token()
        user, token = firebase_login(db, id_token="valid-token-123")

    assert user.id == existing.id
    count = db.query(User).filter(User.firebase_uid == FAKE_UID).count()
    assert count == 1  # no duplicate created


def test_firebase_login_invalid_token_raises(db):
    """Invalid/expired token: raises 401."""
    from app.services.auth_service import firebase_login
    import firebase_admin.auth as _firebase_auth

    with patch("app.services.auth_service.firebase_admin_auth") as mock_auth:
        mock_auth.verify_id_token.side_effect = Exception("Token expired")
        with pytest.raises(HTTPException) as exc_info:
            firebase_login(db, id_token="bad-token")
    assert exc_info.value.status_code == 401


def test_firebase_login_empty_name_uses_email_prefix(db):
    """Firebase token with no display name: username falls back to email prefix."""
    from app.services.auth_service import firebase_login

    with patch("app.services.auth_service.firebase_admin_auth") as mock_auth:
        # name is None/empty
        mock_auth.verify_id_token.return_value = _fake_decoded_token(name=None)
        user, token = firebase_login(db, id_token="valid-token")

    assert user.username == "user"  # prefix of user@example.com

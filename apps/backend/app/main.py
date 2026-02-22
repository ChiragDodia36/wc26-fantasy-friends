from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.db import Base, engine
from app.routers import (
    auth_router,
    users_router,
    leagues_router,
    squads_router,
    transfers_router,
    matches_router,
    players_router,
    ai_router,
)


def create_app() -> FastAPI:
    app = FastAPI(title="WC26 Fantasy Friends", version="0.1.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Ensure metadata exists (real migrations via Alembic)
    Base.metadata.create_all(bind=engine)

    app.include_router(auth_router.router, prefix="/auth", tags=["auth"])
    app.include_router(users_router.router, prefix="/users", tags=["users"])
    app.include_router(leagues_router.router, prefix="/leagues", tags=["leagues"])
    app.include_router(squads_router.router, prefix="/squads", tags=["squads"])
    app.include_router(transfers_router.router, prefix="/transfers", tags=["transfers"])
    app.include_router(matches_router.router, prefix="/matches", tags=["matches"])
    app.include_router(players_router.router, prefix="/players", tags=["players"])
    app.include_router(ai_router.router, prefix="/ai", tags=["ai"])
    return app


app = create_app()


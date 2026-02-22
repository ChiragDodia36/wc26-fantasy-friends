from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import (
    ai_router,
    auth_router,
    leagues_router,
    matches_router,
    players_router,
    rounds_router,
    squads_router,
    transfers_router,
    users_router,
)
from app.tasks.scheduler import start_scheduler, stop_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    start_scheduler()
    yield
    stop_scheduler()


def create_app() -> FastAPI:
    app = FastAPI(title="WC26 Fantasy Friends", version="0.1.0", lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(auth_router.router, prefix="/auth", tags=["auth"])
    app.include_router(users_router.router, prefix="/users", tags=["users"])
    app.include_router(leagues_router.router, prefix="/leagues", tags=["leagues"])
    app.include_router(squads_router.router, prefix="/squads", tags=["squads"])
    app.include_router(transfers_router.router, prefix="/transfers", tags=["transfers"])
    app.include_router(matches_router.router, prefix="/matches", tags=["matches"])
    app.include_router(players_router.router, prefix="/players", tags=["players"])
    app.include_router(rounds_router.router, prefix="/rounds", tags=["rounds"])
    app.include_router(ai_router.router, prefix="/ai", tags=["ai"])
    return app


app = create_app()

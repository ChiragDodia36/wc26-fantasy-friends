"""
Seed real World Cup data from API-Football v3.

Uses WORLD_CUP_SEASON env var (default "2022" for dev, "2026" when available).
Costs ~35 API calls (well within 100/day free limit).

Run:
    cd apps/backend
    source .venv/bin/activate
    source .env
    PYTHONPATH=$(pwd) python ../../scripts/seed_worldcup_data.py
"""
from app.core.db import SessionLocal
from app.services.worldcup_sync_service import seed_worldcup


def main():
    db = SessionLocal()
    try:
        seed_worldcup(db)
    finally:
        db.close()


if __name__ == "__main__":
    main()


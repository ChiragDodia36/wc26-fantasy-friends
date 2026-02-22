import asyncio

from app.core.db import SessionLocal
from app.services.worldcup_sync_service import seed_worldcup


async def main():
    db = SessionLocal()
    await seed_worldcup(db)
    db.close()


if __name__ == "__main__":
    asyncio.run(main())


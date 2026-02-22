import asyncio

from app.tasks.sync_fixtures_task import sync_fixtures
from app.tasks.sync_stats_task import sync_stats


async def run_scheduler():
    while True:
        await sync_fixtures()
        await sync_stats()
        await asyncio.sleep(300)


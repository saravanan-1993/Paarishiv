import asyncio
from app.services.scheduler import check_overdue_tasks
from database import get_database

async def run():
    print("Manually triggering task check...")
    await check_overdue_tasks()
    print("Done")

if __name__ == "__main__":
    asyncio.run(run())

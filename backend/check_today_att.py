import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

async def run():
    client = AsyncIOMotorClient(os.getenv("MONGODB_URL"))
    db = client["civil_erp"]
    today = datetime.now().strftime("%Y-%m-%d")
    att = await db.attendance.find({"date": today}).to_list(100)
    print(f"Attendance for today ({today}): {len(att)}")
    for a in att:
        print(f"User: {a.get('username')}, Status: {a.get('status')}, ID: {a.get('_id')}")

if __name__ == "__main__":
    asyncio.run(run())

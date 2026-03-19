import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime

async def check_attendance():
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['civil_erp']
    
    print("--- Latest 5 Attendance Records ---")
    docs = await db.attendance.find({}).sort('created_at', -1).to_list(5)
    for d in docs:
        print(f"User: {d.get('username')}, Date: {d.get('date')}, In: {d.get('check_in')}, Out: {d.get('check_out')}")
    
    await client.close()

if __name__ == "__main__":
    asyncio.run(check_attendance())

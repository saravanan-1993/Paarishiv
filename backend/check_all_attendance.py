import asyncio
import os
import sys
from datetime import datetime

sys.path.append(os.getcwd())
from database import get_database

async def check():
    db = await get_database()
    today = datetime.now().strftime('%Y-%m-%d')
    
    all_att = await db.attendance.find({}).sort("date", -1).to_list(10)
    print("Recent Attendance Records:")
    for a in all_att:
        print(f"Date: {a.get('date')}, User: {a.get('username')}, Status: {a.get('status')}")
    
    count_today = await db.attendance.count_documents({"date": today})
    print(f"\nTotal for today ({today}): {count_today}")

if __name__ == '__main__':
    asyncio.run(check())

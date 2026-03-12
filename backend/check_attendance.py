import asyncio
import os
import sys
from datetime import datetime

# Add current dir to path for imports
sys.path.append(os.getcwd())

from database import get_database

async def check():
    db = await get_database()
    today = datetime.now().strftime('%Y-%m-%d')
    att = await db.attendance.find({"date": today}).to_list(100)
    print(f"Today {today} attendance records: {len(att)}")
    for a in att:
        print(f"ID: {a.get('employeeId', 'N/A')}, Name: {a.get('employeeName', 'N/A')}, Status: {a.get('status', 'N/A')}")

if __name__ == '__main__':
    asyncio.run(check())

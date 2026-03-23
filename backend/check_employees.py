import asyncio
import os
import sys

# Add current dir to path for imports
sys.path.append(os.getcwd())

from database import get_database

async def check():
    db = await get_database()
    emps = await db.employees.find({}).to_list(100)
    print(f"Total employees: {len(emps)}")
    for e in emps:
        print(f"Name: {e.get('fullName', 'N/A')}, Status: {e.get('status', 'N/A')}")

if __name__ == '__main__':
    asyncio.run(check())

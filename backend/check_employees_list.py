import asyncio
import os
import sys

sys.path.append(os.getcwd())
from database import get_database

async def check_employees():
    db = await get_database()
    employees = await db.employees.find().to_list(100)
    for e in employees:
        print(f"Employee: {e.get('fullName')}, Roles: {e.get('roles')}")

if __name__ == '__main__':
    asyncio.run(check_employees())

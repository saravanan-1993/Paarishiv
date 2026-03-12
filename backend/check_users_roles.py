import asyncio
import os
import sys

sys.path.append(os.getcwd())
from database import get_database

async def check_users():
    db = await get_database()
    users = await db.users.find().to_list(100)
    for u in users:
        print(f"User: {u.get('username')}, Role: {u.get('role')}")

if __name__ == '__main__':
    asyncio.run(check_users())

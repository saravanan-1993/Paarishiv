import asyncio
import os
import sys

sys.path.append(os.getcwd())
from database import get_database

async def show():
    db = await get_database()
    roles_doc = await db.roles.find_one({"_id": "global_roles"})
    if roles_doc:
        for r in roles_doc.get("roles", []):
            print(f"Role: {r.get('name')}")
            for p in r.get("permissions", []):
                print(f"  - {p.get('name')}: {p.get('actions').get('view')}")
    else:
        print("No global_roles doc found.")

if __name__ == '__main__':
    asyncio.run(show())

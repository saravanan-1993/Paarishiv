import asyncio
import os
import sys
import json

sys.path.append(os.getcwd())
from database import get_database

async def show():
    db = await get_database()
    roles_doc = await db.roles.find_one({"_id": "global_roles"})
    res = {"roles": [], "users": []}
    for r in roles_doc.get("roles", []):
        res["roles"].append(r.get("name"))
    async for u in db.users.find({}):
        res["users"].append(f"{u.get('username')}: {u.get('role')}")
    with open("roles_info.json", "w", encoding="utf-8") as f:
        json.dump(res, f, indent=2)

if __name__ == '__main__':
    asyncio.run(show())

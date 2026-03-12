import asyncio
import os
import sys

sys.path.append(os.getcwd())
from database import get_database

async def fix_roles():
    db = await get_database()
    roles_doc = await db.roles.find_one({"_id": "global_roles"})
    if roles_doc and "roles" in roles_doc:
        updated = False
        for r in roles_doc["roles"]:
            if r["name"] == "Accounts Manager":
                r["name"] = "Accountant"
                updated = True
        
        if updated:
            await db.roles.update_one(
                {"_id": "global_roles"},
                {"$set": {"roles": roles_doc["roles"]}}
            )
            print("Successfully updated Accounts Manager to Accountant in DB.")
        else:
            print("Role not found or already changed.")

if __name__ == '__main__':
    asyncio.run(fix_roles())

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

os.chdir(os.path.dirname(os.path.abspath(__file__)))
load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL")
DATABASE_NAME = os.getenv("DATABASE_NAME", "civil_erp")

SUB_TABS_PROCUREMENT = ['Vendors', 'POs', 'Requests', 'GRN']

async def update_roles():
    if not MONGODB_URL:
        print("MONGODB_URL not found")
        return

    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    
    roles_doc = await db.roles.find_one({"_id": "global_roles"})
    if not roles_doc:
        print("No global_roles doc found.")
        return

    roles = roles_doc.get("roles", [])
    updated = False

    for role in roles:
        name = role.get('name')
        perms = role.get('permissions', [])
        
        # Helper to find/add/update permission
        def up_perm(p_name, subtabs):
            nonlocal updated
            found = False
            for p in perms:
                if p['name'] == p_name:
                    p['subTabs'] = subtabs
                    found = True
                    updated = True
            if not found:
                perms.append({
                    "name": p_name,
                    "actions": { "view": True, "edit": True, "delete": False },
                    "subTabs": subtabs
                })
                updated = True

        if name in ['Administrator', 'Purchase Officer', 'General Manager']:
            up_perm('Procurement', SUB_TABS_PROCUREMENT)
            print(f"Updated {name} with full Procurement.")
        elif name in ['Site Engineer', 'Project Manager']:
            up_perm('Procurement', ['POs', 'Requests', 'GRN'])
            print(f"Updated {name} with partial Procurement.")

    if updated:
        await db.roles.update_one({"_id": "global_roles"}, {"$set": {"roles": roles}})
        print("DB Update Complete.")
    else:
        print("No changes needed in DB.")
    client.close()

if __name__ == "__main__":
    asyncio.run(update_roles())

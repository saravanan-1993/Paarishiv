import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def update_roles():
    MONGODB_URL = "mongodb://localhost:27017"
    DATABASE_NAME = "civil_erp"
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    
    roles_doc = await db.roles.find_one({"_id": "global_roles"})
    if not roles_doc:
        print("global_roles not found in DB.")
        return

    roles = roles_doc.get("roles", [])
    updated = False
    for role in roles:
        if role.get("name") == "Purchase Officer":
            perms = role.get("permissions", [])
            # Check if HRMS already exists
            if not any(p.get("name") == "HRMS" for p in perms):
                perms.append({ "name": 'HRMS', "actions": { "view": True, "edit": False, "delete": False } })
                role["permissions"] = perms
                updated = True
                print("Added HRMS permission to Purchase Officer.")
            else:
                print("Purchase Officer already has HRMS permission.")
    
    if updated:
        await db.roles.update_one({"_id": "global_roles"}, {"$set": {"roles": roles}})
        print("Database updated successfully.")
    else:
        print("No updates needed or Purchase Officer role not found.")

if __name__ == "__main__":
    asyncio.run(update_roles())

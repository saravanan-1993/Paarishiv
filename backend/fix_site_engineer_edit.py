import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os

load_dotenv()
MONGODB_URL = os.getenv("MONGODB_URL")
DATABASE_NAME = os.getenv("DATABASE_NAME", "civil_erp")

async def fix_site_engineer_perms():
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    
    # Update Site Engineer role to allow editing Projects
    result = await db.roles.update_one(
        {"_id": "global_roles", "roles.name": "Site Engineer"},
        {
            "$set": {
                "roles.$[role].permissions.$[proj].actions.edit": True
            }
        },
        array_filters=[
            {"role.name": "Site Engineer"},
            {"proj.name": "Projects"}
        ]
    )
    
    if result.modified_count > 0:
        print("✅ Site Engineer role updated successfully!")
        print("   Projects module 'edit' permission is now enabled")
    else:
        print("❌ No changes were made. Please verify the role exists.")
    
    # Verify the change
    roles_doc = await db.roles.find_one({"_id": "global_roles"})
    if roles_doc:
        for role in roles_doc.get("roles", []):
            if role["name"] == "Site Engineer":
                for perm in role.get("permissions", []):
                    if perm["name"] == "Projects":
                        print("\nUpdated permissions:")
                        print(f"  view: {perm['actions']['view']}")
                        print(f"  edit: {perm['actions']['edit']}")
                        print(f"  delete: {perm['actions']['delete']}")
    
    client.close()

asyncio.run(fix_site_engineer_perms())

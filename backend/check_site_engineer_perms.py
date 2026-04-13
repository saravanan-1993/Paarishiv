import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os
import json

load_dotenv()
MONGODB_URL = os.getenv("MONGODB_URL")
DATABASE_NAME = os.getenv("DATABASE_NAME", "civil_erp")

async def check_roles():
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    
    roles_doc = await db.roles.find_one({"_id": "global_roles"})
    if roles_doc:
        roles = roles_doc.get("roles", [])
        for role in roles:
            if role["name"] == "Site Engineer":
                print("--- Site Engineer Permissions ---")
                for perm in role.get("permissions", []):
                    if perm["name"] == "Projects":
                        print(json.dumps(perm, indent=2, default=str))
    else:
        print("No roles document found")
    
    client.close()

asyncio.run(check_roles())

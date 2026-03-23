import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def check():
    c = AsyncIOMotorClient('mongodb://localhost:27017')
    db = c.civil_erp
    colls = await db.list_collection_names()
    print("Collections in civil_erp:", colls)
    if "roles" in colls:
        roles_doc = await db.roles.find_one({"_id": "global_roles"})
        print("global_roles exists:", roles_doc is not None)
    c.close()

if __name__ == "__main__":
    asyncio.run(check())

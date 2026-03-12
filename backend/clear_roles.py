import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def run():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client.civil_erp
    res = await db.roles.delete_one({"_id": "global_roles"})
    print("Deleted old roles:", res.deleted_count)

asyncio.run(run())

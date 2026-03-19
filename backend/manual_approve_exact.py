
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from bson import ObjectId

load_dotenv()

async def manual_approve_exact():
    url = os.getenv("MONGODB_URL")
    client = AsyncIOMotorClient(url)
    db_name = os.getenv("DATABASE_NAME", "civil_erp")
    db = client[db_name]
    
    pid = "69b26eb72bf8981420bba4d1"
    did = "DPR-260315125125"
    
    print(f"Applying update for PID: {pid}, DID: {did}")
    
    result = await db.projects.update_one(
        {"_id": ObjectId(pid), "dprs.id": did},
        {"$set": {"dprs.$.status": "Approved"}}
    )
    
    print(f"Matched count: {result.matched_count}")
    print(f"Modified count: {result.modified_count}")

if __name__ == "__main__":
    asyncio.run(manual_approve_exact())

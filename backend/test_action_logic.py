
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from bson import ObjectId

load_dotenv()

async def simulate_backend_action():
    url = os.getenv("MONGODB_URL")
    db_name = os.getenv("DATABASE_NAME", "civil_erp")
    client = AsyncIOMotorClient(url)
    db = client[db_name]
    
    # Get an Approved request
    req = await db.manpower_requests.find_one({"status": "Approved"})
    if not req:
        print("No Approved request found to test.")
        # Let's check status 'verified' just in case
        req = await db.manpower_requests.find_one({"status": "verified"})
        if not req:
            print("No 'verified' requests either.")
            # Let's check all
            all_reqs = await db.manpower_requests.find({}).to_list(5)
            for r in all_reqs:
                print(f"Found request with status: '{r.get('status')}'")
            return
        
    obj_id = str(req["_id"])
    print(f"Testing with ID: {obj_id} and Status: {req.get('status')}")
    
    # Simulate action_approval logic
    status = "Completed"
    update_fields = {"status": status, "approvedBy": "Script Tester"}
    
    result = await db.manpower_requests.update_one({"_id": ObjectId(obj_id)}, {"$set": update_fields})
    print(f"Modified count: {result.modified_count}")

if __name__ == "__main__":
    asyncio.run(simulate_backend_action())

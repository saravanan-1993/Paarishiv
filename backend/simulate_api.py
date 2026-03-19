
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

async def check():
    url = os.getenv("MONGODB_URL")
    db_name = os.getenv("DATABASE_NAME", "civil_erp")
    client = AsyncIOMotorClient(url)
    db = client[db_name]
    
    status = "Approved"
    query = {"status": {"$regex": f"^{status}$", "$options": "i"}}
    
    manpower = await db.manpower_requests.find(query).sort("_id", -1).to_list(100)
    
    results = {
        "leaves": [],
        "purchase_orders": [],
        "materials": [],
        "expenses": [],
        "manpower": manpower
    }
    
    # Simulate the formatting done in the API
    for mp in results["manpower"]:
        mp["_id"] = str(mp["_id"])
        # Dates...
        for k, v in mp.items():
            if hasattr(v, "isoformat"):
                mp[k] = str(v)
                
    print(f"Number of manpower requests: {len(results['manpower'])}")
    for m in results["manpower"]:
        print(f"  Project: {m.get('project_name')}, Items: {m.get('requested_items')}")

if __name__ == "__main__":
    asyncio.run(check())

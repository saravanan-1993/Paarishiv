import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

async def clean():
    client = AsyncIOMotorClient(os.getenv('MONGODB_URL'))
    db = client[os.getenv('DATABASE_NAME', 'civil_erp')]
    
    bills = await db.bills.find().to_list(1000)
    print(f"Cleaning {len(bills)} bills...")
    
    for b in bills:
        # 1. Trim project name
        if 'project' in b and b['project']:
            trimmed = b['project'].strip()
            if trimmed != b['project']:
                await db.bills.update_one({'_id': b['_id']}, {'$set': {'project': trimmed}})
                print(f"  Trimmed project name for bill {b.get('bill_no')}")
        
        # 2. Add missing fields if any
        updates = {}
        if 'created_at' not in b:
            from datetime import datetime
            updates['created_at'] = datetime.now().isoformat()
        if 'status' not in b:
            updates['status'] = 'Pending'
        
        if updates:
            await db.bills.update_one({'_id': b['_id']}, {'$set': updates})
            print(f"  Added missing fields for bill {b.get('bill_no')}")

    # 3. Trim project names in projects collection
    projs = await db.projects.find().to_list(1000)
    for p in projs:
        if 'name' in p and p['name']:
            trimmed = p['name'].strip()
            if trimmed != p['name']:
                await db.projects.update_one({'_id': p['_id']}, {'$set': {'name': trimmed}})
                print(f"  Trimmed project name for project '{trimmed}'")

    client.close()
    print("Clean up finished.")

if __name__ == "__main__":
    asyncio.run(clean())

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

async def check():
    client = AsyncIOMotorClient(os.getenv('MONGODB_URL'))
    db = client[os.getenv('DATABASE_NAME', 'civil_erp')]
    bills = await db.bills.find().to_list(100)
    projs = await db.projects.find().to_list(100)
    print(f"BILLS ({len(bills)}):")
    for b in bills:
        print(f"  - '{b.get('project')}' | No: {b.get('bill_no')}")
    print(f"\nPROJECTS ({len(projs)}):")
    for p in projs:
        print(f"  - '{p.get('name')}'")
    client.close()

if __name__ == "__main__":
    asyncio.run(check())

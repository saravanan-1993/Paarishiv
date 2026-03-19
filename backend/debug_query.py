
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
import re

load_dotenv()

async def check():
    url = os.getenv("MONGODB_URL")
    db_name = os.getenv("DATABASE_NAME", "civil_erp")
    client = AsyncIOMotorClient(url)
    db = client[db_name]
    
    status = "Approved"
    query = {"status": {"$regex": f"^{status}$", "$options": "i"}}
    print(f"Query: {query}")
    
    count = await db.manpower_requests.count_documents(query)
    print(f"Count with regex: {count}")
    
    # Try exact match
    count_exact = await db.manpower_requests.count_documents({"status": "Approved"})
    print(f"Count with exact 'Approved': {count_exact}")
    
    all_reqs = await db.manpower_requests.find({}).to_list(100)
    for r in all_reqs:
        print(f"ID: {r.get('_id')}, Status: '{r.get('status')}'")

if __name__ == "__main__":
    asyncio.run(check())

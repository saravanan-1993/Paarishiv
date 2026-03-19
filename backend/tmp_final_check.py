import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

async def final_check():
    load_dotenv()
    db = AsyncIOMotorClient(os.getenv('MONGODB_URL', 'mongodb://localhost:27017'))['civil_erp']
    collections = await db.list_collection_names()
    print(f"Final collections: {collections}")
    
if __name__ == "__main__":
    asyncio.run(final_check())

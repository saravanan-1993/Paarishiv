
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

async def check_settings():
    mongodb_url = os.getenv("MONGODB_URL")
    db_name = os.getenv("DATABASE_NAME", "civil_erp")
    print(f"Connecting to {db_name} at {mongodb_url.split('@')[1] if '@' in mongodb_url else 'localhost'}")
    
    client = AsyncIOMotorClient(mongodb_url)
    db = client[db_name]
    cursor = db.settings.find({})
    async for doc in cursor:
        # Hide sensitive info
        if "password" in doc: doc["password"] = "***"
        if "apiSecret" in doc: doc["apiSecret"] = "***"
        print(doc)

if __name__ == "__main__":
    asyncio.run(check_settings())

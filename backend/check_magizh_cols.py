import asyncio
import motor.motor_asyncio
import os
from dotenv import load_dotenv

load_dotenv()

async def check_db():
    mongodb_url = os.getenv("MONGODB_URL")
    client = motor.motor_asyncio.AsyncIOMotorClient(mongodb_url)
    db = client['magizh_civil_erp']
    cols = await db.list_collection_names()
    print("--- COLLECTIONS in magizh_civil_erp ---")
    for col in sorted(cols):
        count = await db[col].count_documents({})
        print(f"Col: {col}, Count: {count}")
    client.close()

if __name__ == "__main__":
    asyncio.run(check_db())

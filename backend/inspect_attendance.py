import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

async def inspect():
    try:
        client = AsyncIOMotorClient(os.getenv('MONGODB_URL'))
        db = client[os.getenv('DATABASE_NAME', 'civil_erp')]
        print("Fetching attendance...")
        records = await db.attendance.find({}).to_list(100)
        print(f"Count: {len(records)}")
        for r in records:
            print(r)
    except Exception as e:
        print(f"Error: {e}")
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(inspect())

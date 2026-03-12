import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

async def check_timeout():
    try:
        print("Connecting to DB...")
        client = AsyncIOMotorClient(os.getenv('MONGODB_URL'), serverSelectionTimeoutMS=5000)
        db = client[os.getenv('DATABASE_NAME', 'civil_erp')]
        print("Pinging...")
        await client.admin.command('ping')
        print("Ping successful!")
        
        count = await db.employees.count_documents({})
        print(f"Employee count: {count}")
        
    except Exception as e:
        print(f"Error: {e}")
    finally:
        if 'client' in locals():
            client.close()

if __name__ == "__main__":
    asyncio.run(check_timeout())

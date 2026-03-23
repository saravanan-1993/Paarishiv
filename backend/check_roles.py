import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

async def check():
    url = os.getenv("MONGODB_URL")
    client = AsyncIOMotorClient(url)
    db = client["civil_erp"]
    try:
        roles = await db.employees.distinct("roles")
        print(f"Roles in DB: {roles}")
        # Find some employees to see their structure
        emps = await db.employees.find().to_list(10)
        for e in emps:
            print(f"Name: {e.get('fullName')}, Roles: {e.get('roles')}")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(check())

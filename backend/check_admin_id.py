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
        admin = await db.employees.find_one({"roles": "Super Admin"})
        if admin:
            print(f"Super Admin Login ID: {admin.get('username') or admin.get('employeeCode')}")
            print(f"Full Name: {admin.get('fullName')}")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(check())

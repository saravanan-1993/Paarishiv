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
        emp = await db.employees.find_one({"fullName": {"$regex": "Gokula Rajan"}})
        print(f"Employee Code: {emp.get('employeeCode')}")
        print(f"Password in DB: {emp.get('password')}")
        print(f"Roles: {emp.get('roles')}")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(check())

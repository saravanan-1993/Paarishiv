
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

async def list_users():
    mongodb_url = os.getenv("MONGODB_URL")
    db_name = os.getenv("DATABASE_NAME", "civil_erp")
    client = AsyncIOMotorClient(mongodb_url)
    db = client[db_name]
    
    print(f"Users in {db_name}:")
    cursor = db.users.find({})
    async for user in cursor:
        print(f"Username: {user.get('username')}, Role: {user.get('role')}")
    
    print("\nEmployees (with username):")
    cursor = db.employees.find({"username": {"$exists": True}})
    async for employee in cursor:
        print(f"Username: {employee.get('username')}, Role: {employee.get('role')}, Name: {employee.get('name')}")

if __name__ == "__main__":
    asyncio.run(list_users())

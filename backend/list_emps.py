import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

async def run():
    client = AsyncIOMotorClient(os.getenv("MONGODB_URL"))
    db = client["civil_erp"]
    emps = await db.employees.find().to_list(100)
    print(f"Total Employees: {len(emps)}")
    for e in emps:
        print(f"Name: {e.get('fullName')}, Username: {e.get('username')}, Code: {e.get('employeeCode')}")

if __name__ == "__main__":
    asyncio.run(run())

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

async def check_employees():
    load_dotenv()
    db = AsyncIOMotorClient(os.getenv('MONGODB_URL', 'mongodb://localhost:27017'))['civil_erp']
    emps = await db.employees.find({}).to_list(100)
    for e in emps:
        print(f"Name: {e.get('fullName')}, Code: {e.get('employeeCode')}, Username: {e.get('username')}, Roles: {e.get('roles')}, Status: {e.get('status')}")

if __name__ == "__main__":
    asyncio.run(check_employees())

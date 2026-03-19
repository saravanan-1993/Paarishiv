import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

async def check():
    load_dotenv()
    db = AsyncIOMotorClient(os.getenv('MONGODB_URL', 'mongodb://localhost:27017'))['civil_erp']
    count = await db.employees.count_documents({})
    print(f'Employees count: {count}')
    if count > 0:
        emps = await db.employees.find({}).to_list(10)
        print([e.get('fullName') for e in emps])
        # Also check status
        active_count = await db.employees.count_documents({"status": "Active"})
        print(f'Active employees: {active_count}')

if __name__ == "__main__":
    asyncio.run(check())

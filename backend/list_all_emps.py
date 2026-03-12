import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

async def inspect_employees():
    client = AsyncIOMotorClient(os.getenv('MONGODB_URL'))
    db = client[os.getenv('DATABASE_NAME', 'civil_erp')]
    records = await db.employees.find({}).to_list(100)
    for r in records:
        print(f"NAME: {r.get('fullName')} | CODE: {r.get('employeeCode')} | DESIG: {r.get('designation')} | ROLES: {r.get('roles')}")
    client.close()

if __name__ == "__main__":
    asyncio.run(inspect_employees())


import motor.motor_asyncio
import asyncio
import json
import os
from dotenv import load_dotenv

load_dotenv()

async def main():
    uri = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    db_name = os.getenv("DATABASE_NAME", "civil_erp")
    client = motor.motor_asyncio.AsyncIOMotorClient(uri)
    db = client[db_name]
    
    # Check employees
    employees = await db['employees'].find().to_list(100)
    print(f"EMPLOYEES:")
    for e in employees:
        print(f"Name: {e.get('fullName')}, ID: {e.get('_id')}, Code: {e.get('employeeCode')}")
    
    # Check all leaves with full details
    leaves = await db['leaves'].find().to_list(100)
    print(f"\nALL LEAVES:")
    for l in leaves:
        print(f"EmpName: {l.get('employeeName')}, EmpId: {l.get('employeeId')}, Status: {l.get('status')}, Dates: {l.get('fromDate')} to {l.get('toDate')}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(main())

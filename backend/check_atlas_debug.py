
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
    
    # Check attendance for today
    today = "2026-03-06"
    attendance = await db['attendance'].find({"date": today}).to_list(100)
    print(f"ATTENDANCE FOR TODAY ({today}): {len(attendance)}")
    for a in attendance:
        print(f"EmpId: {a.get('employeeId')}, Status: {a.get('status')}")
    
    # Check leaves
    leaves = await db['leaves'].find().to_list(100)
    print(f"\nALL LEAVES: {len(leaves)}")
    for l in leaves:
        print(f"ID: {l.get('id')}, Emp: {l.get('employeeName')}, Status: {l.get('status')}, From: {l.get('fromDate')}, To: {l.get('toDate')}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(main())

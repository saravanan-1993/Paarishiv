
import motor.motor_asyncio
import asyncio
import json
from bson import ObjectId

async def main():
    client = motor.motor_asyncio.AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['civil_erp']
    
    # Check employees
    employees = await db['employees'].find().to_list(100)
    print(f"TOTAL EMPLOYEES: {len(employees)}")
    for e in employees:
        print(f"ID: {e.get('_id')}, Code: {e.get('employeeCode')}, Name: {e.get('fullName')}")
    
    # Check today's attendance
    today = "2026-03-06"
    attendance = await db['attendance'].find({"date": today}).to_list(100)
    print(f"\nATTENDANCE FOR {today}: {len(attendance)}")
    for a in attendance:
        print(f"EmpId: {a.get('employeeId')}, Status: {a.get('status')}")
        
    client.close()

if __name__ == "__main__":
    asyncio.run(main())

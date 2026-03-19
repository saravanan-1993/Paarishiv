from motor.motor_asyncio import AsyncIOMotorClient
import asyncio
import os
from dotenv import load_dotenv
from pprint import pprint

async def check():
    load_dotenv()
    url = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    db_name = os.getenv("DATABASE_NAME", "civil_erp")
    client = AsyncIOMotorClient(url)
    db = client[db_name]
    
    print("--- EMPLOYEES ---")
    employees = await db.employees.find().to_list(10)
    for emp in employees:
        pprint({
            "id": str(emp["_id"]),
            "fullName": emp.get("fullName"),
            "username": emp.get("username"),
            "employeeCode": emp.get("employeeCode")
        })
        
    print("\n--- ATTENDANCE ---")
    attendance = await db.attendance.find().sort("date", -1).to_list(10)
    for att in attendance:
        pprint({
            "id": str(att["_id"]),
            "user_id": att.get("user_id"),
            "username": att.get("username"),
            "employeeId": att.get("employeeId"),
            "employeeName": att.get("employeeName"),
            "date": att.get("date"),
            "status": att.get("status")
        })

if __name__ == "__main__":
    asyncio.run(check())

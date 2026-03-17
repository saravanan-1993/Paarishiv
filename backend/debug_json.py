from motor.motor_asyncio import AsyncIOMotorClient
import asyncio
import os
import json
from datetime import datetime
from bson import ObjectId
from dotenv import load_dotenv

async def check():
    load_dotenv()
    url = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    db_name = os.getenv("DATABASE_NAME", "civil_erp")
    client = AsyncIOMotorClient(url)
    db = client[db_name]
    
    res = {}
    
    employees = await db.employees.find({"fullName": "Saravanan"}).to_list(10)
    res["employees"] = []
    for emp in employees:
        emp["_id"] = str(emp["_id"])
        for k, v in emp.items():
            if isinstance(v, (datetime, ObjectId)): emp[k] = str(v)
        res["employees"].append(emp)
        
    attendance = await db.attendance.find({
        "$or": [
            {"employeeName": "Saravanan"},
            {"employeeCode": "EMP001"},
            {"username": "Saravanan"},
            {"employeeId": "EMP001"}
        ]
    }).sort("date", -1).to_list(10)
    res["attendance"] = []
    for att in attendance:
        att["_id"] = str(att["_id"])
        for k, v in att.items():
            if isinstance(v, (datetime, ObjectId)): att[k] = str(v)
        res["attendance"].append(att)
        
    print(json.dumps(res, indent=2))

if __name__ == "__main__":
    asyncio.run(check())

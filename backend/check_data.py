import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

async def list_data():
    client = AsyncIOMotorClient(os.getenv("MONGODB_URL"))
    db = client[os.getenv("DATABASE_NAME", "civil_erp")]
    
    users_count = await db.users.count_documents({})
    employees_count = await db.employees.count_documents({})
    attendance_count = await db.attendance.count_documents({})
    
    print(f"Counts - Users: {users_count}, Employees: {employees_count}, Attendance: {attendance_count}")
    
    print("\n--- USERS (First 20) ---")
    users = await db.users.find().limit(20).to_list(20)
    for u in users:
        print(f"User: {u.get('username')}, Role: {u.get('role')}")
        
    print("\n--- EMPLOYEES (First 20) ---")
    employees = await db.employees.find().limit(20).to_list(20)
    for e in employees:
        print(f"Employee: {e.get('fullName')}, Code: {e.get('employeeCode')}, Username: {e.get('username')}, Designation: {e.get('designation')}")

    print("\n--- RECENT ATTENDANCE (First 20) ---")
    attendance = await db.attendance.find().sort("created_at", -1).limit(20).to_list(20)
    for a in attendance:
        u = a.get('username')
        d = a.get('date')
        s = a.get('status')
        ts = a.get('created_at')
        print(f"Attendance: User={u}, Date={d}, Status={s}, Created={ts}")

if __name__ == "__main__":
    asyncio.run(list_data())

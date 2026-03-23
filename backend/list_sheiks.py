from database import db
import asyncio

async def list_sheiks():
    sheiks = await db.employees.find({"email": {"$regex": "sheik", "$options": "i"}}).to_list(10)
    for s in sheiks:
        print(f"ID: {s.get('_id')}")
        print(f"Email in DB: '{s.get('email')}'")
        print(f"Username in DB: '{s.get('username')}'")
        print(f"EmployeeCode in DB: '{s.get('employeeCode')}'")
        print(f"Password in DB: '{s.get('password')}'")
        print("-" * 20)

if __name__ == "__main__":
    asyncio.run(list_sheiks())

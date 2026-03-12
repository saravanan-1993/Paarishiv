from database import db
import asyncio

async def list_employees():
    employees = await db.employees.find().to_list(100)
    print(f"Total employees in DB: {len(employees)}")
    for e in employees:
        print(f"Name: {e.get('fullName'):20} | Email: {e.get('email'):25} | Code: {e.get('employeeCode'):10} | Role: {str(e.get('roles'))}")

if __name__ == "__main__":
    asyncio.run(list_employees())

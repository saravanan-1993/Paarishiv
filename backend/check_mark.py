import database
import asyncio

async def check_mark():
    db = await database.get_database()
    emp = await db.employees.find_one({"fullName": {"$regex": "Mark", "$options": "i"}})
    if emp:
        print(f"Found: {emp['fullName']} ({emp['employeeCode']})")
    else:
        print("Not found")

if __name__ == "__main__":
    asyncio.run(check_mark())

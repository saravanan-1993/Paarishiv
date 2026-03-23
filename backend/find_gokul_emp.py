from database import db
import asyncio

async def find_gokul():
    emp = await db.employees.find_one({"fullName": {"$regex": "Gokul", "$options": "i"}})
    print(f"Employee found: {emp}")

if __name__ == "__main__":
    asyncio.run(find_gokul())

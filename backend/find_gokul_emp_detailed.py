from database import db
import asyncio
from bson import json_util

async def find_gokul():
    emp = await db.employees.find_one({"fullName": {"$regex": "Gokul", "$options": "i"}})
    print(json_util.dumps(emp, indent=2))

if __name__ == "__main__":
    asyncio.run(find_gokul())

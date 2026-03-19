from database import db
import asyncio

async def check_user():
    user = await db.users.find_one({"username": {"$regex": "^gokul", "$options": "i"}})
    print(f"User: {user}")

if __name__ == "__main__":
    asyncio.run(check_user())

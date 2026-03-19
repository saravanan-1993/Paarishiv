import asyncio
import motor.motor_asyncio
import os
from dotenv import load_dotenv

load_dotenv()

async def main():
    url = os.getenv("MONGODB_URL")
    client = motor.motor_asyncio.AsyncIOMotorClient(url)
    db = client["civil_erp"]
    admin = await db.users.find_one({"role": {"$regex": "admin", "$options": "i"}})
    if admin:
        print(f"Admin Username: {admin.get('username')}")
    else:
        # Check all users
        users = await db.users.find().to_list(10)
        if users:
            print("First few users:")
            for u in users:
                print(f"User: {u.get('username')}, Role: {u.get('role')}")
        else:
            print("No users in db")

if __name__ == "__main__":
    asyncio.run(main())

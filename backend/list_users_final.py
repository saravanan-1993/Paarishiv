import asyncio
import motor.motor_asyncio
import os
from dotenv import load_dotenv

load_dotenv()

async def main():
    url = os.getenv("MONGODB_URL")
    client = motor.motor_asyncio.AsyncIOMotorClient(url)
    db = client["civil_erp"]
    users = await db.users.find().to_list(100)
    print(f"Total users: {len(users)}")
    for u in users:
        print(f"Username: {u.get('username')}, Role: {u.get('role')}")

if __name__ == "__main__":
    asyncio.run(main())

from database import db
import asyncio

async def check_sheik_fixed():
    user = await db.employees.find_one({"email": "sheik@mntfuture.com"})
    if user:
        print(f"User in DB: {user}")
    else:
        print("User NOT found after fix!")

if __name__ == "__main__":
    asyncio.run(check_sheik_fixed())

from database import db
import asyncio
from passlib.context import CryptContext

async def check_user():
    user = await db.users.find_one({"username": "sheik@mntfuture.com"})
    if user:
        print(f"User found: {user}")
        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        is_correct = pwd_context.verify("123456", user.get("password"))
        print(f"Password '123456' correct: {is_correct}")
    else:
        print("User NOT found")

if __name__ == "__main__":
    asyncio.run(check_user())

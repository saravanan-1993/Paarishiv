from database import db
import asyncio

async def list_users():
    users = await db.users.find().to_list(100)
    for u in users:
        print(f"Username: {u.get('username')}, Name: {u.get('name')}, Role: {u.get('role')}, EmpCode: {u.get('employeeCode')}")

if __name__ == "__main__":
    asyncio.run(list_users())

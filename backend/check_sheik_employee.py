from database import db
import asyncio

async def check_employee():
    # Search for the user in the employees collection
    user = await db.employees.find_one({
        "$or": [
            {"email": "sheik@mntfuture.com"},
            {"employeeCode": "sheik@mntfuture.com"},
            {"username": "sheik@mntfuture.com"}
        ]
    })
    
    if user:
        print("Employee found in database!")
        print(f"Name: {user.get('fullName')}")
        print(f"Email: {user.get('email')}")
        print(f"Password in DB: '{user.get('password')}'")
        print(f"Status: {user.get('status')}")
        print(f"Roles: {user.get('roles')}")
    else:
        print("Employee NOT found in database.")

if __name__ == "__main__":
    asyncio.run(check_employee())

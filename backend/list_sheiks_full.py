from database import db
import asyncio

async def list_sheiks():
    sheiks = await db.employees.find({"email": {"$regex": "sheik", "$options": "i"}}).to_list(10)
    for s in sheiks:
        email = s.get('email', 'NONE')
        print(f"FULL_EMAIL_IN_DB: [{email}]")
        print(f"PASSWORD_IN_DB: [{s.get('password')}]")

if __name__ == "__main__":
    asyncio.run(list_sheiks())

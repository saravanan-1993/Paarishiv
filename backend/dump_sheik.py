from database import db
import asyncio

async def list_sheiks():
    sheiks = await db.employees.find({"email": {"$regex": "sheik", "$options": "i"}}).to_list(10)
    with open("sheik_dump.txt", "w") as f:
        for s in sheiks:
            email = s.get('email', 'NONE')
            f.write(f"EMAIL: [{email}]\n")
            f.write(f"PASS: [{s.get('password')}]\n")

if __name__ == "__main__":
    asyncio.run(list_sheiks())

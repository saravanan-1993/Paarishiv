import asyncio
import motor.motor_asyncio
import os
from dotenv import load_dotenv

load_dotenv()

async def check_db():
    mongodb_url = os.getenv("MONGODB_URL")
    client = motor.motor_asyncio.AsyncIOMotorClient(mongodb_url)
    db = client['civil_erp']
    
    p = await db.projects.find_one({"name": "Lakshmi Homes"})
    if p:
        print(f"Project: {p.get('name')}")
        print(f"  engineer_id stored: {p.get('engineer_id')}")
        
    async for e in db.employees.find({"roles": "Site Engineer"}):
        print(f"EE: {e.get('fullName')}, Code: {e.get('employeeCode')}")

    client.close()

if __name__ == "__main__":
    asyncio.run(check_db())

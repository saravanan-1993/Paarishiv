import asyncio
import motor.motor_asyncio
import os
from dotenv import load_dotenv

load_dotenv()

async def check_db():
    mongodb_url = os.getenv("MONGODB_URL")
    client = motor.motor_asyncio.AsyncIOMotorClient(mongodb_url)
    db = client['civil_erp']
    
    project = await db.projects.find_one({"name": "Lakshmi Homes"})
    if project:
         print(f"Project 'Lakshmi Homes': engineer_id={project.get('engineer_id')}")
         
    # Check the actual employee with that code or name
    emp = await db.employees.find_one({"fullName": "Saravanan"})
    if emp:
        print(f"Employee 'Saravanan': code={emp.get('employeeCode')}, username={emp.get('username')}")
        
    emp2 = await db.employees.find_one({"employeeCode": "MNT001"})
    if emp2:
        print(f"Employee 'MNT001': name={emp2.get('fullName')}")

    client.close()

if __name__ == "__main__":
    asyncio.run(check_db())

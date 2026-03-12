import asyncio
import motor.motor_asyncio
import os
from dotenv import load_dotenv

load_dotenv()

async def check_db():
    mongodb_url = os.getenv("MONGODB_URL")
    client = motor.motor_asyncio.AsyncIOMotorClient(mongodb_url)
    db = client['civil_erp']
    
    print("--- SITE ENGINEERS ---")
    async for emp in db.employees.find({"roles": "Site Engineer"}):
        print(f"EE: {emp.get('fullName')}, Username: {emp.get('username')}, Code: {emp.get('employeeCode')}")
    
    print("\n--- PROJECTS AND THEIR ENGINEERS ---")
    async for p in db.projects.find():
        print(f"Project: {p.get('name')}, Engineer ID: {p.get('engineer_id')}")
        
    print("\n--- PURCHASE ORDERS AND THEIR PROJECTS ---")
    async for po in db.purchase_orders.find():
        print(f"PO Vendor: {po.get('vendor_name')}, Project: {po.get('project_name')}, Status: {po.get('status')}")

    client.close()

if __name__ == "__main__":
    asyncio.run(check_db())

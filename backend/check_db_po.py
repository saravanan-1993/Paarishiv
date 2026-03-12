import asyncio
import motor.motor_asyncio
import os
from dotenv import load_dotenv

load_dotenv()

async def check_db():
    mongodb_url = os.getenv("MONGODB_URL")
    client = motor.motor_asyncio.AsyncIOMotorClient(mongodb_url)
    db = client['magizh_civil_erp']
    
    for col_name in ['projects', 'purchase_orders', 'employees']:
        count = await db[col_name].count_documents({})
        print(f"Count for {col_name}: {count}")
        if count > 0:
            async for doc in db[col_name].find().limit(2):
                if col_name == 'projects':
                    print(f"  Project: {doc.get('name')}, Eng: {doc.get('engineer_id')}, ID: {doc.get('_id')}")
                elif col_name == 'purchase_orders':
                    print(f"  PO Value: {doc.get('total_amount')}, Project: {doc.get('project_name')}, Status: {doc.get('status')}")
                else:
                    print(f"  EE: {doc.get('employeeCode')}, Roles: {doc.get('roles')}")

    client.close()

if __name__ == "__main__":
    asyncio.run(check_db())

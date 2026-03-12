import asyncio
import motor.motor_asyncio
import os
from dotenv import load_dotenv

load_dotenv()

async def check_db():
    mongodb_url = os.getenv("MONGODB_URL")
    client = motor.motor_asyncio.AsyncIOMotorClient(mongodb_url)
    db = client['civil_erp']
    
    print("--- ACCOUNTANT USER ---")
    emp = await db.employees.find_one({'username': 'accountant'})
    print(emp)
    
    print("\n--- ROLES IN DB ---")
    roles_doc = await db.roles.find_one({"_id": "global_roles"})
    if roles_doc:
        acc_role = next((r for r in roles_doc.get("roles", []) if r["name"] == "Accountant"), None)
        print(f"Accountant Role: {acc_role}")
    else:
        print("global_roles document not found!")

    client.close()

if __name__ == "__main__":
    asyncio.run(check_db())

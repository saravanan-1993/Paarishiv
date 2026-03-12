import asyncio
import motor.motor_asyncio
import os
from dotenv import load_dotenv

load_dotenv()

async def check_db():
    mongodb_url = os.getenv("MONGODB_URL")
    client = motor.motor_asyncio.AsyncIOMotorClient(mongodb_url)
    db = client['civil_erp']
    
    async for po in db.purchase_orders.find():
        print(f"PO ID: {po.get('_id')}, Status: {po.get('status')}")

    client.close()

if __name__ == "__main__":
    asyncio.run(check_db())

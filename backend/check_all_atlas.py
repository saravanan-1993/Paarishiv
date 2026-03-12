import asyncio
import motor.motor_asyncio
import os
from dotenv import load_dotenv

load_dotenv()

async def check_db():
    mongodb_url = os.getenv("MONGODB_URL")
    client = motor.motor_asyncio.AsyncIOMotorClient(mongodb_url)
    dbs = await client.list_database_names()
    
    for db_name in dbs:
        print(f"\nDB: {db_name}")
        db = client[db_name]
        cols = await db.list_collection_names()
        for col in cols:
            count = await db[col].count_documents({})
            print(f"  {col}: {count}")
            # If it's a promising collection, print some IDs/names
            if count > 0 and col in ['projects', 'purchase_orders', 'employees', 'purchase-orders']:
                async for doc in db[col].find().limit(2):
                    print(f"    - {doc.get('name') or doc.get('vendor_name') or doc.get('username') or doc.get('id') or doc.get('_id')}")

    client.close()

if __name__ == "__main__":
    asyncio.run(check_db())

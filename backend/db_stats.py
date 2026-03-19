
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def check_stats():
    # URI from the previous successful test_db_conn.py run
    mongo_uri = "mongodb+srv://admin:admin@civil-erp.v1.mongodb.net/civil_erp?retryWrites=true&w=majority"
    client = AsyncIOMotorClient(mongo_uri)
    db = client.civil_erp
    
    collections = await db.list_collection_names()
    print(f"Collections: {collections}")
    
    for coll in collections:
        count = await db[coll].count_documents({})
        print(f"{coll}: {count} documents")
        
    client.close()

if __name__ == "__main__":
    asyncio.run(check_stats())

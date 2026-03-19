from database import db
import asyncio

async def list_collections():
    collections = await db.list_collection_names()
    print(f"Collections: {collections}")
    
    for coll_name in collections:
        count = await db[coll_name].count_documents({})
        print(f" - {coll_name}: {count}")

if __name__ == "__main__":
    asyncio.run(list_collections())

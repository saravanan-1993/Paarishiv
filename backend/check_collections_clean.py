from database import db
import asyncio

async def list_collections():
    collections = await db.list_collection_names()
    print(f"Total Collections Found: {len(collections)}")
    
    for coll_name in sorted(collections):
        count = await db[coll_name].count_documents({})
        print(f"Collection: {coll_name:30} Count: {count}")

if __name__ == "__main__":
    asyncio.run(list_collections())

from database import db
import asyncio

async def find_sheik():
    collections = await db.list_collection_names()
    for coll_name in collections:
        docs = await db[coll_name].find({
            "$or": [
                {"email": {"$regex": "sheik", "$options": "i"}},
                {"name": {"$regex": "sheik", "$options": "i"}},
                {"fullName": {"$regex": "sheik", "$options": "i"}},
                {"username": {"$regex": "sheik", "$options": "i"}}
            ]
        }).to_list(10)
        if docs:
            print(f"Found in collection: {coll_name}")
            for d in docs:
                # Remove sensitive info before printing if needed, but here it's debug
                print(f"  {d}")

if __name__ == "__main__":
    asyncio.run(find_sheik())

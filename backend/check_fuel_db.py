import asyncio
from database import get_database

async def main():
    db = await get_database()
    collections = await db.list_collection_names()
    print("Collections:", collections)
    
    # Check for anything related to fuel
    for col in collections:
        if 'fuel' in col.lower() or 'stock' in col.lower() or 'inventory' in col.lower():
            count = await db[col].count_documents({})
            print(f"Collection: {col}, Count: {count}")
            if count > 0:
                sample = await db[col].find_one({})
                print(f"Sample from {col}: {sample}")

if __name__ == "__main__":
    asyncio.run(main())

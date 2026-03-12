import asyncio
import os
import sys

sys.path.append(os.getcwd())
from database import get_database

async def list_collections():
    db = await get_database()
    collections = await db.list_collection_names()
    print(collections)

if __name__ == '__main__':
    asyncio.run(list_collections())

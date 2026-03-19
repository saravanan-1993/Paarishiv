
import asyncio
from database import get_database
from bson import ObjectId

async def check():
    db = await get_database()
    projects = await db.projects.find().to_list(100)
    for p in projects:
        print(f"Name: {p.get('name')}, ID: {p.get('_id')}, Type: {type(p.get('_id'))}")

if __name__ == "__main__":
    asyncio.run(check())

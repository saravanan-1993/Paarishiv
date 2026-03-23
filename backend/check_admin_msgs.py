import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

async def check():
    url = os.getenv("MONGODB_URL")
    client = AsyncIOMotorClient(url)
    db = client["civil_erp"]
    try:
        from bson import ObjectId
        # Find any message to admin
        msgs = await db.chat_messages.find({"receiver": "admin"}).sort("timestamp", -1).to_list(10)
        print(f"Total messages to admin found: {len(msgs)}")
        for m in msgs:
            print(f"[{m.get('timestamp')}] From: {m.get('sender')}, Content: {m.get('content')[:50]}...")
            
    except Exception as e:
        print(f"Error: {e}")
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(check())

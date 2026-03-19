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
        # Check all system messages
        msgs = await db.chat_messages.find({"sender": "System"}).sort("timestamp", -1).to_list(10)
        print("Last 10 System Messages:")
        for m in msgs:
            print(f"[{m.get('timestamp')}] {m.get('sender')} -> {m.get('receiver')}: {m.get('content')}")
            
    except Exception as e:
        print(f"Error: {e}")
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(check())

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
        # Check all "Overdue" status in tasks
        projects = await db.projects.find().to_list(100)
        overdue_tasks = []
        for p in projects:
            for t in p.get("tasks", []):
                if t.get("status") == "Overdue":
                   overdue_tasks.append(f"{p['name']} - {t['name']}")
        print(f"Overdue Tasks found: {overdue_tasks}")
        
        # Check all messages from System to anyone
        msgs = await db.chat_messages.find({"sender": "System", "content": {"$regex": "OVERDUE"}}).sort("timestamp", -1).to_list(10)
        print("Last 10 Overdue Notification Messages:")
        for m in msgs:
            print(f"[{m.get('timestamp')}] System -> {m.get('receiver')}: {m.get('content')}")
            
    except Exception as e:
        print(f"Error: {e}")
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(check())

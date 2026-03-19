import asyncio
from database import db

async def main():
    proj = await db.projects.find_one({"name": {"$regex": "Agrini", "$options": "i"}})
    if not proj:
        print("Project not found")
        return
        
    print(f"Project ID: {proj['_id']}")
    
    # Let's count activity logs
    logs = await db.activity_log.find({"project_id": str(proj["_id"])}).to_list(100)
    print("Activity logs for Agrini:", len(logs))
    for log in logs:
        print(log)

asyncio.run(main())


import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import json

async def check_project():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["civil_erp"]
    project_id = "69b12b64afbf9232d3739fad"
    
    try:
        project = await db.projects.find_one({"_id": ObjectId(project_id)})
        if project:
            # Convert ObjectId and datetime to string for JSON serialization
            def serialize(obj):
                if isinstance(obj, ObjectId):
                    return str(obj)
                if hasattr(obj, 'isoformat'):
                    return obj.isoformat()
                return str(obj)
            
            print(json.dumps(project, default=serialize, indent=2))
        else:
            print(f"Project with ID {project_id} not found.")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(check_project())

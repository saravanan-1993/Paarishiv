
import motor.motor_asyncio
import asyncio
import json
import os
from dotenv import load_dotenv
from bson import ObjectId

class JSONEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, ObjectId): return str(o)
        return super().default(o)

load_dotenv()

async def main():
    uri = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    db_name = os.getenv("DATABASE_NAME", "civil_erp")
    client = motor.motor_asyncio.AsyncIOMotorClient(uri)
    db = client[db_name]
    
    # Dump leaves
    leaves = await db['leaves'].find().to_list(100)
    with open("leaves_dump.json", "w", encoding="utf-8") as f:
        json.dump(leaves, f, indent=2, cls=JSONEncoder)
    
    # Dump employees
    employees = await db['employees'].find().to_list(100)
    with open("employees_dump.json", "w", encoding="utf-8") as f:
        json.dump(employees, f, indent=2, cls=JSONEncoder)
        
    client.close()

if __name__ == "__main__":
    asyncio.run(main())

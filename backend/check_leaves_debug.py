
import motor.motor_asyncio
import asyncio
import json
from bson import ObjectId

class JSONEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, ObjectId):
            return str(o)
        return super().default(o)

async def main():
    client = motor.motor_asyncio.AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['civil_erp']
    leaves = await db['leaves'].find().to_list(100)
    print(json.dumps(leaves, indent=2, cls=JSONEncoder))
    await client.close()

if __name__ == "__main__":
    asyncio.run(main())

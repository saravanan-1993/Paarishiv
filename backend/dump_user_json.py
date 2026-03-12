from database import db
import asyncio
import json
from bson import ObjectId

class JSONEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, ObjectId):
            return str(o)
        return json.JSONEncoder.default(self, o)

async def dump_sheik():
    user = await db.employees.find_one({"email": "sheik@mntfuture.com"})
    if user:
        print(json.dumps(user, indent=4, cls=JSONEncoder))
    else:
        print("User NOT found")

if __name__ == "__main__":
    asyncio.run(dump_sheik())

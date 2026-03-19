
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
    
    # Check attendance for today
    today = "2026-03-06"
    attendance_count = await db['attendance'].count_documents({"date": today})
    print(f"ATTENDANCE COUNT FOR TODAY ({today}): {attendance_count}")
    
    # Check all attendance where status is Leave
    leave_att_count = await db['attendance'].count_documents({"status": "Leave", "date": today})
    print(f"LEAVE ATTENDANCE COUNT FOR TODAY: {leave_att_count}")
    
    # Check leaves again
    leaves_count = await db['leaves'].count_documents({})
    print(f"ALL LEAVES COUNT: {leaves_count}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(main())

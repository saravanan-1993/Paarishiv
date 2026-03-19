import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def check_attendance():
    try:
        client = AsyncIOMotorClient('mongodb://localhost:27017')
        db = client['civil_erp']
        
        print("--- Latest 5 Attendance Records ---")
        cursor = db.attendance.find({}).sort('created_at', -1)
        docs = await cursor.to_list(length=5)
        
        if not docs:
            print("No records found.")
        
        for d in docs:
            print(f"User: {d.get('username')}, Date: {d.get('date')}, In: {d.get('check_in')}, Out: {d.get('check_out')}")
        
        client.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(check_attendance())

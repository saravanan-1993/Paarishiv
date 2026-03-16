
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

async def check_trips():
    mongo_url = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    client = AsyncIOMotorClient(mongo_url)
    db = client.civil_erp
    print(f"Connected to DB: {db.name}")
    count = await db.trips.count_documents({})
    print(f"Total trips in DB: {count}")
    trip = await db.trips.find_one()
    with open("trip_output.txt", "w") as f:
        if trip:
            f.write(str(trip))
        else:
            f.write("No trip found")

if __name__ == "__main__":
    asyncio.run(check_trips())

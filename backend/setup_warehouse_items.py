import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os

async def setup_tracking():
    client = AsyncIOMotorClient("mongodb+srv://admin:z9EQ50SnM0yzv3On@cluster0.lvnxfa7.mongodb.net/civil-erp")
    db = client.civil_erp
    
    # Update switches and wires to Warehouse type
    # Others will default to Direct in code
    await db.materials.update_many(
        {"name": {"$regex": "Switch|Wire|Cable", "$options": "i"}},
        {"$set": {"tracking_type": "Warehouse"}}
    )
    
    # Also ensure some exist
    warehouse_items = [
        {"name": "Modular Switch 6A", "category": "Electrical", "unit": "Nos", "tracking_type": "Warehouse"},
        {"name": "Copper Wire 2.5sqmm", "category": "Electrical", "unit": "Coil", "tracking_type": "Warehouse"},
        {"name": "LED Panel Light 12W", "category": "Electrical", "unit": "Nos", "tracking_type": "Warehouse"}
    ]
    
    for item in warehouse_items:
        await db.materials.update_one(
            {"name": item["name"]},
            {"$set": item},
            upsert=True
        )
        
    print("Warehouse items updated/created.")

if __name__ == "__main__":
    asyncio.run(setup_tracking())

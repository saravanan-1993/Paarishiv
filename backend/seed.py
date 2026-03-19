"""
Run this once to seed the database with demo data:
    venv\Scripts\python seed.py
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
from dotenv import load_dotenv
import os

load_dotenv()

MONGODB_URL  = os.getenv("MONGODB_URL")
DATABASE_NAME = os.getenv("DATABASE_NAME", "civil_erp")

# ── Demo Data ──────────────────────────────────────────────────────────────────

PROJECTS = [
    {
        "name": "Sky Tower Residence",
        "client": "Lakshmi Developers",
        "location": "Coimbatore, Tamil Nadu",
        "budget": 18000000,
        "start_date": datetime(2025, 6, 1),
        "end_date": datetime(2027, 3, 31),
        "status": "Ongoing",
        "engineer_id": "engineer",
        "progress": 34.4,
        "tasks": [],
        "created_at": datetime.now(),
    },
    {
        "name": "Chennai Metro Phase 3",
        "client": "CMRL",
        "location": "Chennai, Tamil Nadu",
        "budget": 25000000,
        "start_date": datetime(2026, 1, 15),
        "end_date": datetime(2028, 6, 30),
        "status": "Ongoing",
        "engineer_id": "engineer",
        "progress": 26.8,
        "tasks": [],
        "created_at": datetime.now(),
    },
    {
        "name": "Grand Mall Extension",
        "client": "RMZ Corp",
        "location": "Madurai, Tamil Nadu",
        "budget": 12000000,
        "start_date": datetime(2025, 1, 10),
        "end_date": datetime(2026, 6, 30),
        "status": "Ongoing",
        "engineer_id": "engineer",
        "progress": 74.2,
        "tasks": [],
        "created_at": datetime.now(),
    },
    {
        "name": "Riverside Bridge",
        "client": "State PWD",
        "location": "Trichy, Tamil Nadu",
        "budget": 9000000,
        "start_date": datetime(2025, 3, 1),
        "end_date": datetime(2026, 9, 30),
        "status": "Ongoing",
        "engineer_id": "engineer",
        "progress": 61.5,
        "tasks": [],
        "created_at": datetime.now(),
    },
    {
        "name": "Wedding Hall Complex",
        "client": "Sri Murugan Trusts",
        "location": "Salem, Tamil Nadu",
        "budget": 30000000,
        "start_date": datetime(2026, 2, 1),
        "end_date": datetime(2028, 12, 31),
        "status": "Ongoing",
        "engineer_id": "engineer",
        "progress": 8.0,
        "tasks": [],
        "created_at": datetime.now(),
    },
]

MATERIALS = [
    {"name": "Cement (OPC 53)", "category": "Binding",         "unit": "Bags",  "min_stock_level": 500,  "current_stock": 4200},
    {"name": "Steel Rods (12mm)", "category": "Reinforcement", "unit": "Tons",  "min_stock_level": 10,   "current_stock": 38},
    {"name": "Bricks (Red)",     "category": "Masonry",         "unit": "Units", "min_stock_level": 5000, "current_stock": 65000},
    {"name": "Sand (Coarse)",    "category": "Aggregate",       "unit": "Loads", "min_stock_level": 20,   "current_stock": 45},
    {"name": "Gravel (20mm)",    "category": "Aggregate",       "unit": "Loads", "min_stock_level": 15,   "current_stock": 12},
    {"name": "TMT Rods (8mm)",   "category": "Reinforcement",   "unit": "Tons",  "min_stock_level": 5,    "current_stock": 22},
    {"name": "PVC Pipes (4in)",  "category": "Plumbing",        "unit": "Pcs",   "min_stock_level": 100,  "current_stock": 280},
    {"name": "Tiles (Vitrified)","category": "Finishing",       "unit": "Sqft",  "min_stock_level": 200,  "current_stock": 1500},
]

LABOUR = [
    {"name": "Muthu",  "contact": "9876543210", "category": "Mason",    "daily_wage": 850, "current_project_id": None},
    {"name": "Selvam", "contact": "8765432109", "category": "Helper",   "daily_wage": 600, "current_project_id": None},
    {"name": "Pandi",  "contact": "7654321098", "category": "Bent-bar", "daily_wage": 750, "current_project_id": None},
    {"name": "Rajan",  "contact": "6543210987", "category": "Mason",    "daily_wage": 900, "current_project_id": None},
    {"name": "Kumar",  "contact": "9988776655", "category": "Helper",   "daily_wage": 600, "current_project_id": None},
]

VENDORS = [
    {"name": "Lordson Enterprises",   "category": "Cement",   "gstin": "33AADFL1234A1Z5", "contact": "9876501234", "status": "Active"},
    {"name": "SVS Earth Movers",      "category": "Equipment","gstin": "33BBBSV5678B1Z6", "contact": "9876509876", "status": "Active"},
    {"name": "RK Electricals",        "category": "Electrical","gstin": "33CCCRK4321C1Z7","contact": "9865004321", "status": "Active"},
    {"name": "Sundar Steel Works",    "category": "Steel",    "gstin": "33DDDSS9876D1Z8", "contact": "9876543210", "status": "Active"},
]

# ── Seed function ──────────────────────────────────────────────────────────────

async def seed():
    client = AsyncIOMotorClient(MONGODB_URL, serverSelectionTimeoutMS=8000)
    db = client[DATABASE_NAME]

    print("[SEED] Seeding Civil ERP database...\n")

    # Drop existing collections (fresh start)
    for col in ["projects", "materials", "labour", "vendors"]:
        await db[col].drop()
        print(f"  [CLEAR] {col}")

    # Insert fresh data
    r1 = await db.projects.insert_many(PROJECTS)
    print(f"  [OK] Projects inserted:  {len(r1.inserted_ids)}")

    r2 = await db.materials.insert_many(MATERIALS)
    print(f"  [OK] Materials inserted: {len(r2.inserted_ids)}")

    r3 = await db.labour.insert_many(LABOUR)
    print(f"  [OK] Labour inserted:    {len(r3.inserted_ids)}")

    r4 = await db.vendors.insert_many(VENDORS)
    print(f"  [OK] Vendors inserted:   {len(r4.inserted_ids)}")

    print("\n[DONE] Database seeded successfully!")
    print(f"   Database : {DATABASE_NAME}")
    print(f"   Atlas URL: {MONGODB_URL[:40]}...")

    client.close()

if __name__ == "__main__":
    asyncio.run(seed())

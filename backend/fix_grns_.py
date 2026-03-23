import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId

async def fix():
    db = AsyncIOMotorClient("mongodb://localhost:27017")["civil_erp"]
    print("Fixing historical GRNs...")
    expenses = await db.expenses.find({"grn_id": {"$exists": True, "$ne": None}}).to_list(1000)
    for exp in expenses:
        grn_id = exp.get("grn_id")
        if grn_id:
            amount = exp.get("base_amount") or 0
            gst = exp.get("gst_amount") or 0
            total = amount + gst
            if total == 0:
                total = exp.get("amount") or 0
            if total > 0:
                print(f"Setting {grn_id} to {total}")
                await db.grns.update_one(
                    {"_id": ObjectId(grn_id)},
                    {"$set": {"total_amount": float(total)}}
                )
    print("Historical GRN patches Complete.")

asyncio.run(fix())

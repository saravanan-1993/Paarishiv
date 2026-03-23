import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def fix():
    db = AsyncIOMotorClient("mongodb://localhost:27017")["civil_erp"]
    print("Fixing historical GRNs...")
    expenses = await db.expenses.find({"category": "Material Purchase"}).to_list(1000)
    for exp in expenses:
        grn_id = exp.get("grn_id")
        if grn_id:
            try:
                from bson import ObjectId
                # Ensure the GRN has total_amount set if it wasn't
                amount = exp.get("total_amount") or exp.get("amount") or 0
                await db.grns.update_one(
                    {"_id": ObjectId(grn_id), "total_amount": {"$exists": False}},
                    {"$set": {"total_amount": float(amount)}}
                )
                print(f"Updated GRN {grn_id} with amount {amount}")
            except Exception as e:
                print(f"Error updating {grn_id}: {e}")

asyncio.run(fix())

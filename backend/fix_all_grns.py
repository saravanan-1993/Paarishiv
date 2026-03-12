import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId

async def update_all_grn_totals():
    db = AsyncIOMotorClient("mongodb://localhost:27017")["civil_erp"]
    print("Fixing all GRNs amounts...")
    grns = await db.grns.find().to_list(1000)
    for grn in grns:
        if "total_amount" in grn and grn["total_amount"] > 0:
            continue
        expenses = await db.expenses.find({"grn_id": str(grn["_id"])}).to_list(1000)
        total_p = sum(float(e.get("amount", 0)) for e in expenses)
        if total_p > 0:
            print(f"Update GRN {grn['_id']} to {total_p}")
            await db.grns.update_one({"_id": grn["_id"]}, {"$set": {"total_amount": total_p}})
    print("Done")

asyncio.run(update_all_grn_totals())

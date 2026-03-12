import asyncio
import os
from dotenv import load_dotenv
from database import db as civil_db
from bson import ObjectId

async def fix():
    print("Fixing historical GRNs in Production DB correctly...")
    grns = await civil_db.grns.find().to_list(1000)
    for grn in grns:
        grn_id = str(grn["_id"])
        expenses = await civil_db.expenses.find({"grn_id": grn_id}).to_list(1000)
        if not expenses: continue
        
        # Try to find a total_amount / base_amount from any expense
        invoice_total = 0
        for exp in expenses:
            if exp.get("total_amount"):
                invoice_total = exp.get("total_amount")
                break
            base = exp.get("base_amount") or 0
            gst = exp.get("gst_amount") or 0
            if (base + gst) > 0:
                invoice_total = base + gst
                break
                
        # If still 0, sum all payment amounts to derive what the total amount probably was
        if invoice_total == 0:
            invoice_total = sum(float(e.get("amount", 0)) for e in expenses)
            
        if invoice_total > 0:
            print(f"Update {grn_id} to invoice total {invoice_total}")
            await civil_db.grns.update_one(
                {"_id": ObjectId(grn_id)},
                {"$set": {"total_amount": float(invoice_total)}}
            )

    print("Historical GRN patches Complete.")

asyncio.run(fix())

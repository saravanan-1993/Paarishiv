"""
Migration script: Create expense entries for all existing fuel_stock and fuel_logs
that were added before the auto-expense feature was implemented.
Run once: python migrate_fuel_expenses.py
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DATABASE_NAME = "civil_erp"


async def migrate():
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]

    print("=" * 60)
    print("Fuel -> Expense Migration")
    print("=" * 60)

    # Step 1: Get all existing fuel expense source IDs to avoid duplicates
    existing = await db.expenses.find(
        {"source": {"$in": ["fuel_stock", "fuel_log"]}},
        {"reference": 1, "description": 1, "source": 1}
    ).to_list(10000)
    existing_descriptions = set(e.get("description", "") for e in existing)
    print(f"Found {len(existing)} existing fuel expenses (will skip duplicates)\n")

    # Step 2: Migrate fuel_stock → expenses
    stocks = await db.fuel_stock.find().to_list(10000)
    stock_created = 0
    stock_skipped = 0
    stock_total_amount = 0

    print(f"Processing {len(stocks)} fuel stock entries...")
    for s in stocks:
        total_amount = s.get("totalAmount", 0) or 0
        qty = s.get("qty", 0) or 0
        rate = s.get("rate", 0) or 0
        site = s.get("site", "General") or "General"
        supplier = s.get("supplier", "") or ""
        bill_no = s.get("billNo", "") or ""

        if total_amount <= 0:
            stock_skipped += 1
            continue

        desc = f"Diesel Purchase - {qty}L @ Rs.{rate}/L" + (f" ({supplier})" if supplier else "")

        # Check duplicate
        if desc in existing_descriptions:
            stock_skipped += 1
            continue

        # Parse date
        stock_date = s.get("date")
        if isinstance(stock_date, datetime):
            date_str = stock_date.isoformat()
        elif isinstance(stock_date, str):
            date_str = stock_date
        else:
            date_str = datetime.now().isoformat()

        expense_doc = {
            "category": "Fuel/Diesel",
            "amount": total_amount,
            "project": site,
            "payee": supplier or "Fuel Purchase",
            "paymentMode": "Cash",
            "reference": bill_no,
            "description": desc,
            "date": date_str,
            "invoice_no": bill_no,
            "voucher_no": "",
            "status": "Recorded",
            "source": "fuel_stock",
            "base_amount": total_amount,
            "gst_amount": 0,
            "created_by": s.get("addedBy", "Migration")
        }
        await db.expenses.insert_one(expense_doc)
        stock_created += 1
        stock_total_amount += total_amount
        existing_descriptions.add(desc)

        # Update project spent
        if site and site != "General":
            await db.projects.update_one(
                {"name": site},
                {"$inc": {"spent": total_amount}}
            )

    print(f"  Created: {stock_created} expense entries (Rs.{stock_total_amount:,.2f})")
    print(f"  Skipped: {stock_skipped} (zero amount or duplicate)\n")

    # Step 3: Migrate fuel_logs → expenses
    logs = await db.fuel_logs.find().to_list(10000)
    log_created = 0
    log_skipped = 0
    log_total_amount = 0

    print(f"Processing {len(logs)} fuel log entries...")
    for l in logs:
        qty = l.get("qty", 0) or 0
        site = l.get("site", "General") or "General"
        asset_name = l.get("assetName", "") or l.get("assetId", "")
        engineer = l.get("engineer", "") or ""
        log_date = l.get("date", "")

        if qty <= 0:
            log_skipped += 1
            continue

        # Get rate from latest stock for this site
        query = {"site": site} if site and site != "General" else {}
        recent_stock = await db.fuel_stock.find(query).sort("date", -1).to_list(1)
        rate = recent_stock[0].get("rate", 0) if recent_stock else 0
        fuel_cost = round(qty * rate, 2)

        if fuel_cost <= 0:
            log_skipped += 1
            continue

        desc = f"Diesel Consumption - {asset_name} ({qty}L x Rs.{rate}/L) | {engineer}"

        # Check duplicate
        if desc in existing_descriptions:
            log_skipped += 1
            continue

        expense_doc = {
            "category": "Fuel/Diesel",
            "amount": fuel_cost,
            "project": site,
            "payee": "Fuel Consumption",
            "paymentMode": "Internal",
            "reference": "",
            "description": desc,
            "date": log_date or datetime.now().isoformat(),
            "voucher_no": "",
            "status": "Recorded",
            "source": "fuel_log",
            "base_amount": fuel_cost,
            "gst_amount": 0,
            "created_by": "Migration"
        }
        await db.expenses.insert_one(expense_doc)
        log_created += 1
        log_total_amount += fuel_cost
        existing_descriptions.add(desc)

    print(f"  Created: {log_created} expense entries (Rs.{log_total_amount:,.2f})")
    print(f"  Skipped: {log_skipped} (zero cost or duplicate)\n")

    print("=" * 60)
    print(f"TOTAL: {stock_created + log_created} new expenses created")
    print(f"TOTAL AMOUNT: Rs.{stock_total_amount + log_total_amount:,.2f}")
    print("=" * 60)

    client.close()


if __name__ == "__main__":
    asyncio.run(migrate())

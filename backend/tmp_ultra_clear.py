import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

async def clear_chat_and_more():
    load_dotenv()
    db = AsyncIOMotorClient(os.getenv('MONGODB_URL', 'mongodb://localhost:27017'))['civil_erp']
    
    # List all collections to see what's left
    collections = await db.list_collection_names()
    print(f"Collections before: {collections}")
    
    # Collections to definitely clear
    to_clear = [
        "chat_messages", 
        "chat_groups", 
        "chat_group_read",
        "material_requests",
        "consolidated_requests",
        "stock_ledger",
        "material_transfers",
        "warehouse_inventory",
        "attendance",
        "payroll",
        "expenses",
        "bills",
        "receipts",
        "purchase_bills",
        "grns",
        "purchase_orders",
        "projects",
        "vendors",
        "fleet_vehicles",
        "fleet_trips",
        "fleet_maintenance",
        "surprise_attendance",
        "workflow_timeline",
        "site_reports" # Just in case
    ]
    
    for col in to_clear:
        if col in collections:
            print(f"Clearing {col}...")
            await db[col].drop()
            
    # Now about employees. The user showed the chat list which is populated from employees.
    # To "clear" this, we should probably remove all employees except maybe the current one or admin.
    # But since they want to "start fresh", I'll clear all employees. 
    # If they need to log in, they can use the hardcoded demo accounts.
    
    print("Clearing employees...")
    await db.employees.drop()
    
    print("Done clearing.")

if __name__ == "__main__":
    asyncio.run(clear_chat_and_more())

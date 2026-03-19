from database import db
import asyncio

async def check_pos():
    pos = await db.purchase_orders.find().to_list(100)
    print(f"Total POs: {len(pos)}")
    for p in pos:
        print(f"PO ID: {str(p['_id'])[-6:]}, Vendor Name: '{p.get('vendor_name')}'")

if __name__ == "__main__":
    asyncio.run(check_pos())

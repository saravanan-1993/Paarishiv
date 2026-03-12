from database import db
import asyncio

async def check_vendors():
    vendors = await db.vendors.find().to_list(100)
    print(f"Total Vendors: {len(vendors)}")
    for v in vendors:
        print(f"Name: '{v.get('name')}', Email: '{v.get('email')}'")

if __name__ == "__main__":
    asyncio.run(check_vendors())

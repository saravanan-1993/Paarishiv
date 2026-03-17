import asyncio
from database import get_database

async def main():
    db = await get_database()
    settings = await db.settings.find_one({"type": "company_profile"})
    if settings:
        print(f"LOGO_URL: {settings.get('logo')}")
    else:
        print("LOGO_URL: None (No settings found)")

if __name__ == "__main__":
    asyncio.run(main())

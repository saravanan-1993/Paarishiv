from database import db
import asyncio

async def fix_sheik():
    # Only update the one that has the typo
    result = await db.employees.update_one(
        {"email": "sheik@mntfure.com"},
        {"$set": {"email": "sheik@mntfuture.com"}}
    )
    if result.matched_count > 0:
        print("Success: Corrected sheik's email typo!")
    else:
        print("Failed: No employee found with email 'sheik@mntfure.com'")

if __name__ == "__main__":
    asyncio.run(fix_sheik())

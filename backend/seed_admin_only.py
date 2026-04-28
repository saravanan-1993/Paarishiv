"""
Perfect Admin Seed Script
- Creates admin user with manoj@mntfuture.com / Admin@123
- Auto-checks if admin exists (skips if found)
- Creates only essential roles and admin user
- Safe to run multiple times
Run: python seed_admin_only.py
"""
import asyncio
import bcrypt
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
from dotenv import load_dotenv
import os

load_dotenv()

def hash_pw(pw):
    return bcrypt.hashpw(pw.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

async def seed_admin_only():
    client = AsyncIOMotorClient(os.getenv("MONGODB_URL"))
    db = client[os.getenv("DATABASE_NAME", "civil_erp")]

    print("[ADMIN SEED] Perfect admin setup...\n")

    admin_email = "manoj@mntfuture.com"
    admin_password = "Admin@123"

    # 1. Create Administrator role (only if not exists)
    existing_roles = await db.roles.find_one({"_id": "global_roles"})
    if not existing_roles:
        roles_doc = {
            "_id": "global_roles",
            "roles": [
                {"name": "Administrator", "permissions": [
                    {"name": "Dashboard", "actions": {"view": True, "edit": True, "delete": True}},
                    {"name": "Projects", "actions": {"view": True, "edit": True, "delete": True}},
                    {"name": "HRMS", "actions": {"view": True, "edit": True, "delete": True}},
                    {"name": "Inventory", "actions": {"view": True, "edit": True, "delete": True}},
                    {"name": "Accounts", "actions": {"view": True, "edit": True, "delete": True}},
                    {"name": "Procurement", "actions": {"view": True, "edit": True, "delete": True}},
                    {"name": "Fleet Management", "actions": {"view": True, "edit": True, "delete": True}},
                    {"name": "Settings", "actions": {"view": True, "edit": True, "delete": True}},
                    {"name": "Reports", "actions": {"view": True, "edit": True, "delete": True}},
                    {"name": "Team Chat", "actions": {"view": True, "edit": True, "delete": True}},
                    {"name": "Approvals", "actions": {"view": True, "edit": True, "delete": True}},
                    {"name": "System Logs", "actions": {"view": True, "edit": True, "delete": True}},
                ]}
            ]
        }
        await db.roles.insert_one(roles_doc)
        print("  ✅ Administrator role created")
    else:
        print("  ⏭️  Roles already exist")

    # 2. Check if admin user exists (by email, code, or role)
    existing_admin = await db.employees.find_one({
        "$or": [
            {"email": admin_email},
            {"employeeCode": "ADMIN001"},
            {"roles": {"$in": ["Administrator"]}}
        ]
    })

    if existing_admin:
        # Update existing admin email if different
        if existing_admin.get("email") != admin_email:
            await db.employees.update_one(
                {"_id": existing_admin["_id"]},
                {"$set": {"email": admin_email}}
            )
            print(f"  ✅ Updated admin email to: {admin_email}")
        print(f"  ⏭️  Admin exists: {existing_admin.get('employeeCode', 'N/A')}")
    else:
        # Create new admin user
        admin_user = {
            "employeeCode": "ADMIN001", 
            "fullName": "Administrator", 
            "email": admin_email,
            "hashed_password": hash_pw(admin_password), 
            "roles": ["Administrator"],
            "designation": "Administrator", 
            "department": "Management",
            "phone": "9999999999", 
            "status": "Active", 
            "joiningDate": datetime.now().strftime("%Y-%m-%d"),
            "basicSalary": 50000, 
            "hra": 5000, 
            "salaryType": "monthly", 
            "dailyWage": 0, 
            "dob": "1990-01-01",
            "created_at": datetime.now()
        }
        await db.employees.insert_one(admin_user)
        print(f"  ✅ Admin user created: ADMIN001")

    # 3. Ensure counter exists
    existing_counter = await db.counters.find_one({"_id": "employee_code"})
    if not existing_counter:
        await db.counters.insert_one({"_id": "employee_code", "seq": 1})
        print("  ✅ Employee counter initialized")
    else:
        print("  ⏭️  Counter already exists")

    print("\n🎉 Perfect Admin Setup Complete!")
    print("=" * 40)
    print(f"📧 Email: {admin_email}")
    print(f"👤 Username: ADMIN001")
    print(f"🔑 Password: {admin_password}")
    print(f"🏢 Database: {os.getenv('DATABASE_NAME', 'civil_erp')}")
    print("=" * 40)

    client.close()

if __name__ == "__main__":
    asyncio.run(seed_admin_only())
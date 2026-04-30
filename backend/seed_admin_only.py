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
    # Always reset roles to ensure Administrator has full permissions
    admin_role = {
        "name": "Administrator",
        "description": "Full system access",
        "tags": ["admin", "System"],
        "permissions": [
            {"name": "Dashboard", "actions": {"view": True, "edit": True, "delete": True}},
            {"name": "Projects", "actions": {"view": True, "edit": True, "delete": True}, "subTabs": ["Overview", "Tasks", "DPR", "Financials", "Documents", "Labour Attendance", "Workflow Tracking"]},
            {"name": "Tasks", "actions": {"view": True, "edit": True, "delete": True}},
            {"name": "Accounts", "actions": {"view": True, "edit": True, "delete": True}, "subTabs": ["Overview", "Sales", "PurchaseBills", "Purchase", "Payments", "Ledger", "Quotations", "LabourWages"]},
            {"name": "Procurement", "actions": {"view": True, "edit": True, "delete": True}, "subTabs": ["Vendors", "POs", "Requests", "GRN"]},
            {"name": "HRMS", "actions": {"view": True, "edit": True, "delete": True}, "subTabs": ["Dashboard", "Employee Master", "Attendance", "Leave Management", "Payroll", "Surprise Visits", "Workforce", "Authorized Users", "Roles & Permissions"]},
            {"name": "Approvals", "actions": {"view": True, "edit": True, "delete": True}, "subTabs": ["Leaves", "Purchase Orders", "Materials", "Expenses", "Manpower", "SC Bills", "Labour Pay"]},
            {"name": "Inventory Management", "actions": {"view": True, "edit": True, "delete": True}, "subTabs": ["Materials", "Warehouse", "Coordination", "Machinery"]},
            {"name": "Reports", "actions": {"view": True, "edit": True, "delete": True}, "subTabs": ["Financial", "Project", "HRMS", "Inventory", "Plant"]},
            {"name": "Team Chat", "actions": {"view": True, "edit": True, "delete": True}},
            {"name": "Fleet Management", "actions": {"view": True, "edit": True, "delete": True}, "subTabs": ["Dashboard", "Trips", "Vehicles", "Maintenance", "Reports"]},
            {"name": "System Logs", "actions": {"view": True, "edit": True, "delete": True}},
            {"name": "Settings", "actions": {"view": True, "edit": True, "delete": True}, "subTabs": ["Profile", "Company Profile", "Security", "Notifications", "Cloudinary", "SMTP"]},
            {"name": "Site Reports", "actions": {"view": True, "edit": True, "delete": True}, "subTabs": ["Site Reports (DPR)", "Material Requests", "Transfer Requests"]},
            {"name": "Subcontractor Billing", "actions": {"view": True, "edit": True, "delete": True}},
            {"name": "Notifications", "actions": {"view": True, "edit": True, "delete": False}},
        ],
        "dashboardCards": ["overview_stats", "quick_actions", "active_projects_list", "budget_overview", "recent_activities", "my_tasks", "approvals_card", "inventory_card"],
        "features": ["add_project", "edit_project", "delete_project", "create_dpr", "add_material_request", "transfer_material", "create_po", "approve_po", "add_vendor", "create_grn", "add_labour", "edit_attendance", "approve_leave", "add_employee", "create_invoice", "create_sc_bill"],
        "userCount": 1
    }

    await db.roles.update_one(
        {"_id": "global_roles"},
        {"$set": {"roles": [admin_role]}},
        upsert=True
    )
    print("  [OK] Administrator role seeded (all modules)")

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
            print(f"  [OK] Updated admin email to: {admin_email}")
        print(f"  [SKIP]  Admin exists: {existing_admin.get('employeeCode', 'N/A')}")
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
        print(f"  [OK] Admin user created: ADMIN001")

    # 3. Ensure counter exists
    existing_counter = await db.counters.find_one({"_id": "employee_code"})
    if not existing_counter:
        await db.counters.insert_one({"_id": "employee_code", "seq": 1})
        print("  [OK] Employee counter initialized")
    else:
        print("  [SKIP]  Counter already exists")

    print("\n[DONE] Perfect Admin Setup Complete!")
    print("=" * 40)
    print(f"Email: Email: {admin_email}")
    print(f"User: Username: ADMIN001")
    print(f"Pass: Password: {admin_password}")
    print(f"DB: Database: {os.getenv('DATABASE_NAME', 'civil_erp')}")
    print("=" * 40)

    client.close()

if __name__ == "__main__":
    asyncio.run(seed_admin_only())
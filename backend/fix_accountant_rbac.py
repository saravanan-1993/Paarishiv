import asyncio
import motor.motor_asyncio
import os
from dotenv import load_dotenv

load_dotenv()

async def sync_roles():
    mongodb_url = os.getenv("MONGODB_URL")
    client = motor.motor_asyncio.AsyncIOMotorClient(mongodb_url)
    db = client['civil_erp']
    
    SUB_TABS = {
        'Projects': ['Overview', 'Tasks', 'DPR', 'Financials', 'Documents', 'Workflow Tracking'],
        'HRMS': ['Dashboard', 'Employee Master', 'Attendance', 'Leave Management', 'Payroll', 'Surprise Visits'],
        'Accounts': ['Overview', 'Sales', 'PurchaseBills', 'Purchase', 'Payments', 'Ledger'],
        'Procurement': ['Vendors', 'POs', 'Requests', 'GRN'],
        'Inventory Management': ['Materials', 'Warehouse', 'Coordination', 'Machinery'],
        'Settings': ['Profile', 'Company Profile', 'Security', 'Notifications', 'Cloudinary', 'SMTP'],
        'Fleet Management': ['Dashboard', 'Trips', 'Vehicles', 'Maintenance', 'Reports'],
        'Site Reports': ['Site Reports (DPR)', 'Material Requests', 'Transfer Requests'],
        'User Management': ['Authorized Users', 'Roles & Permissions'],
        'Approvals': ['Leaves', 'Purchase Orders', 'Materials', 'Expenses'],
        'Reports': ['Financial', 'Project', 'HRMS', 'Inventory', 'Plant']
    }

    accountant_role = {
        "name": "Accountant",
        "description": "Manage accounts and billing",
        "tags": ["accountant"],
        "permissions": [
            { "name": "Dashboard", "actions": { "view": True, "edit": False, "delete": False } },
            { "name": "Accounts", "actions": { "view": True, "edit": True, "delete": False }, "subTabs": SUB_TABS['Accounts'] },
            { "name": "Reports", "actions": { "view": True, "edit": True, "delete": False } },
            { "name": "Team Chat", "actions": { "view": True, "edit": True, "delete": False } },
            { "name": "HRMS", "actions": { "view": True, "edit": False, "delete": False }, "subTabs": ['Dashboard', 'Payroll'] },
        ],
        "dashboardCards": ["budget_overview", "overview_stats"],
        "features": ["create_invoice"],
        "userCount": 2
    }

    print("Updating Accountant role in DB...")
    roles_doc = await db.roles.find_one({"_id": "global_roles"})
    if roles_doc:
        roles = roles_doc.get("roles", [])
        updated = False
        for i, r in enumerate(roles):
            if r["name"] == "Accountant":
                roles[i] = accountant_role
                updated = True
                break
        
        if not updated:
            roles.append(accountant_role)
        
        await db.roles.update_one({"_id": "global_roles"}, {"$set": {"roles": roles}})
        print("Successfully updated Accountant role.")
    else:
        print("global_roles document not found! Creating it...")
        await db.roles.insert_one({"_id": "global_roles", "roles": [accountant_role]})
        print("Created global_roles with Accountant role.")

    client.close()

if __name__ == "__main__":
    asyncio.run(sync_roles())

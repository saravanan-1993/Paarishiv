import asyncio
import os
import sys

sys.path.append(os.getcwd())
from database import get_database

async def fix_site_engineer_procurement():
    db = await get_database()
    roles_doc = await db.roles.find_one({"_id": "global_roles"})
    
    if not roles_doc:
        print("No global_roles doc found.")
        return

    roles = roles_doc.get("roles", [])
    updated = False
    
    for r in roles:
        if r.get('name') == 'Site Engineer':
            for p in r.get("permissions", []):
                if p.get('name') == 'Procurement':
                    # Restrict subTabs to exclude 'Vendors'
                    p['subTabs'] = ['POs', 'Requests', 'GRN']
                    updated = True
                    print("Updated Site Engineer Procurement sub-tabs.")
        
        # Ensure Administrator has all sub-tabs
        if r.get('name') == 'Administrator':
            for p in r.get("permissions", []):
                if p.get('name') == 'Procurement':
                    p['subTabs'] = ['Vendors', 'POs', 'Requests', 'GRN']
                elif p.get('name') == 'Projects':
                    p['subTabs'] = ['Overview', 'Tasks', 'DPR', 'Financials', 'Documents', 'Workflow Tracking']
                elif p.get('name') == 'HRMS':
                    p['subTabs'] = ['Dashboard', 'Employee Master', 'Attendance', 'Leave Management', 'Payroll', 'Surprise Visits']

    if updated:
        await db.roles.update_one(
            {"_id": "global_roles"},
            {"$set": {"roles": roles}}
        )
        print("Global roles updated in database.")
    else:
        print("Site Engineer role or Procurement permission not found.")

if __name__ == '__main__':
    asyncio.run(fix_site_engineer_procurement())

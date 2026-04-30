from fastapi import APIRouter, Depends
from typing import List, Dict, Any
from database import get_database
from app.utils.auth import get_current_user
from app.utils.rbac import RBACPermission

router = APIRouter(prefix="/roles", tags=["roles"])

DASHBOARD_CARDS = [
    { "id": 'overview_stats', "label": 'Overall Statistics (Total Projects, Value, etc.)' },
    { "id": 'quick_actions', "label": 'Quick Actions Bar' },
    { "id": 'active_projects_list', "label": 'Active Projects List' },
    { "id": 'budget_overview', "label": 'Budget Overview Chart' },
    { "id": 'recent_activities', "label": 'Recent System Activities' },
    { "id": 'my_tasks', "label": 'My Tasks List' },
    { "id": 'approvals_card', "label": 'Pending Approvals Card' },
    { "id": 'inventory_card', "label": 'Inventory Overview Card' },
]

SYSTEM_FEATURES = [
    { "id": 'add_project', "label": 'Create New Project' },
    { "id": 'edit_project', "label": 'Edit Project Details' },
    { "id": 'delete_project', "label": 'Delete Project' },
    { "id": 'create_dpr', "label": 'Create Daily Progress Report (DPR)' },
    { "id": 'add_material_request', "label": 'Request New Material' },
    { "id": 'transfer_material', "label": 'Transfer Material between Sites' },
    { "id": 'create_po', "label": 'Create Purchase Order' },
    { "id": 'approve_po', "label": 'Approve Purchase Order' },
    { "id": 'add_vendor', "label": 'Add New Vendor' },
    { "id": 'create_grn', "label": 'Create GRN (Goods Received)' },
    { "id": 'add_labour', "label": 'Add Labour/Workers' },
    { "id": 'edit_attendance', "label": 'Modify Daily Attendance' },
    { "id": 'approve_leave', "label": 'Approve Leaves' },
    { "id": 'add_employee', "label": 'Add New Employee' },
    { "id": 'create_invoice', "label": 'Create Invoice/Bill' },
]

SUB_TABS = {
    'Projects': ['Overview', 'Tasks', 'DPR', 'Financials', 'Documents', 'Workflow Tracking'],
    'HRMS': ['Dashboard', 'Employee Master', 'Attendance', 'Leave Management', 'Payroll', 'Surprise Visits', 'Workforce', 'Authorized Users', 'Roles & Permissions'],
    'Budget & Finance': ['Overview', 'Sales', 'PurchaseBills', 'Purchase', 'Payments', 'Ledger'],
    'Budget Control': ['Overview', 'Sales', 'PurchaseBills', 'Purchase', 'Payments', 'Ledger'],
    'Accounts': ['Overview', 'Sales', 'PurchaseBills', 'Purchase', 'Payments', 'Ledger'],
    'Procurement': ['Vendors', 'POs', 'Requests', 'GRN'],
    'Inventory Management': ['Materials', 'Warehouse', 'Coordination', 'Machinery'],
    'Settings': ['Profile', 'Company Profile', 'Security', 'Notifications', 'Cloudinary', 'SMTP']
}

# Only Administrator role is seeded. All other roles are created via HRMS → Roles & Permissions.
DEFAULT_ROLES = [
    {
        "name": 'Administrator',
        "description": 'Full system access',
        "tags": ['admin', 'System'],
        "permissions": [
            { "name": 'Dashboard', "actions": { "view": True, "edit": True, "delete": True } },
            { "name": 'Projects', "actions": { "view": True, "edit": True, "delete": True }, "subTabs": SUB_TABS['Projects'] },
            { "name": 'Tasks', "actions": { "view": True, "edit": True, "delete": True } },
            { "name": 'Accounts', "actions": { "view": True, "edit": True, "delete": True }, "subTabs": SUB_TABS['Accounts'] },
            { "name": 'Procurement', "actions": { "view": True, "edit": True, "delete": True }, "subTabs": SUB_TABS['Procurement'] },
            { "name": 'HRMS', "actions": { "view": True, "edit": True, "delete": True }, "subTabs": SUB_TABS['HRMS'] },
            { "name": 'Approvals', "actions": { "view": True, "edit": True, "delete": True } },
            { "name": 'Inventory Management', "actions": { "view": True, "edit": True, "delete": True }, "subTabs": SUB_TABS['Inventory Management'] },
            { "name": 'Reports', "actions": { "view": True, "edit": True, "delete": True } },
            { "name": 'Team Chat', "actions": { "view": True, "edit": True, "delete": True } },
            { "name": 'Fleet Management', "actions": { "view": True, "edit": True, "delete": True } },
            { "name": 'System Logs', "actions": { "view": True, "edit": True, "delete": True } },
            { "name": 'Settings', "actions": { "view": True, "edit": True, "delete": True }, "subTabs": SUB_TABS['Settings'] },
            { "name": 'Subcontractor Billing', "actions": { "view": True, "edit": True, "delete": True } },
            { "name": 'Notifications', "actions": { "view": True, "edit": True, "delete": False } },
            { "name": 'Site Reports', "actions": { "view": True, "edit": True, "delete": True } },
        ],
        "dashboardCards": [c["id"] for c in DASHBOARD_CARDS],
        "features": [f["id"] for f in SYSTEM_FEATURES],
        "userCount": 1
    },
]

# C4 Fix: Added auth dependency to GET and RBAC to POST
@router.get("/", dependencies=[Depends(get_current_user)])
async def get_roles(db = Depends(get_database)):
    roles_doc = await db.roles.find_one({"_id": "global_roles"})
    if not roles_doc:
        # Initialize default roles
        await db.roles.insert_one({"_id": "global_roles", "roles": DEFAULT_ROLES})
        return DEFAULT_ROLES
    return roles_doc.get("roles", DEFAULT_ROLES)

# C4 Fix: Only admins can save roles (User Management merged into HRMS)
@router.post("/", dependencies=[Depends(RBACPermission("HRMS", "edit"))])
async def save_roles(roles: List[Dict[str, Any]], db = Depends(get_database)):
    # Upsert the roles
    await db.roles.update_one(
        {"_id": "global_roles"},
        {"$set": {"roles": roles}},
        upsert=True
    )
    return {"message": "Roles saved successfully"}

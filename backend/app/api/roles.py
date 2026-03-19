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
    'HRMS': ['Dashboard', 'Employee Master', 'Attendance', 'Leave Management', 'Payroll', 'Surprise Visits'],
    'Budget & Finance': ['Overview', 'Sales', 'PurchaseBills', 'Purchase', 'Payments', 'Ledger'],
    'Budget Control': ['Overview', 'Sales', 'PurchaseBills', 'Purchase', 'Payments', 'Ledger'],
    'Accounts': ['Overview', 'Sales', 'PurchaseBills', 'Purchase', 'Payments', 'Ledger'],
    'Procurement': ['Vendors', 'POs', 'Requests', 'GRN'],
    'Inventory Management': ['Materials', 'Warehouse', 'Coordination', 'Machinery'],
    'Settings': ['Profile', 'Company Profile', 'Security', 'Notifications', 'Cloudinary', 'SMTP']
}

DEFAULT_ROLES = [
    {
        "name": 'Administrator',
        "description": 'Full system access',
        "tags": ['admin', 'System'],
        "permissions": [
            { "name": 'Dashboard', "actions": { "view": True, "edit": True, "delete": True } },
            { "name": 'Projects', "actions": { "view": True, "edit": True, "delete": True }, "subTabs": SUB_TABS['Projects'] },
            { "name": 'Budget Control', "actions": { "view": True, "edit": True, "delete": True }, "subTabs": SUB_TABS['Budget & Finance'] },
            { "name": 'Accounts', "actions": { "view": True, "edit": True, "delete": True }, "subTabs": SUB_TABS['Accounts'] },
            { "name": 'Procurement', "actions": { "view": True, "edit": True, "delete": True }, "subTabs": SUB_TABS['Procurement'] },
            { "name": 'HRMS', "actions": { "view": True, "edit": True, "delete": True }, "subTabs": SUB_TABS['HRMS'] },
            { "name": 'Approvals', "actions": { "view": True, "edit": True, "delete": True } },
            { "name": 'Inventory Management', "actions": { "view": True, "edit": True, "delete": True }, "subTabs": SUB_TABS['Inventory Management'] },
            { "name": 'Reports', "actions": { "view": True, "edit": True, "delete": True } },
            { "name": 'Team Chat', "actions": { "view": True, "edit": True, "delete": True } },
            { "name": 'Fleet Management', "actions": { "view": True, "edit": True, "delete": True } },
            { "name": 'User Management', "actions": { "view": True, "edit": True, "delete": True } },
            { "name": 'System Logs', "actions": { "view": True, "edit": True, "delete": True } },
            { "name": 'Settings', "actions": { "view": True, "edit": True, "delete": True }, "subTabs": SUB_TABS['Settings'] },
            { "name": 'Tasks', "actions": { "view": True, "edit": True, "delete": True } },
        ],
        "dashboardCards": [c["id"] for c in DASHBOARD_CARDS],
        "features": [f["id"] for f in SYSTEM_FEATURES],
        "userCount": 1
    },
    {
        "name": 'Site Engineer',
        "description": 'Site operations and material tracking',
        "tags": ['site_engineer'],
        "permissions": [
            { "name": 'Dashboard', "actions": { "view": True, "edit": False, "delete": False } },
            { "name": 'Projects', "actions": { "view": True, "edit": True, "delete": False }, "subTabs": ['Overview', 'Tasks', 'DPR'] },
            { "name": 'HRMS', "actions": { "view": True, "edit": False, "delete": False }, "subTabs": ['Dashboard', 'Attendance', 'Leave Management'] },
            { "name": 'Inventory Management', "actions": { "view": True, "edit": True, "delete": False }, "subTabs": ['Materials', 'Warehouse'] },
            { "name": 'Procurement', "actions": { "view": True, "edit": True, "delete": False }, "subTabs": ['POs', 'Requests', 'GRN'] },
            { "name": 'Reports', "actions": { "view": True, "edit": False, "delete": False } },
            { "name": 'Team Chat', "actions": { "view": True, "edit": True, "delete": False } },
            { "name": 'Fleet Management', "actions": { "view": True, "edit": True, "delete": False } },
            { "name": 'Tasks', "actions": { "view": True, "edit": True, "delete": False } },
        ],
        "dashboardCards": ['quick_actions', 'active_projects_list', 'my_tasks'],
        "features": ['create_dpr', 'add_material_request', 'transfer_material', 'create_grn'],
        "userCount": 3
    },
    {
        "name": 'Project Coordinator',
        "description": 'Coordinate projects and track progress',
        "tags": ['project_coordinator'],
        "permissions": [
            { "name": 'Dashboard', "actions": { "view": True, "edit": False, "delete": False } },
            { "name": 'Projects', "actions": { "view": True, "edit": True, "delete": False } },
            { "name": 'HRMS', "actions": { "view": True, "edit": False, "delete": False } },
            { "name": 'Inventory Management', "actions": { "view": True, "edit": True, "delete": False } },
            { "name": 'Reports', "actions": { "view": True, "edit": False, "delete": False } },
            { "name": 'Team Chat', "actions": { "view": True, "edit": True, "delete": False } },
            { "name": 'Fleet Management', "actions": { "view": True, "edit": True, "delete": False } },
            { "name": 'Tasks', "actions": { "view": True, "edit": True, "delete": False } },
        ],
        "dashboardCards": ['overview_stats', 'active_projects_list', 'my_tasks', 'recent_activities'],
        "features": ['add_project', 'edit_project'],
        "userCount": 2
    },
    {
        "name": 'General Manager',
        "description": 'Oversees all operations',
        "tags": ['gm', 'management'],
        "permissions": [
            { "name": 'Dashboard', "actions": { "view": True, "edit": False, "delete": False } },
            { "name": 'Projects', "actions": { "view": True, "edit": True, "delete": False } },
            { "name": 'Accounts', "actions": { "view": True, "edit": True, "delete": False } },
            { "name": 'HRMS', "actions": { "view": True, "edit": True, "delete": False } },
            { "name": 'Inventory Management', "actions": { "view": True, "edit": True, "delete": False } },
            { "name": 'Procurement', "actions": { "view": True, "edit": True, "delete": False }, "subTabs": SUB_TABS['Procurement'] },
            { "name": 'Reports', "actions": { "view": True, "edit": True, "delete": False } },
        ],
        "dashboardCards": [c["id"] for c in DASHBOARD_CARDS],
        "features": [f["id"] for f in SYSTEM_FEATURES],
        "userCount": 1
    },
    {
        "name": 'Accountant',
        "description": 'Manage accounts and billing',
        "tags": ['accountant', 'accounts'],
        "permissions": [
            { "name": 'Dashboard', "actions": { "view": True, "edit": False, "delete": False } },
            { "name": 'Budget Control', "actions": { "view": True, "edit": True, "delete": False } },
            { "name": 'Accounts', "actions": { "view": True, "edit": True, "delete": False } },
            { "name": 'Reports', "actions": { "view": True, "edit": True, "delete": False } },
            { "name": 'Team Chat', "actions": { "view": True, "edit": True, "delete": False } },
            { "name": 'HRMS', "actions": { "view": True, "edit": False, "delete": False } },
        ],
        "dashboardCards": ['budget_overview', 'overview_stats'],
        "features": ['create_invoice'],
        "userCount": 2
    },
    {
        "name": 'Purchase Officer',
        "description": 'Handle incoming purchase requests',
        "tags": ['purchase', 'procurement'],
        "permissions": [
            { "name": 'Dashboard', "actions": { "view": True, "edit": False, "delete": False } },
            { "name": 'Projects', "actions": { "view": True, "edit": False, "delete": False } },
            { "name": 'Procurement', "actions": { "view": True, "edit": True, "delete": False }, "subTabs": SUB_TABS['Procurement'] },
            { "name": 'Inventory Management', "actions": { "view": True, "edit": True, "delete": False } },
            { "name": 'Team Chat', "actions": { "view": True, "edit": True, "delete": False } },
            { "name": 'HRMS', "actions": { "view": True, "edit": False, "delete": False } },
        ],
        "dashboardCards": ['inventory_card', 'approvals_card'],
        "features": ['create_po', 'approve_po', 'add_vendor', 'create_grn'],
        "userCount": 2
    },
    {
        "name": 'Inventory Manager',
        "description": 'Manage warehouse stock',
        "tags": ['inventory', 'store'],
        "permissions": [
            { "name": 'Dashboard', "actions": { "view": True, "edit": False, "delete": False } },
            { "name": 'Inventory Management', "actions": { "view": True, "edit": True, "delete": False } },
            { "name": 'Reports', "actions": { "view": True, "edit": False, "delete": False } },
            { "name": 'Team Chat', "actions": { "view": True, "edit": True, "delete": False } },
        ],
        "dashboardCards": ['inventory_card', 'recent_activities'],
        "features": ['create_grn', 'transfer_material'],
        "userCount": 2
    },
    {
        "name": 'HR Manager',
        "description": 'Employee, Leave and Payroll management',
        "tags": ['hr'],
        "permissions": [
            { "name": 'Dashboard', "actions": { "view": True, "edit": False, "delete": False } },
            { "name": 'HRMS', "actions": { "view": True, "edit": True, "delete": True } },
            { "name": 'Reports', "actions": { "view": True, "edit": False, "delete": False } },
            { "name": 'Team Chat', "actions": { "view": True, "edit": True, "delete": False } },
        ],
        "dashboardCards": ['overview_stats', 'recent_activities'],
        "features": ['add_employee', 'approve_leave', 'edit_attendance'],
        "userCount": 1
    },
    {
        "name": 'Project Manager',
        "description": 'Attendance and Leave approval',
        "tags": ['pm'],
        "permissions": [
            { "name": 'Dashboard', "actions": { "view": True, "edit": False, "delete": False } },
            { "name": 'Projects', "actions": { "view": True, "edit": True, "delete": False } },
            { "name": 'HRMS', "actions": { "view": True, "edit": True, "delete": False } },
            { "name": 'Procurement', "actions": { "view": True, "edit": True, "delete": False }, "subTabs": ['POs', 'Requests', 'GRN'] },
            { "name": 'Team Chat', "actions": { "view": True, "edit": True, "delete": False } },
            { "name": 'Tasks', "actions": { "view": True, "edit": True, "delete": False } },
        ],
        "dashboardCards": ['overview_stats', 'active_projects_list', 'approvals_card'],
        "features": ['add_project', 'edit_project', 'approve_leave'],
        "userCount": 2
    },
    {
        "name": 'Employee',
        "description": 'Apply for leaves and view profile',
        "tags": ['employee'],
        "permissions": [
            { "name": 'Dashboard', "actions": { "view": True, "edit": False, "delete": False } },
            { "name": 'HRMS', "actions": { "view": True, "edit": False, "delete": False } },
            { "name": 'Team Chat', "actions": { "view": True, "edit": True, "delete": False } },
        ],
        "dashboardCards": ['my_tasks'],
        "features": [],
        "userCount": 10
    }
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

# C4 Fix: Only admins can save roles
@router.post("/", dependencies=[Depends(RBACPermission("User Management", "edit"))])
async def save_roles(roles: List[Dict[str, Any]], db = Depends(get_database)):
    # Upsert the roles
    await db.roles.update_one(
        {"_id": "global_roles"},
        {"$set": {"roles": roles}},
        upsert=True
    )
    return {"message": "Roles saved successfully"}

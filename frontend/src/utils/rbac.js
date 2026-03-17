export const DASHBOARD_CARDS = [
    { id: 'overview_stats', label: 'Overall Statistics (Total Projects, Value, etc.)' },
    { id: 'quick_actions', label: 'Quick Actions Bar' },
    { id: 'active_projects_list', label: 'Active Projects List' },
    { id: 'budget_overview', label: 'Budget Overview Chart' },
    { id: 'recent_activities', label: 'Recent System Activities' },
    { id: 'my_tasks', label: 'My Tasks List' },
    { id: 'approvals_card', label: 'Pending Approvals Card' },
    { id: 'inventory_card', label: 'Inventory Overview Card' },
];

export const SYSTEM_FEATURES = [
    { id: 'add_project', label: 'Create New Project' },
    { id: 'edit_project', label: 'Edit Project Details' },
    { id: 'delete_project', label: 'Delete Project' },
    { id: 'create_dpr', label: 'Create Daily Progress Report (DPR)' },
    { id: 'add_material_request', label: 'Request New Material' },
    { id: 'transfer_material', label: 'Transfer Material between Sites' },
    { id: 'create_po', label: 'Create Purchase Order' },
    { id: 'approve_po', label: 'Approve Purchase Order' },
    { id: 'add_vendor', label: 'Add New Vendor' },
    { id: 'create_grn', label: 'Create GRN (Goods Received)' },
    { id: 'add_labour', label: 'Add Labour/Workers' },
    { id: 'edit_attendance', label: 'Modify Daily Attendance' },
    { id: 'approve_leave', label: 'Approve Leaves' },
    { id: 'add_employee', label: 'Add New Employee' },
    { id: 'create_invoice', label: 'Create Invoice/Bill' },
];

export const SUB_TABS = {
    'Projects': ['Overview', 'Tasks', 'DPR', 'Financials', 'Documents', 'Workflow Tracking'],
    'HRMS': ['Dashboard', 'Employee Master', 'Attendance', 'Leave Management', 'Payroll', 'Surprise Visits', 'Manpower Req'],
    'Accounts': ['Overview', 'Sales', 'PurchaseBills', 'Purchase', 'Payments', 'Ledger'],
    'Procurement': ['Vendors', 'POs', 'Requests', 'GRN'],
    'Inventory Management': ['Materials', 'Warehouse', 'Coordination', 'Machinery'],
    'Settings': ['Profile', 'Company Profile', 'Security', 'Notifications', 'Cloudinary', 'SMTP'],
    'Fleet Management': ['Dashboard', 'Trips', 'Vehicles', 'Maintenance', 'Reports'],
    'Site Reports': ['Site Reports (DPR)', 'Material Requests', 'Transfer Requests'],
    'User Management': ['Authorized Users', 'Roles & Permissions'],
    'Approvals': ['Leaves', 'Purchase Orders', 'Materials', 'Expenses', 'Manpower'],
    'Reports': ['Financial', 'Project', 'HRMS', 'Inventory', 'Plant']
};

export const DEFAULT_ROLES = [
    {
        name: 'Administrator',
        description: 'Full system access',
        tags: ['admin', 'System'],
        permissions: [
            { name: 'Dashboard', actions: { view: true, edit: true, delete: true } },
            { name: 'Projects', actions: { view: true, edit: true, delete: true }, subTabs: SUB_TABS['Projects'] },
            { name: 'Tasks', actions: { view: true, edit: true, delete: true } },
            { name: 'Accounts', actions: { view: true, edit: true, delete: true }, subTabs: SUB_TABS['Accounts'] },
            { name: 'Procurement', actions: { view: true, edit: true, delete: true }, subTabs: SUB_TABS['Procurement'] },
            { name: 'HRMS', actions: { view: true, edit: true, delete: true }, subTabs: SUB_TABS['HRMS'] },
            { name: 'Approvals', actions: { view: true, edit: true, delete: true }, subTabs: SUB_TABS['Approvals'] },
            { name: 'Inventory Management', actions: { view: true, edit: true, delete: true }, subTabs: SUB_TABS['Inventory Management'] },
            { name: 'Reports', actions: { view: true, edit: true, delete: true }, subTabs: SUB_TABS['Reports'] },
            { name: 'Team Chat', actions: { view: true, edit: true, delete: true } },
            { name: 'Fleet Management', actions: { view: true, edit: true, delete: true }, subTabs: SUB_TABS['Fleet Management'] },
            { name: 'User Management', actions: { view: true, edit: true, delete: true }, subTabs: SUB_TABS['User Management'] },
            { name: 'System Logs', actions: { view: true, edit: true, delete: true } },
            { name: 'Settings', actions: { view: true, edit: true, delete: true }, subTabs: SUB_TABS['Settings'] },
            { name: 'Site Reports', actions: { view: true, edit: true, delete: true }, subTabs: SUB_TABS['Site Reports'] },
        ],
        dashboardCards: DASHBOARD_CARDS.map(c => c.id),
        features: SYSTEM_FEATURES.map(f => f.id),
        userCount: 1
    },
    {
        name: 'Site Engineer',
        description: 'Site operations and material tracking',
        tags: ['site_engineer'],
        permissions: [
            { name: 'Dashboard', actions: { view: true, edit: false, delete: false } },
            { name: 'Projects', actions: { view: true, edit: true, delete: false }, subTabs: ['Overview', 'Tasks', 'DPR'] },
            { name: 'HRMS', actions: { view: true, edit: false, delete: false }, subTabs: ['Dashboard', 'Attendance', 'Leave Management'] },
            { name: 'Inventory Management', actions: { view: true, edit: true, delete: false }, subTabs: ['Materials', 'Warehouse'] },
            { name: 'Accounts', actions: { view: false, edit: false, delete: false } },
            { name: 'Procurement', actions: { view: true, edit: true, delete: false }, subTabs: ['POs', 'Requests', 'GRN'] },
            { name: 'Reports', actions: { view: true, edit: false, delete: false } },
            { name: 'Team Chat', actions: { view: true, edit: true, delete: false } },
            { name: 'Fleet Management', actions: { view: true, edit: true, delete: false } },
            { name: 'Tasks', actions: { view: true, edit: true, delete: false } },
            { name: 'User Management', actions: { view: false, edit: false, delete: false } },
            { name: 'System Logs', actions: { view: false, edit: false, delete: false } },
            { name: 'Settings', actions: { view: false, edit: false, delete: false } },
        ],
        dashboardCards: ['quick_actions', 'active_projects_list', 'my_tasks'],
        features: ['create_dpr', 'add_material_request', 'transfer_material', 'create_grn'],
        userCount: 3
    },
    {
        name: 'Project Coordinator',
        description: 'Coordinate projects and track progress',
        tags: ['project_coordinator'],
        permissions: [
            { name: 'Dashboard', actions: { view: true, edit: false, delete: false } },
            { name: 'Projects', actions: { view: true, edit: true, delete: false } },
            { name: 'HRMS', actions: { view: true, edit: false, delete: false } },
            { name: 'Inventory Management', actions: { view: true, edit: true, delete: false } },
            { name: 'Reports', actions: { view: true, edit: false, delete: false } },
            { name: 'Team Chat', actions: { view: true, edit: true, delete: false } },
            { name: 'Fleet Management', actions: { view: true, edit: true, delete: false } },
            { name: 'Site Reports', actions: { view: true, edit: true, delete: false } },
            { name: 'Approvals', actions: { view: true, edit: true, delete: false }, subTabs: ['Manpower'] },
        ],
        dashboardCards: ['overview_stats', 'active_projects_list', 'my_tasks', 'recent_activities'],
        features: ['add_project', 'edit_project'],
        userCount: 2
    },
    {
        name: 'Accountant',
        description: 'Manage accounts and billing',
        tags: ['accountant'],
        permissions: [
            { name: 'Dashboard', actions: { view: true, edit: false, delete: false } },
            { name: 'Accounts', actions: { view: true, edit: true, delete: false }, subTabs: SUB_TABS['Accounts'] },
            { name: 'Reports', actions: { view: true, edit: true, delete: false } },
            { name: 'Team Chat', actions: { view: true, edit: true, delete: false } },
            { name: 'HRMS', actions: { view: true, edit: false, delete: false }, subTabs: ['Dashboard', 'Payroll'] },
        ],
        dashboardCards: ['budget_overview', 'overview_stats'],
        features: ['create_invoice'],
        userCount: 2
    },
    {
        name: 'HR Manager',
        description: 'Employee, Leave and Payroll management',
        tags: ['hr'],
        permissions: [
            { name: 'Dashboard', actions: { view: true, edit: false, delete: false } },
            { name: 'HRMS', actions: { view: true, edit: true, delete: true }, subTabs: SUB_TABS['HRMS'] },
            { name: 'Reports', actions: { view: true, edit: false, delete: false } },
            { name: 'Team Chat', actions: { view: true, edit: true, delete: false } },
        ],
        dashboardCards: ['overview_stats', 'recent_activities'],
        features: ['add_employee', 'approve_leave', 'edit_attendance'],
        userCount: 1
    },
    {
        name: 'Project Manager',
        description: 'Attendance and Leave approval',
        tags: ['pm'],
        permissions: [
            { name: 'Dashboard', actions: { view: true, edit: false, delete: false } },
            { name: 'Projects', actions: { view: true, edit: true, delete: false }, subTabs: SUB_TABS['Projects'] },
            { name: 'Procurement', actions: { view: true, edit: true, delete: false }, subTabs: SUB_TABS['Procurement'] },
            { name: 'HRMS', actions: { view: true, edit: true, delete: false }, subTabs: SUB_TABS['HRMS'] },
            { name: 'Team Chat', actions: { view: true, edit: true, delete: false } },
        ],
        dashboardCards: ['overview_stats', 'active_projects_list', 'approvals_card'],
        features: ['add_project', 'edit_project', 'approve_leave'],
        userCount: 2
    },
    {
        name: 'Purchase Officer',
        description: 'Handle incoming purchase requests',
        tags: ['purchase', 'procurement'],
        permissions: [
            { name: 'Dashboard', actions: { view: true, edit: false, delete: false } },
            { name: 'Projects', actions: { view: true, edit: false, delete: false } },
            { name: 'Procurement', actions: { view: true, edit: true, delete: false }, subTabs: SUB_TABS['Procurement'] },
            { name: 'Inventory Management', actions: { view: true, edit: true, delete: false }, subTabs: SUB_TABS['Inventory Management'] },
            { name: 'Team Chat', actions: { view: true, edit: true, delete: false } },
            { name: 'HRMS', actions: { view: true, edit: false, delete: false } },
        ],
        dashboardCards: ['inventory_card', 'approvals_card'],
        features: ['create_po', 'approve_po', 'add_vendor', 'create_grn'],
        userCount: 2
    },
    {
        name: 'Employee',
        description: 'Apply for leaves and view profile',
        tags: ['employee'],
        permissions: [
            { name: 'Dashboard', actions: { view: true, edit: false, delete: false } },
            { name: 'HRMS', actions: { view: true, edit: false, delete: false } },
            { name: 'Team Chat', actions: { view: true, edit: true, delete: false } },
        ],
        dashboardCards: ['my_tasks'],
        features: [],
        userCount: 10
    }
];

export const getRoles = () => {
    try {
        const stored = localStorage.getItem('erp_roles');
        if (stored) return JSON.parse(stored);
    } catch (e) {
        console.error("Failed parsing erp_roles", e);
    }
    return DEFAULT_ROLES;
};

export const fetchAndSyncRoles = async () => {
    try {
        const baseUrl = '/api';
        const res = await fetch(`${baseUrl}/roles/`);
        if (res.ok) {
            const data = await res.json();
            localStorage.setItem('erp_roles', JSON.stringify(data));
            window.dispatchEvent(new Event('rolesUpdated'));
            return data;
        }
    } catch (err) {
        console.error("Failed to sync roles with backend:", err);
    }
    return null;
};

export const saveRoles = (roles) => {
    localStorage.setItem('erp_roles', JSON.stringify(roles));
    window.dispatchEvent(new Event('rolesUpdated'));
    // Fire and forget save to backend
    try {
        const baseUrl = '/api';
        fetch(`${baseUrl}/roles/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(roles)
        });
    } catch (err) { }
};

export const hasPermission = (user, moduleName, action = 'view') => {
    if (!user) return false;

    // Super Admin / Administrator explicitly overrides everything
    const roleNormalized = user.role?.trim();
    if (roleNormalized === 'Super Admin' || roleNormalized === 'Administrator') return true;

    const roles = getRoles();
    const roleObj = roles.find(r => r.name === user.role);

    // If exact role isn't found, try to check if user.role is a comma-separated list
    let matchedRole = roleObj;
    if (!matchedRole && typeof user.role === 'string') {
        const userRolesArr = user.role.split(',').map(s => s.trim());
        if (userRolesArr.includes('Super Admin') || userRolesArr.includes('Administrator')) return true;

        // Find first matching role
        for (let r of userRolesArr) {
            const found = roles.find(ro => ro.name === r);
            if (found) {
                matchedRole = found;
                break;
            }
        }
    }

    if (!matchedRole) return false;

    const perm = matchedRole.permissions?.find(p => p.name === moduleName);
    if (!perm) return false;

    return !!perm.actions[action];
};

const getMatchedRole = (user, roles) => {
    if (!user) return null;
    let roleObj = roles.find(r => r.name === user.role);
    if (!roleObj && typeof user.role === 'string') {
        const userRolesArr = user.role.split(',').map(s => s.trim());
        for (let r of userRolesArr) {
            const found = roles.find(ro => ro.name === r);
            if (found) {
                roleObj = found; break;
            }
        }
    }
    return roleObj;
};

export const hasDashboardCard = (user, cardId) => {
    if (!user) return false;
    const roles = getRoles();
    const matchedRole = getMatchedRole(user, roles);
    if (!matchedRole) {
        // Fallback for hardcoded Super Admin if role doesn't exist
        if (user.role === 'Super Admin' || user.role === 'Administrator') return true;
        return false;
    }
    // Default to true if dashboardCards array is missing (for legacy roles)
    if (!matchedRole.dashboardCards) return true;
    return matchedRole.dashboardCards.includes(cardId);
};

export const hasFeature = (user, featureId) => {
    if (!user) return false;
    const roles = getRoles();
    const matchedRole = getMatchedRole(user, roles);
    if (!matchedRole) {
        // Fallback for hardcoded Super Admin if role doesn't exist
        if (user.role === 'Super Admin' || user.role === 'Administrator') return true;
        return false;
    }
    // Default to true if features array is missing (for legacy roles), to avoid accidental lockout
    if (!matchedRole.features) return true;
    return matchedRole.features.includes(featureId);
};

export const hasSubTabAccess = (user, moduleName, subTabName) => {
    if (!user) return false;
    if (user.role === 'Super Admin' || user.role === 'Administrator') return true;

    const roles = getRoles();
    const matchedRole = getMatchedRole(user, roles);
    if (!matchedRole) return false;

    const perm = matchedRole.permissions?.find(p => p.name === moduleName);
    if (!perm) return false;

    // If subTabs is not defined, default to true if the user can view the module
    if (!perm.subTabs) return !!perm.actions?.view;

    return perm.subTabs.includes(subTabName);
};

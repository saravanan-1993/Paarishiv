// Centralized entity → route mapping for notification clicks.
// Used by Header.jsx (dropdown) and Notifications.jsx (page).

export const ENTITY_ROUTES = {
    project: (id) => id ? `/projects/${id}` : '/projects',
    po: (id) => id ? `/workflow?tab=POs&id=${id}` : `/workflow?tab=POs`,
    grn: (id) => id ? `/workflow?tab=GRN&id=${id}` : `/workflow?tab=GRN`,
    leave: (id) => id ? `/hr?tab=${encodeURIComponent('Leave Management')}&id=${id}` : `/hr?tab=${encodeURIComponent('Leave Management')}`,
    dpr: (id) => {
        if (typeof id === 'string' && id.includes(':')) {
            const parts = id.split(':');
            return parts.length === 2 ? `/projects/${parts[0]}` : '/site-reports';
        }
        return '/site-reports';
    },
    expense: (id) => id ? `/finance?tab=Payments&id=${id}` : `/finance?tab=Payments`,
    material_request: (id) => id ? `/materials?tab=Coordination&id=${id}` : `/materials?tab=Coordination`,
    manpower: (id) => id ? `/approvals?tab=Manpower&id=${id}` : `/approvals?tab=Manpower`,
    payroll: (id) => id ? `/hr?tab=Payroll&id=${id}` : `/hr?tab=Payroll`,
    bill: (id) => id ? `/finance?tab=Sales&id=${id}` : `/finance?tab=Sales`,
    vehicle: (id) => id ? `/fleet?tab=Vehicles&id=${id}` : `/fleet?tab=Vehicles`,
    task: (id) => id ? `/projects/${id}?tab=Tasks` : '/tasks',
};

export const getEntityRoute = (entityType, id) => {
    const fn = ENTITY_ROUTES[entityType];
    return fn ? fn(id) : null;
};

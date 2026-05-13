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
    labour_attendance: (id) => id ? `/hr?tab=Attendance&id=${id}` : `/hr?tab=Attendance`,
    labour_payment: (id) => id ? `/labour-wages?id=${id}` : `/labour-wages`,
    subcontractor_advance: (id) => id ? `/subcontractor-billing?tab=Advances&id=${id}` : `/subcontractor-billing?tab=Advances`,
    subcontractor_bill: (id) => id ? `/subcontractor-billing?tab=Bills&id=${id}` : `/subcontractor-billing?tab=Bills`,
    trip_request: (id) => id ? `/fleet?tab=${encodeURIComponent('Trip Requests')}&id=${id}` : `/fleet?tab=${encodeURIComponent('Trip Requests')}`,
    stock_return: (id) => id ? `/materials?tab=Warehouse&id=${id}` : `/materials?tab=Warehouse`,
    material_transfer: (id) => id ? `/materials?tab=Coordination&id=${id}` : `/materials?tab=Coordination`,
    maintenance: (id) => id ? `/fleet?tab=Maintenance&id=${id}` : `/fleet?tab=Maintenance`,
    employee: (id) => id ? `/hr?tab=${encodeURIComponent('Employee Master')}&id=${id}` : `/hr?tab=${encodeURIComponent('Employee Master')}`,
    payment_request: (id) => id ? `/finance?tab=Payments&id=${id}` : `/finance?tab=Payments`,
    receipt: (id) => id ? `/finance?tab=Sales&id=${id}` : `/finance?tab=Sales`,
    purchase_bill: (id) => id ? `/finance?tab=PurchaseBills&id=${id}` : `/finance?tab=PurchaseBills`,
    trip: (id) => id ? `/fleet?tab=Trips&id=${id}` : `/fleet?tab=Trips`,
    material: (id) => id ? `/materials?tab=Materials&id=${id}` : `/materials?tab=Materials`,
    attendance: (id) => id ? `/hr?tab=Attendance&id=${id}` : `/hr?tab=Attendance`,
};

export const getEntityRoute = (entityType, id) => {
    const fn = ENTITY_ROUTES[entityType];
    if (fn) return fn(id);
    // Fallback: unknown entity_type → safe default
    return '/notifications';
};

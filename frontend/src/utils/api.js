import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Attach Bearer token to every request
api.interceptors.request.use((config) => {
    const user = localStorage.getItem('erp_user');
    if (user) {
        const { token } = JSON.parse(user);
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
    }
    return config;
});

// Auto-logout if the backend returns 401 (expired / invalid token)
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            const url = error.config?.url || '';
            const isPublicEndpoint = url.includes('/settings/company') || url.includes('/auth/');
            const isOnLoginPage = window.location.pathname === '/login';
            // Don't auto-logout for public endpoints or on login page
            // Also skip if user just logged in (within last 5 seconds) to prevent race condition
            const loginTime = parseInt(localStorage.getItem('erp_login_time') || '0');
            const justLoggedIn = (Date.now() - loginTime) < 5000;
            if (!isPublicEndpoint && !isOnLoginPage && !justLoggedIn) {
                localStorage.removeItem('erp_user');
                localStorage.removeItem('erp_login_time');
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

// ── Auth ─────────────────────────────────────────────────────────────────────
export const authAPI = {
    login: (username, password) => {
        const form = new URLSearchParams();
        form.append('username', username);
        form.append('password', password);
        return api.post('/auth/login', form, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
    },
};

// ── Projects ──────────────────────────────────────────────────────────────────
export const projectAPI = {
    getAll: (params) => api.get('/projects/', { params }),
    getOne: (id) => api.get(`/projects/${id}`),
    getAllDPRs: () => api.get('/projects/all-dprs'),
    create: (data) => api.post('/projects/', data),
    update: (id, data) => api.put(`/projects/${id}`, data),
    updateStatus: (id, status) => api.put(`/projects/${id}/status`, { status }),
    delete: (id) => api.delete(`/projects/${id}`),
    addTask: (id, task) => api.post(`/projects/${id}/tasks`, task),
    updateTask: (projectId, taskId, data) => api.put(`/projects/${projectId}/tasks/${taskId}`, data),
    notifyTask: (projectId, taskId) => api.post(`/projects/${projectId}/tasks/${taskId}/notify`),
    shareTaskEmail: (projectId, taskId) => api.post(`/projects/${projectId}/tasks/${taskId}/share-email`),
    deleteTask: (projectId, taskId) => api.delete(`/projects/${projectId}/tasks/${taskId}`),
    addDpr: (id, dpr) => api.post(`/projects/${id}/dprs`, dpr),
    updateDprStatus: (projectId, dprId, status) => api.put(`/projects/${projectId}/dprs/${dprId}/status`, { status }),
    uploadPhoto: (formData) => api.post('/projects/upload-photo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
    addDocument: (id, doc) => api.post(`/projects/${id}/documents`, doc),
};

// ── Materials ─────────────────────────────────────────────────────────────────
export const materialAPI = {
    getAll: () => api.get('/materials/'),
    create: (data) => api.post('/materials/', data),
    getInventoryByProject: (projectName) => api.get(`/materials/project/${projectName}`),
    update: (id, data) => api.put(`/materials/${id}`, data),
    delete: (id) => api.delete(`/materials/${id}`),
    updateInventory: (inventoryId, data) => api.put(`/materials/inventory/${inventoryId}`, data),
    getInventoryLedger: (projectName, materialName) => api.get('/materials/inventory/ledger', {
        params: { project_name: projectName, material_name: materialName }
    }),
};

// ── Finance ───────────────────────────────────────────────────────────────────
export const financeAPI = {
    getExpenses: () => api.get('/finance/expenses'),
    createExpense: (data) => api.post('/finance/expenses', data),
    getIncome: () => api.get('/finance/income'),
    createIncome: (data) => api.post('/finance/income', data),
    getPayables: () => api.get('/finance/payables'),
    getVoucherPayments: (grnId) => api.get(`/finance/payables/${grnId}/payments`),
    getReceipts: () => api.get('/finance/receipts'),
    createReceipt: (data) => api.post('/finance/receipts', data),
    getProjectSummary: (projectName) => api.get(`/finance/project-summary/${encodeURIComponent(projectName)}`),
};

// ── Labour ────────────────────────────────────────────────────────────────────
export const labourAPI = {
    getAll: (params) => api.get('/labour/', { params }),
    getOne: (id) => api.get(`/labour/${id}`),
    create: (data) => api.post('/labour/', data),
    update: (id, data) => api.put(`/labour/${id}`, data),
    delete: (id) => api.delete(`/labour/${id}`),
};

// ── Vendors ───────────────────────────────────────────────────────────────────
export const vendorAPI = {
    getAll: () => api.get('/vendors/'),
    create: (data) => api.post('/vendors/', data),
    update: (id, data) => api.put(`/vendors/${id}`, data),
    delete: (id) => api.delete(`/vendors/${id}`),
    getLedger: (id) => api.get(`/vendors/${id}/ledger`),
};

// ── Purchase Orders ───────────────────────────────────────────────────────────
export const purchaseOrderAPI = {
    getAll: () => api.get('/purchase-orders/'),
    create: (data) => api.post('/purchase-orders/', data),
    update: (id, data) => api.put(`/purchase-orders/${id}/`, data),
    approve: (id) => api.put(`/purchase-orders/${id}/approve/`),
    sendEmail: (id) => api.post(`/purchase-orders/${id}/send-email/`),
};

// ── GRNs ──────────────────────────────────────────────────────────────────────
export const grnAPI = {
    getAll: () => api.get('/grns/'),
    create: (data) => api.post('/grns/', data),
    update: (id, data) => api.put(`/grns/${id}`, data),
    delete: (id) => api.delete(`/grns/${id}`),
};

// ── Client Billing ────────────────────────────────────────────────────────────
export const billingAPI = {
    getAll: () => api.get('/finance/bills'),
    create: (data) => api.post('/finance/bills', data),
    markPaid: (id, data) => api.put(`/finance/bills/${id}/mark-paid`, data),
    delete: (id) => api.delete(`/finance/bills/${id}`),
    getPurchaseBills: () => api.get('/finance/purchase-bills'),
    createPurchaseBill: (data) => api.post('/finance/purchase-bills', data),
    deletePurchaseBill: (id) => api.delete(`/finance/purchase-bills/${id}`),
};

// ── Employees ─────────────────────────────────────────────────────────────────
export const employeeAPI = {
    getAll: () => api.get('/employees/'),
    getOne: (id) => api.get(`/employees/${id}`),
    create: (data) => api.post('/employees/', data),
    update: (id, data) => api.put(`/employees/${id}`, data),
    delete: (id) => api.delete(`/employees/${id}`),
    uploadDocument: (id, formData, docType) => api.post(`/employees/${id}/documents?doc_type=${docType || 'general'}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
    getDocuments: (id) => api.get(`/employees/${id}/documents`),
};

// ── Chat ──────────────────────────────────────────────────────────────────────
export const chatAPI = {
    getUsers: () => api.get('/chat/users'),
    getUsersWithUnread: (currentUserId) => api.get(`/chat/users/${currentUserId}`),
    getHistory: (u1, u2) => api.get(`/chat/history/${u1}/${u2}`),
    getHistoryGroup: (groupId) => api.get(`/chat/history/group/${groupId}`),
    getGroups: (username) => api.get(`/chat/groups/${username}`),
    createGroup: (groupData) => api.post('/chat/groups', groupData),
    addGroupMembers: (groupId, members) => api.put(`/chat/groups/${groupId}/members`, { members }),
    getNotifications: (userId) => api.get(`/chat/notifications/${userId}`),
    markAsRead: (userId, senderId, groupId = null) =>
        api.post(`/chat/mark-read/${userId}/${senderId}${groupId ? `?group_id=${groupId}` : ''}`),
    uploadFile: (formData) => api.post('/chat/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
};

// ── Fleet Management ────────────────────────────────────────────────────────
export const fleetAPI = {
    getVehicles: () => api.get('/fleet/vehicles'),
    createVehicle: (data) => api.post('/fleet/vehicles', data),
    updateVehicle: (id, data) => api.put(`/fleet/vehicles/${id}`, data),
    deleteVehicle: (id) => api.delete(`/fleet/vehicles/${id}`),

    getTrips: () => api.get('/fleet/trips'),
    createTrip: (data) => api.post('/fleet/trips', data),
    updateTrip: (id, data) => api.put(`/fleet/trips/${id}`, data),
    deleteTrip: (id) => api.delete(`/fleet/trips/${id}`),

    getStats: () => api.get('/fleet/stats/summary'),

    getMaintenance: (vehicleId) => api.get(`/fleet/maintenance/${vehicleId}`),
    addMaintenance: (data) => api.post('/fleet/maintenance', data),

    // Equipment (Plant & Machinery)
    getEquipment: () => api.get('/fleet/equipment'),
    createEquipment: (data) => api.post('/fleet/equipment', data),
    updateEquipment: (id, data) => api.put(`/fleet/equipment/${id}`, data),
    deleteEquipment: (id) => api.delete(`/fleet/equipment/${id}`),

    // Fuel Operations
    getFuelStock: (projectName) => api.get('/fleet/fuel/stock', { params: { project_name: projectName } }),
    addFuelStock: (data) => api.post('/fleet/fuel/stock', data),
    getFuelLogs: (projectName) => api.get('/fleet/fuel/logs', { params: { project_name: projectName } }),
    addFuelLog: (data) => api.post('/fleet/fuel/logs', data),
    getFuelSummary: (projectName) => api.get('/fleet/fuel/summary', { params: { project_name: projectName } }),
};

// ── HRMS ──────────────────────────────────────────────────────────────────────
export const hrmsAPI = {
    getStats: () => api.get('/hrms/dashboard/stats'),
    getAttendance: (date) => api.get('/hrms/attendance', { params: { date } }),
    getAttendanceRange: (fromDate, toDate) => api.get('/hrms/attendance/range', { params: { from_date: fromDate, to_date: toDate } }),
    saveAttendance: (records) => api.post('/hrms/attendance', records),
    getLeaves: () => api.get('/hrms/leaves'),
    applyLeave: (data) => api.post('/hrms/leaves', data),
    updateLeave: (id, data) => api.put(`/hrms/leaves/${id}`, data),
    getPayroll: (month) => api.get('/hrms/payroll', { params: { month } }),
    generatePayroll: (month) => api.post('/hrms/payroll/generate', null, { params: { month } }),
    getSettings: () => api.get('/hrms/settings'),
    updateSettings: (data) => api.post('/hrms/settings', data),
    getDesignations: () => api.get('/hrms/designations'),
    addDesignation: (value) => api.post('/hrms/designations', { value }),
    getDepartments: () => api.get('/hrms/departments'),
    addDepartment: (value) => api.post('/hrms/departments', { value })
};

// ── Surprise Visit Attendance ────────────────────────────────────────────────
export const surpriseVisitAPI = {
    getAll: (params) => api.get('/surprise-attendance/', { params }),
    create: (formData) => api.post('/surprise-attendance/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
};

// ── Inventory & Warehouse ──────────────────────────────────────────────────
export const inventoryAPI = {
    getWarehouseStock: () => api.get('/inventory/warehouse'),
    getWarehouse: () => api.get('/inventory/warehouse'),
    getRequests: (params) => api.get('/inventory/requests', { params }),
    createRequest: (data) => api.post('/inventory/requests', data),
    deleteRequest: (id) => api.delete(`/inventory/requests/${id}`),
    issueStock: (requestId, data) => api.post(`/inventory/requests/${requestId}/issue`, data),
    updateRequestStatus: (requestId, data) => api.put(`/inventory/requests/${requestId}/status`, data),
    returnStock: (data) => api.post('/inventory/return', data),
    getLedger: (params) => api.get('/inventory/ledger', { params }),
    transferMaterials: (data) => api.post('/inventory/transfer', data),
    requestTransfer: (data) => api.post('/inventory/transfers/request', data),
    getPendingTransfers: () => api.get('/inventory/transfers/pending'),
    approveTransfer: (id) => api.put(`/inventory/transfers/${id}/approve`),
    rejectTransfer: (id) => api.put(`/inventory/transfers/${id}/reject`),
    getConsolidated: () => api.get('/inventory/consolidated'),
    consolidateRequests: (data) => api.post('/inventory/requests/consolidate', data),
    // Warehouse-aware PO flow
    checkWarehouseAvailability: (data) => api.post('/inventory/warehouse/check-availability', data),
    bulkWarehouseIssue: (data) => api.post('/inventory/warehouse/bulk-issue', data),
    getMaterialWiseReport: () => api.get('/inventory/report/material-wise'),
};

// ── Attendance ────────────────────────────────────────────────────────────────
export const attendanceAPI = {
    getSummary: () => api.get('/attendance/me/summary'),
    clockIn: (data) => api.post('/attendance/clock-in', data),
    clockOut: () => api.post('/attendance/clock-out'),
    startBreak: (data) => api.post('/attendance/start-break', data),
    endBreak: () => api.post('/attendance/end-break'),
};

// ── Approvals ─────────────────────────────────────────────────────────────────
export const approvalsAPI = {
    getAll: (status) => api.get('/approvals/', { params: { status } }),
    getPending: () => api.get('/approvals/pending'),
    action: (type, id, action, payload = {}) => api.put(`/approvals/${type}/${id}/${action}`, payload),
};

export const rolesAPI = {
    getRoles: () => api.get('/roles/'),
    saveRoles: (roles) => api.post('/roles/', roles)
};

export const workflowAPI = {
    getTimeline: (projectId) => api.get(`/workflow/${projectId}/timeline`),
    getActivityLog: (projectId) => api.get(`/workflow/${projectId}/activity-log`),
    getDashboardOverview: () => api.get('/workflow/dashboard-overview'),
};

export const settingsAPI = {
    getCompany: () => api.get('/settings/company'),
    updateCompany: (data) => api.post('/settings/company', data),
    getCloudinary: () => api.get('/settings/cloudinary'),
    updateCloudinary: (data) => api.post('/settings/cloudinary', data),
    getSMTP: () => api.get('/settings/smtp'),
    updateSMTP: (data) => api.post('/settings/smtp', data),
    testSMTP: (data) => api.post('/settings/smtp/test', data),
    uploadLogo: (formData) => api.post('/settings/logo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
    changePassword: (data) => api.post('/settings/password', data),
};

export const profileAPI = {
    getProfile: () => api.get('/settings/profile'),
    updateProfile: (data) => api.post('/settings/profile', data),
    uploadAvatar: (formData) => api.post('/settings/profile/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
};

export const logsAPI = {
    getLogs: (limit = 100) => api.get(`/logs/?limit=${limit}`),
    clearLogs: () => api.delete('/logs/clear'),
};

// ── Quotations ────────────────────────────────────────────────────────────────
export const quotationAPI = {
    getAll: () => api.get('/quotations/'),
    getOne: (id) => api.get(`/quotations/${id}`),
    create: (data) => api.post('/quotations/', data),
    update: (id, data) => api.put(`/quotations/${id}`, data),
    delete: (id) => api.delete(`/quotations/${id}`),
    // Multipart: { email, pdf_file? } → attaches PDF when provided
    sendEmail: (id, formData) => api.post(`/quotations/${id}/send-email`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
    // Multipart: { pdf_file } → uploads to Cloudinary, returns shareable URL for WhatsApp
    uploadPDF: (id, formData) => api.post(`/quotations/${id}/upload-pdf`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
};

// ── Labour Attendance ─────────────────────────────────────────────────────────
export const labourAttendanceAPI = {
    getAll: (params) => api.get('/labour-attendance/', { params }),
    getOne: (id) => api.get(`/labour-attendance/${id}`),
    create: (data) => api.post('/labour-attendance/', data),
    update: (id, data) => api.put(`/labour-attendance/${id}`, data),
    delete: (id) => api.delete(`/labour-attendance/${id}`),
    getProjectSummary: (projectName) => api.get('/labour-attendance/project-summary', { params: { project_name: projectName } }),
    getWagesSummary: (params) => api.get('/labour-attendance/wages-summary', { params }),
    getSalaryPayments: (params) => api.get('/labour-attendance/salary-payments', { params }),
    processSalary: (data) => api.post('/labour-attendance/process-salary', data),
};

// ── Notifications ────────────────────────────────────────────────────────────
export const notificationAPI = {
    getAll: (params) => api.get('/notifications/', { params }),
    getUnreadCount: () => api.get('/notifications/unread-count'),
    markAsRead: (id) => api.put(`/notifications/${id}/read`),
    markAllAsRead: () => api.put('/notifications/read-all'),
    delete: (id) => api.delete(`/notifications/${id}`),
};

export default api;

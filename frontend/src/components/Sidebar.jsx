import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { hasPermission, hasSubTabAccess } from '../utils/rbac';
import { chatAPI, approvalsAPI, projectAPI, settingsAPI, notificationAPI } from '../utils/api';
import {
    LayoutDashboard,
    Briefcase,
    Wallet,
    HardHat,
    Users,
    Package,
    FileText,
    History,
    Settings,
    ChevronLeft,
    ChevronRight,
    LogOut,
    Truck,
    PieChart,
    TrendingUp,
    MessageSquare,
    CheckCircle2,
    ListTodo,
    LayoutList,
    ChevronDown,
    BellRing
} from 'lucide-react';

const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    {
        icon: Briefcase,
        label: 'Projects',
        path: '/projects'
    },
    { icon: ListTodo, label: 'Tasks', path: '/tasks' },
    {
        icon: Wallet,
        label: 'Accounts',
        path: '/finance',
        subItems: [
            { label: 'Overview', tabId: 'Overview' },
            { label: 'Sales', tabId: 'Sales' },
            { label: 'Purchase Bills', tabId: 'PurchaseBills' },
            { label: 'Purchase', tabId: 'Purchase' },
            { label: 'Payments', tabId: 'Payments' },
            { label: 'Ledger', tabId: 'Ledger' },
            { label: 'Quotation', tabId: 'Quotations', path: '/quotations' },
            { label: 'Labour Wages', tabId: 'LabourWages', path: '/labour-wages' },
        ]
    },
    {
        icon: HardHat,
        label: 'Procurement',
        path: '/workflow',
        subItems: [
            { label: 'Vendors', tabId: 'Vendors' },
            { label: 'POs', tabId: 'POs' },
            { label: 'Requests', tabId: 'Requests' },
            { label: 'GRN', tabId: 'GRN' },
        ]
    },
    {
        icon: Users,
        label: 'HRMS',
        path: '/hr',
        subItems: [
            { label: 'Dashboard', tabId: 'Dashboard' },
            { label: 'Employee Master', tabId: 'Employee Master' },
            { label: 'Attendance', tabId: 'Attendance' },
            { label: 'Leave Management', tabId: 'Leave Management' },
            { label: 'Payroll', tabId: 'Payroll' },
            { label: 'Surprise Visits', tabId: 'Surprise Visits' },
            { label: 'Workforce', tabId: 'Workforce' },
            { label: 'Authorized Users', tabId: 'Authorized Users' },
            { label: 'Roles & Permissions', tabId: 'Roles & Permissions' },
        ]
    },
    {
        icon: Package,
        label: 'Inventory Management',
        path: '/materials',
        subItems: [
            { label: 'Materials', tabId: 'Materials' },
            { label: 'Warehouse', tabId: 'Warehouse' },
            { label: 'Coordination', tabId: 'Coordination' },
            { label: 'Machinery', tabId: 'Machinery' },
        ]
    },
    {
        icon: Truck,
        label: 'Fleet Management',
        path: '/fleet',
        subItems: [
            { label: 'Dashboard', tabId: 'Dashboard' },
            { label: 'Trips', tabId: 'Trips' },
            { label: 'Vehicles', tabId: 'Vehicles' },
            { label: 'Maintenance', tabId: 'Maintenance' },
            { label: 'Reports', tabId: 'Reports' },
        ]
    },
    {
        icon: FileText,
        label: 'Reports',
        path: '/reports',
        subItems: [
            { label: 'Financial', tabId: 'Financial' },
            { label: 'Project', tabId: 'Project' },
            { label: 'HRMS', tabId: 'HRMS' },
            { label: 'Inventory', tabId: 'Inventory' },
            { label: 'Plant', tabId: 'Plant' },
        ]
    },
    {
        icon: LayoutList,
        label: 'Site Reports',
        path: '/site-reports',
        subItems: [
            { label: 'Site Reports (DPR)', tabId: 'Site Reports (DPR)' },
            { label: 'Material Requests', tabId: 'Material Requests' },
            { label: 'Transfer Requests', tabId: 'Transfer Requests' },
        ]
    },
    { icon: BellRing, label: 'Notifications', path: '/notifications', alwaysShow: true },
    { icon: MessageSquare, label: 'Team Chat', path: '/chat' },
    {
        icon: CheckCircle2,
        label: 'Approvals',
        path: '/approvals',
        adminOnly: true,
        subItems: [
            { label: 'Leaves', tabId: 'Leaves' },
            { label: 'Purchase Orders', tabId: 'Purchase Orders' },
            { label: 'Materials', tabId: 'Materials' },
            { label: 'Expenses', tabId: 'Expenses' },
            { label: 'Manpower', tabId: 'Manpower' },
        ]
    },
    { icon: History, label: 'System Logs', path: '/logs', adminOnly: true },
    {
        icon: Settings,
        label: 'Settings',
        path: '/settings',
        subItems: [
            { label: 'Profile', tabId: 'Profile' },
            { label: 'Company Profile', tabId: 'Company Profile' },
            { label: 'Security', tabId: 'Security' },
            { label: 'Cloudinary', tabId: 'Cloudinary' },
            { label: 'SMTP', tabId: 'SMTP' },
        ]
    },
];

const Sidebar = ({ activeTab, setActiveTab, isOpen, setIsOpen }) => {
    const [collapsed, setCollapsed] = useState(false);
    const [expandedMenus, setExpandedMenus] = useState({ 'Procurement': true });
    const [unreadCount, setUnreadCount] = useState(0);
    const [notifUnreadCount, setNotifUnreadCount] = useState(0);
    const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
    const [pendingTasksCount, setPendingTasksCount] = useState(0);
    const [rolesVersion, setRolesVersion] = useState(0);
    const [companyInfo, setCompanyInfo] = useState({
        companyName: 'CIVIL ERP',
        logo: ''
    });
    const navigate = useNavigate();
    const { user, logout } = useAuth();

    React.useEffect(() => {
        const handleRolesUpdate = () => setRolesVersion(v => v + 1);
        const handleStorage = (e) => { if (e.key === 'erp_roles') setRolesVersion(v => v + 1); };

        window.addEventListener('rolesUpdated', handleRolesUpdate);
        window.addEventListener('storage', handleStorage);

        const fetchCompany = async () => {
            try {
                const res = await settingsAPI.getCompany();
                if (res.data) setCompanyInfo(res.data);
            } catch (err) {
                console.error("Failed to fetch company info:", err);
            }
        };
        fetchCompany();
        window.addEventListener('companyInfoUpdated', fetchCompany);

        return () => {
            window.removeEventListener('rolesUpdated', handleRolesUpdate);
            window.removeEventListener('storage', handleStorage);
            window.removeEventListener('companyInfoUpdated', fetchCompany);
        };
    }, []);

    React.useEffect(() => {
        if (!user) return;
        const fetchUnread = async () => {
            try {
                const res = await chatAPI.getNotifications(user.username);
                setUnreadCount(res.data.unread_count);
            } catch (err) {
                console.error('Failed to fetch unread count', err);
            }
        };

        const fetchApprovals = async () => {
            if (hasPermission(user, 'Approvals', 'view')) {
                try {
                    const res = await approvalsAPI.getPending();
                    let count = 0;
                    if (res.data) {
                        count += (res.data.leaves?.length || 0);
                        count += (res.data.purchase_orders?.length || 0);
                        count += (res.data.materials?.length || 0);
                        count += (res.data.expenses?.length || 0);
                        count += (res.data.manpower?.length || 0);
                    }
                    setPendingApprovalsCount(count);
                } catch (err) {
                    console.error('Failed to fetch approvals count', err);
                }
            }
        };

        const fetchTasks = async () => {
            try {
                const res = await projectAPI.getAll();
                const projects = res.data || [];
                let count = 0;
                const isEngineer = user.role === 'Site Engineer';

                projects.forEach(project => {
                    const projectTasks = project.tasks || [];
                    projectTasks.forEach(t => {
                        if (t.status === 'Pending') {
                            // Site engineers only see tasks assigned to them, or if no one is assigned but it's their project
                            if (isEngineer && t.assignedTo !== user.username && project.engineer_id !== user.username) {
                                return;
                            }
                            count++;
                        }
                    });
                });
                setPendingTasksCount(count);
            } catch (err) {
                console.error('Failed to fetch tasks count', err);
            }
        };

        const fetchNotifCount = async () => {
            try {
                const res = await notificationAPI.getUnreadCount();
                setNotifUnreadCount(res.data.unread_count || 0);
            } catch (err) {}
        };

        fetchUnread();
        fetchApprovals();
        fetchTasks();
        fetchNotifCount();
        const interval = setInterval(() => {
            fetchUnread();
            fetchApprovals();
            fetchTasks();
            fetchNotifCount();
        }, 15000);
        return () => clearInterval(interval);
    }, [user]);

    const handleNavigation = (path) => {
        setActiveTab(path);
        navigate(path);
    };

    const filteredItems = menuItems.filter(item => {
        if (item.alwaysShow) return true;
        return hasPermission(user, item.label, 'view');
    }).map(item => {
        if (item.subItems) {
            const nested = item.subItems.filter(sub => {
                // In RBAC, Procurement subtabs are 'Vendors', 'POs', 'Requests', 'GRN'
                return hasSubTabAccess(user, item.label, sub.tabId);
            });
            return { ...item, subItems: nested };
        }
        return item;
    }).filter(item => {
        // Hide parent menu items that have subItems defined but all are filtered out
        if (item.subItems && item.subItems.length === 0) return false;
        return true;
    });

    const toggleMenu = (e, label) => {
        e.stopPropagation();
        setExpandedMenus(prev => ({
            ...prev,
            [label]: !prev[label]
        }));
    };

    return (
        <>
            {/* Mobile Overlay */}
            {isOpen && (
                <div
                    onClick={() => setIsOpen(false)}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        zIndex: 95,
                        display: 'none' // Controlled by CSS media query
                    }}
                    className="sidebar-overlay"
                />
            )}

            <div className={`sidebar ${collapsed ? 'collapsed' : ''} ${isOpen ? 'mobile-open' : ''}`} style={{
                width: collapsed ? '80px' : 'var(--sidebar-width)',
                height: '100vh',
                backgroundColor: 'var(--sidebar-bg)',
                borderRight: 'none',
                boxShadow: '4px 0 10px rgba(0, 0, 0, 0.05)',
                position: 'fixed',
                left: 0,
                top: 0,
                zIndex: 100,
                transition: 'var(--transition)',
                display: 'flex',
                flexDirection: 'column'
            }}>
                <div className="sidebar-header" style={{
                    padding: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: collapsed ? 'center' : 'space-between',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    height: 'var(--header-height)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                        <div style={{
                            width: collapsed ? '32px' : '48px',
                            height: collapsed ? '32px' : '48px',
                            backgroundColor: 'white',
                            borderRadius: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--primary)',
                            fontWeight: 'bold',
                            overflow: 'hidden',
                            transition: 'all 0.3s ease',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                        }}>
                            {companyInfo.logo ? (
                                <img
                                    src={companyInfo.logo.startsWith('http') || companyInfo.logo.startsWith('/static') || companyInfo.logo.startsWith('/api') ? companyInfo.logo : `/api${companyInfo.logo}`}
                                    alt="Logo"
                                    style={{ width: '85%', height: '85%', objectFit: 'contain' }}
                                />
                            ) : (
                                companyInfo.companyName ? companyInfo.companyName[0].toUpperCase() : 'C'
                            )}
                        </div>
                    </div>
                    <button
                        onClick={() => setCollapsed(!collapsed)}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--sidebar-text)',
                            padding: '4px'
                        }}
                    >
                        {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
                    </button>
                </div>

                <div className="sidebar-menu" style={{
                    flex: 1,
                    padding: '16px 12px',
                    overflowY: 'auto',
                    overflowX: 'hidden'
                }}>
                    {filteredItems.map((item, index) => (
                        <React.Fragment key={index}>
                            <div
                                onClick={() => {
                                    if (item.subItems && item.subItems.length > 0 && !collapsed) {
                                        setExpandedMenus(prev => ({ ...prev, [item.label]: !prev[item.label] }));
                                    } else {
                                        handleNavigation(item.path);
                                    }
                                }}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    padding: '12px 16px',
                                    borderRadius: 'var(--radius-md)',
                                    cursor: 'pointer',
                                    marginBottom: '4px',
                                    transition: 'var(--transition)',
                                    backgroundColor: activeTab === item.path ? 'var(--primary)' : 'transparent',
                                    color: activeTab === item.path ? '#FFFFFF' : 'var(--sidebar-text)',
                                    justifyContent: collapsed ? 'center' : 'flex-start',
                                    position: 'relative',
                                    borderLeft: activeTab === item.path ? '4px solid #FFFFFF' : '4px solid transparent'
                                }}
                                className="menu-item"
                            >
                                <item.icon size={20} style={{ minWidth: '20px' }} />
                                {!collapsed && (
                                    <>
                                        <span style={{ fontSize: '14px', fontWeight: activeTab === item.path ? '600' : '500', flex: 1 }}>
                                            {item.label}
                                        </span>
                                        {item.subItems && item.subItems.length > 0 && (
                                            <ChevronDown
                                                size={16}
                                                style={{
                                                    transform: expandedMenus[item.label] ? 'rotate(180deg)' : 'rotate(0deg)',
                                                    transition: '0.3s ease'
                                                }}
                                            />
                                        )}
                                    </>
                                )}
                                {item.label === 'Notifications' && notifUnreadCount > 0 && (
                                    <div style={{
                                        backgroundColor: '#EF4444',
                                        color: 'white',
                                        borderRadius: '50%',
                                        minWidth: '18px',
                                        height: '18px',
                                        fontSize: '10px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontWeight: '700',
                                        position: collapsed ? 'absolute' : 'static',
                                        top: collapsed ? '4px' : 'auto',
                                        right: collapsed ? '4px' : 'auto',
                                        boxShadow: '0 2px 4px rgba(239, 68, 68, 0.3)'
                                    }}>
                                        {notifUnreadCount > 9 ? '9+' : notifUnreadCount}
                                    </div>
                                )}
                                {item.label === 'Team Chat' && unreadCount > 0 && (
                                    <div style={{
                                        backgroundColor: '#EF4444',
                                        color: 'white',
                                        borderRadius: '50%',
                                        minWidth: '18px',
                                        height: '18px',
                                        fontSize: '10px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontWeight: '700',
                                        position: collapsed ? 'absolute' : 'static',
                                        top: collapsed ? '4px' : 'auto',
                                        right: collapsed ? '4px' : 'auto',
                                        boxShadow: '0 2px 4px rgba(239, 68, 68, 0.3)'
                                    }}>
                                        {unreadCount > 9 ? '9+' : unreadCount}
                                    </div>
                                )}
                                {item.label === 'Approvals' && pendingApprovalsCount > 0 && (
                                    <div style={{
                                        backgroundColor: '#F59E0B',
                                        color: 'white',
                                        borderRadius: '12px',
                                        padding: '0 6px',
                                        minWidth: '18px',
                                        height: '18px',
                                        fontSize: '10px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontWeight: '700',
                                        position: collapsed ? 'absolute' : 'static',
                                        top: collapsed ? '4px' : 'auto',
                                        right: collapsed ? '4px' : 'auto',
                                        boxShadow: '0 2px 4px rgba(245, 158, 11, 0.3)'
                                    }}>
                                        {pendingApprovalsCount > 99 ? '99+' : pendingApprovalsCount}
                                    </div>
                                )}
                                {item.label === 'Tasks' && pendingTasksCount > 0 && (
                                    <div style={{
                                        backgroundColor: '#3B82F6',
                                        color: 'white',
                                        borderRadius: '50%',
                                        minWidth: '18px',
                                        height: '18px',
                                        fontSize: '10px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontWeight: '700',
                                        position: collapsed ? 'absolute' : 'static',
                                        top: collapsed ? '4px' : 'auto',
                                        right: collapsed ? '4px' : 'auto',
                                        boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)'
                                    }}>
                                        {pendingTasksCount > 9 ? '9+' : pendingTasksCount}
                                    </div>
                                )}
                            </div>

                            {/* Sub Items */}
                            {!collapsed && expandedMenus[item.label] && item.subItems && item.subItems.length > 0 && (
                                <div style={{ marginBottom: '8px' }}>
                                    {item.subItems.map((sub, sIdx) => {
                                        const subPath = sub.path || `${item.path}?tab=${sub.tabId}`;
                                        const isSubActive = sub.path
                                            ? window.location.pathname === sub.path
                                            : (window.location.pathname === item.path && window.location.search.includes(`tab=${sub.tabId}`));

                                        return (
                                            <div
                                                key={sIdx}
                                                onClick={() => handleNavigation(subPath)}
                                                style={{
                                                    padding: '10px 16px 10px 48px',
                                                    fontSize: '13px',
                                                    fontWeight: isSubActive ? '700' : '500',
                                                    color: isSubActive ? 'white' : 'var(--sidebar-text)',
                                                    backgroundColor: isSubActive ? 'rgba(255,255,255,0.1)' : 'transparent',
                                                    cursor: 'pointer',
                                                    borderRadius: '8px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '10px',
                                                    margin: '2px 0'
                                                }}
                                                className="sub-item"
                                            >
                                                <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: isSubActive ? 'white' : 'rgba(255,255,255,0.3)' }} />
                                                {sub.label}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </React.Fragment>
                    ))}
                </div>

                <div className="sidebar-footer" style={{
                    padding: '16px 12px',
                    borderTop: '1px solid rgba(255,255,255,0.05)'
                }}>
                    <div
                        onClick={logout}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '12px 16px',
                            borderRadius: 'var(--radius-md)',
                            cursor: 'pointer',
                            color: '#EF4444',
                            justifyContent: collapsed ? 'center' : 'flex-start'
                        }}
                    >
                        <LogOut size={20} />
                        {!collapsed && <span style={{ fontSize: '14px', fontWeight: '500' }}>Logout</span>}
                    </div>
                </div>

                <style>{`
        .menu-item:hover {
          background-color: rgba(255, 255, 255, 0.1) !important;
          color: #FFFFFF !important;
        }
        .sub-item:hover {
          background-color: rgba(255, 255, 255, 0.08) !important;
          color: white !important;
        }
      `}</style>
            </div>
        </>
    );
};

export default Sidebar;

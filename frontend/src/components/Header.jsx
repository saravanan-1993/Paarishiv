import React, { useState, useRef, useEffect } from 'react';
import {
    Bell, User, CheckCircle2, AlertCircle,
    Info, Package, Clock, Menu, X, LogOut, Settings, ChevronDown,
    Wallet, Users, Truck, Briefcase, ArrowRight, ShieldCheck, FileText
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';

const EVENT_ICON_MAP = {
    approval: ShieldCheck,
    workflow: ArrowRight,
    material: Package,
    finance: Wallet,
    hr: Users,
    task: CheckCircle2,
    fleet: Truck,
    project: Briefcase,
    system: Bell,
};

const EVENT_COLOR_MAP = {
    approval: { bg: '#FEF3C7', color: '#F59E0B' },
    workflow: { bg: '#DBEAFE', color: '#3B82F6' },
    material: { bg: '#D1FAE5', color: '#10B981' },
    finance: { bg: '#EDE9FE', color: '#8B5CF6' },
    hr: { bg: '#FCE7F3', color: '#EC4899' },
    task: { bg: '#FEE2E2', color: '#EF4444' },
    fleet: { bg: '#F3F4F6', color: '#6B7280' },
    project: { bg: '#E0F2FE', color: '#0EA5E9' },
    system: { bg: '#F3F4F6', color: '#6B7280' },
};

const ENTITY_ROUTES = {
    project: (id) => `/projects/${id}`,
    po: () => `/workflow?tab=POs`,
    grn: () => `/workflow?tab=GRN`,
    leave: () => `/hr?tab=Leave+Management`,
    dpr: (id) => { const p = id?.split(':'); return p?.length === 2 ? `/projects/${p[0]}` : '/site-reports'; },
    expense: () => `/finance?tab=Payments`,
    material_request: () => `/materials?tab=Coordination`,
    manpower: () => `/approvals`,
    payroll: () => `/hr?tab=Payroll`,
    bill: () => `/finance?tab=Sales`,
    vehicle: () => `/fleet?tab=Vehicles`,
    task: (id) => id ? `/projects/${id}` : '/tasks',
};

const formatTime = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const diff = (now - d) / 1000;
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 172800) return 'Yesterday';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

const Header = ({ setIsSidebarOpen, isSidebarOpen }) => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const { notifications, unreadCount, markAllAsRead, markOneAsRead } = useNotifications();
    const [notifOpen, setNotifOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const [companyLogo, setCompanyLogo] = useState('');
    const notifRef = useRef(null);
    const profileRef = useRef(null);

    // Bug 11.2 - Fetch company logo
    useEffect(() => {
        const fetchLogo = async () => {
            try {
                const { settingsAPI } = await import('../utils/api');
                const res = await settingsAPI.getCompany();
                if (res.data?.logo) setCompanyLogo(res.data.logo);
            } catch (e) {}
        };
        fetchLogo();
        const handler = () => fetchLogo();
        window.addEventListener('companyInfoUpdated', handler);
        return () => window.removeEventListener('companyInfoUpdated', handler);
    }, []);

    // Close panel when clicking outside
    useEffect(() => {
        const handler = (e) => {
            if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
            if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleNotifClick = (n) => {
        if (!n.is_read) markOneAsRead(n._id);
        const routeFn = ENTITY_ROUTES[n.entity_type];
        if (routeFn) {
            navigate(routeFn(n.entity_id));
            setNotifOpen(false);
        }
    };

    return (
        <header style={{
            height: 'var(--header-height, 70px)',
            backgroundColor: 'white',
            borderBottom: '1px solid var(--border)',
            position: 'fixed',
            top: 0,
            right: 0,
            left: 0,
            zIndex: 90,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
            transition: 'all 0.3s ease',
            marginLeft: 'var(--sidebar-width, 260px)'
        }} className="app-header">
            <div className="header-left" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <button
                    className="menu-toggle"
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    style={{ background: 'none', border: 'none', padding: '8px', color: 'var(--text-main)', cursor: 'pointer', display: 'none' }}
                >
                    {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
                {companyLogo && (
                    <img
                        src={companyLogo.startsWith('http') || companyLogo.startsWith('/static') ? companyLogo : `/api${companyLogo}`}
                        alt="Logo"
                        style={{ height: '36px', objectFit: 'contain', borderRadius: '6px' }}
                    />
                )}
            </div>

            <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button className="icon-btn" title="Help Guide" onClick={() => navigate('/settings?tab=Profile')} style={{ background: 'none', border: 'none', padding: '8px', color: 'var(--text-muted)', cursor: 'pointer' }}>
                        <Info size={20} />
                    </button>

                    <div style={{ position: 'relative' }} ref={notifRef}>
                        <button
                            className="icon-btn"
                            onClick={() => setNotifOpen(!notifOpen)}
                            style={{ position: 'relative', background: 'none', border: 'none', padding: '8px', color: 'var(--text-muted)', cursor: 'pointer' }}
                        >
                            <Bell size={20} />
                            {unreadCount > 0 && (
                                <span style={{
                                    position: 'absolute', top: '2px', right: '2px',
                                    minWidth: '18px', height: '18px', padding: '0 4px',
                                    backgroundColor: '#EF4444', color: 'white',
                                    fontSize: '10px', fontWeight: '800',
                                    borderRadius: '9px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    border: '2px solid white'
                                }}>
                                    {unreadCount > 99 ? '99+' : unreadCount}
                                </span>
                            )}
                        </button>

                        {/* Notifications Dropdown */}
                        {notifOpen && (
                            <div style={{
                                position: 'absolute', top: 'calc(100% + 10px)', right: '-10px',
                                width: '380px', backgroundColor: 'white', borderRadius: '12px',
                                boxShadow: '0 10px 40px rgba(0,0,0,0.12)', border: '1px solid var(--border)',
                                zIndex: 100, overflow: 'hidden'
                            }}>
                                <div style={{ padding: '14px 16px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <h3 style={{ fontSize: '15px', fontWeight: '800', margin: 0 }}>
                                        Notifications
                                        {unreadCount > 0 && <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--primary)', marginLeft: '8px' }}>{unreadCount} new</span>}
                                    </h3>
                                    <button onClick={markAllAsRead} style={{ fontSize: '12px', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '600' }}>Mark all read</button>
                                </div>
                                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                    {notifications.length === 0 ? (
                                        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                                            <Bell size={28} style={{ color: '#E2E8F0', marginBottom: '8px' }} />
                                            <p>No notifications yet</p>
                                        </div>
                                    ) : (
                                        notifications.map((n) => {
                                            const evtType = n.event_type || 'system';
                                            const Icon = EVENT_ICON_MAP[evtType] || Bell;
                                            const colors = EVENT_COLOR_MAP[evtType] || EVENT_COLOR_MAP.system;

                                            return (
                                                <div
                                                    key={n._id}
                                                    onClick={() => handleNotifClick(n)}
                                                    style={{
                                                        padding: '12px 16px', borderBottom: '1px solid #F1F5F9',
                                                        display: 'flex', gap: '10px', alignItems: 'flex-start',
                                                        backgroundColor: n.is_read ? 'white' : '#F8FAFF',
                                                        cursor: n.entity_type ? 'pointer' : 'default',
                                                        transition: 'background 0.15s'
                                                    }}
                                                    className="hover-notif"
                                                >
                                                    <div style={{
                                                        width: '34px', height: '34px', borderRadius: '8px',
                                                        backgroundColor: colors.bg, color: colors.color,
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                                                    }}>
                                                        <Icon size={16} />
                                                    </div>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                                                            <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-main)' }}>{n.title || 'Notification'}</span>
                                                            {n.priority === 'high' && (
                                                                <span style={{ fontSize: '9px', fontWeight: '700', padding: '1px 5px', borderRadius: '6px', backgroundColor: '#FEE2E2', color: '#EF4444' }}>HIGH</span>
                                                            )}
                                                        </div>
                                                        <p style={{ fontSize: '12px', color: n.is_read ? '#94A3B8' : '#475569', lineHeight: '1.4', marginBottom: '3px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                                                            {n.content}
                                                        </p>
                                                        <span style={{ fontSize: '10px', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            <Clock size={10} /> {formatTime(n.created_at)}
                                                            {n.project_name && <> &middot; {n.project_name}</>}
                                                        </span>
                                                    </div>
                                                    {!n.is_read && (
                                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--primary)', flexShrink: 0, marginTop: '4px' }} />
                                                    )}
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                                {/* View All link */}
                                <div
                                    onClick={() => { navigate('/notifications'); setNotifOpen(false); }}
                                    style={{
                                        padding: '12px', textAlign: 'center', borderTop: '1px solid #F1F5F9',
                                        cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: 'var(--primary)',
                                        transition: 'background 0.15s'
                                    }}
                                    className="hover-notif"
                                >
                                    View All Notifications
                                </div>
                                <style>{`.hover-notif:hover { background-color: #F8FAFC !important; }`}</style>
                            </div>
                        )}
                    </div>
                </div>

                <div
                    className="user-profile"
                    ref={profileRef}
                    onClick={() => setProfileOpen(!profileOpen)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '12px',
                        paddingLeft: '20px', borderLeft: '1px solid var(--border)',
                        cursor: 'pointer', padding: '6px 12px 6px 20px',
                        borderRadius: '8px', transition: 'all 0.2s ease', position: 'relative'
                    }}
                >
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-main)' }}>{user?.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>{user?.role}</div>
                    </div>
                    {user?.avatar ? (
                        <img src={user.avatar} alt={user.name} style={{
                            width: '38px', height: '38px', borderRadius: '10px',
                            objectFit: 'cover', boxShadow: '0 4px 6px rgba(37, 99, 235, 0.2)'
                        }} />
                    ) : (
                        <div style={{
                            width: '38px', height: '38px', borderRadius: '10px',
                            backgroundColor: 'var(--primary)', color: 'white',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: '800', fontSize: '15px',
                            boxShadow: '0 4px 6px rgba(37, 99, 235, 0.2)'
                        }}>
                            {user?.name?.charAt(0) || 'U'}
                        </div>
                    )}
                    <ChevronDown size={14} style={{ color: 'var(--text-muted)', marginLeft: '4px', transform: profileOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />

                    {/* Profile Dropdown */}
                    {profileOpen && (
                        <div style={{
                            position: 'absolute', top: '120%', right: 0, width: '200px',
                            backgroundColor: 'white', borderRadius: '12px',
                            boxShadow: '0 10px 25px rgba(0,0,0,0.1)', border: '1px solid var(--border)',
                            zIndex: 100, overflow: 'hidden', padding: '8px'
                        }}>
                            <div style={{ padding: '12px', borderBottom: '1px solid #F1F5F9', marginBottom: '4px' }}>
                                <p style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main)' }}>{user?.name}</p>
                                <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{user?.email || 'admin@civilerp.com'}</p>
                            </div>

                            <button className="profile-item" onClick={() => { navigate('/settings'); setProfileOpen(false); }}
                                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', borderRadius: '8px', border: 'none', background: 'none', color: 'var(--text-main)', fontSize: '13px', fontWeight: '500', cursor: 'pointer', transition: 'all 0.2s' }}>
                                <User size={16} /> My Profile
                            </button>

                            <button className="profile-item" onClick={() => { navigate('/settings'); setProfileOpen(false); }}
                                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', borderRadius: '8px', border: 'none', background: 'none', color: 'var(--text-main)', fontSize: '13px', fontWeight: '500', cursor: 'pointer', transition: 'all 0.2s' }}>
                                <Settings size={16} /> Settings
                            </button>

                            <div style={{ height: '1px', backgroundColor: '#F1F5F9', margin: '4px 0' }}></div>

                            <button className="profile-item logout" onClick={(e) => { e.stopPropagation(); logout(); }}
                                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', borderRadius: '8px', border: 'none', background: 'none', color: '#EF4444', fontSize: '13px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s' }}>
                                <LogOut size={16} /> Sign Out
                            </button>
                            <style>{`
                                .profile-item:hover { background-color: #F8FAFC; }
                                .profile-item.logout:hover { background-color: #FEF2F2; }
                            `}</style>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Header;

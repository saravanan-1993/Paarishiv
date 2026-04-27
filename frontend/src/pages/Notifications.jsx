import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { notificationAPI } from '../utils/api';
import { useNotifications } from '../context/NotificationContext';
import {
    Bell, CheckCircle2, AlertCircle, Package, Wallet, Users, Truck, Briefcase,
    ArrowRight, Filter, CheckCheck, Trash2, RefreshCw, ChevronLeft, ChevronRight,
    Clock, FileText, ShieldCheck
} from 'lucide-react';

const EVENT_CONFIG = {
    approval: { icon: ShieldCheck, color: '#F59E0B', bg: '#FEF3C7', label: 'Approval' },
    workflow: { icon: ArrowRight, color: '#3B82F6', bg: '#DBEAFE', label: 'Workflow' },
    material: { icon: Package, color: '#10B981', bg: '#D1FAE5', label: 'Material' },
    finance: { icon: Wallet, color: '#8B5CF6', bg: '#EDE9FE', label: 'Finance' },
    hr: { icon: Users, color: '#EC4899', bg: '#FCE7F3', label: 'HR' },
    task: { icon: CheckCircle2, color: '#EF4444', bg: '#FEE2E2', label: 'Task' },
    fleet: { icon: Truck, color: '#6B7280', bg: '#F3F4F6', label: 'Fleet' },
    project: { icon: Briefcase, color: '#0EA5E9', bg: '#E0F2FE', label: 'Project' },
    system: { icon: Bell, color: '#6B7280', bg: '#F3F4F6', label: 'System' },
};

const ENTITY_ROUTES = {
    project: (id) => `/projects/${id}`,
    po: () => `/workflow?tab=POs`,
    grn: () => `/workflow?tab=GRN`,
    leave: () => `/hr?tab=Leave+Management`,
    dpr: (id) => {
        const parts = id?.split(':');
        return parts?.length === 2 ? `/projects/${parts[0]}` : '/site-reports';
    },
    expense: () => `/finance?tab=Payments`,
    material_request: () => `/materials?tab=Coordination`,
    manpower: () => `/approvals`,
    payroll: () => `/hr?tab=Payroll`,
    bill: () => `/finance?tab=Sales`,
    vehicle: () => `/fleet?tab=Vehicles`,
    task: (id) => id ? `/projects/${id}` : '/tasks',
};

const Notifications = () => {
    const navigate = useNavigate();
    const { refreshCount } = useNotifications();
    const [notifications, setNotifications] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pages, setPages] = useState(1);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // all, unread, approval, workflow, material, finance, hr, task, project
    const [filterOpen, setFilterOpen] = useState(false);

    const fetchNotifications = useCallback(async () => {
        setLoading(true);
        try {
            const params = { page, limit: 30 };
            if (filter === 'unread') params.is_read = 'false';
            else if (filter !== 'all') params.event_type = filter;
            const res = await notificationAPI.getAll(params);
            setNotifications(res.data.notifications || []);
            setTotal(res.data.total || 0);
            setPages(res.data.pages || 1);
        } catch (err) {
            console.error('Failed to fetch notifications', err);
        }
        setLoading(false);
    }, [page, filter]);

    useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

    const handleMarkAllRead = async () => {
        try {
            await notificationAPI.markAllAsRead();
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            refreshCount();
        } catch (err) { console.error(err); }
    };

    const handleMarkRead = async (id) => {
        try {
            await notificationAPI.markAsRead(id);
            setNotifications(prev => prev.map(n => n._id === id ? { ...n, is_read: true } : n));
            refreshCount();
        } catch (err) { console.error(err); }
    };

    const handleDelete = async (e, id) => {
        e.stopPropagation();
        try {
            await notificationAPI.delete(id);
            setNotifications(prev => prev.filter(n => n._id !== id));
            setTotal(t => t - 1);
            refreshCount();
        } catch (err) { console.error(err); }
    };

    const handleClick = (notif) => {
        if (!notif.is_read) handleMarkRead(notif._id);
        const routeFn = ENTITY_ROUTES[notif.entity_type];
        if (routeFn) {
            navigate(routeFn(notif.entity_id));
        }
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
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
    };

    const filters = [
        { key: 'all', label: 'All' },
        { key: 'unread', label: 'Unread' },
        { key: 'approval', label: 'Approvals' },
        { key: 'workflow', label: 'Workflow' },
        { key: 'material', label: 'Material' },
        { key: 'finance', label: 'Finance' },
        { key: 'hr', label: 'HR' },
        { key: 'project', label: 'Project' },
        { key: 'task', label: 'Task' },
    ];

    return (
        <div style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-main)', marginBottom: '4px' }}>Notifications</h1>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{total} total notifications</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={fetchNotifications} className="btn-icon" style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-muted)' }}>
                        <RefreshCw size={14} /> Refresh
                    </button>
                    <button onClick={handleMarkAllRead} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: 'var(--primary)', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '600' }}>
                        <CheckCheck size={14} /> Mark all read
                    </button>
                </div>
            </div>

            {/* Filter Tabs */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', flexWrap: 'wrap' }}>
                {filters.map(f => (
                    <button
                        key={f.key}
                        onClick={() => { setFilter(f.key); setPage(1); }}
                        style={{
                            padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '600',
                            border: filter === f.key ? 'none' : '1px solid var(--border)',
                            background: filter === f.key ? 'var(--primary)' : 'white',
                            color: filter === f.key ? 'white' : 'var(--text-muted)',
                            cursor: 'pointer', transition: 'all 0.2s'
                        }}
                    >{f.label}</button>
                ))}
            </div>

            {/* Notification List */}
            <div style={{ background: 'white', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden' }}>
                {loading ? (
                    <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <div style={{ width: '32px', height: '32px', border: '3px solid #E2E8F0', borderTop: '3px solid var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }}></div>
                        Loading...
                    </div>
                ) : notifications.length === 0 ? (
                    <div style={{ padding: '60px', textAlign: 'center' }}>
                        <Bell size={40} style={{ color: '#E2E8F0', marginBottom: '12px' }} />
                        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No notifications</p>
                    </div>
                ) : (
                    notifications.map((n) => {
                        const config = EVENT_CONFIG[n.event_type] || EVENT_CONFIG.system;
                        const Icon = config.icon;
                        return (
                            <div
                                key={n._id}
                                onClick={() => handleClick(n)}
                                style={{
                                    padding: '16px 20px',
                                    display: 'flex',
                                    gap: '14px',
                                    alignItems: 'flex-start',
                                    borderBottom: '1px solid #F1F5F9',
                                    cursor: n.entity_type ? 'pointer' : 'default',
                                    backgroundColor: n.is_read ? 'white' : '#F8FAFF',
                                    transition: 'background 0.15s',
                                    position: 'relative',
                                }}
                                className="notif-row"
                            >
                                {/* Unread dot */}
                                {!n.is_read && (
                                    <div style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--primary)' }} />
                                )}

                                {/* Icon */}
                                <div style={{
                                    width: '40px', height: '40px', borderRadius: '10px',
                                    backgroundColor: config.bg, color: config.color,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                                }}>
                                    <Icon size={18} />
                                </div>

                                {/* Content */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                        <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main)' }}>{n.title}</span>
                                        <span style={{
                                            fontSize: '10px', fontWeight: '600', padding: '2px 8px', borderRadius: '10px',
                                            backgroundColor: config.bg, color: config.color
                                        }}>{config.label}</span>
                                        {n.priority === 'high' && (
                                            <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 6px', borderRadius: '10px', backgroundColor: '#FEE2E2', color: '#EF4444' }}>HIGH</span>
                                        )}
                                    </div>
                                    <p style={{ fontSize: '13px', color: n.is_read ? 'var(--text-muted)' : 'var(--text-main)', lineHeight: '1.5', marginBottom: '4px' }}>
                                        {n.content}
                                    </p>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <Clock size={11} /> {formatTime(n.created_at)}
                                        </span>
                                        {n.project_name && (
                                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <Briefcase size={11} /> {n.project_name}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Delete */}
                                <button
                                    onClick={(e) => handleDelete(e, n._id)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#CBD5E1', padding: '4px', borderRadius: '6px', flexShrink: 0 }}
                                    className="notif-del"
                                    title="Delete"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Pagination */}
            {pages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginTop: '20px' }}>
                    <button
                        disabled={page <= 1}
                        onClick={() => setPage(p => p - 1)}
                        style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border)', background: 'white', cursor: page > 1 ? 'pointer' : 'not-allowed', opacity: page > 1 ? 1 : 0.5, display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}
                    >
                        <ChevronLeft size={14} /> Prev
                    </button>
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600' }}>
                        Page {page} of {pages}
                    </span>
                    <button
                        disabled={page >= pages}
                        onClick={() => setPage(p => p + 1)}
                        style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border)', background: 'white', cursor: page < pages ? 'pointer' : 'not-allowed', opacity: page < pages ? 1 : 0.5, display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}
                    >
                        Next <ChevronRight size={14} />
                    </button>
                </div>
            )}

            <style>{`
                .notif-row:hover { background-color: #F8FAFC !important; }
                .notif-del:hover { color: #EF4444 !important; background-color: #FEF2F2 !important; }
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
};

export default Notifications;

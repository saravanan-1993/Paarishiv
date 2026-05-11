import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { notificationAPI } from '../utils/api';
import { useNotifications } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { hasPermission } from '../utils/rbac';
import { ENTITY_ROUTES } from '../utils/notificationRoutes';
import Pagination from '../components/Pagination';
import { Skeleton } from '../components/Skeleton';
import {
    Bell, CheckCircle2, AlertCircle, Package, Wallet, Users, Truck, Briefcase,
    ArrowRight, Filter, CheckCheck, Trash2, RefreshCw,
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

const Notifications = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { refreshCount } = useNotifications();
    const [notifications, setNotifications] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pages, setPages] = useState(1);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // all, unread, approval, workflow, material, finance, hr, task, project
    const [filterOpen, setFilterOpen] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);

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
            setSelectedIds(prev => prev.filter(x => x !== id));
            refreshCount();
        } catch (err) { console.error(err); }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) return;
        try {
            await Promise.allSettled(selectedIds.map(id => notificationAPI.delete(id)));
            setNotifications(prev => prev.filter(n => !selectedIds.includes(n._id)));
            setTotal(t => Math.max(0, t - selectedIds.length));
            setSelectedIds([]);
            refreshCount();
        } catch (err) { console.error(err); }
    };

    const toggleSelectAllVisible = () => {
        const visibleIds = notifications.map(n => n._id);
        const allSelected = visibleIds.every(id => selectedIds.includes(id));
        if (allSelected) setSelectedIds([]);
        else setSelectedIds(visibleIds);
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
        hasPermission(user, 'Approvals', 'view') && { key: 'approval', label: 'Approvals' },
        hasPermission(user, 'Procurement', 'view') && { key: 'workflow', label: 'Workflow' },
        hasPermission(user, 'Inventory Management', 'view') && { key: 'material', label: 'Material' },
        hasPermission(user, 'Accounts', 'view') && { key: 'finance', label: 'Finance' },
        hasPermission(user, 'HRMS', 'view') && { key: 'hr', label: 'HR' },
        hasPermission(user, 'Projects', 'view') && { key: 'project', label: 'Project' },
        hasPermission(user, 'Tasks', 'view') && { key: 'task', label: 'Task' },
    ].filter(Boolean);

    return (
        <div style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-main)', marginBottom: '4px' }}>Notifications</h1>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{total} total notifications</p>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {selectedIds.length > 0 && (
                        <button onClick={handleBulkDelete} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--danger)', background: 'var(--danger-bg)', color: 'var(--danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '600' }}>
                            <Trash2 size={14} aria-hidden="true" /> Delete {selectedIds.length}
                        </button>
                    )}
                    {notifications.length > 0 && (
                        <button onClick={toggleSelectAllVisible} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'white', cursor: 'pointer', fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600 }}>
                            {notifications.every(n => selectedIds.includes(n._id)) ? 'Unselect All' : 'Select All'}
                        </button>
                    )}
                    <button onClick={fetchNotifications} className="btn-icon" style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-muted)' }}>
                        <RefreshCw size={14} aria-hidden="true" /> Refresh
                    </button>
                    <button onClick={handleMarkAllRead} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: 'var(--primary)', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '600' }}>
                        <CheckCheck size={14} aria-hidden="true" /> Mark all read
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
                    <div aria-busy="true">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} style={{ padding: '16px 20px', display: 'flex', gap: '14px', borderBottom: '1px solid #F1F5F9' }}>
                                <Skeleton width={40} height={40} radius={8} />
                                <div style={{ flex: 1 }}>
                                    <Skeleton width="30%" height={12} style={{ marginBottom: '8px' }} />
                                    <Skeleton width="80%" height={14} style={{ marginBottom: '6px' }} />
                                    <Skeleton width="40%" height={11} />
                                </div>
                            </div>
                        ))}
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
                                onKeyDown={(e) => { if (n.entity_type && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); handleClick(n); } }}
                                role={n.entity_type ? 'button' : undefined}
                                tabIndex={n.entity_type ? 0 : -1}
                                aria-label={n.entity_type ? `Open notification: ${n.title || n.content}` : undefined}
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
                                {/* Bulk select checkbox */}
                                <input
                                    type="checkbox"
                                    checked={selectedIds.includes(n._id)}
                                    onChange={(e) => { e.stopPropagation(); setSelectedIds(prev => prev.includes(n._id) ? prev.filter(x => x !== n._id) : [...prev, n._id]); }}
                                    onClick={(e) => e.stopPropagation()}
                                    aria-label={`Select notification: ${n.title || n.content}`}
                                    style={{ marginTop: '4px', width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--primary)', flexShrink: 0 }}
                                />
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
                                    <p style={{ fontSize: '13px', color: n.is_read ? 'var(--text-muted)' : 'var(--text-main)', lineHeight: '1.5', marginBottom: '4px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }} title={n.content}>
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
                <Pagination
                    currentPage={page}
                    totalItems={total}
                    pageSize={30}
                    onPageChange={setPage}
                />
            )}

            <style>{`
                .notif-row:hover { background-color: #F8FAFC !important; }
                .notif-del:hover { color: #EF4444 !important; background-color: #FEF2F2 !important; }
            `}</style>
        </div>
    );
};

export default Notifications;

import React, { useState, useRef, useEffect } from 'react';
import {
    Bell, Search, User, CheckCircle2, AlertCircle,
    Info, Package, FileText, Clock, AlertTriangle, Menu, X, MessageSquare, LogOut, Settings, ChevronDown
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';

const Header = ({ setIsSidebarOpen, isSidebarOpen }) => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const { notifications, unreadCount, markAllAsRead } = useNotifications();
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
            if (notifRef.current && !notifRef.current.contains(e.target)) {
                setNotifOpen(false);
            }
            if (profileRef.current && !profileRef.current.contains(e.target)) {
                setProfileOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const getIcon = (type) => {
        if (type === 'task_alert') return AlertCircle;
        if (type === 'task_update') return CheckCircle2;
        if (type === 'chat_message' || type === 'chat_group') return MessageSquare;
        return Bell;
    };

    return (
        <header style={{
            height: 'var(--header-height, 70px)',
            backgroundColor: 'white',
            borderBottom: '1px solid var(--border)',
            position: 'fixed',
            top: 0,
            right: 0,
            left: 0, // Changed from var(--sidebar-width) to handle mobile better
            zIndex: 90,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
            transition: 'all 0.3s ease',
            marginLeft: 'var(--sidebar-width, 260px)' // Move margin here instead of left
        }} className="app-header">
            <div className="header-left" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <button
                    className="menu-toggle"
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    style={{
                        background: 'none',
                        border: 'none',
                        padding: '8px',
                        color: 'var(--text-main)',
                        cursor: 'pointer',
                        display: 'none'
                    }}
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
                    <button className="icon-btn" title="Help Guide" style={{ background: 'none', border: 'none', padding: '8px', color: 'var(--text-muted)', cursor: 'pointer' }}>
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
                                    position: 'absolute',
                                    top: '4px',
                                    right: '4px',
                                    width: '16px',
                                    height: '16px',
                                    backgroundColor: '#EF4444',
                                    color: 'white',
                                    fontSize: '10px',
                                    fontWeight: '800',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    border: '2px solid white'
                                }}>
                                    {unreadCount}
                                </span>
                            )}
                        </button>

                        {/* Notifications Dropdown */}
                        {notifOpen && (
                            <div style={{
                                position: 'absolute',
                                top: 'calc(100% + 10px)',
                                right: '-10px',
                                width: '320px',
                                backgroundColor: 'white',
                                borderRadius: '12px',
                                boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                                border: '1px solid var(--border)',
                                zIndex: 100,
                                overflow: 'hidden'
                            }}>
                                <div style={{ padding: '16px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <h3 style={{ fontSize: '15px', fontWeight: '800' }}>Notifications</h3>
                                    <button onClick={markAllAsRead} style={{ fontSize: '12px', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '600' }}>Mark read</button>
                                </div>
                                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                    {notifications.length === 0 ? (
                                        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>No notifications</div>
                                    ) : (
                                        notifications.map((n) => (
                                            <div key={n.id} style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9', display: 'flex', gap: '12px', opacity: n.read ? 0.6 : 1, transition: 'background 0.2s', cursor: 'pointer' }} className="hover-notif">
                                                {(() => {
                                                    const Icon = getIcon(n.type);
                                                    let bgColor = '#EFF6FF';
                                                    let color = '#3B82F6';
                                                    if (n.type === 'task_update' || n.message?.includes('Completed')) { bgColor = '#DCFCE7'; color = '#10B981'; }
                                                    else if (n.type === 'task_alert' || n.message?.includes('Rejected')) { bgColor = '#FEF2F2'; color = '#EF4444'; }
                                                    else if (n.message?.includes('chat') || n.message?.includes('group')) { bgColor = '#F3E8FF'; color = '#8B5CF6'; }

                                                    return (
                                                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: bgColor, color: color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                            <Icon size={18} />
                                                        </div>
                                                    );
                                                })()}
                                                <div>
                                                    <p style={{ fontSize: '13px', lineHeight: '1.4', marginBottom: '2px' }}>{n.message}</p>
                                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{n.time}</span>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                                <style>{`.hover-notif:hover { background-color: #F8FAFC; }`}</style>
                            </div>
                        )}
                    </div>
                </div>

                <div
                    className="user-profile"
                    ref={profileRef}
                    onClick={() => setProfileOpen(!profileOpen)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        paddingLeft: '20px',
                        borderLeft: '1px solid var(--border)',
                        cursor: 'pointer',
                        padding: '6px 12px 6px 20px',
                        borderRadius: '8px',
                        transition: 'all 0.2s ease',
                        position: 'relative'
                    }}
                >
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-main)' }}>{user?.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>{user?.role}</div>
                    </div>
                    {user?.avatar ? (
                        <img src={user.avatar} alt={user.name} style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '10px',
                            objectFit: 'cover',
                            boxShadow: '0 4px 6px rgba(37, 99, 235, 0.2)'
                        }} />
                    ) : (
                        <div style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '10px',
                            backgroundColor: 'var(--primary)',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: '800',
                            fontSize: '15px',
                            boxShadow: '0 4px 6px rgba(37, 99, 235, 0.2)'
                        }}>
                            {user?.name?.charAt(0) || 'U'}
                        </div>
                    )}
                    <ChevronDown size={14} style={{ color: 'var(--text-muted)', marginLeft: '4px', transform: profileOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />

                    {/* Profile Dropdown */}
                    {profileOpen && (
                        <div style={{
                            position: 'absolute',
                            top: '120%',
                            right: 0,
                            width: '200px',
                            backgroundColor: 'white',
                            borderRadius: '12px',
                            boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                            border: '1px solid var(--border)',
                            zIndex: 100,
                            overflow: 'hidden',
                            padding: '8px'
                        }}>
                            <div style={{ padding: '12px', borderBottom: '1px solid #F1F5F9', marginBottom: '4px' }}>
                                <p style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main)' }}>{user?.name}</p>
                                <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{user?.email || 'admin@civilerp.com'}</p>
                            </div>

                            <button
                                className="profile-item"
                                onClick={() => { navigate('/settings'); setProfileOpen(false); }}
                                style={{
                                    width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px',
                                    borderRadius: '8px', border: 'none', background: 'none', color: 'var(--text-main)',
                                    fontSize: '13px', fontWeight: '500', cursor: 'pointer', transition: 'all 0.2s'
                                }}
                            >
                                <User size={16} /> My Profile
                            </button>

                            <button
                                className="profile-item"
                                onClick={() => { navigate('/settings'); setProfileOpen(false); }}
                                style={{
                                    width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px',
                                    borderRadius: '8px', border: 'none', background: 'none', color: 'var(--text-main)',
                                    fontSize: '13px', fontWeight: '500', cursor: 'pointer', transition: 'all 0.2s'
                                }}
                            >
                                <Settings size={16} /> Settings
                            </button>

                            <div style={{ height: '1px', backgroundColor: '#F1F5F9', margin: '4px 0' }}></div>

                            <button
                                className="profile-item logout"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    logout();
                                }}
                                style={{
                                    width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px',
                                    borderRadius: '8px', border: 'none', background: 'none', color: '#EF4444',
                                    fontSize: '13px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s'
                                }}
                            >
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

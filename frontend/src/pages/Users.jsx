import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { UserPlus, Search, Filter, Mail, Shield, ShieldCheck, MoreVertical, Edit2, Trash2, CheckCircle, XCircle, Loader2, Edit3, ListTodo, Plus, LayoutDashboard, Briefcase, Wallet, ShoppingCart, Users as UsersIcon, Package, FileText, UserCog, History, Settings as SettingsIcon } from 'lucide-react';
import { employeeAPI } from '../utils/api';
import CreateRoleModal from '../components/CreateRoleModal';
import { getRoles, saveRoles, hasPermission, fetchAndSyncRoles } from '../utils/rbac';
import { useAuth } from '../context/AuthContext';

const Users = () => {
    const { user } = useAuth();
    const canEditHRMS = hasPermission(user, 'HRMS', 'edit');
    const canDeleteHRMS = hasPermission(user, 'HRMS', 'delete');
    const [searchParams, setSearchParams] = useSearchParams();
    const urlTab = searchParams.get('tab');
    const [activeTab, setActiveTab] = useState('Users');

    const tabMapping = useMemo(() => ({
        'Authorized Users': 'Users',
        'Roles & Permissions': 'Roles'
    }), []);

    useEffect(() => {
        if (urlTab) {
            const internalTab = tabMapping[urlTab] || urlTab;
            if (Object.values(tabMapping).includes(internalTab)) {
                setActiveTab(internalTab);
            }
        }
    }, [urlTab, tabMapping]);

    const handleTabChange = (tabId) => {
        const label = Object.keys(tabMapping).find(key => tabMapping[key] === tabId) || tabId;
        setActiveTab(tabId);
        setSearchParams({ tab: label });
    };
    const [searchTerm, setSearchTerm] = useState('');
    const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
    const [newUser, setNewUser] = useState({
        fullName: '',
        employeeCode: '',
        email: '',
        roles: [],
        password: '',
        status: 'Active'
    });

    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [openMenuId, setOpenMenuId] = useState(null);

    // Roles state
    const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
    const [editingRole, setEditingRole] = useState(null);

    const iconMapping = {
        'Dashboard': LayoutDashboard,
        'Projects': Briefcase,
        'Tasks': ListTodo,
        'Accounts': Wallet,
        'Procurement': ShoppingCart,
        'HRMS': UsersIcon,
        'Inventory Management': Package,
        'Reports': FileText,
        'User Management': UserCog,
        'System Logs': History,
        'Settings': SettingsIcon
    };

    const loadRoles = () => {
        const storedRoles = getRoles();
        return storedRoles.map(r => ({
            ...r,
            permissions: r.permissions.map(p => ({
                ...p,
                icon: iconMapping[p.name] || LayoutDashboard
            }))
        }));
    };

    const [roles, setRoles] = useState(loadRoles());

    useEffect(() => {
        const handleClickOutside = () => setOpenMenuId(null);
        document.addEventListener('click', handleClickOutside);

        // Sync roles with backend on mount
        const syncRoles = async () => {
            const serverRoles = await fetchAndSyncRoles();
            if (serverRoles) {
                setRoles(serverRoles.map(r => ({
                    ...r,
                    permissions: r.permissions.map(p => ({
                        ...p,
                        icon: iconMapping[p.name] || LayoutDashboard
                    }))
                })));
            }
        };
        syncRoles();

        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const res = await employeeAPI.getAll();
            const mappedUsers = res.data.map(u => ({
                id: u._id,
                name: u.fullName || u.name || u.employeeCode,
                email: u.email || 'No email',
                role: u.roles ? u.roles[0] : (u.role || 'Staff'),
                status: u.status || 'Active',
                lastLogin: u.lastLogin || 'N/A'
            }));
            setUsers(mappedUsers);
        } catch (err) {
            console.error('Failed to fetch users', err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (userId) => {
        if (!window.confirm('Are you sure you want to delete this user?')) return;
        try {
            await employeeAPI.delete(userId);
            fetchUsers();
        } catch (err) {
            console.error('Delete failed', err);
            alert('Failed to delete user');
        }
    };

    const stats = [
        { label: 'Total Users', value: users.length, icon: Shield, color: '#3B82F6' },
        { label: 'Super Admins', value: users.filter(u => u.role === 'Super Admin' || u.role === 'Admin' || u.role === 'Administrator').length, icon: ShieldCheck, color: '#10B981' },
        { label: 'Site Engineers', value: users.filter(u => u.role.includes('Engineer')).length, icon: Shield, color: '#F59E0B' },
        { label: 'Active Now', value: users.filter(u => u.status === 'Active').length, icon: CheckCircle, color: '#8B5CF6' },
    ];

    const [editingUser, setEditingUser] = useState(null);

    const handleRoleCreated = (newRole, isUpdate) => {
        let updatedRoles;
        if (isUpdate) {
            updatedRoles = roles.map(r => r.name === editingRole.name ? newRole : r);
        } else {
            updatedRoles = [...roles, newRole];
        }
        setRoles(updatedRoles);
        saveRoles(updatedRoles.map(r => ({
            name: r.name,
            description: r.description,
            tags: r.tags,
            permissions: r.permissions.map(p => ({
                name: p.name,
                actions: p.actions,
                subTabs: p.subTabs
            })),
            dashboardCards: r.dashboardCards || [],
            features: r.features || []
        })));
        setEditingRole(null);
        setIsRoleModalOpen(false);
    };

    const handleDeleteRole = (roleName) => {
        if (roleName === 'Administrator' || roleName === 'Super Admin') {
            alert(`Cannot delete ${roleName} role`);
            return;
        }
        if (window.confirm(`Are you sure you want to delete the ${roleName} role?`)) {
            const updated = roles.filter(r => r.name !== roleName);
            setRoles(updated);
            saveRoles(updated.map(r => ({
                name: r.name,
                description: r.description,
                tags: r.tags,
                permissions: r.permissions.map(p => ({
                    name: p.name,
                    actions: p.actions,
                    subTabs: p.subTabs
                })),
                dashboardCards: r.dashboardCards || [],
                features: r.features || []
            })));
        }
    };

    const handleEditRole = (role) => {
        setEditingRole(role);
        setIsRoleModalOpen(true);
    };

    const handleCreateRoleClick = () => {
        setEditingRole(null);
        setIsRoleModalOpen(true);
    };

    const handleEdit = (user) => {
        // Map frontend fields back to what backend expects for creation/update
        // Note: fetchUsers already has mapped data, but we need the original or a compatible structure
        setNewUser({
            id: user.id,
            fullName: user.name,
            employeeCode: users.find(u => u.id === user.id)?.employeeCode || user.name, // employeeCode might be missing in mappedUsers
            email: user.email === 'No email' ? '' : user.email,
            roles: [user.role],
            password: '', // Don't pre-fill password for security
            status: user.status
        });
        setEditingUser(user);
        setIsAddUserModalOpen(true);
    };

    const handleCreateUser = async () => {
        if (!newUser.fullName || !newUser.employeeCode || (!editingUser && !newUser.password)) {
            alert('Please fill in required fields (Name, Code, Password)');
            return;
        }

        try {
            if (editingUser) {
                // For now, employeeAPI doesn't have an update method in api.js, let's add it or use create if backend handles it
                // Actually, I should check if backend has an update endpoint.
                await employeeAPI.update(editingUser.id, newUser);
            } else {
                await employeeAPI.create(newUser);
            }
            setIsAddUserModalOpen(false);
            setEditingUser(null);
            setNewUser({ fullName: '', employeeCode: '', email: '', roles: [], password: '', status: 'Active' });
            fetchUsers();
        } catch (err) {
            console.error('Save failed', err);
            const detail = err.response?.data?.detail;
            const errorMsg = Array.isArray(detail)
                ? detail.map(d => `${d.loc.join('.')}: ${d.msg}`).join('\n')
                : detail || 'Failed to save user';
            alert(errorMsg);
        }
    };

    const handleToggleStatus = async (user) => {
        const newStatus = user.status === 'Active' ? 'Inactive' : 'Active';
        try {
            await employeeAPI.update(user.id, { status: newStatus });
            fetchUsers();
        } catch (err) {
            console.error('Status update failed', err);
        }
    };

    const handleResetPassword = (user) => {
        setNewUser({
            ...newUser,
            id: user.id,
            fullName: user.name,
            employeeCode: users.find(u => u.id === user.id)?.employeeCode || user.name,
            email: user.email === 'No email' ? '' : user.email,
            roles: [user.role],
            status: user.status
        });
        setEditingUser(user);
        setIsAddUserModalOpen(true);
    };

    return (
        <div style={{ position: 'relative' }}>
            <div className="animate-fade-in">
                {/* Header Section */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <div>
                        <h2 style={{ fontSize: '24px', marginBottom: '4px' }}>System Access & Roles</h2>
                        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Control access, assign roles, and manage system permissions.</p>
                    </div>
                </div>

                {/* Main Tabs */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
                    <button
                        onClick={() => handleTabChange('Users')}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '8px', border: 'none',
                            background: activeTab === 'Users' ? '#f1f5f9' : 'transparent', color: activeTab === 'Users' ? 'var(--text-main)' : 'var(--text-muted)',
                            fontWeight: activeTab === 'Users' ? '700' : '600', fontSize: '14px', cursor: 'pointer'
                        }}
                    >
                        <UsersIcon size={18} />
                        Authorized Users
                    </button>
                    <button
                        onClick={() => handleTabChange('Roles')}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '8px', border: 'none',
                            background: activeTab === 'Roles' ? '#f1f5f9' : 'transparent', color: activeTab === 'Roles' ? 'var(--text-main)' : 'var(--text-muted)',
                            fontWeight: activeTab === 'Roles' ? '700' : '600', fontSize: '14px', cursor: 'pointer'
                        }}
                    >
                        <ShieldCheck size={18} />
                        Roles & Permissions
                    </button>
                </div>

                {activeTab === 'Roles' && (
                    <div className="animate-fade-in">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                            <div>
                                <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '4px' }}>Role Definitions</h3>
                                <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Define access permissions for each role below</p>
                            </div>
                            {canEditHRMS && <button className="btn btn-primary" style={{ padding: '10px 20px', fontWeight: '800' }} onClick={handleCreateRoleClick}>
                                <Plus size={18} /> CREATE ROLE
                            </button>}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px', alignItems: 'start' }}>
                            {roles.map((role, idx) => (
                                <div key={idx} className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                                        <div style={{ flex: 1 }}>
                                            <h4 style={{ fontSize: '16px', fontWeight: '700' }}>{role.name}</h4>
                                            <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{role.description}</p>
                                        </div>
                                        {canEditHRMS && <div style={{ display: 'flex', gap: '8px', marginLeft: '12px', flexShrink: 0 }}>
                                            <button
                                                onClick={() => handleEditRole(role)}
                                                style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: '600', color: '#0284c7' }}
                                            >
                                                <Edit3 size={14} /> Edit
                                            </button>
                                            {canDeleteHRMS && role.name !== 'Administrator' && role.name !== 'Super Admin' && (
                                                <button
                                                    onClick={() => handleDeleteRole(role.name)}
                                                    style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: '600', color: '#dc2626' }}
                                                >
                                                    <Trash2 size={14} /> Delete
                                                </button>
                                            )}
                                        </div>}
                                    </div>

                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
                                        {(role.tags || []).map(tag => (
                                            <span key={tag} style={{
                                                padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '600',
                                                backgroundColor: tag === 'System' ? '#EFF6FF' : '#f1f5f9',
                                                color: tag === 'System' ? '#3B82F6' : 'var(--text-muted)',
                                                border: '1px solid var(--border)'
                                            }}>
                                                {tag}
                                            </span>
                                        ))}
                                    </div>

                                    <div style={{ padding: '16px 0', borderTop: '1px solid var(--border)', flex: 1 }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                                            {role.permissions.map(perm => {
                                                const acts = perm.actions || { view: true, edit: false, delete: false };
                                                return (
                                                    <div key={perm.name} style={{
                                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px',
                                                        borderRadius: '6px', border: '1px solid var(--border)', fontSize: '11px', fontWeight: '600',
                                                        color: 'var(--text-main)', background: '#f8fafc', minHeight: '38px'
                                                    }}>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: 0 }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                {perm.icon ? <perm.icon size={12} style={{ color: 'var(--primary)', flexShrink: 0 }} /> : <Shield size={12} style={{ color: 'var(--primary)', flexShrink: 0 }} />}
                                                                <span style={{ fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{perm.name}</span>
                                                            </div>
                                                            {perm.subTabs && perm.subTabs.length > 0 && (
                                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', paddingLeft: '18px' }}>
                                                                    {perm.subTabs.map(st => (
                                                                        <span key={st} style={{ fontSize: '9px', padding: '1px 4px', backgroundColor: '#e2e8f0', borderRadius: '3px', color: 'var(--text-muted)' }}>{st}</span>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div style={{ display: 'flex', gap: '4px', flexShrink: 0, marginLeft: '6px' }}>
                                                            <span style={{ fontSize: '10px', fontWeight: '700', color: acts.view ? '#10B981' : '#CBD5E1' }}>V</span>
                                                            <span style={{ fontSize: '10px', fontWeight: '700', color: acts.edit ? '#F59E0B' : '#CBD5E1' }}>E</span>
                                                            <span style={{ fontSize: '10px', fontWeight: '700', color: acts.delete ? '#EF4444' : '#CBD5E1' }}>D</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'Users' && (
                    <div className="animate-fade-in">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h3 style={{ fontSize: '18px', fontWeight: '700' }}>Manage System Users</h3>
                            <button className="btn btn-primary" onClick={() => setIsAddUserModalOpen(true)}>
                                <UserPlus size={18} />
                                Add New User
                            </button>
                        </div>

                        {/* Stats Cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '24px' }}>
                            {stats.map((stat, i) => (
                                <div key={i} className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px' }}>
                                    <div style={{
                                        width: '40px',
                                        height: '40px',
                                        borderRadius: '10px',
                                        backgroundColor: `${stat.color}15`,
                                        color: stat.color,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        <stat.icon size={20} />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{stat.label}</div>
                                        <div style={{ fontSize: '20px', fontWeight: '700' }}>{stat.value}</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Filters & Search */}
                        <div className="card" style={{ marginBottom: '24px', padding: '16px' }}>
                            <div style={{ display: 'flex', gap: '16px' }}>
                                <div style={{ flex: 1, position: 'relative' }}>
                                    <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                    <input
                                        type="text"
                                        placeholder="Search by name, email or role..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        style={{ width: '100%', padding: '10px 12px 10px 40px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: '14px' }}
                                    />
                                </div>
                                <button className="btn btn-outline">
                                    <Filter size={18} />
                                    Filter Roles
                                </button>
                            </div>
                        </div>

                        {/* Users Table */}
                        <div className="card">
                            <h3 style={{ marginBottom: '20px', fontSize: '18px' }}>Authorized System Users</h3>
                            {loading ? (
                                <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                                    <Loader2 className="animate-spin" size={32} color="var(--primary)" />
                                </div>
                            ) : (
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>User Details</th>
                                            <th>Role</th>
                                            <th>Status</th>
                                            <th>Last Login</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {users
                                            .filter(u => u.name.toLowerCase().includes(searchTerm.toLowerCase()) || u.role.toLowerCase().includes(searchTerm.toLowerCase()))
                                            .map((user, i) => (
                                                <tr key={i}>
                                                    <td>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                            <div style={{
                                                                width: '36px',
                                                                height: '36px',
                                                                borderRadius: '50%',
                                                                backgroundColor: 'var(--primary)',
                                                                color: 'white',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                fontWeight: '600',
                                                                fontSize: '14px'
                                                            }}>
                                                                {user.name.charAt(0)}
                                                            </div>
                                                            <div>
                                                                <div style={{ fontWeight: '600', fontSize: '14px' }}>{user.name}</div>
                                                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                    <Mail size={12} /> {user.email}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span style={{
                                                            padding: '4px 10px',
                                                            borderRadius: '6px',
                                                            backgroundColor: 'var(--bg-main)',
                                                            fontSize: '12px',
                                                            fontWeight: '600',
                                                            color: (user.role === 'Super Admin' || user.role === 'Admin') ? 'var(--primary)' : 'var(--text-muted)',
                                                            border: (user.role === 'Super Admin' || user.role === 'Admin') ? '1px solid var(--primary-light)' : '1px solid var(--border)'
                                                        }}>
                                                            {user.role}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            {user.status === 'Active' ? <CheckCircle size={14} color="#10B981" /> : <XCircle size={14} color="#EF4444" />}
                                                            <span style={{ fontSize: '13px', color: user.status === 'Active' ? '#10B981' : '#EF4444', fontWeight: '500' }}>
                                                                {user.status}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{user.lastLogin}</td>
                                                    <td style={{ textAlign: 'right', paddingRight: '20px' }}>
                                                        <div style={{
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            backgroundColor: '#f8fafc',
                                                            padding: '4px',
                                                            borderRadius: '10px',
                                                            border: '1px solid #e2e8f0',
                                                            gap: '4px'
                                                        }}>
                                                            {canEditHRMS && <button
                                                                onClick={() => handleEdit(user)}
                                                                title="Edit User"
                                                                style={{
                                                                    padding: '8px',
                                                                    borderRadius: '8px',
                                                                    border: 'none',
                                                                    background: 'transparent',
                                                                    color: 'var(--primary)',
                                                                    cursor: 'pointer',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    transition: 'all 0.2s'
                                                                }}
                                                                onMouseEnter={(e) => {
                                                                    e.currentTarget.style.backgroundColor = 'var(--primary-light)';
                                                                    e.currentTarget.style.transform = 'scale(1.1)';
                                                                }}
                                                                onMouseLeave={(e) => {
                                                                    e.currentTarget.style.backgroundColor = 'transparent';
                                                                    e.currentTarget.style.transform = 'scale(1)';
                                                                }}
                                                            >
                                                                <Edit2 size={16} />
                                                            </button>}
                                                            {canDeleteHRMS && <><div style={{ width: '1px', height: '16px', backgroundColor: '#e2e8f0' }}></div>
                                                            <button
                                                                onClick={() => handleDelete(user.id)}
                                                                title="Delete User"
                                                                style={{
                                                                    padding: '8px',
                                                                    borderRadius: '8px',
                                                                    border: 'none',
                                                                    background: 'transparent',
                                                                    color: '#EF4444',
                                                                    cursor: 'pointer',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    transition: 'all 0.2s'
                                                                }}
                                                                onMouseEnter={(e) => {
                                                                    e.currentTarget.style.backgroundColor = '#FEF2F2';
                                                                    e.currentTarget.style.transform = 'scale(1.1)';
                                                                }}
                                                                onMouseLeave={(e) => {
                                                                    e.currentTarget.style.backgroundColor = 'transparent';
                                                                    e.currentTarget.style.transform = 'scale(1)';
                                                                }}
                                                            >
                                                                <Trash2 size={16} />
                                                            </button></>}
                                                            <div style={{ width: '1px', height: '16px', backgroundColor: '#e2e8f0' }}></div>
                                                            <div style={{ position: 'relative' }}>
                                                                <button
                                                                    title="More Options"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setOpenMenuId(openMenuId === user.id ? null : user.id);
                                                                    }}
                                                                    className="more-options-button"
                                                                    style={{
                                                                        padding: '8px',
                                                                        borderRadius: '8px',
                                                                        border: 'none',
                                                                        background: openMenuId === user.id ? '#F1F5F9' : 'transparent',
                                                                        color: 'var(--text-muted)',
                                                                        cursor: 'pointer',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        transition: 'all 0.2s'
                                                                    }}
                                                                    onMouseEnter={(e) => {
                                                                        if (openMenuId !== user.id) {
                                                                            e.currentTarget.style.backgroundColor = '#F1F5F9';
                                                                            e.currentTarget.style.transform = 'scale(1.1)';
                                                                        }
                                                                    }}
                                                                    onMouseLeave={(e) => {
                                                                        if (openMenuId !== user.id) {
                                                                            e.currentTarget.style.backgroundColor = 'transparent';
                                                                            e.currentTarget.style.transform = 'scale(1)';
                                                                        }
                                                                    }}
                                                                >
                                                                    <MoreVertical size={16} />
                                                                </button>

                                                                {openMenuId === user.id && (
                                                                    <div className="dropdown-menu-container" style={{
                                                                        position: 'absolute',
                                                                        top: '100%',
                                                                        right: 0,
                                                                        marginTop: '8px',
                                                                        backgroundColor: 'white',
                                                                        borderRadius: '12px',
                                                                        boxShadow: 'var(--shadow-lg)',
                                                                        border: '1px solid var(--border)',
                                                                        zIndex: 100,
                                                                        minWidth: '180px',
                                                                        padding: '6px',
                                                                        animation: 'fadeIn 0.15s ease'
                                                                    }}>
                                                                        <div
                                                                            onClick={() => handleToggleStatus(user)}
                                                                            style={{ padding: '10px 12px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                                                                            className="dropdown-item-hover"
                                                                        >
                                                                            {user.status === 'Active' ? <XCircle size={14} color="#EF4444" /> : <CheckCircle size={14} color="#10B981" />}
                                                                            {user.status === 'Active' ? 'Deactivate User' : 'Activate User'}
                                                                        </div>
                                                                        <div
                                                                            onClick={() => handleResetPassword(user)}
                                                                            style={{ padding: '10px 12px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                                                                            className="dropdown-item-hover"
                                                                        >
                                                                            <Shield size={14} color="var(--primary)" />
                                                                            Reset Password
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        {users.length === 0 && (
                                            <tr>
                                                <td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                                                    No users found in the system.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <CreateRoleModal
                isOpen={isRoleModalOpen}
                onClose={() => {
                    setIsRoleModalOpen(false);
                    setEditingRole(null);
                }}
                onRoleCreated={handleRoleCreated}
                initialData={editingRole}
            />

            {/* Create/Edit User Modal */}
            {isAddUserModalOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
                }}>
                    <div className="card animate-fade-in" style={{ width: '450px', padding: '32px', maxHeight: '90vh', overflowY: 'auto' }}>
                        <h3 style={{ marginBottom: '24px' }}>{editingUser ? 'Edit System User' : 'Create New System User'}</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600' }}>Full Name *</label>
                                <input
                                    placeholder="Enter full name"
                                    value={newUser.fullName}
                                    onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })}
                                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600' }}>User Code / ID *</label>
                                <input
                                    placeholder="e.g. EMP1001"
                                    value={newUser.employeeCode}
                                    onChange={(e) => setNewUser({ ...newUser, employeeCode: e.target.value })}
                                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600' }}>Email Address</label>
                                <input
                                    placeholder="email@example.com"
                                    value={newUser.email}
                                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: '600' }}>Assign Role</label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                    {roles.map(r => r.name).map(role => (
                                        <div
                                            key={role}
                                            style={{
                                                padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                                                backgroundColor: newUser.roles.includes(role) ? 'var(--primary)' : '#f1f5f9',
                                                color: newUser.roles.includes(role) ? 'white' : 'var(--text-muted)',
                                                border: newUser.roles.includes(role) ? '1px solid var(--primary)' : '1px solid var(--border)'
                                            }}
                                            onClick={() => {
                                                if (newUser.roles.includes(role)) {
                                                    setNewUser({ ...newUser, roles: newUser.roles.filter(r => r !== role) });
                                                } else {
                                                    setNewUser({ ...newUser, roles: [role] }); // Single role selection for simplicity
                                                }
                                            }}
                                        >
                                            {role}
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: '600' }}>
                                    {editingUser ? 'New Password (Optional)' : 'Initial Password *'}
                                </label>
                                {editingUser && <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>Leave blank to keep current password</p>}
                                <input
                                    type="password"
                                    placeholder="••••••••"
                                    value={newUser.password}
                                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}
                                />
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
                            <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => { setIsAddUserModalOpen(false); setEditingUser(null); }}>Cancel</button>
                            <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleCreateUser}>{editingUser ? 'Update User' : 'Create User'}</button>
                        </div>
                    </div>
                </div>
            )}
            <style>{`
                .dropdown-item-hover:hover {
                    background-color: #F8FAFC;
                    color: var(--primary);
                }
            `}</style>
        </div>
    );
};

export default Users;

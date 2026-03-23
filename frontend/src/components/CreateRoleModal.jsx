import React, { useState } from 'react';
import { X, Shield, LayoutDashboard, Briefcase, ListTodo, Wallet, ShoppingCart, Users, Truck, CheckCircle2, MessageSquare, LayoutList, ShieldCheck, FileText, Settings, Package, HardHat, UserCog, History, ChevronDown, ChevronUp } from 'lucide-react';
import { SUB_TABS } from '../utils/rbac';

const MODULES = [
    { name: 'Dashboard', icon: LayoutDashboard },
    { name: 'Projects', icon: Briefcase },
    { name: 'Tasks', icon: ListTodo },
    { name: 'Accounts', icon: Wallet },
    { name: 'Procurement', icon: ShoppingCart },
    { name: 'HRMS', icon: Users },
    { name: 'Inventory Management', icon: Package },
    { name: 'Fleet Management', icon: Truck },
    { name: 'Approvals', icon: CheckCircle2 },
    { name: 'Reports', icon: FileText },
    { name: 'Site Reports', icon: LayoutList },
    { name: 'Team Chat', icon: MessageSquare },
    { name: 'User Management', icon: UserCog },
    { name: 'System Logs', icon: History },
    { name: 'Settings', icon: Settings },
];

const CreateRoleModal = ({ isOpen, onClose, onRoleCreated, initialData }) => {
    const [roleName, setRoleName] = useState('');
    const [description, setDescription] = useState('');
    const [permissions, setPermissions] = useState({});
    const [expandedModule, setExpandedModule] = useState(null);

    React.useEffect(() => {
        if (initialData) {
            setRoleName(initialData.name);
            setDescription(initialData.description);
            // Convert array form to object form for editing
            const permObj = {};
            initialData.permissions?.forEach(p => {
                permObj[p.name] = {
                    actions: p.actions || { view: true, edit: false, delete: false },
                    subTabs: p.subTabs || (SUB_TABS[p.name] ? [...SUB_TABS[p.name]] : [])
                };
            });
            setPermissions(permObj);
        } else {
            setRoleName('');
            setDescription('');
            setPermissions({});
        }
    }, [initialData, isOpen]);

    if (!isOpen) return null;

    const toggleAction = (moduleName, action) => {
        const currentPerms = permissions[moduleName] || {
            actions: { view: false, edit: false, delete: false },
            subTabs: SUB_TABS[moduleName] ? [...SUB_TABS[moduleName]] : []
        };
        const newActions = { ...currentPerms.actions, [action]: !currentPerms.actions[action] };

        // If any action is true, the module is effectively "selected"
        if (!newActions.view && !newActions.edit && !newActions.delete) {
            const newPerms = { ...permissions };
            delete newPerms[moduleName];
            setPermissions(newPerms);
        } else {
            setPermissions({
                ...permissions,
                [moduleName]: { ...currentPerms, actions: newActions }
            });
        }
    };

    const toggleSubTab = (moduleName, subTab) => {
        const currentPerms = permissions[moduleName] || {
            actions: { view: true, edit: false, delete: false },
            subTabs: []
        };
        let newSubTabs = [...currentPerms.subTabs];
        if (newSubTabs.includes(subTab)) {
            newSubTabs = newSubTabs.filter(s => s !== subTab);
        } else {
            newSubTabs.push(subTab);
        }

        setPermissions({
            ...permissions,
            [moduleName]: { ...currentPerms, subTabs: newSubTabs }
        });
    };

    const handleCreate = () => {
        const newRole = {
            name: roleName,
            description: description || 'New system role',
            tags: [roleName.toLowerCase().replace(/\s+/g, '_')],
            permissions: MODULES.filter(m => permissions[m.name]).map(m => ({
                name: m.name,
                actions: permissions[m.name].actions,
                subTabs: permissions[m.name].subTabs
            })),
            dashboardCards: [],
            features: [],
            userCount: initialData?.userCount || 0
        };
        onRoleCreated(newRole, !!initialData);
        onClose();
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '850px', width: '95%' }}>
                <div className="modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', backgroundColor: '#f1f5f9', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                            <Shield size={20} />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '18px', fontWeight: '700' }}>{initialData ? 'Update Role' : 'Create New Role'}</h3>
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Configure module and sub-tab level access</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                        <X size={24} />
                    </button>
                </div>

                <div className="modal-body" style={{ padding: '24px', maxHeight: '70vh', overflowY: 'auto' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '14px' }}>Role Name</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Project Coordinator"
                                    value={roleName}
                                    onChange={(e) => setRoleName(e.target.value)}
                                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '14px' }}>Role Description</label>
                                <input
                                    placeholder="Brief responsibilities..."
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none' }}
                                />
                            </div>
                        </div>

                        <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                <div>
                                    <h4 style={{ fontWeight: '700', fontSize: '15px' }}>Module & Sub-Tab Access</h4>
                                    <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Select modules and toggle individual sub-tabs.</p>
                                </div>
                                <div style={{ display: 'flex', gap: '30px', marginRight: '16px', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>
                                    <span style={{ width: '18px', textAlign: 'center' }}>VIEW</span>
                                    <span style={{ width: '18px', textAlign: 'center' }}>EDIT</span>
                                    <span style={{ width: '18px', textAlign: 'center' }}>DELETE</span>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {MODULES.map(module => {
                                    const mPerms = permissions[module.name]?.actions || { view: false, edit: false, delete: false };
                                    const mSubTabs = permissions[module.name]?.subTabs || [];
                                    const hasAccess = Object.values(mPerms).some(v => v);
                                    const isExpanded = expandedModule === module.name;
                                    const availableSubTabs = SUB_TABS[module.name] || [];

                                    return (
                                        <div
                                            key={module.name}
                                            style={{
                                                borderRadius: '8px',
                                                border: '1px solid var(--border)',
                                                backgroundColor: hasAccess ? '#ffffff' : '#fcfcfc',
                                                overflow: 'hidden'
                                            }}
                                        >
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    padding: '12px 16px',
                                                    cursor: 'default'
                                                }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                                                    <div style={{ color: hasAccess ? 'var(--primary)' : 'var(--text-muted)' }}>
                                                        <module.icon size={18} />
                                                    </div>
                                                    <span style={{
                                                        fontSize: '14px',
                                                        fontWeight: '600',
                                                        color: hasAccess ? 'var(--primary)' : 'var(--text-main)'
                                                    }}>
                                                        {module.name}
                                                    </span>
                                                    {availableSubTabs.length > 0 && hasAccess && (
                                                        <button
                                                            onClick={() => setExpandedModule(isExpanded ? null : module.name)}
                                                            style={{
                                                                background: 'none', border: 'none', cursor: 'pointer',
                                                                color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
                                                                gap: '4px', fontSize: '11px', fontWeight: '700',
                                                                marginLeft: '8px', padding: '2px 8px', borderRadius: '4px',
                                                                backgroundColor: '#f1f5f9'
                                                            }}
                                                        >
                                                            {mSubTabs.length} / {availableSubTabs.length} Tabs
                                                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                        </button>
                                                    )}
                                                </div>

                                                <div style={{ display: 'flex', gap: '30px', alignItems: 'center' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={mPerms.view}
                                                        onChange={() => toggleAction(module.name, 'view')}
                                                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                                    />
                                                    <input
                                                        type="checkbox"
                                                        checked={mPerms.edit}
                                                        onChange={() => toggleAction(module.name, 'edit')}
                                                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                                    />
                                                    <input
                                                        type="checkbox"
                                                        checked={mPerms.delete}
                                                        onChange={() => toggleAction(module.name, 'delete')}
                                                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                                    />
                                                </div>
                                            </div>

                                            {isExpanded && hasAccess && availableSubTabs.length > 0 && (
                                                <div style={{
                                                    padding: '12px 16px 16px 46px',
                                                    borderTop: '1px solid #f1f5f9',
                                                    backgroundColor: '#f8fafc',
                                                    display: 'grid',
                                                    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                                                    gap: '10px'
                                                }}>
                                                    {availableSubTabs.map(subTab => (
                                                        <div
                                                            key={subTab}
                                                            onClick={() => toggleSubTab(module.name, subTab)}
                                                            style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '8px',
                                                                cursor: 'pointer',
                                                                padding: '6px 10px',
                                                                borderRadius: '6px',
                                                                border: '1px solid' + (mSubTabs.includes(subTab) ? ' var(--primary-light)' : ' transparent'),
                                                                backgroundColor: mSubTabs.includes(subTab) ? '#ffffff' : 'transparent',
                                                                transition: 'all 0.2s'
                                                            }}
                                                        >
                                                            <div style={{
                                                                width: '16px',
                                                                height: '16px',
                                                                borderRadius: '4px',
                                                                border: '1px solid ' + (mSubTabs.includes(subTab) ? 'var(--primary)' : 'var(--border)'),
                                                                backgroundColor: mSubTabs.includes(subTab) ? 'var(--primary)' : 'transparent',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                color: 'white'
                                                            }}>
                                                                {mSubTabs.includes(subTab) && <ShieldCheck size={10} strokeWidth={3} />}
                                                            </div>
                                                            <span style={{
                                                                fontSize: '12px',
                                                                fontWeight: mSubTabs.includes(subTab) ? '700' : '600',
                                                                color: mSubTabs.includes(subTab) ? 'var(--primary)' : 'var(--text-muted)'
                                                            }}>
                                                                {subTab}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="modal-footer" style={{ justifyContent: 'flex-end', gap: '12px', padding: '20px 24px', borderTop: '1px solid var(--border)' }}>
                    <button className="btn btn-outline" onClick={onClose}>Cancel</button>
                    <button
                        className="btn btn-primary"
                        onClick={handleCreate}
                        disabled={!roleName || Object.keys(permissions).length === 0}
                        style={{ opacity: (!roleName || Object.keys(permissions).length === 0) ? 0.6 : 1, fontWeight: '800' }}
                    >
                        {initialData ? 'UPDATE ROLE' : 'CREATE ROLE'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CreateRoleModal;

import React, { useState, useEffect, useRef } from 'react';
import { X, Loader2, AlertCircle, CheckCircle, Users, Search, Check } from 'lucide-react';
import { projectAPI, employeeAPI } from '../utils/api';
import PremiumSelect from './PremiumSelect';
import CustomSelect from './CustomSelect';

const CreateProjectModal = ({ isOpen, onClose, onProjectCreated }) => {
    const [form, setForm] = useState({
        name: '',
        client: '',
        location: '',
        budget: '',
        start_date: '',
        end_date: '',
        // Single source of truth for project assignment — admin picks any
        // number of staff. engineer_id / coordinator_id are derived from
        // the first / second selection at submit time so legacy reads
        // (dashboards, notifications) keep working.
        assigned_members: [],
        status: 'Ongoing',
        latitude: '',
        longitude: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [staff, setStaff] = useState([]);
    const [memberSearch, setMemberSearch] = useState('');
    const [memberDropdownOpen, setMemberDropdownOpen] = useState(false);
    const memberWrapRef = useRef(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        if (!memberDropdownOpen) return;
        const handleClickOutside = (e) => {
            if (memberWrapRef.current && !memberWrapRef.current.contains(e.target)) {
                setMemberDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [memberDropdownOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const fetchStaff = async () => {
            try {
                const res = await employeeAPI.getAll();
                const emps = res.data || [];
                // Include monthly-salaried staff with at least one role
                // assigned (management/professional). RBAC is enforced
                // elsewhere; this list is just for project assignment UX.
                const list = emps
                    .filter(emp => (emp.salaryType === 'monthly' || !emp.salaryType)
                        && Array.isArray(emp.roles) && emp.roles.length > 0)
                    .map(emp => ({
                        value: emp.employeeCode || emp.username || (emp._id ? emp._id.toString() : ''),
                        label: emp.fullName,
                        // Show role badge under name (first role)
                        role: Array.isArray(emp.roles) && emp.roles.length > 0 ? emp.roles[0] : '',
                    }))
                    .filter(s => s.value);

                // Always include an "Admin" option as fallback
                const uniqueMap = new Map();
                uniqueMap.set('admin', { value: 'admin', label: 'Admin', role: 'Administrator' });
                list.forEach(item => uniqueMap.set(item.value, item));
                setStaff(Array.from(uniqueMap.values()));
            } catch (err) {
                console.error('Failed to fetch staff:', err);
            }
        };
        fetchStaff();
    }, [isOpen]);

    if (!isOpen) return null;

    const handleChange = (e) => {
        setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Basic validation
        if (!form.name || !form.client || !form.location || !form.budget || !form.start_date || !form.end_date) {
            setError('Please fill in all required fields.');
            return;
        }
        if (parseFloat(form.budget) <= 0) {
            setError('Budget must be greater than zero.');
            return;
        }
        if (form.start_date > form.end_date) {
            setError('Start date cannot be after end date.');
            return;
        }
        if (!Array.isArray(form.assigned_members) || form.assigned_members.length === 0) {
            setError('Please assign at least one team member.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            // Backward-compat: engineer_id / coordinator_id are derived from
            // the first (and second, if present) selected member so existing
            // widgets that read a single primary assignee keep working.
            const primary = form.assigned_members[0];
            const secondary = form.assigned_members[1] || form.assigned_members[0];

            const payload = {
                name: form.name,
                client: form.client,
                location: form.location,
                budget: parseFloat(form.budget),
                start_date: new Date(form.start_date).toISOString(),
                end_date: new Date(form.end_date).toISOString(),
                assigned_members: form.assigned_members,
                engineer_id: primary,
                coordinator_id: secondary,
                status: form.status,
                latitude: form.latitude ? parseFloat(form.latitude) : null,
                longitude: form.longitude ? parseFloat(form.longitude) : null,
                tasks: [],
                progress: 0,
            };

            const response = await projectAPI.create(payload);
            onProjectCreated && onProjectCreated(response.data);

            // Reset form
            setForm({
                name: '', client: '', location: '', budget: '',
                start_date: '', end_date: '',
                assigned_members: [],
                status: 'Ongoing', latitude: '', longitude: ''
            });
            setMemberSearch('');
            setMemberDropdownOpen(false);
            onClose();
        } catch (err) {
            console.error('Create project error:', err);
            setError(err?.response?.data?.detail || 'Failed to create project. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Toggle a member's selection
    const toggleMember = (value) => {
        setForm(prev => {
            const exists = prev.assigned_members.includes(value);
            return {
                ...prev,
                assigned_members: exists
                    ? prev.assigned_members.filter(v => v !== value)
                    : [...prev.assigned_members, value],
            };
        });
        setError('');
    };

    // Resolve a member value → its option object for chip rendering
    const findStaff = (value) => staff.find(s => s.value === value);
    const filteredStaff = staff.filter(s => {
        if (!memberSearch.trim()) return true;
        const q = memberSearch.trim().toLowerCase();
        return s.label.toLowerCase().includes(q) || (s.role || '').toLowerCase().includes(q);
    });

    const inputStyle = {
        width: '100%', padding: '8px 12px', borderRadius: '8px',
        border: '1px solid var(--border)', fontSize: '13px',
        outline: 'none', backgroundColor: '#FAFAFA',
        transition: 'all 0.2s',
        boxSizing: 'border-box',
    };
    const labelStyle = { display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: '700', color: 'var(--text-main)' };

    return (
        <>
            <div className="modal-overlay">
                <div className="card animate-fade-in" style={{ 
                    width: 'min(95%, 700px)', 
                    backgroundColor: 'white', 
                    padding: '24px', 
                    maxHeight: 'min(95vh, 800px)', 
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: '16px',
                    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
                }}>
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <div>
                            <h2 style={{ fontSize: '18px', fontWeight: '800' }}>Create New Project</h2>
                            <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px' }}>Fill in details to register project</p>
                        </div>
                        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}>
                            <X size={20} />
                        </button>
                    </div>

                    {/* Error */}
                    {error && (
                        <div style={{ padding: '12px 16px', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', marginBottom: '20px', display: 'flex', gap: '8px', alignItems: 'center', color: '#DC2626', fontSize: '13px', fontWeight: '600' }}>
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}

                    <div className="custom-scrollbar" style={{ overflowY: 'auto', paddingRight: '4px', flex: 1 }}>
                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {/* Project + Client in one row for better vertical space */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div>
                                    <label style={labelStyle}>Project Name *</label>
                                    <input name="name" value={form.name} onChange={handleChange} type="text" placeholder="e.g. Sunset Heights" style={inputStyle} />
                                </div>
                                <div>
                                    <label style={labelStyle}>Client Name *</label>
                                    <input name="client" value={form.client} onChange={handleChange} type="text" placeholder="e.g. Lakshmi Developers" style={inputStyle} />
                                </div>
                            </div>

                            {/* Location + Budget in one row */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)', gap: '16px' }}>
                                <div>
                                    <label style={labelStyle}>Location *</label>
                                    <input name="location" value={form.location} onChange={handleChange} type="text" placeholder="e.g. Coimbatore, Tamil Nadu" style={inputStyle} />
                                </div>
                                <div>
                                    <label style={labelStyle}>Total Budget (₹) *</label>
                                    <input name="budget" value={form.budget} onChange={handleChange} type="number" placeholder="e.g. 25000000" style={inputStyle} min="0" />
                                </div>
                            </div>

                            {/* Coordinates + Status */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                                <div>
                                    <label style={labelStyle}>Latitude</label>
                                    <input name="latitude" value={form.latitude} onChange={handleChange} type="number" step="any" placeholder="11.0168" style={inputStyle} />
                                </div>
                                <div>
                                    <label style={labelStyle}>Longitude</label>
                                    <input name="longitude" value={form.longitude} onChange={handleChange} type="number" step="any" placeholder="76.9558" style={inputStyle} />
                                </div>
                                <div style={{ paddingTop: '2px' }}>
                                    <CustomSelect
                                        label="Status"
                                        options={[
                                            { value: 'Ongoing', label: 'Ongoing' },
                                            { value: 'On Hold', label: 'On Hold' },
                                            { value: 'Completed', label: 'Completed' }
                                        ]}
                                        value={form.status}
                                        onChange={(val) => setForm(prev => ({ ...prev, status: val }))}
                                        icon={CheckCircle}
                                        width="full"
                                    />
                                </div>
                            </div>

                            {/* Dates */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div>
                                    <label style={labelStyle}>Start Date *</label>
                                    <input name="start_date" value={form.start_date} onChange={handleChange} type="date" style={inputStyle} />
                                </div>
                                <div>
                                    <label style={labelStyle}>End Date *</label>
                                    <input name="end_date" value={form.end_date} onChange={handleChange} type="date" style={inputStyle} />
                                </div>
                            </div>

                            {/* Assigned Team Members (multi-select) */}
                            <div ref={memberWrapRef} style={{ position: 'relative' }}>
                                <label style={labelStyle}>Assigned Team Members *</label>
                                {/* Chip + trigger box */}
                                <div
                                    onClick={() => setMemberDropdownOpen(o => !o)}
                                    style={{
                                        ...inputStyle,
                                        minHeight: 40, padding: '6px 10px',
                                        display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center',
                                        cursor: 'pointer', backgroundColor: 'white',
                                    }}
                                >
                                    {form.assigned_members.length === 0 && (
                                        <span style={{ color: '#94A3B8', fontSize: 13 }}>
                                            Select one or more team members...
                                        </span>
                                    )}
                                    {form.assigned_members.map(val => {
                                        const opt = findStaff(val);
                                        if (!opt) return null;
                                        return (
                                            <span key={val} style={{
                                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                                padding: '4px 8px', borderRadius: 6,
                                                backgroundColor: '#EFF6FF', color: '#1D4ED8',
                                                fontSize: 12, fontWeight: 600,
                                            }}>
                                                {opt.label}
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); toggleMember(val); }}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 0, color: '#1D4ED8' }}
                                                    aria-label={`Remove ${opt.label}`}
                                                >
                                                    <X size={12} />
                                                </button>
                                            </span>
                                        );
                                    })}
                                    <Users size={14} style={{ marginLeft: 'auto', color: '#64748B', flexShrink: 0 }} />
                                </div>

                                {/* Dropdown panel */}
                                {memberDropdownOpen && (
                                    <div style={{
                                        position: 'absolute', top: '100%', left: 0, right: 0,
                                        marginTop: 4, backgroundColor: 'white',
                                        border: '1px solid var(--border)', borderRadius: 8,
                                        boxShadow: '0 10px 25px rgba(0,0,0,0.12)',
                                        zIndex: 20, maxHeight: 280, display: 'flex', flexDirection: 'column',
                                    }}>
                                        <div style={{ padding: 8, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <Search size={14} color="#64748B" />
                                            <input
                                                type="text"
                                                placeholder="Search by name or role..."
                                                value={memberSearch}
                                                onChange={e => setMemberSearch(e.target.value)}
                                                autoFocus
                                                style={{ flex: 1, border: 'none', outline: 'none', fontSize: 13, padding: '4px 2px', backgroundColor: 'transparent' }}
                                            />
                                            {form.assigned_members.length > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() => setForm(prev => ({ ...prev, assigned_members: [] }))}
                                                    style={{ fontSize: 11, fontWeight: 700, color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer' }}
                                                >
                                                    Clear all
                                                </button>
                                            )}
                                        </div>
                                        <div style={{ overflowY: 'auto', flex: 1 }}>
                                            {filteredStaff.length === 0 ? (
                                                <div style={{ padding: '20px 12px', textAlign: 'center', color: '#94A3B8', fontSize: 12 }}>
                                                    No matching staff
                                                </div>
                                            ) : filteredStaff.map(opt => {
                                                const selected = form.assigned_members.includes(opt.value);
                                                return (
                                                    <div
                                                        key={opt.value}
                                                        onClick={() => toggleMember(opt.value)}
                                                        style={{
                                                            display: 'flex', alignItems: 'center', gap: 10,
                                                            padding: '8px 12px', cursor: 'pointer',
                                                            backgroundColor: selected ? '#EFF6FF' : 'transparent',
                                                        }}
                                                        onMouseEnter={e => { if (!selected) e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
                                                        onMouseLeave={e => { if (!selected) e.currentTarget.style.backgroundColor = 'transparent'; }}
                                                    >
                                                        <div style={{
                                                            width: 16, height: 16, borderRadius: 4,
                                                            border: `1.5px solid ${selected ? '#1D4ED8' : '#CBD5E1'}`,
                                                            backgroundColor: selected ? '#1D4ED8' : 'white',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        }}>
                                                            {selected && <Check size={12} color="white" />}
                                                        </div>
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <div style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                {opt.label}
                                                            </div>
                                                            {opt.role && (
                                                                <div style={{ fontSize: 11, color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                    {opt.role}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <div style={{ padding: 8, borderTop: '1px solid var(--border)', textAlign: 'right' }}>
                                            <span style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>
                                                {form.assigned_members.length} selected
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </form>
                    </div>

                    {/* Footer Buttons Fixed at Bottom */}
                    <div style={{ display: 'flex', gap: '12px', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border)', justifyContent: 'flex-end' }}>
                        <button type="button" className="btn btn-outline" style={{ height: '40px', padding: '0 20px', fontSize: '13px' }} onClick={onClose} disabled={loading}>
                            Cancel
                        </button>
                        <button onClick={handleSubmit} type="button" className="btn btn-primary" style={{ height: '40px', padding: '0 28px', fontSize: '13px', fontWeight: '800' }} disabled={loading}>
                            {loading ? (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                                    <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                                    Creating...
                                </span>
                            ) : '+ Create Project'}
                        </button>
                    </div>


                    <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
                </div>
            </div>
        </>
    );
};

export default CreateProjectModal;

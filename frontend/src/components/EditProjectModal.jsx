import React, { useState, useEffect, useRef } from 'react';
import { X, Loader2, AlertCircle, CheckCircle, Users, Search, Check } from 'lucide-react';
import { projectAPI, employeeAPI } from '../utils/api';
import PremiumSelect from './PremiumSelect';

const EditProjectModal = ({ isOpen, onClose, project, onProjectUpdated }) => {
    const [form, setForm] = useState({
        name: '',
        client: '',
        location: '',
        budget: '',
        start_date: '',
        end_date: '',
        assigned_members: [],
        status: '',
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
        if (project) {
            // Resolve potentially-populated object refs back to string IDs
            const getStringId = (val) => {
                if (!val) return '';
                if (typeof val === 'object') {
                    return val._id || val.id || val.username || val.employeeCode || '';
                }
                return String(val);
            };

            // Initialize assigned_members from existing field if present,
            // else fall back to [engineer_id, coordinator_id] for legacy
            // projects created before the multi-assign change.
            let members = Array.isArray(project.assigned_members)
                ? project.assigned_members.filter(Boolean).map(String)
                : [];
            if (members.length === 0) {
                const eng = getStringId(project.engineer_id);
                const coord = getStringId(project.coordinator_id);
                const legacy = [eng, coord].filter(v => v && v !== 'engineer' && v !== 'coordinator');
                // De-duplicate while preserving order
                members = Array.from(new Set(legacy));
            }

            setForm({
                name: project.name || '',
                client: project.client || '',
                location: project.location || '',
                budget: project.budget || '',
                start_date: project.start_date ? project.start_date.split('T')[0] : '',
                end_date: project.end_date ? project.end_date.split('T')[0] : '',
                assigned_members: members,
                status: project.status || 'Ongoing',
                latitude: project.latitude || '',
                longitude: project.longitude || ''
            });
        }
    }, [project]);

    useEffect(() => {
        if (!isOpen) return;
        const fetchStaff = async () => {
            try {
                const res = await employeeAPI.getAll();
                const emps = res.data || [];
                const list = emps
                    .filter(emp => (emp.salaryType === 'monthly' || !emp.salaryType)
                        && Array.isArray(emp.roles) && emp.roles.length > 0)
                    .map(emp => ({
                        value: emp.employeeCode || emp.username || (emp._id ? emp._id.toString() : ''),
                        label: emp.fullName,
                        role: Array.isArray(emp.roles) && emp.roles.length > 0 ? emp.roles[0] : '',
                    }))
                    .filter(s => s.value);

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

    // If a member exists on the project but is not in the loaded staff list
    // (e.g. inactive employee, legacy default like "engineer"), still render
    // a chip with the raw value so the admin can see/remove it.
    const findStaff = (value) => staff.find(s => s.value === value) || { value, label: value, role: '' };
    const filteredStaff = staff.filter(s => {
        if (!memberSearch.trim()) return true;
        const q = memberSearch.trim().toLowerCase();
        return s.label.toLowerCase().includes(q) || (s.role || '').toLowerCase().includes(q);
    });

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!form.name || !form.client || !form.location || !form.budget || !form.start_date || !form.end_date) {
            setError('Please fill in all required fields.');
            return;
        }
        if (!Array.isArray(form.assigned_members) || form.assigned_members.length === 0) {
            setError('Please assign at least one team member.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            // Backward-compat: keep engineer_id / coordinator_id in sync
            // with the first / second selected member so legacy widgets
            // and notification recipients keep working.
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
            };

            const response = await projectAPI.update(project._id || project.id, payload);
            onProjectUpdated && onProjectUpdated(response.data);
            onClose();
        } catch (err) {
            console.error('Update project error:', err);
            setError(err?.response?.data?.detail || 'Failed to update project. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const inputStyle = {
        width: '100%', padding: '10px 12px', borderRadius: '8px',
        border: '1px solid var(--border)', fontSize: '14px',
        outline: 'none', backgroundColor: '#FAFAFA',
        transition: 'border-color 0.2s',
        boxSizing: 'border-box',
    };
    const labelStyle = { display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '700', color: 'var(--text-main)' };

    return (
        <div className="modal-overlay">
            <div className="card animate-fade-in" style={{ width: '600px', backgroundColor: 'white', padding: '32px', maxHeight: '90vh', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
                    <div>
                        <h2 style={{ fontSize: '20px', fontWeight: '800' }}>Edit Project</h2>
                        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>Update site details and location coordinates</p>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}>
                        <X size={22} />
                    </button>
                </div>

                {error && (
                    <div style={{ padding: '12px 16px', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', marginBottom: '20px', display: 'flex', gap: '8px', alignItems: 'center', color: '#DC2626', fontSize: '13px', fontWeight: '600' }}>
                        <AlertCircle size={16} />
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div>
                        <label style={labelStyle}>Project Name *</label>
                        <input name="name" value={form.name} onChange={handleChange} type="text" style={inputStyle} />
                    </div>
                    <div>
                        <label style={labelStyle}>Client Name *</label>
                        <input name="client" value={form.client} onChange={handleChange} type="text" style={inputStyle} />
                    </div>
                    <div>
                        <label style={labelStyle}>Location *</label>
                        <input name="location" value={form.location} onChange={handleChange} type="text" style={inputStyle} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '16px' }}>
                        <div>
                            <label style={labelStyle}>Latitude</label>
                            <input name="latitude" value={form.latitude} onChange={handleChange} type="number" step="any" placeholder="e.g. 11.0168" style={inputStyle} />
                        </div>
                        <div>
                            <label style={labelStyle}>Longitude</label>
                            <input name="longitude" value={form.longitude} onChange={handleChange} type="number" step="any" placeholder="e.g. 76.9558" style={inputStyle} />
                        </div>
                    </div>

                    <div>
                        <label style={labelStyle}>Total Budget (₹) *</label>
                        <input name="budget" value={form.budget} onChange={handleChange} type="number" style={inputStyle} min="0" />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '16px' }}>
                        <div>
                            <label style={labelStyle}>Start Date *</label>
                            <input name="start_date" value={form.start_date} onChange={handleChange} type="date" style={inputStyle} />
                        </div>
                        <div>
                            <label style={labelStyle}>End Date *</label>
                            <input name="end_date" value={form.end_date} onChange={handleChange} type="date" style={inputStyle} />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '16px' }}>
                        <div>
                            <label style={labelStyle}>Status</label>
                            <PremiumSelect
                                options={[
                                    { value: 'Ongoing', label: 'Ongoing' },
                                    { value: 'On Hold', label: 'On Hold' },
                                    { value: 'Completed', label: 'Completed' },
                                    { value: 'Delayed', label: 'Delayed' }
                                ]}
                                value={form.status}
                                onChange={(val) => setForm(prev => ({ ...prev, status: val }))}
                                icon={CheckCircle}
                            />
                        </div>
                    </div>

                    {/* Assigned Team Members (multi-select) */}
                    <div ref={memberWrapRef} style={{ position: 'relative' }}>
                        <label style={labelStyle}>Assigned Team Members *</label>
                        <div
                            onClick={() => setMemberDropdownOpen(o => !o)}
                            style={{
                                ...inputStyle,
                                minHeight: 44, padding: '6px 10px',
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

                    <div style={{ display: 'flex', gap: '12px', marginTop: '12px', paddingTop: '20px', borderTop: '1px solid var(--border)', justifyContent: 'flex-end' }}>
                        <button type="button" className="btn btn-outline" style={{ height: '44px', padding: '0 24px' }} onClick={onClose} disabled={loading}>
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary" style={{ height: '44px', padding: '0 32px', fontWeight: '800' }} disabled={loading}>
                            {loading ? <Loader2 className="animate-spin" size={18} /> : 'Save Changes'}
                        </button>
                    </div>
                </form>
                <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } .animate-spin { animation: spin 1s linear infinite; }`}</style>
            </div>
        </div>
    );
};

export default EditProjectModal;

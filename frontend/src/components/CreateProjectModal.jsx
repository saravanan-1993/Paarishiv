import React, { useState, useEffect } from 'react';
import { X, Loader2, AlertCircle, CheckCircle, Users } from 'lucide-react';
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
        engineer_id: 'admin',
        coordinator_id: 'admin',
        status: 'Ongoing',
        latitude: '',
        longitude: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [engineers, setEngineers] = useState([]);
    const [coordinators, setCoordinators] = useState([]);

    useEffect(() => {
        const fetchEngineers = async () => {
            try {
                const res = await employeeAPI.getAll();
                const emps = res.data || [];

                // Helper to build unique list from emps
                const getUniqueStaff = (filterFn, defaultOptions) => {
                    const list = emps
                        .filter(filterFn)
                        .map(emp => ({
                            // Bug 1.5 Fix: Use employeeCode as value for consistent matching with login username
                            value: emp.employeeCode || emp.username || (emp._id ? emp._id.toString() : ''),
                            label: emp.fullName
                        }));

                    const uniqueMap = new Map();
                    // Add default options first so they are preferred/exist
                    defaultOptions.forEach(opt => uniqueMap.set(opt.value, opt.label));
                    
                    // Add employees, overriding defaults if values match (or just adding)
                    list.forEach(item => {
                        if (item.value) {
                            uniqueMap.set(item.value, item.label);
                        }
                    });

                    return Array.from(uniqueMap.entries()).map(([value, label]) => ({ value, label }));
                };

                const engList = getUniqueStaff(
                    emp => {
                        const desig = (emp.designation || '').toLowerCase();
                        const roles = (emp.roles || []).map(r => r.toLowerCase());
                        const isEngineer = desig.includes('engineer') || desig.includes('engginer') || desig.includes('supervisor') || roles.some(r => r.includes('engineer') || r.includes('supervisor'));
                        return isEngineer && (emp.salaryType === 'monthly' || !emp.salaryType);
                    },
                    [{ value: 'admin', label: 'Admin' }]
                );
                setEngineers(engList);

                const coordList = getUniqueStaff(
                    emp => {
                        const desig = (emp.designation || '').toLowerCase();
                        const roles = (emp.roles || []).map(r => r.toLowerCase());
                        const isCoord = desig.includes('coordinator') || desig.includes('manager') || desig.includes('admin') || roles.some(r => r.includes('coordinator') || r.includes('manager'));
                        return isCoord && (emp.salaryType === 'monthly' || !emp.salaryType);
                    },
                    [{ value: 'admin', label: 'Admin' }]
                );
                setCoordinators(coordList);
            } catch (err) {
                console.error('Failed to fetch staff:', err);
            }
        };
        if (isOpen) fetchEngineers();
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

        setLoading(true);
        setError('');

        try {
            const payload = {
                name: form.name,
                client: form.client,
                location: form.location,
                budget: parseFloat(form.budget),
                start_date: new Date(form.start_date).toISOString(),
                end_date: new Date(form.end_date).toISOString(),
                engineer_id: form.engineer_id,
                coordinator_id: form.coordinator_id,
                status: form.status,
                latitude: form.latitude ? parseFloat(form.latitude) : null,
                longitude: form.longitude ? parseFloat(form.longitude) : null,
                tasks: [],
                progress: 0,
            };

            const response = await projectAPI.create(payload);
            onProjectCreated && onProjectCreated(response.data);

            // Reset form
            setForm({ name: '', client: '', location: '', budget: '', start_date: '', end_date: '', engineer_id: 'admin', coordinator_id: 'admin', status: 'Ongoing', latitude: '', longitude: '' });
            onClose();
        } catch (err) {
            console.error('Create project error:', err);
            setError(err?.response?.data?.detail || 'Failed to create project. Please try again.');
        } finally {
            setLoading(false);
        }
    };

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
            <div style={{
                position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 1000, backdropFilter: 'blur(4px)', padding: '20px'
            }}>
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

                            {/* Engineer + Coordinator */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div>
                                    <CustomSelect
                                        label="Site Engineer"
                                        options={engineers}
                                        value={form.engineer_id}
                                        onChange={(val) => setForm(prev => ({ ...prev, engineer_id: val }))}
                                        icon={Users}
                                        width="full"
                                        searchable={true}
                                    />
                                </div>
                                <div>
                                    <CustomSelect
                                        label="Coordinator"
                                        options={coordinators}
                                        value={form.coordinator_id}
                                        onChange={(val) => setForm(prev => ({ ...prev, coordinator_id: val }))}
                                        icon={Users}
                                        width="full"
                                        searchable={true}
                                    />
                                </div>
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

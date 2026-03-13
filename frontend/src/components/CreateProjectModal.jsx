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
        engineer_id: 'engineer',
        coordinator_id: 'coordinator',
        status: 'Ongoing',
        latitude: '',
        longitude: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [engineers, setEngineers] = useState([
        { value: 'engineer', label: 'Suki Engineer' },
        { value: 'admin', label: 'Admin' }
    ]);
    const [coordinators, setCoordinators] = useState([
        { value: 'coordinator', label: 'Project Coordinator' },
        { value: 'admin', label: 'Admin' }
    ]);

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
                            // Use _id as the primary unique value to prevent jumper-back bugs with duplicate codes
                            value: (emp._id ? emp._id.toString() : '') || emp.username || emp.employeeCode,
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
                    emp => emp.designation?.toLowerCase().includes('engineer') ||
                           emp.roles?.some(role => role.toLowerCase().includes('engineer')),
                    [
                        { value: 'engineer', label: 'Suki Engineer' },
                        { value: 'admin', label: 'Admin' }
                    ]
                );
                setEngineers(engList);

                const coordList = getUniqueStaff(
                    emp => emp.designation?.toLowerCase().includes('coordinator') ||
                           emp.roles?.some(role => role.toLowerCase().includes('coordinator')),
                    [
                        { value: 'coordinator', label: 'Project Coordinator' },
                        { value: 'admin', label: 'Admin' }
                    ]
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
            setForm({ name: '', client: '', location: '', budget: '', start_date: '', end_date: '', engineer_id: 'engineer', coordinator_id: 'coordinator', status: 'Ongoing', latitude: '', longitude: '' });
            onClose();
        } catch (err) {
            console.error('Create project error:', err);
            setError(err?.response?.data?.detail || 'Failed to create project. Please try again.');
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
        <>
            <div style={{
                position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 1000, backdropFilter: 'blur(4px)', padding: '20px'
            }}>
                <div className="card animate-fade-in" style={{ width: '600px', backgroundColor: 'white', padding: '32px', maxHeight: '90vh', overflowY: 'auto' }}>
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
                        <div>
                            <h2 style={{ fontSize: '20px', fontWeight: '800' }}>Create New Project</h2>
                            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>Fill in details to register the project in ERP</p>
                        </div>
                        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}>
                            <X size={22} />
                        </button>
                    </div>

                    {/* Error */}
                    {error && (
                        <div style={{ padding: '12px 16px', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', marginBottom: '20px', display: 'flex', gap: '8px', alignItems: 'center', color: '#DC2626', fontSize: '13px', fontWeight: '600' }}>
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {/* Project Name */}
                        <div>
                            <label style={labelStyle}>Project Name *</label>
                            <input name="name" value={form.name} onChange={handleChange} type="text" placeholder="e.g. Sunset Heights Phase 2" style={inputStyle} />
                        </div>

                        {/* Client Name */}
                        <div>
                            <label style={labelStyle}>Client Name *</label>
                            <input name="client" value={form.client} onChange={handleChange} type="text" placeholder="e.g. Lakshmi Developers Pvt Ltd" style={inputStyle} />
                        </div>

                        {/* Location */}
                        <div>
                            <label style={labelStyle}>Location *</label>
                            <input name="location" value={form.location} onChange={handleChange} type="text" placeholder="e.g. Coimbatore, Tamil Nadu" style={inputStyle} />
                        </div>

                        {/* Coordinates */}
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

                        {/* Status + Budget */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '16px' }}>
                            <div>
                                <label style={labelStyle}>Total Budget (₹) *</label>
                                <input name="budget" value={form.budget} onChange={handleChange} type="number" placeholder="e.g. 25000000" style={inputStyle} min="0" />
                            </div>
                            <div>
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

                        {/* Engineer + Coordinator */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '16px' }}>
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

                        {/* Buttons */}
                        <div style={{ display: 'flex', gap: '12px', marginTop: '12px', paddingTop: '20px', borderTop: '1px solid var(--border)', justifyContent: 'flex-end' }}>
                            <button type="button" className="btn btn-outline" style={{ height: '44px', padding: '0 24px' }} onClick={onClose} disabled={loading}>
                                Cancel
                            </button>
                            <button type="submit" className="btn btn-primary" style={{ height: '44px', padding: '0 32px', fontWeight: '800' }} disabled={loading}>
                                {loading ? (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                                        <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                                        Creating...
                                    </span>
                                ) : '+ Create Project'}
                            </button>
                        </div>
                    </form>

                    <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
                </div>
            </div>
        </>
    );
};

export default CreateProjectModal;

import React, { useState, useEffect } from 'react';
import { X, Truck, Loader2 } from 'lucide-react';
import { fleetAPI, projectAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const LOAD_TYPES = ['Sand', 'Cement', 'Steel', 'Aggregate', 'M-Sand', 'Bricks', 'Gravel', 'Soil', 'Debris', 'Water', 'Equipment', 'Other'];
const UNITS = ['Tons', 'Loads', 'Bags', 'Cu.m', 'Nos', 'Kgs'];

const TripRequestModal = ({ isOpen, onClose, onSuccess }) => {
    const { user } = useAuth();
    const toast = useToast();
    const [projects, setProjects] = useState([]);
    const [isSaving, setIsSaving] = useState(false);
    const [form, setForm] = useState({
        project_id: '',
        project_name: '',
        load_type: 'Sand',
        from_location: '',
        to_location: '',
        quantity: '',
        quantity_unit: 'Tons',
        requested_date: new Date().toISOString().split('T')[0],
        remarks: '',
    });

    useEffect(() => {
        if (isOpen) {
            projectAPI.getAll().then(r => setProjects(r.data || [])).catch(() => {});
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleProjectChange = (e) => {
        const proj = projects.find(p => p._id === e.target.value || p.id === e.target.value);
        setForm(f => ({ ...f, project_id: e.target.value, project_name: proj?.name || '' }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.from_location.trim() || !form.to_location.trim()) {
            toast.warning('Please fill From Location and To Location.');
            return;
        }
        setIsSaving(true);
        try {
            const res = await fleetAPI.createTripRequest({
                ...form,
                quantity: form.quantity ? parseFloat(form.quantity) : null,
            });
            if (onSuccess) onSuccess(res.data);
            setForm({
                project_id: '', project_name: '', load_type: 'Sand',
                from_location: '', to_location: '', quantity: '',
                quantity_unit: 'Tons', requested_date: new Date().toISOString().split('T')[0], remarks: '',
            });
            onClose();
        } catch (err) {
            toast.error(err?.response?.data?.detail || 'Failed to submit trip request.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="card animate-fade-in" style={{ width: '90%', maxWidth: '520px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0 }}>
                <div className="modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', backgroundColor: '#eff6ff', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>
                            <Truck size={20} />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '18px', fontWeight: '800' }}>Request a Trip</h3>
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Submit transport / material delivery request</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="modal-body" style={{ padding: '24px', overflowY: 'auto' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Project *</label>
                            <select
                                required
                                value={form.project_id}
                                onChange={handleProjectChange}
                                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '14px' }}
                            >
                                <option value="">Select project...</option>
                                {projects.map(p => (
                                    <option key={p._id || p.id} value={p._id || p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Load / Material Type *</label>
                            <select
                                required
                                value={form.load_type}
                                onChange={e => setForm(f => ({ ...f, load_type: e.target.value }))}
                                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '14px' }}
                            >
                                {LOAD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>From Location *</label>
                                <input
                                    required
                                    type="text"
                                    placeholder="e.g. Quarry / Vendor"
                                    value={form.from_location}
                                    onChange={e => setForm(f => ({ ...f, from_location: e.target.value }))}
                                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>To Location *</label>
                                <input
                                    required
                                    type="text"
                                    placeholder="e.g. Site / Store"
                                    value={form.to_location}
                                    onChange={e => setForm(f => ({ ...f, to_location: e.target.value }))}
                                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Quantity</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="e.g. 10"
                                    value={form.quantity}
                                    onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Unit</label>
                                <select
                                    value={form.quantity_unit}
                                    onChange={e => setForm(f => ({ ...f, quantity_unit: e.target.value }))}
                                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '14px' }}
                                >
                                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Required Date</label>
                            <input
                                type="date"
                                value={form.requested_date}
                                onChange={e => setForm(f => ({ ...f, requested_date: e.target.value }))}
                                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Remarks</label>
                            <textarea
                                rows={3}
                                placeholder="Additional notes..."
                                value={form.remarks}
                                onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
                                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', resize: 'vertical' }}
                            />
                        </div>

                    </div>

                    <div className="modal-footer" style={{ borderTop: 'none', padding: '24px 0 0 0', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                        <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
                        <button type="submit" disabled={isSaving} className="btn btn-primary" style={{ fontWeight: '800' }}>
                            {isSaving ? <Loader2 size={16} className="animate-spin" /> : 'Submit Request'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default TripRequestModal;

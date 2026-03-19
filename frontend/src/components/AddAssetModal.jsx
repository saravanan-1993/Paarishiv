import React, { useState, useEffect } from 'react';
import { X, Construction, Briefcase } from 'lucide-react';
import { projectAPI } from '../utils/api';
import CustomSelect from './CustomSelect';

const AddAssetModal = ({ isOpen, onClose, onAssetAdded }) => {
    const [projects, setProjects] = useState([]);
    const [formData, setFormData] = useState({
        id: '',
        name: '',
        category: '',
        site: '',
        status: 'Working',
        diesel: '',
        hours: ''
    });

    useEffect(() => {
        if (isOpen) {
            const load = async () => {
                try {
                    const res = await projectAPI.getAll();
                    setProjects(res.data || []);
                } catch (err) {
                    console.error('Failed to load projects:', err);
                }
            };
            load();
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        onAssetAdded({
            ...formData,
            diesel: `${formData.diesel}L/day`,
            hours: `${formData.hours}h`
        });
        onClose();
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '540px', width: '95%', overflow: 'visible' }}>
                <div className="modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', backgroundColor: '#eff6ff', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                            <Construction size={22} />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '18px', fontWeight: '800' }}>ADD NEW EQUIPMENT</h3>
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Register new machinery to the fleet</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="modal-body" style={{ padding: '24px', overflow: 'visible' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                        <div className="form-group">
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Equipment ID *</label>
                            <input type="text" required placeholder="e.g. EQP004" value={formData.id} onChange={(e) => setFormData({ ...formData, id: e.target.value })} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1.5px solid var(--border)', fontSize: '14px' }} />
                        </div>
                        <div className="form-group">
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Machine Name *</label>
                            <input type="text" required placeholder="e.g. Excavator" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1.5px solid var(--border)', fontSize: '14px' }} />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                        <div className="form-group">
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Category *</label>
                            <select required value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1.5px solid var(--border)', fontSize: '14px', backgroundColor: 'white' }}>
                                <option value="">Select</option>
                                <option value="Excavator">Excavator</option>
                                <option value="Backhoe">Backhoe</option>
                                <option value="Mixer">Mixer</option>
                                <option value="Crane">Crane</option>
                                <option value="Truck">Truck</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <CustomSelect
                                label="Assign to Site *"
                                options={projects.map(p => ({ value: p.name, label: p.name }))}
                                value={formData.site}
                                onChange={(val) => setFormData({ ...formData, site: val })}
                                icon={Briefcase}
                                width="full"
                                searchable={true}
                                placeholder="Select Project"
                            />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                        <div className="form-group">
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Initial Hours</label>
                            <input type="number" placeholder="0" value={formData.hours} onChange={(e) => setFormData({ ...formData, hours: e.target.value })} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1.5px solid var(--border)', fontSize: '14px' }} />
                        </div>
                        <div className="form-group">
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Avg Fuel/Day (L)</label>
                            <input type="number" placeholder="0" value={formData.diesel} onChange={(e) => setFormData({ ...formData, diesel: e.target.value })} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1.5px solid var(--border)', fontSize: '14px' }} />
                        </div>
                    </div>

                    <div className="modal-footer" style={{ borderTop: '1px solid var(--border)', padding: '20px 0 0 0', gap: '12px', justifyContent: 'flex-end', display: 'flex' }}>
                        <button type="button" className="btn btn-outline" onClick={onClose} style={{ padding: '12px 24px' }}>Cancel</button>
                        <button type="submit" className="btn btn-primary" style={{ fontWeight: '800', padding: '12px 32px' }}>REGISTER EQUIPMENT</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddAssetModal;

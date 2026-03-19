import React, { useState, useEffect } from 'react';
import { X, Package, Plus, Trash2, Loader2, Briefcase } from 'lucide-react';
import { projectAPI, materialAPI, inventoryAPI } from '../utils/api';
import CustomSelect from './CustomSelect';
import { useAuth } from '../context/AuthContext';

const StockRequestModal = ({ isOpen, onClose, onSuccess }) => {
    const { user } = useAuth();
    const [isSaving, setIsSaving] = useState(false);
    const [projects, setProjects] = useState([]);
    const [materials, setMaterials] = useState([]);
    const [formData, setFormData] = useState({
        project_id: '',
        project_name: '',
        requested_items: [{ name: '', quantity: 1, unit: 'Nos' }]
    });

    useEffect(() => {
        if (isOpen) {
            const load = async () => {
                const [projRes, matRes] = await Promise.all([
                    projectAPI.getAll(),
                    materialAPI.getAll()
                ]);
                setProjects(projRes.data || []);
                setMaterials(matRes.data || []);
            };
            load();
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleAddItem = () => {
        setFormData({
            ...formData,
            requested_items: [...formData.requested_items, { name: '', quantity: 1, unit: 'Nos' }]
        });
    };

    const handleRemoveItem = (index) => {
        const items = [...formData.requested_items];
        items.splice(index, 1);
        setFormData({ ...formData, requested_items: items });
    };

    const handleItemChange = (index, field, value) => {
        const items = [...formData.requested_items];
        items[index][field] = value;
        if (field === 'name') {
            const mat = materials.find(m => m.name === value);
            if (mat) items[index].unit = mat.unit;
        }
        setFormData({ ...formData, requested_items: items });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.project_id) return alert('Please select a project');

        setIsSaving(true);
        try {
            const proj = projects.find(p => (p._id || p.id) === formData.project_id);
            await inventoryAPI.createRequest({
                ...formData,
                project_name: proj.name,
                engineer_id: user?.username || 'Gokul'
            });
            onSuccess();
        } catch (err) {
            console.error('Request error:', err);
            alert('Failed to submit request');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="modal-overlay" style={{ zIndex: 1100, backgroundColor: 'rgba(0,0,0,0.6)' }}>
            <div className="modal-content animate-fade-in" style={{ maxWidth: '600px', width: '90%' }}>
                <div className="modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', backgroundColor: '#eff6ff', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>
                            <Package size={20} />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '18px', fontWeight: '800' }}>New Stock Request</h3>
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Site Engineer requesting from Warehouse</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} /></button>
                </div>

                <form onSubmit={handleSubmit} className="modal-body" style={{ padding: '24px' }}>
                    <div style={{ marginBottom: '24px' }}>
                        <CustomSelect
                            label="Project / Site Selection"
                            options={projects.map(p => ({ value: p._id || p.id, label: p.name }))}
                            value={formData.project_id}
                            onChange={(val) => setFormData({ ...formData, project_id: val })}
                            icon={Briefcase}
                            width="full"
                        />
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <h4 style={{ fontSize: '14px', fontWeight: '700' }}>Requested Items</h4>
                            <button type="button" onClick={handleAddItem} className="btn btn-outline btn-sm" style={{ padding: '4px 12px' }}>
                                <Plus size={14} /> Add Item
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {formData.requested_items.map((item, idx) => (
                                <div key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', backgroundColor: '#f9fafb', padding: '12px', borderRadius: '8px' }}>
                                    <div style={{ flex: 1 }}>
                                        <CustomSelect
                                            label="Material Name"
                                            options={materials.map(m => ({ value: m.name, label: m.name }))}
                                            value={item.name}
                                            onChange={(val) => handleItemChange(idx, 'name', val)}
                                            placeholder="Select Material"
                                            width="full"
                                            searchable={true}
                                        />
                                    </div>
                                    <div style={{ width: '80px' }}>
                                        <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>Qty</label>
                                        <input
                                            type="number"
                                            required
                                            min="0.01"
                                            step="any"
                                            value={item.quantity}
                                            onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                                            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border)' }}
                                        />
                                    </div>
                                    <div style={{ width: '60px' }}>
                                        <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>Unit</label>
                                        <div style={{ padding: '10px', fontSize: '13px', color: 'var(--text-muted)' }}>{item.unit}</div>
                                    </div>
                                    <button type="button" onClick={() => handleRemoveItem(idx)} style={{ padding: '10px', color: '#ef4444', background: 'none', border: 'none' }}>
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div style={{ marginTop: '32px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                        <button type="button" onClick={onClose} className="btn btn-outline" style={{ fontWeight: '700' }}>Cancel</button>
                        <button type="submit" disabled={isSaving} className="btn btn-primary" style={{ fontWeight: '800', minWidth: '140px' }}>
                            {isSaving ? <Loader2 size={18} className="animate-spin" /> : 'SUBMIT REQUEST'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default StockRequestModal;

import React, { useState, useEffect, useMemo } from 'react';
import { X, Plus, Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { materialAPI, inventoryAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import CustomSelect from './CustomSelect';

const UrgentMaterialRequestModal = ({ isOpen, onClose, onSuccess, project }) => {
    const { user } = useAuth();
    const [saving, setSaving] = useState(false);
    const [materials, setMaterials] = useState([]);
    const [items, setItems] = useState([{ name: '', quantity: '', unit: '' }]);
    const [remarks, setRemarks] = useState('');

    useEffect(() => {
        if (isOpen) {
            materialAPI.getAll().then(res => setMaterials(res.data || [])).catch(() => {});
            setItems([{ name: '', quantity: '', unit: '' }]);
            setRemarks('');
        }
    }, [isOpen]);

    if (!isOpen || !project) return null;

    const addItem = () => setItems([...items, { name: '', quantity: '', unit: '' }]);
    const removeItem = (idx) => { if (items.length > 1) setItems(items.filter((_, i) => i !== idx)); };
    const updateItem = (idx, field, val) => {
        const newItems = [...items];
        newItems[idx][field] = val;
        if (field === 'name') {
            const mat = materials.find(m => m.name === val);
            if (mat && mat.unit) newItems[idx].unit = mat.unit;
        }
        setItems(newItems);
    };

    const materialOptions = useMemo(() => [
        { value: '', label: 'Select material' },
        ...materials.map(m => ({ value: m.name, label: m.name }))
    ], [materials]);

    const unitOptions = useMemo(() => {
        const units = new Set(materials.map(m => m.unit).filter(Boolean));
        ['Nos', 'Bags', 'Kg', 'Tons', 'Liters', 'Meters', 'Sq.ft', 'Cu.ft'].forEach(u => units.add(u));
        return [...units].sort().map(u => ({ value: u, label: u }));
    }, [materials]);

    const handleSubmit = async () => {
        const validItems = items.filter(i => i.name.trim() && parseInt(i.quantity) > 0);
        if (!validItems.length) { alert('Add at least one material with quantity'); return; }

        setSaving(true);
        try {
            await inventoryAPI.createRequest({
                project_id: project._id || project.id,
                project_name: project.name,
                engineer_id: user?.username || user?.employeeCode || '',
                requested_items: validItems.map(i => ({
                    name: i.name.trim(),
                    quantity: parseInt(i.quantity),
                    unit: i.unit || 'Nos',
                })),
                priority: 'Urgent',
                remarks: remarks || 'Urgent — required today',
                is_urgent: true,
            });
            alert('Urgent material request submitted!');
            onSuccess?.();
        } catch (err) {
            console.error(err);
            alert(err.response?.data?.detail || 'Failed to submit request');
        }
        setSaving(false);
    };

    return (
        <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div style={modal}>
                <div style={header}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#FEF2F2', color: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <AlertTriangle size={18} />
                        </div>
                        <div>
                            <div style={{ fontSize: 17, fontWeight: 800 }}>Urgent Material Request</div>
                            <div style={{ fontSize: 12, color: '#64748B' }}>{project.name} — Required Today</div>
                        </div>
                    </div>
                    <button onClick={onClose} style={iconBtn}><X size={20} /></button>
                </div>

                <div style={body}>
                    <div style={{ padding: '10px 14px', borderRadius: 8, backgroundColor: '#FEF2F2', border: '1px solid #FECACA', marginBottom: 16, fontSize: 13, color: '#991B1B', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <AlertTriangle size={14} />
                        This request will be marked as <strong>URGENT</strong> and sent for immediate processing.
                    </div>

                    {items.map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'flex-end' }}>
                            <div style={{ flex: 3 }}>
                                {idx === 0 && <label style={labelStyle}>Material</label>}
                                <CustomSelect
                                    options={materialOptions}
                                    value={item.name}
                                    onChange={val => updateItem(idx, 'name', val)}
                                    placeholder="Select material"
                                    width="full"
                                    searchable={true}
                                />
                            </div>
                            <div style={{ flex: 1 }}>
                                {idx === 0 && <label style={labelStyle}>Qty</label>}
                                <input type="number" min="1" value={item.quantity}
                                    onChange={e => updateItem(idx, 'quantity', e.target.value)}
                                    style={inputStyle} placeholder="0" />
                            </div>
                            <div style={{ flex: 1.5 }}>
                                {idx === 0 && <label style={labelStyle}>Unit</label>}
                                <CustomSelect
                                    options={unitOptions}
                                    value={item.unit}
                                    onChange={val => updateItem(idx, 'unit', val)}
                                    placeholder="Unit"
                                    width="full"
                                    searchable={false}
                                />
                            </div>
                            <div style={{ paddingBottom: 2 }}>
                                <button onClick={() => removeItem(idx)} disabled={items.length <= 1}
                                    style={{ background: 'none', border: 'none', color: items.length > 1 ? '#EF4444' : '#CBD5E1', cursor: items.length > 1 ? 'pointer' : 'default', padding: 6 }}>
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))}

                    <button onClick={addItem} style={addBtn}><Plus size={14} /> Add Material</button>

                    <div style={{ marginTop: 14 }}>
                        <label style={{ ...labelStyle, marginBottom: 4 }}>Remarks</label>
                        <textarea rows={2} value={remarks} onChange={e => setRemarks(e.target.value)}
                            style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
                            placeholder="Reason for urgency..." />
                    </div>
                </div>

                <div style={footer}>
                    <button onClick={onClose} style={cancelBtn} disabled={saving}>Cancel</button>
                    <button onClick={handleSubmit} style={urgentBtn} disabled={saving}>
                        {saving ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <AlertTriangle size={16} />}
                        Submit Urgent Request
                    </button>
                </div>
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
        </div>
    );
};

const overlay = { position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 };
const modal = { backgroundColor: 'white', borderRadius: 14, width: '100%', maxWidth: 650, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' };
const header = { padding: '18px 22px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' };
const body = { padding: '18px 22px', overflowY: 'auto', flex: 1 };
const footer = { padding: '14px 22px', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end', gap: 10 };
const iconBtn = { background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', padding: 4 };
const labelStyle = { fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', display: 'block', marginBottom: 4 };
const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #E2E8F0', fontSize: 14, outline: 'none', fontWeight: 600, textAlign: 'center' };
const addBtn = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px dashed #3B82F6', backgroundColor: '#EFF6FF', color: '#1D4ED8', fontSize: 12, fontWeight: 600, cursor: 'pointer' };
const cancelBtn = { padding: '9px 18px', borderRadius: 8, border: '1px solid #E2E8F0', backgroundColor: 'white', cursor: 'pointer', fontWeight: 600, color: '#475569' };
const urgentBtn = { padding: '9px 18px', borderRadius: 8, border: 'none', backgroundColor: '#EF4444', color: 'white', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };

export default UrgentMaterialRequestModal;

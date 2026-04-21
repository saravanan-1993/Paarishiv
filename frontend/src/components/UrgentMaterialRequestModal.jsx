import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { materialAPI, inventoryAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';

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
        // Auto-fill unit from material master when name is selected
        if (field === 'name') {
            const mat = materials.find(m => m.name === val);
            if (mat && mat.unit) newItems[idx].unit = mat.unit;
        }
        setItems(newItems);
    };

    // Get unique units from materials for manual entry fallback
    const knownUnits = [...new Set(materials.map(m => m.unit).filter(Boolean))];

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

                    <div style={{ border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden', marginBottom: 12 }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                            <thead>
                                <tr style={{ backgroundColor: '#F8FAFC' }}>
                                    <th style={th}>#</th>
                                    <th style={{ ...th, minWidth: 200 }}>Material</th>
                                    <th style={{ ...th, width: 90 }}>Quantity</th>
                                    <th style={{ ...th, width: 100 }}>Unit</th>
                                    <th style={{ ...th, width: 36 }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item, idx) => (
                                    <tr key={idx} style={{ borderTop: '1px solid #F1F5F9' }}>
                                        <td style={td}>{idx + 1}</td>
                                        <td style={td}>
                                            <input list="urgent-mat-list" value={item.name} onChange={e => updateItem(idx, 'name', e.target.value)}
                                                style={cellInput} placeholder="Select material" />
                                            <datalist id="urgent-mat-list">
                                                {materials.map((m, i) => <option key={i} value={m.name}>{m.name} ({m.unit || 'Nos'})</option>)}
                                            </datalist>
                                        </td>
                                        <td style={td}>
                                            <input type="number" min="1" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)}
                                                style={{ ...cellInput, textAlign: 'center', fontWeight: 700 }} placeholder="0" />
                                        </td>
                                        <td style={td}>
                                            <input list="unit-list" value={item.unit} onChange={e => updateItem(idx, 'unit', e.target.value)}
                                                style={cellInput} placeholder="Unit" />
                                            <datalist id="unit-list">
                                                {knownUnits.map((u, i) => <option key={i} value={u} />)}
                                            </datalist>
                                        </td>
                                        <td style={td}>
                                            <button onClick={() => removeItem(idx)} disabled={items.length <= 1}
                                                style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', padding: 4 }}>
                                                <Trash2 size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <button onClick={addItem} style={addBtn}><Plus size={14} /> Add Material</button>

                    <div style={{ marginTop: 14 }}>
                        <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4, display: 'block' }}>Remarks</label>
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

const overlay = { position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: 20 };
const modal = { backgroundColor: 'white', borderRadius: 14, width: '100%', maxWidth: 650, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' };
const header = { padding: '18px 22px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' };
const body = { padding: '18px 22px', overflowY: 'auto', flex: 1 };
const footer = { padding: '14px 22px', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end', gap: 10 };
const iconBtn = { background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', padding: 4 };
const th = { padding: '10px 12px', textAlign: 'left', fontSize: 11, color: '#64748B', fontWeight: 700, textTransform: 'uppercase' };
const td = { padding: '8px 10px', verticalAlign: 'middle' };
const cellInput = { width: '100%', padding: '7px 9px', borderRadius: 6, border: '1px solid #E2E8F0', fontSize: 13, outline: 'none' };
const addBtn = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px dashed #3B82F6', backgroundColor: '#EFF6FF', color: '#1D4ED8', fontSize: 12, fontWeight: 600, cursor: 'pointer' };
const cancelBtn = { padding: '9px 18px', borderRadius: 8, border: '1px solid #E2E8F0', backgroundColor: 'white', cursor: 'pointer', fontWeight: 600, color: '#475569' };
const urgentBtn = { padding: '9px 18px', borderRadius: 8, border: 'none', backgroundColor: '#EF4444', color: 'white', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };

export default UrgentMaterialRequestModal;

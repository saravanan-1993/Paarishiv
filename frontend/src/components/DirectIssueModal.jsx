import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Truck, Loader2 } from 'lucide-react';
import { inventoryAPI, projectAPI } from '../utils/api';

const DirectIssueModal = ({ isOpen, onClose, onSuccess }) => {
    const [saving, setSaving] = useState(false);
    const [projects, setProjects] = useState([]);
    const [warehouseStock, setWarehouseStock] = useState([]);
    const [selectedProject, setSelectedProject] = useState('');
    const [items, setItems] = useState([{ id: Date.now(), name: '', quantity: '', unit: 'Nos' }]);

    useEffect(() => {
        if (!isOpen) return;
        setSelectedProject('');
        setItems([{ id: Date.now(), name: '', quantity: '', unit: 'Nos' }]);
        Promise.all([
            projectAPI.getAll(),
            inventoryAPI.getWarehouse(),
        ]).then(([pRes, wRes]) => {
            setProjects((pRes.data || []).filter(p => p.status !== 'Completed'));
            setWarehouseStock(wRes.data || []);
        }).catch(() => {});
    }, [isOpen]);

    if (!isOpen) return null;

    const updateItem = (id, field, val) => {
        setItems(items.map(it => {
            if (it.id !== id) return it;
            const updated = { ...it, [field]: val };
            if (field === 'name') {
                const wh = warehouseStock.find(w => w.material_name === val);
                if (wh) updated.unit = wh.unit || 'Nos';
            }
            return updated;
        }));
    };
    const addItem = () => setItems([...items, { id: Date.now() + Math.random(), name: '', quantity: '', unit: 'Nos' }]);
    const removeItem = (id) => { if (items.length > 1) setItems(items.filter(it => it.id !== id)); };

    const getAvailable = (name) => {
        const wh = warehouseStock.find(w => w.material_name === name);
        return wh ? wh.stock : 0;
    };

    const handleSubmit = async () => {
        if (!selectedProject) { alert('Select a destination project'); return; }
        const valid = items.filter(it => it.name && parseFloat(it.quantity) > 0);
        if (!valid.length) { alert('Add at least one item with quantity'); return; }
        // Check stock
        for (const it of valid) {
            const avail = getAvailable(it.name);
            if (parseFloat(it.quantity) > avail) {
                alert(`Insufficient stock for ${it.name}. Available: ${avail}, Requested: ${it.quantity}`);
                return;
            }
        }

        setSaving(true);
        try {
            await inventoryAPI.bulkWarehouseIssue({
                request_id: '',
                project_name: selectedProject,
                items: valid.map(it => ({ name: it.name, quantity: parseFloat(it.quantity), unit: it.unit })),
            });
            alert(`${valid.length} materials sent to ${selectedProject}`);
            onSuccess?.();
            onClose();
        } catch (err) {
            console.error(err);
            alert(err.response?.data?.detail || 'Failed to issue materials');
        }
        setSaving(false);
    };

    return (
        <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div style={modal}>
                <div style={header}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#DBEAFE', color: '#1D4ED8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Truck size={18} />
                        </div>
                        <div>
                            <div style={{ fontSize: 17, fontWeight: 800 }}>Send to Site</div>
                            <div style={{ fontSize: 12, color: '#64748B' }}>Issue materials from warehouse to project site</div>
                        </div>
                    </div>
                    <button onClick={onClose} style={iconBtn}><X size={20} /></button>
                </div>

                <div style={body}>
                    <div style={{ marginBottom: 16 }}>
                        <label style={labelStyle}>Destination Project *</label>
                        <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)} style={inputStyle}>
                            <option value="">Select project...</option>
                            {projects.map(p => <option key={p._id || p.id} value={p.name}>{p.name}</option>)}
                        </select>
                    </div>

                    <div style={{ border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden', marginBottom: 12 }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                            <thead>
                                <tr style={{ backgroundColor: '#F8FAFC' }}>
                                    <th style={th}>Material</th>
                                    <th style={{ ...th, width: 80 }}>Available</th>
                                    <th style={{ ...th, width: 90 }}>Quantity</th>
                                    <th style={{ ...th, width: 70 }}>Unit</th>
                                    <th style={{ ...th, width: 36 }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map(it => {
                                    const avail = getAvailable(it.name);
                                    const qty = parseFloat(it.quantity) || 0;
                                    return (
                                        <tr key={it.id} style={{ borderTop: '1px solid #F1F5F9' }}>
                                            <td style={td}>
                                                <select value={it.name} onChange={e => updateItem(it.id, 'name', e.target.value)} style={cellInput}>
                                                    <option value="">Select material</option>
                                                    {warehouseStock.filter(w => w.stock > 0).map(w => (
                                                        <option key={w.material_name} value={w.material_name}>{w.material_name} ({w.stock} {w.unit})</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td style={{ ...td, textAlign: 'center' }}>
                                                {it.name ? (
                                                    <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                                                        backgroundColor: avail > 0 ? (qty > avail ? '#FEE2E2' : '#DCFCE7') : '#F1F5F9',
                                                        color: avail > 0 ? (qty > avail ? '#B91C1C' : '#15803D') : '#94A3B8' }}>
                                                        {avail}
                                                    </span>
                                                ) : '—'}
                                            </td>
                                            <td style={td}>
                                                <input type="number" min="0" value={it.quantity} onChange={e => updateItem(it.id, 'quantity', e.target.value)}
                                                    style={{ ...cellInput, textAlign: 'center', fontWeight: 700 }} placeholder="0" />
                                            </td>
                                            <td style={{ ...td, color: '#64748B', fontSize: 12 }}>{it.unit}</td>
                                            <td style={td}>
                                                <button onClick={() => removeItem(it.id)} disabled={items.length <= 1}
                                                    style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', padding: 4 }}>
                                                    <Trash2 size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <button onClick={addItem} style={addBtn}><Plus size={14} /> Add Material</button>
                </div>

                <div style={footer}>
                    <button onClick={onClose} style={cancelBtn}>Cancel</button>
                    <button onClick={handleSubmit} disabled={saving} style={saveBtn}>
                        {saving ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Truck size={16} />}
                        Send to Site
                    </button>
                </div>
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
        </div>
    );
};

const overlay = { position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: 20 };
const modal = { backgroundColor: 'white', borderRadius: 14, width: '100%', maxWidth: 700, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' };
const header = { padding: '18px 22px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' };
const body = { padding: '18px 22px', overflowY: 'auto', flex: 1 };
const footer = { padding: '14px 22px', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end', gap: 10 };
const iconBtn = { background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', padding: 4 };
const labelStyle = { fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4, display: 'block' };
const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13, outline: 'none' };
const th = { padding: '10px 12px', textAlign: 'left', fontSize: 11, color: '#64748B', fontWeight: 700, textTransform: 'uppercase' };
const td = { padding: '8px 10px', verticalAlign: 'middle' };
const cellInput = { width: '100%', padding: '7px 9px', borderRadius: 6, border: '1px solid #E2E8F0', fontSize: 13, outline: 'none' };
const addBtn = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px dashed #3B82F6', backgroundColor: '#EFF6FF', color: '#1D4ED8', fontSize: 12, fontWeight: 600, cursor: 'pointer', marginTop: 8 };
const cancelBtn = { padding: '9px 18px', borderRadius: 8, border: '1px solid #E2E8F0', backgroundColor: 'white', cursor: 'pointer', fontWeight: 600, color: '#475569' };
const saveBtn = { padding: '9px 18px', borderRadius: 8, border: 'none', backgroundColor: '#3B82F6', color: 'white', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };

export default DirectIssueModal;

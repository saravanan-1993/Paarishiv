import React, { useState, useEffect } from 'react';
import { X, ArrowRightLeft, Package, Truck, Hash, Loader2 } from 'lucide-react';
import { inventoryAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';

const TransferModal = ({ isOpen, onClose, onTransferAdded, projects = [] }) => {
    const { user } = useAuth();
    const projectNames = projects.map(p => p.name).filter(Boolean);
    const [loading, setLoading] = useState(false);
    const [sourceInventory, setSourceInventory] = useState([]);

    // Derive unique units from inventory data
    const availableUnits = React.useMemo(() => {
        const units = new Set(sourceInventory.map(i => i.unit).filter(Boolean));
        ['Nos', 'Bags', 'Kg', 'Tons', 'Liters', 'Meters'].forEach(u => units.add(u));
        return [...units].sort();
    }, [sourceInventory]);

    const [formData, setFormData] = useState({
        type: 'Material',
        from: '',
        to: '',
        items: [{ name: '', quantity: '', unit: 'Nos' }],
        notes: '',
    });

    // Fetch inventory for selected source project
    useEffect(() => {
        if (formData.from) {
            inventoryAPI.getWarehouseStock().then(res => {
                // Combine warehouse + site inventory
                const items = (res.data || []).map(i => ({ name: i.material_name, stock: i.stock, unit: i.unit || 'Nos' }));
                setSourceInventory(items.filter(i => i.stock > 0));
            }).catch(() => setSourceInventory([]));
        } else {
            setSourceInventory([]);
        }
    }, [formData.from]);

    if (!isOpen) return null;

    const addItem = () => setFormData(prev => ({ ...prev, items: [...prev.items, { name: '', quantity: '', unit: 'Nos' }] }));
    const removeItem = (idx) => setFormData(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));
    const updateItem = (idx, field, val) => {
        setFormData(prev => {
            const items = [...prev.items];
            items[idx] = { ...items[idx], [field]: val };
            if (field === 'name') {
                const found = sourceInventory.find(m => m.name === val);
                if (found) items[idx].unit = found.unit;
            }
            return { ...prev, items };
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.from || !formData.to) { alert('Select both source and destination'); return; }
        if (formData.from === formData.to) { alert('Source and destination cannot be the same'); return; }
        const validItems = formData.items.filter(i => i.name && parseFloat(i.quantity) > 0);
        if (validItems.length === 0) { alert('Add at least one item with name and quantity'); return; }

        setLoading(true);
        try {
            await inventoryAPI.requestTransfer({
                from_project: formData.from,
                to_project: formData.to,
                items: validItems.map(i => ({ name: i.name, quantity: parseFloat(i.quantity), unit: i.unit })),
                notes: formData.notes,
            });
            onTransferAdded?.();
            onClose();
        } catch (err) {
            console.error('Transfer failed:', err);
            alert(err?.response?.data?.detail || 'Failed to create transfer request');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '640px', width: '95%', paddingBottom: '0' }}>
                <div className="modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', backgroundColor: '#eff6ff', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>
                            <ArrowRightLeft size={20} />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '18px', fontWeight: '800' }}>INTER-SITE TRANSFER</h3>
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Transfer materials between project sites</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={24} /></button>
                </div>

                <form onSubmit={handleSubmit} className="modal-body" style={{ padding: '24px 24px 12px 24px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>From Project *</label>
                            <select required value={formData.from} onChange={(e) => setFormData({ ...formData, from: e.target.value, items: [{ name: '', quantity: '', unit: 'Nos' }] })}
                                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                <option value="">Select Source</option>
                                {projectNames.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>To Project *</label>
                            <select required value={formData.to} onChange={(e) => setFormData({ ...formData, to: e.target.value })}
                                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                <option value="">Select Destination</option>
                                {projectNames.filter(p => p !== formData.from).map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <label style={{ fontSize: '13px', fontWeight: '700' }}>Items to Transfer *</label>
                            <button type="button" onClick={addItem} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: '600', fontSize: '12px', cursor: 'pointer' }}>+ Add Item</button>
                        </div>
                        {formData.items.map((item, idx) => (
                            <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                                <select value={item.name} onChange={e => updateItem(idx, 'name', e.target.value)}
                                    style={{ flex: 2, padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                    <option value="">Select Material</option>
                                    {sourceInventory.map(m => <option key={m.name} value={m.name}>{m.name} ({m.stock} {m.unit})</option>)}
                                </select>
                                <input type="number" min="0.01" placeholder="Qty" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)}
                                    style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }} />
                                <select value={item.unit} onChange={e => updateItem(idx, 'unit', e.target.value)}
                                    style={{ width: '80px', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                    {availableUnits.map(u => <option key={u} value={u}>{u}</option>)}
                                </select>
                                {formData.items.length > 1 && (
                                    <button type="button" onClick={() => removeItem(idx)} style={{ color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px' }}>&times;</button>
                                )}
                            </div>
                        ))}
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Notes</label>
                        <textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} placeholder="Optional notes..."
                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', minHeight: '60px', resize: 'vertical' }} />
                    </div>

                    <div style={{ padding: '12px 0 20px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                        <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={loading} style={{ fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                            INITIATE TRANSFER
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default TransferModal;

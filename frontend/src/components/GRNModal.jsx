import React, { useState, useEffect } from 'react';
import { X, Truck, Info, Loader2, CheckCircle, Clock } from 'lucide-react';
import { purchaseOrderAPI, grnAPI } from '../utils/api';

const GRNModal = ({ isOpen, onClose, onSuccess }) => {
    const [isSaving, setIsSaving] = useState(false);
    const [pos, setPOs] = useState([]);
    const [allGrns, setAllGrns] = useState([]);
    const [formData, setFormData] = useState({
        po_id: '',
        vehicle_number: '',
        invoice_number: '',
        receipt_type: 'Partial' // 'Partial' or 'Final'
    });
    const [items, setItems] = useState([]);

    useEffect(() => {
        if (isOpen) {
            // Fetch POs that are either Approved or Already Partially Received
            purchaseOrderAPI.getAll().then(res => {
                const availablePOs = (res.data || []).filter(p =>
                    p.status?.toLowerCase() === 'approved' ||
                    p.status?.toLowerCase() === 'partially received'
                );
                setPOs(availablePOs);
            }).catch(() => { });

            grnAPI.getAll().then(res => setAllGrns(res.data || [])).catch(() => { });
        }
    }, [isOpen]);

    const handlePOChange = (poId) => {
        const selectedPO = pos.find(p => p.id === poId);
        setFormData({ ...formData, po_id: poId });

        if (selectedPO) {
            // Find all existing GRNs for this PO to calculate previously received quantities
            const previousGrns = allGrns.filter(g => g.po_id === poId);

            setItems(selectedPO.items.map(item => {
                const alreadyReceived = previousGrns.reduce((sum, g) => {
                    const grnItem = g.items.find(gi => gi.name === item.name);
                    return sum + (grnItem ? parseFloat(grnItem.received_qty || 0) : 0);
                }, 0);

                const remaining = Math.max(0, item.qty - alreadyReceived);

                return {
                    name: item.name,
                    po_qty: item.qty,
                    already_received: alreadyReceived,
                    unit: item.unit,
                    received_qty: remaining, // Suggest the remaining balance
                    rejected_qty: 0,
                    remarks: ''
                };
            }));
        }
    };

    const handleItemChange = (index, field, value) => {
        const newItems = [...items];
        newItems[index][field] = value;
        setItems(newItems);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.po_id) {
            alert('Please select a Purchase Order');
            return;
        }

        setIsSaving(true);
        try {
            await grnAPI.create({
                ...formData,
                items: items.map(item => ({
                    ...item,
                    received_qty: parseFloat(item.received_qty),
                    rejected_qty: parseFloat(item.rejected_qty)
                }))
            });
            if (onSuccess) onSuccess();
            onClose();
        } catch (err) {
            console.error('Failed to create GRN:', err);
            alert('Failed to save Goods Receipt Note.');
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <form onSubmit={handleSubmit} className="card animate-fade-in" style={{
                width: '95%', maxWidth: '900px', maxHeight: '90vh',
                display: 'flex', flexDirection: 'column', padding: 0
            }}>
                {/* Header */}
                <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ padding: '10px', backgroundColor: '#ECFDF5', color: '#10B981', borderRadius: '8px' }}>
                            <Truck size={20} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '18px', fontWeight: '700' }}>Goods Receipt Note (GRN)</h2>
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Inventory arrival record for PO</p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                        <X size={24} />
                    </button>
                </div>

                {/* Body */}
                <div style={{ padding: '24px', overflowY: 'auto' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '32px' }}>
                        <div style={{ gridColumn: 'span 2' }}>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Select PO Reference*</label>
                            <select
                                required
                                value={formData.po_id}
                                onChange={(e) => handlePOChange(e.target.value)}
                                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'white', fontWeight: '600' }}
                            >
                                <option value="">Select Approved PO</option>
                                {pos.map(p => (
                                    <option key={p.id} value={p.id}>
                                        PO-{p.id.slice(-6).toUpperCase()} • {p.vendor_name} • {p.project_name} ({p.status})
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Receipt Mode</label>
                            <div style={{ display: 'flex', padding: '4px', backgroundColor: 'var(--bg-main)', borderRadius: '8px', gap: '4px' }}>
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, receipt_type: 'Partial' })}
                                    style={{
                                        flex: 1, padding: '8px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer',
                                        border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                        backgroundColor: formData.receipt_type === 'Partial' ? 'white' : 'transparent',
                                        color: formData.receipt_type === 'Partial' ? 'var(--primary)' : 'var(--text-muted)',
                                        boxShadow: formData.receipt_type === 'Partial' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                        fontWeight: formData.receipt_type === 'Partial' ? '700' : '500'
                                    }}
                                >
                                    <Clock size={14} /> Partial
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, receipt_type: 'Final' })}
                                    style={{
                                        flex: 1, padding: '8px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer',
                                        border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                        backgroundColor: formData.receipt_type === 'Final' ? 'white' : 'transparent',
                                        color: formData.receipt_type === 'Final' ? '#10b981' : 'var(--text-muted)',
                                        boxShadow: formData.receipt_type === 'Final' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                        fontWeight: formData.receipt_type === 'Final' ? '700' : '500'
                                    }}
                                >
                                    <CheckCircle size={14} /> Close PO
                                </button>
                            </div>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Invoice / LR No</label>
                            <input
                                type="text"
                                value={formData.invoice_number}
                                onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)' }}
                            />
                        </div>
                    </div>

                    <table className="data-table" style={{ border: '1px solid var(--border)' }}>
                        <thead style={{ backgroundColor: '#f8fafc' }}>
                            <tr>
                                <th style={{ fontSize: '12px' }}>Material Description</th>
                                <th style={{ fontSize: '12px', textAlign: 'center' }}>Total PO</th>
                                <th style={{ fontSize: '12px', textAlign: 'center' }}>Already Rec</th>
                                <th style={{ fontSize: '12px', width: '140px' }}>Now Received</th>
                                <th style={{ fontSize: '12px', width: '130px' }}>Rejected</th>
                                <th style={{ fontSize: '12px' }}>Balance</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.length === 0 ? (
                                <tr>
                                    <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>Select a Purchase Order to load items</td>
                                </tr>
                            ) : items.map((item, i) => {
                                const remainingAfterThis = Math.max(0, item.po_qty - item.already_received - item.received_qty);
                                return (
                                    <tr key={i}>
                                        <td style={{ fontWeight: '600', fontSize: '13px' }}>{item.name}</td>
                                        <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>{item.po_qty} {item.unit}</td>
                                        <td style={{ textAlign: 'center', color: '#10b981', fontWeight: '600', fontSize: '13px' }}>{item.already_received}</td>
                                        <td>
                                            <input
                                                required
                                                type="number"
                                                min="0"
                                                value={item.received_qty}
                                                onChange={(e) => handleItemChange(i, 'received_qty', Math.max(0, parseFloat(e.target.value) || 0))}
                                                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)', fontWeight: '700' }}
                                            />
                                        </td>
                                        <td>
                                            <input
                                                type="number"
                                                min="0"
                                                value={item.rejected_qty}
                                                onChange={(e) => handleItemChange(i, 'rejected_qty', Math.max(0, parseFloat(e.target.value) || 0))}
                                                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)', color: '#ef4444' }}
                                            />
                                        </td>
                                        <td style={{ fontSize: '13px', fontWeight: '600', color: remainingAfterThis > 0 ? '#f59e0b' : 'var(--text-muted)' }}>
                                            {remainingAfterThis} {item.unit}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    <div style={{ marginTop: '24px', padding: '16px', backgroundColor: formData.receipt_type === 'Final' ? '#f0fdf4' : '#f8fafc', borderRadius: '8px', border: `1px dashed ${formData.receipt_type === 'Final' ? '#10b981' : 'var(--border)'}` }}>
                        <p style={{ fontSize: '13px', color: formData.receipt_type === 'Final' ? '#15803d' : 'var(--text-muted)', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Info size={16} />
                            {formData.receipt_type === 'Final'
                                ? 'Final Receipt: This PO will be marked as CLOSED. No further GRNs can be created for this order.'
                                : 'Partial Receipt: This PO will remain OPEN (Partially Received) for future deliveries.'}
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div style={{ padding: '20px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '12px', backgroundColor: '#f8fafc', borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px' }}>
                    <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
                    <button type="submit" disabled={isSaving} className="btn btn-primary" style={{ padding: '10px 32px' }}>
                        {isSaving ? <Loader2 size={16} className="animate-spin" /> : 'Confirm Stock Entry'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default GRNModal;

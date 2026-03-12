import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, FileText, Calendar, Building2, IndianRupee, Loader2, ClipboardCheck, ArrowDown } from 'lucide-react';
import { grnAPI, billingAPI, purchaseOrderAPI } from '../utils/api';
import CustomSelect from './CustomSelect';

const PurchaseBillModal = ({ isOpen, onClose, onSuccess }) => {
    const [isSaving, setIsSaving] = useState(false);
    const [grns, setGrns] = useState([]);
    const [loadingGrns, setLoadingGrns] = useState(false);

    const [formData, setFormData] = useState({
        grn_id: '',
        bill_no: '',
        bill_date: new Date().toISOString().split('T')[0],
        po_id: '',
        vendor_name: '',
        project_name: '',
        tax_amount: 0,
        notes: ''
    });

    const [items, setItems] = useState([]);

    useEffect(() => {
        if (isOpen) {
            setLoadingGrns(true);
            grnAPI.getAll().then(res => {
                // Only show GRNs that aren't billed yet (assuming status is 'Received' or similar)
                setGrns((res.data || []).filter(g => g.status !== 'Billed'));
            }).finally(() => setLoadingGrns(false));
        }
    }, [isOpen]);

    const handleGRNSelect = (grnId) => {
        const grn = grns.find(g => g.id === grnId);
        if (grn) {
            setFormData({
                ...formData,
                grn_id: grn.id,
                po_id: grn.po_id,
                vendor_name: grn.vendor_name || '', // Need to ensure backend sends this or fetch from PO
                project_name: grn.project_name || ''
            });

            // Set items from GRN (using received quantities)
            setItems(grn.items.map(it => ({
                name: it.name,
                qty: it.received_qty || it.qty,
                unit: it.unit,
                rate: 0, // Accountant must enter actual bill price
                amount: 0
            })));
        }
    };

    const handleItemChange = (index, field, value) => {
        const newItems = [...items];
        newItems[index][field] = value;
        if (field === 'rate' || field === 'qty') {
            newItems[index].amount = parseFloat(newItems[index].qty || 0) * parseFloat(newItems[index].rate || 0);
        }
        setItems(newItems);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.grn_id || !formData.bill_no) {
            alert('Please select a GRN and provide a Bill Number');
            return;
        }

        setIsSaving(true);
        try {
            const total_amount = items.reduce((sum, it) => sum + (it.amount || 0), 0);
            await billingAPI.createPurchaseBill({
                ...formData,
                items,
                total_amount: total_amount + parseFloat(formData.tax_amount || 0),
                tax_amount: parseFloat(formData.tax_amount || 0)
            });
            if (onSuccess) onSuccess();
            onClose();
        } catch (err) {
            console.error('Failed to create purchase bill:', err);
            alert('Failed to save bill.');
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    const subTotal = items.reduce((sum, it) => sum + (it.amount || 0), 0);
    const totalWithTax = subTotal + parseFloat(formData.tax_amount || 0);

    return (
        <div className="modal-overlay" style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)'
        }}>
            <form onSubmit={handleSubmit} className="modal-container animate-fade-in" style={{
                backgroundColor: 'white', width: '100%', maxWidth: '850px',
                borderRadius: '12px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                display: 'flex', flexDirection: 'column', maxHeight: '90vh'
            }}>
                <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ padding: '10px', backgroundColor: '#ecfdf5', borderRadius: '8px', color: '#10b981' }}>
                            <FileText size={20} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '18px', fontWeight: '700' }}>Record Purchase Bill</h2>
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Enter actual bill details against Good Received (GRN)</p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                        <X size={24} />
                    </button>
                </div>

                <div style={{ padding: '24px', overflowY: 'auto' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px', marginBottom: '32px' }}>
                        <div>
                            <CustomSelect
                                label="Select Pending GRN*"
                                options={grns.map(g => ({
                                    value: g.id,
                                    label: `GRN-${g.id.slice(-6).toUpperCase()} (${g.project_name})`
                                }))}
                                value={formData.grn_id}
                                onChange={handleGRNSelect}
                                placeholder="-- Choose GRN --"
                                width="full"
                                icon={ClipboardCheck}
                                error={!formData.grn_id}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Vendor (Auto-filled)</label>
                            <input readOnly value={formData.vendor_name} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: '#f8fafc' }} />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Bill Number*</label>
                            <input required value={formData.bill_no} onChange={(e) => setFormData({ ...formData, bill_no: e.target.value })} placeholder="e.g. BILL/2024/001" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }} />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Bill Date*</label>
                            <input type="date" value={formData.bill_date} onChange={(e) => setFormData({ ...formData, bill_date: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }} />
                        </div>
                    </div>

                    <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '16px' }}>Invoice Items (Pricing)</h3>
                    <table className="data-table" style={{ border: '1px solid var(--border)', width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ backgroundColor: '#f8fafc' }}>
                            <tr>
                                <th style={{ textAlign: 'left', padding: '12px' }}>Material</th>
                                <th style={{ textAlign: 'center', padding: '12px' }}>Qty (Recv)</th>
                                <th style={{ textAlign: 'center', padding: '12px' }}>Actual Rate (₹)</th>
                                <th style={{ textAlign: 'right', padding: '12px' }}>Amount (₹)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item, idx) => (
                                <tr key={idx}>
                                    <td style={{ padding: '12px' }}>{item.name}</td>
                                    <td style={{ textAlign: 'center', padding: '12px' }}>{item.qty} {item.unit}</td>
                                    <td style={{ textAlign: 'center', padding: '12px' }}>
                                        <input
                                            type="number"
                                            value={item.rate}
                                            onChange={(e) => handleItemChange(idx, 'rate', e.target.value)}
                                            style={{ width: '100px', padding: '4px', border: '1px solid var(--border)', borderRadius: '4px' }}
                                        />
                                    </td>
                                    <td style={{ textAlign: 'right', padding: '12px', fontWeight: '700' }}>
                                        {item.amount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </td>
                                </tr>
                            ))}
                            {items.length === 0 && <tr><td colSpan="4" style={{ textAlign: 'center', padding: '24px', color: '#94a3b8' }}>Select a GRN to load items</td></tr>}
                        </tbody>
                    </table>

                    <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
                        <div style={{ width: '300px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Subtotal:</span>
                                <span style={{ fontWeight: '600' }}>₹{subTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Tax / GST (₹):</span>
                                <input
                                    type="number"
                                    value={formData.tax_amount}
                                    onChange={(e) => setFormData({ ...formData, tax_amount: e.target.value })}
                                    style={{ width: '100px', textAlign: 'right', padding: '4px', border: '1px solid var(--border)', borderRadius: '4px' }}
                                />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', paddingTop: '12px', borderTop: '2px solid var(--border)' }}>
                                <span style={{ fontWeight: '800' }}>Grand Total:</span>
                                <span style={{ fontWeight: '900', color: '#059669', fontSize: '18px' }}>₹{totalWithTax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div style={{ padding: '20px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '12px', backgroundColor: '#f8fafc', borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px' }}>
                    <button type="button" className="btn btn-outline" onClick={onClose} style={{ padding: '10px 24px' }}>Cancel</button>
                    <button type="submit" disabled={isSaving || items.length === 0} className="btn btn-primary" style={{ padding: '10px 32px' }}>
                        {isSaving ? <Loader2 size={16} className="animate-spin" /> : 'Confirm Bill'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default PurchaseBillModal;

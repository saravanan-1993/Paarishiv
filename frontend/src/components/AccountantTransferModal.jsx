import React, { useState, useEffect } from 'react';
import { X, ArrowRightLeft, Loader2, IndianRupee, User, Building2 } from 'lucide-react';
import { inventoryAPI } from '../utils/api';

const AccountantTransferModal = ({ isOpen, onClose, transfer, onSuccess }) => {
    const [items, setItems] = useState([]);
    const [executing, setExecuting] = useState(false);
    const [loadingRates, setLoadingRates] = useState(false);

    useEffect(() => {
        if (isOpen && transfer?.items) {
            const initialItems = transfer.items.map(item => ({
                name: item.name,
                quantity: item.quantity,
                unit: item.unit,
                rate: '',
                amount: 0,
            }));
            setItems(initialItems);
            fetchLastRates(initialItems);
        }
    }, [isOpen, transfer]);

    const fetchLastRates = async (itemsList) => {
        try {
            setLoadingRates(true);
            const materialNames = itemsList.map(i => i.name);
            const res = await inventoryAPI.checkWarehouseAvailability({ material_names: materialNames });
            const availability = res.data || {};
            setItems(prev => prev.map(item => {
                const found = availability[item.name] || {};
                const lastRate = found.last_rate || found.rate || '';
                const rate = lastRate ? parseFloat(lastRate) : '';
                return {
                    ...item,
                    rate: rate !== '' ? rate : '',
                    amount: rate !== '' ? parseFloat(item.quantity) * rate : 0,
                };
            }));
        } catch (err) {
            console.error('Failed to fetch last rates:', err);
        } finally {
            setLoadingRates(false);
        }
    };

    const updateRate = (idx, value) => {
        setItems(prev => {
            const updated = [...prev];
            const rate = value === '' ? '' : parseFloat(value) || 0;
            updated[idx] = {
                ...updated[idx],
                rate,
                amount: rate !== '' ? parseFloat(updated[idx].quantity) * rate : 0,
            };
            return updated;
        });
    };

    const totalValue = items.reduce((sum, item) => sum + (item.amount || 0), 0);

    const handleExecute = async () => {
        setExecuting(true);
        try {
            await inventoryAPI.executeTransfer(transfer.id, {
                items: items.map(i => ({
                    name: i.name,
                    quantity: parseFloat(i.quantity),
                    unit: i.unit,
                    rate: parseFloat(i.rate) || 0,
                }))
            });
            alert('Transfer executed successfully');
            onSuccess?.();
        } catch (err) {
            alert(err.response?.data?.detail || 'Failed to execute transfer');
        }
        setExecuting(false);
    };

    if (!isOpen || !transfer) return null;

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        try {
            return new Date(dateStr).toLocaleDateString('en-IN', {
                day: '2-digit', month: 'short', year: 'numeric'
            });
        } catch {
            return dateStr;
        }
    };

    return (
        <div className="modal-overlay">
            <div className="card animate-fade-in" style={{ width: '95%', maxWidth: '800px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0 }}>
                {/* Header */}
                <div className="modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', backgroundColor: '#ecfdf5', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                            <ArrowRightLeft size={20} />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '18px', fontWeight: '800', margin: 0 }}>Execute Material Transfer</h3>
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                                {transfer.from_project} <span style={{ margin: '0 4px' }}>&rarr;</span> {transfer.to_project}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                        <X size={24} />
                    </button>
                </div>

                {/* Body */}
                <div className="modal-body" style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
                    {/* Transfer Info Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px', marginBottom: '24px' }}>
                        <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: '#fef3c7', border: '1px solid #fde68a' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                                <Building2 size={14} style={{ color: '#d97706' }} />
                                <span style={{ fontSize: '11px', fontWeight: '700', color: '#92400e', textTransform: 'uppercase' }}>From Project</span>
                            </div>
                            <p style={{ fontSize: '14px', fontWeight: '600', margin: 0, color: '#78350f' }}>{transfer.from_project}</p>
                        </div>
                        <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: '#dbeafe', border: '1px solid #93c5fd' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                                <Building2 size={14} style={{ color: '#2563eb' }} />
                                <span style={{ fontSize: '11px', fontWeight: '700', color: '#1e40af', textTransform: 'uppercase' }}>To Project</span>
                            </div>
                            <p style={{ fontSize: '14px', fontWeight: '600', margin: 0, color: '#1e3a5f' }}>{transfer.to_project}</p>
                        </div>
                        <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                                <User size={14} style={{ color: '#059669' }} />
                                <span style={{ fontSize: '11px', fontWeight: '700', color: '#065f46', textTransform: 'uppercase' }}>Approved By</span>
                            </div>
                            <p style={{ fontSize: '14px', fontWeight: '600', margin: 0, color: '#064e3b' }}>{transfer.admin_approved_by || '-'}</p>
                        </div>
                        <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: '#f3e8ff', border: '1px solid #d8b4fe' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                                <User size={14} style={{ color: '#7c3aed' }} />
                                <span style={{ fontSize: '11px', fontWeight: '700', color: '#5b21b6', textTransform: 'uppercase' }}>Requested By</span>
                            </div>
                            <p style={{ fontSize: '14px', fontWeight: '600', margin: 0, color: '#4c1d95' }}>{transfer.requested_by || '-'}</p>
                        </div>
                    </div>

                    {/* Items Table */}
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '10px' }}>
                            Transfer Items {loadingRates && <span style={{ fontWeight: '400', color: 'var(--text-muted)' }}>(loading rates...)</span>}
                        </label>
                        <div style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                                <thead>
                                    <tr style={{ backgroundColor: 'var(--bg-secondary, #f9fafb)' }}>
                                        <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>Material</th>
                                        <th style={{ padding: '12px 14px', textAlign: 'center', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)', width: '80px' }}>Qty</th>
                                        <th style={{ padding: '12px 14px', textAlign: 'center', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)', width: '70px' }}>Unit</th>
                                        <th style={{ padding: '12px 14px', textAlign: 'center', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)', width: '130px' }}>Rate (&#8377;)</th>
                                        <th style={{ padding: '12px 14px', textAlign: 'right', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)', width: '120px' }}>Amount (&#8377;)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((item, idx) => (
                                        <tr key={idx} style={{ borderBottom: idx < items.length - 1 ? '1px solid var(--border)' : 'none' }}>
                                            <td style={{ padding: '12px 14px', fontWeight: '500' }}>{item.name}</td>
                                            <td style={{ padding: '12px 14px', textAlign: 'center' }}>{item.quantity}</td>
                                            <td style={{ padding: '12px 14px', textAlign: 'center', color: 'var(--text-muted)' }}>{item.unit}</td>
                                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    placeholder="0.00"
                                                    value={item.rate}
                                                    onChange={(e) => updateRate(idx, e.target.value)}
                                                    style={{
                                                        width: '100%',
                                                        padding: '8px 10px',
                                                        borderRadius: '6px',
                                                        border: '1px solid var(--border)',
                                                        textAlign: 'right',
                                                        fontSize: '14px',
                                                        fontWeight: '500',
                                                        outline: 'none',
                                                    }}
                                                />
                                            </td>
                                            <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '600', color: item.amount > 0 ? '#059669' : 'var(--text-muted)' }}>
                                                {item.amount > 0 ? `₹${item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Total Value */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '16px 20px',
                        borderRadius: '10px',
                        backgroundColor: '#f0fdf4',
                        border: '1px solid #bbf7d0',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <IndianRupee size={16} style={{ color: '#059669' }} />
                            <span style={{ fontSize: '14px', fontWeight: '700', color: '#065f46' }}>Total Transfer Value:</span>
                        </div>
                        <span style={{ fontSize: '22px', fontWeight: '800', color: '#059669' }}>
                            ₹{totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                    </div>
                </div>

                {/* Footer */}
                <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                    <button
                        type="button"
                        className="btn btn-outline"
                        onClick={onClose}
                        disabled={executing}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleExecute}
                        disabled={executing}
                        style={{
                            padding: '10px 24px',
                            borderRadius: '8px',
                            border: 'none',
                            backgroundColor: '#10b981',
                            color: '#fff',
                            fontWeight: '800',
                            fontSize: '14px',
                            cursor: executing ? 'not-allowed' : 'pointer',
                            opacity: executing ? 0.7 : 1,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                        }}
                    >
                        {executing ? <Loader2 size={16} className="animate-spin" /> : <ArrowRightLeft size={16} />}
                        {executing ? 'Executing...' : 'Execute Transfer'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AccountantTransferModal;

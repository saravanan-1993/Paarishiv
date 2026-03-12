import React, { useState } from 'react';
import { X, ClipboardCheck, Loader2 } from 'lucide-react';
import { inventoryAPI } from '../utils/api';

const StockIssueModal = ({ isOpen, onClose, request, onSuccess }) => {
    const [isSaving, setIsSaving] = useState(false);

    // We assume Admin approves the amounts in the request
    // In a mature system, they could adjust quantities here.

    if (!isOpen || !request) return null;

    const handleIssue = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            // Send the request items as the issued items
            await inventoryAPI.issueStock(request.id, {
                issued_items: request.requested_items
            });
            onSuccess();
        } catch (err) {
            console.error('Issue error:', err);
            const msg = typeof err.response?.data?.detail === 'string'
                ? err.response.data.detail
                : 'Failed to issue stock. Please check warehouse stock levels.';
            alert(msg);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="modal-overlay" style={{ zIndex: 1100, backgroundColor: 'rgba(0,0,0,0.6)' }}>
            <div className="modal-content animate-fade-in" style={{ maxWidth: '450px', width: '90%' }}>
                <div className="modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', backgroundColor: '#ecfdf5', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669' }}>
                            <ClipboardCheck size={20} />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '18px', fontWeight: '800' }}>Approve & Issue</h3>
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Confirm stock dispatch to {request.project_name}</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} /></button>
                </div>

                <div className="modal-body" style={{ padding: '24px' }}>
                    <div style={{ backgroundColor: '#f9fafb', padding: '16px', borderRadius: '8px', marginBottom: '24px' }}>
                        <h4 style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '12px' }}>Items to be Released</h4>
                        {request.requested_items.map((item, idx) => (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', borderBottom: '1px dashed #e5e7eb', paddingBottom: '4px' }}>
                                <span style={{ fontWeight: '600' }}>{item.name}</span>
                                <span style={{ fontWeight: '800', color: 'var(--primary)' }}>{item.quantity} {item.unit}</span>
                            </div>
                        ))}
                    </div>

                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px' }}>
                        Issuing this stock will immediately decrement the warehouse inventory and increment the {request.project_name} site inventory.
                    </p>

                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                        <button type="button" onClick={onClose} className="btn btn-outline" style={{ fontWeight: '700' }}>Cancel</button>
                        <button type="button" onClick={handleIssue} disabled={isSaving} className="btn btn-primary" style={{ fontWeight: '800', minWidth: '140px', backgroundColor: '#10B981', border: 'none' }}>
                            {isSaving ? <Loader2 size={18} className="animate-spin" /> : 'CONFIRM ISSUANCE'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StockIssueModal;

import React, { useState, useEffect } from 'react';
import { X, FileText, CheckCircle, Download, Printer, AlertCircle, Plus, Trash2, Save } from 'lucide-react';
import { purchaseOrderAPI, projectAPI } from '../utils/api';

const PODetailModal = ({ isOpen, onClose, po, onSuccess }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState(null);
    const [projects, setProjects] = useState([]);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (po) {
            setEditData({ ...po });
        }
        if (isOpen) {
            fetchProjects();
        }
    }, [po, isOpen]);

    const fetchProjects = async () => {
        try {
            const res = await projectAPI.getAll();
            setProjects(res.data || []);
        } catch (err) {
            console.error('Failed to fetch projects:', err);
        }
    };

    if (!isOpen || !po || !editData) return null;

    const formattedDate = po.created_at ? new Date(po.created_at).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    }) : '—';

    const handleAddItem = () => {
        setEditData({
            ...editData,
            items: [...editData.items, { name: '', qty: 1, unit: 'Nos', rate: 0 }]
        });
    };

    const handleRemoveItem = (index) => {
        const newItems = editData.items.filter((_, i) => i !== index);
        setEditData({ ...editData, items: newItems });
    };

    const handleItemChange = (index, field, value) => {
        const newItems = [...editData.items];
        newItems[index][field] = value;
        setEditData({ ...editData, items: newItems });
    };

    const calculateTotal = () => {
        return editData.items.reduce((sum, item) => sum + (parseFloat(item.qty || 0) * parseFloat(item.rate || 0)), 0);
    };

    const handleSave = async (shouldApprove = false) => {
        setIsSaving(true);
        try {
            const finalData = {
                vendor_name: editData.vendor_name,
                project_name: editData.project_name,
                expected_delivery: editData.expected_delivery,
                items: editData.items.map(item => ({
                    name: item.name,
                    qty: parseFloat(item.qty || 0),
                    unit: item.unit,
                    rate: parseFloat(item.rate || 0)
                })),
                notes: editData.notes || "",
                admin_remarks: editData.admin_remarks || "",
                status: shouldApprove ? 'Approved' : editData.status,
                total_amount: calculateTotal()
            };
            await purchaseOrderAPI.update(po.id, finalData);
            if (onSuccess) onSuccess();
            setIsEditing(false);
            if (shouldApprove) onClose();
        } catch (err) {
            console.error('Failed to update PO:', err);
            const errMsg = err.response?.data?.detail || err.message;
            alert('Failed to save changes: ' + errMsg);
        } finally {
            setIsSaving(false);
        }
    };

    const handleApprove = async () => {
        setIsSaving(true);
        try {
            await purchaseOrderAPI.approve(po.id);
            if (onSuccess) onSuccess();
            onClose();
        } catch (err) {
            console.error('Failed to approve PO:', err);
            alert('Failed to approve PO.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="modal-overlay" style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)'
        }}>
            <div className="modal-container animate-fade-in" style={{
                backgroundColor: 'white', width: '100%', maxWidth: '900px',
                borderRadius: '12px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                display: 'flex', flexDirection: 'column', maxHeight: '90vh'
            }}>
                {/* Header */}
                <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ padding: '10px', backgroundColor: 'var(--bg-main)', borderRadius: '8px', color: 'var(--primary)' }}>
                            <FileText size={20} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '18px', fontWeight: '700' }}>{isEditing ? 'Edit Purchase Order' : 'Purchase Order Details'}</h2>
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>PO-{po.id.slice(-6).toUpperCase()} • Issued on {formattedDate}</p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {!isEditing && po.status === 'Pending' && (
                            <button className="btn btn-outline" onClick={() => setIsEditing(true)} style={{ padding: '8px 16px' }}>Edit Order</button>
                        )}
                        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', marginLeft: '8px' }}>
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div style={{ padding: '24px', overflowY: 'auto' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginBottom: '32px' }}>
                        <div>
                            <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Vendor Information</p>
                            <h4 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '4px' }}>{po.vendor_name}</h4>
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Status: Active Vendor</p>
                        </div>
                        <div>
                            <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Project Delivery (Site)</p>
                            {isEditing ? (
                                <select
                                    value={editData.project_name}
                                    onChange={(e) => setEditData({ ...editData, project_name: e.target.value })}
                                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border)' }}
                                >
                                    {projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                                </select>
                            ) : (
                                <h4 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '4px' }}>{po.project_name}</h4>
                            )}
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>Expected: {po.expected_delivery || '—'}</p>
                        </div>
                        <div>
                            <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Current Status</p>
                            <span className={`badge ${po.status === 'Approved' ? 'badge-success' : 'badge-warning'}`} style={{ padding: '6px 12px' }}>
                                {po.status}
                            </span>
                        </div>
                    </div>

                    {/* Items Table */}
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f8fafc' }}>
                                <th style={{ textAlign: 'left', padding: '12px', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', borderBottom: '2px solid var(--border)' }}>ITEM DESCRIPTION</th>
                                <th style={{ textAlign: 'right', padding: '12px', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', borderBottom: '2px solid var(--border)' }}>QTY</th>
                                <th style={{ textAlign: 'right', padding: '12px', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', borderBottom: '2px solid var(--border)' }}>UNIT</th>
                                <th style={{ textAlign: 'right', padding: '12px', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', borderBottom: '2px solid var(--border)' }}>RATE</th>
                                <th style={{ textAlign: 'right', padding: '12px', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', borderBottom: '2px solid var(--border)' }}>TOTAL</th>
                                {isEditing && <th style={{ width: '50px', borderBottom: '2px solid var(--border)' }}></th>}
                            </tr>
                        </thead>
                        <tbody>
                            {(isEditing ? editData.items : po.items).map((item, i) => (
                                <tr key={i}>
                                    <td style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>
                                        {isEditing ? (
                                            <input value={item.name} onChange={(e) => handleItemChange(i, 'name', e.target.value)} style={{ width: '100%', padding: '6px' }} />
                                        ) : (
                                            <span style={{ fontSize: '14px', fontWeight: '600' }}>{item.name}</span>
                                        )}
                                    </td>
                                    <td style={{ textAlign: 'right', padding: '12px', borderBottom: '1px solid var(--border)' }}>
                                        {isEditing ? (
                                            <input type="number" value={item.qty} onChange={(e) => handleItemChange(i, 'qty', e.target.value)} style={{ width: '80px', textAlign: 'right', padding: '6px' }} />
                                        ) : (
                                            <span style={{ fontSize: '14px' }}>{item.qty}</span>
                                        )}
                                    </td>
                                    <td style={{ textAlign: 'right', padding: '12px', borderBottom: '1px solid var(--border)' }}>
                                        {isEditing ? (
                                            <select value={item.unit} onChange={(e) => handleItemChange(i, 'unit', e.target.value)} style={{ padding: '6px' }}>
                                                <option value="Nos">Nos</option>
                                                <option value="Kg">Kg</option>
                                                <option value="Mtr">Mtr</option>
                                                <option value="Bag">Bag</option>
                                                <option value="Sft">Sft</option>
                                                <option value="Cft">Cft</option>
                                            </select>
                                        ) : (
                                            <span style={{ fontSize: '14px' }}>{item.unit}</span>
                                        )}
                                    </td>
                                    <td style={{ textAlign: 'right', padding: '12px', borderBottom: '1px solid var(--border)' }}>
                                        {isEditing ? (
                                            <input type="number" value={item.rate} onChange={(e) => handleItemChange(i, 'rate', e.target.value)} style={{ width: '100px', textAlign: 'right', padding: '6px' }} />
                                        ) : (
                                            <span style={{ fontSize: '14px' }}>₹{(item.rate || 0).toLocaleString()}</span>
                                        )}
                                    </td>
                                    <td style={{ textAlign: 'right', padding: '12px', borderBottom: '1px solid var(--border)', fontSize: '14px', fontWeight: '700' }}>
                                        ₹{((isEditing ? item.qty * item.rate : item.qty * item.rate) || 0).toLocaleString()}
                                    </td>
                                    {isEditing && (
                                        <td style={{ borderBottom: '1px solid var(--border)', textAlign: 'center' }}>
                                            <button onClick={() => handleRemoveItem(i)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 size={16} /></button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {isEditing && (
                        <button className="btn btn-outline btn-sm" onClick={handleAddItem} style={{ marginBottom: '24px' }}>
                            <Plus size={16} /> ADD ANOTHER ITEM
                        </button>
                    )}

                    {/* Remarks Section */}
                    <div style={{ marginBottom: '24px' }}>
                        <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Admin / Internal Remarks</p>
                        {isEditing ? (
                            <textarea
                                value={editData.admin_remarks}
                                onChange={(e) => setEditData({ ...editData, admin_remarks: e.target.value })}
                                placeholder="Enter changes made or approval notes..."
                                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', minHeight: '80px' }}
                            />
                        ) : (
                            <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', fontSize: '14px', fontStyle: po.admin_remarks ? 'normal' : 'italic', color: po.admin_remarks ? 'inherit' : 'var(--text-muted)' }}>
                                {po.admin_remarks || 'No remarks provided by admin.'}
                            </div>
                        )}
                    </div>

                    {/* Totals */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <div style={{ width: '250px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: '800', paddingTop: '12px', borderTop: '2px solid var(--border)' }}>
                                <span>Grand Total:</span>
                                <span style={{ color: 'var(--primary)' }}>₹{(isEditing ? calculateTotal() : po.total_amount).toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div style={{ padding: '20px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '12px', backgroundColor: '#f8fafc', borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px' }}>
                    {isEditing ? (
                        <>
                            <button className="btn btn-outline" onClick={() => setIsEditing(false)}>Cancel Edit</button>
                            <button className="btn btn-primary" onClick={() => handleSave(false)} disabled={isSaving}>
                                <Save size={18} /> {isSaving ? 'SAVING...' : 'SAVE MODIFICATIONS'}
                            </button>
                        </>
                    ) : (
                        <>
                            <button className="btn btn-outline" onClick={onClose}>Close</button>
                            {po.status === 'Pending' && (
                                <button className="btn btn-primary" onClick={handleApprove} disabled={isSaving} style={{ padding: '10px 32px' }}>
                                    <CheckCircle size={18} /> {isSaving ? 'APPROVING...' : 'APPROVE PO'}
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PODetailModal;

import React from 'react';
import { X, Package, Calendar, User, Clock, CheckCircle } from 'lucide-react';

const MaterialRequestDetailModal = ({ isOpen, onClose, request }) => {
    if (!isOpen || !request) return null;

    const items = request.requested_items || request.items || [];

    return (
        <div className="modal-overlay" style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 1000,
            backdropFilter: 'blur(4px)'
        }}>
            <div className="modal-container animate-fade-in" style={{
                backgroundColor: 'white', width: '100%', maxWidth: '600px',
                borderRadius: '16px', display: 'flex', flexDirection: 'column',
                maxHeight: '90vh', overflow: 'hidden',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
            }}>
                <div style={{ padding: '24px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ padding: '12px', backgroundColor: '#fef3c7', borderRadius: '12px', color: '#f59e0b', boxShadow: '0 4px 6px rgba(245, 158, 11, 0.1)' }}>
                            <Package size={24} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', margin: 0, letterSpacing: '-0.5px' }}>
                                Material Request Details
                            </h2>
                            <p style={{ color: '#64748b', fontSize: '14px', margin: '4px 0 0 0', fontWeight: '600' }}>
                                {request._id ? `REF-${request._id.toString().slice(-6).toUpperCase()}` : 'Request Info'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px',
                            cursor: 'pointer', padding: '8px', color: '#64748b', display: 'flex', transition: 'all 0.2s',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                        }}
                    >
                        <X size={20} />
                    </button>
                </div>

                <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                        <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', color: '#64748b' }}>
                                <Package size={16} /> <span style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Project</span>
                            </div>
                            <p style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', margin: 0 }}>{request.project_name || request.projectName || 'N/A'}</p>
                        </div>
                        <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', color: '#64748b' }}>
                                <Calendar size={16} /> <span style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Date Requested</span>
                            </div>
                            <p style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                                {request.created_at ? new Date(request.created_at).toLocaleDateString() : 'N/A'}
                            </p>
                        </div>
                        <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', color: '#64748b' }}>
                                <User size={16} /> <span style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Engineer / Requester</span>
                            </div>
                            <p style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', margin: 0 }}>{request.engineer_id || 'Site Engineer'}</p>
                        </div>
                        <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', color: '#64748b' }}>
                                <Clock size={16} /> <span style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</span>
                            </div>
                            <p style={{ fontSize: '15px', fontWeight: '800', margin: 0, color: request.status === 'Approved' ? '#16a34a' : (request.status === 'Rejected' ? '#dc2626' : '#d97706') }}>
                                {request.status}
                            </p>
                        </div>
                    </div>

                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                        <div style={{ background: '#f1f5f9', padding: '12px 16px', borderBottom: '1px solid #e2e8f0' }}>
                            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#334155', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <CheckCircle size={16} color="#3b82f6" /> Requested Items ({items.length})
                            </h3>
                        </div>
                        <div style={{ padding: '0 16px' }}>
                            {items.length === 0 ? (
                                <p style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '14px', margin: 0 }}>No items requested.</p>
                            ) : (
                                items.map((item, idx) => (
                                    <div key={idx} style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        padding: '16px 0', borderBottom: idx < items.length - 1 ? '1px solid #e2e8f0' : 'none'
                                    }}>
                                        <div>
                                            <p style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>{item.name || item.itemName || item.item_name}</p>
                                        </div>
                                        <div style={{ background: '#eff6ff', padding: '4px 12px', borderRadius: '20px', border: '1px solid #bfdbfe' }}>
                                            <p style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#1d4ed8' }}>
                                                {item.quantity || item.qty} {item.unit}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {request.remarks && (
                        <div style={{ marginTop: '24px', background: '#fef2f2', border: '1px solid #fecaca', padding: '16px', borderRadius: '12px' }}>
                            <p style={{ fontSize: '12px', color: '#991b1b', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '800', margin: '0 0 8px 0' }}>Remarks</p>
                            <p style={{ fontSize: '14px', color: '#7f1d1d', margin: 0, lineHeight: 1.5 }}>{request.remarks}</p>
                        </div>
                    )}
                </div>

                <div style={{ padding: '20px 24px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                        onClick={onClose}
                        style={{ padding: '10px 24px', borderRadius: '8px', background: 'white', color: '#475569', fontWeight: '700', border: '1px solid #cbd5e1', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MaterialRequestDetailModal;

import React, { useState, useEffect } from 'react';
import { X, Calendar, IndianRupee, CreditCard, User, FileText, Clock, Share2 } from 'lucide-react';
import { financeAPI } from '../utils/api';

const PaymentHistoryModal = ({ isOpen, onClose, invoice }) => {
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (isOpen && invoice?.id) {
            setLoading(true);
            setError(null);
            setPayments([]); // Reset before fetch
            financeAPI.getVoucherPayments(invoice.id)
                .then(res => setPayments(Array.isArray(res.data) ? res.data : []))
                .catch(err => {
                    console.error('Payment history fetch error:', err);
                    setError('Could not load payment history. Please try again.');
                })
                .finally(() => setLoading(false));
        } else if (!isOpen) {
            setPayments([]);
            setError(null);
        }
    }, [isOpen, invoice?.id]);

    if (!isOpen || !invoice) return null;

    const handleWhatsAppShare = (payment) => {
        const text = `*Payment Receipt*\n\n` +
            `*Voucher:* ${invoice.voucher_no}\n` +
            `*Vendor:* ${invoice.vendor}\n` +
            `*Amount Paid:* ₹${payment.amount?.toLocaleString()}\n` +
            `*Date:* ${payment.date}\n` +
            `*Mode:* ${payment.paymentMode}\n` +
            `*Ref:* ${payment.reference || '-'}\n` +
            `${payment.description ? `*Note:* ${payment.description}` : ''}`;

        const encodedText = encodeURIComponent(text);
        window.open(`https://wa.me/?text=${encodedText}`, '_blank');
    };

    return (
        <div className="modal-overlay" style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)'
        }}>
            <div className="modal-container animate-fade-in" style={{
                backgroundColor: 'white', width: '100%', maxWidth: '600px',
                borderRadius: '12px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                display: 'flex', flexDirection: 'column', maxHeight: '80vh'
            }}>
                {/* Header */}
                <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <h2 style={{ fontSize: '20px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Clock size={20} color="var(--primary)" /> Payment History
                        </h2>
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Voucher: {invoice.voucher_no} • {invoice.vendor}</p>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                        <X size={24} />
                    </button>
                </div>

                {/* Items Summary */}
                <div style={{ padding: '12px 24px', backgroundColor: '#F8FAFC', borderBottom: '1px solid var(--border)' }}>
                    <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Items Received in this GRN:</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {invoice.items?.map((item, idx) => (
                            <div key={idx} style={{ padding: '4px 10px', backgroundColor: 'white', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px' }}>
                                <span style={{ fontWeight: '600' }}>{item.name}</span>: {item.received_qty} {item.unit}
                            </div>
                        ))}
                        {(!invoice.items || invoice.items.length === 0) && (
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No item details available</span>
                        )}
                    </div>
                </div>

                {/* Body */}
                <div style={{ padding: '24px', overflowY: 'auto' }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                            <div style={{ fontSize: '14px', fontWeight: '600' }}>Loading payment history...</div>
                        </div>
                    ) : error ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#EF4444' }}>
                            <FileText size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
                            <p style={{ fontWeight: '600', marginBottom: '8px' }}>Error Loading Data</p>
                            <p style={{ fontSize: '13px' }}>{error}</p>
                        </div>
                    ) : payments.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                            <FileText size={48} style={{ margin: '0 auto 16px', opacity: 0.2 }} />
                            <p style={{ fontWeight: '600', marginBottom: '4px' }}>No Payments Recorded Yet</p>
                            <p style={{ fontSize: '13px' }}>Voucher: <b>{invoice.voucher_no}</b></p>
                            <p style={{ fontSize: '12px', marginTop: '8px', color: '#F59E0B' }}>Use "Process Payment" to record the first payment.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {payments.map((p, i) => (
                                <div key={i} className="card" style={{ padding: '16px', borderLeft: '4px solid #10B981', backgroundColor: '#f8fafc' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700', fontSize: '16px', color: '#10B981' }}>
                                            <IndianRupee size={16} /> {p.amount?.toLocaleString()}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <Calendar size={14} /> {p.date}
                                            </div>
                                            <button
                                                onClick={() => handleWhatsAppShare(p)}
                                                style={{
                                                    background: '#25D366', color: 'white', border: 'none',
                                                    borderRadius: '6px', padding: '4px 8px', fontSize: '12px',
                                                    fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px',
                                                    cursor: 'pointer', boxShadow: '0 2px 4px rgba(37,211,102,0.2)'
                                                }}
                                                title="Share on WhatsApp"
                                            >
                                                <Share2 size={12} /> Share
                                            </button>
                                        </div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                                            <CreditCard size={14} color="var(--text-muted)" />
                                            <span style={{ color: 'var(--text-muted)' }}>Mode:</span>
                                            <span style={{ fontWeight: '600' }}>{p.paymentMode}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                                            <FileText size={14} color="var(--text-muted)" />
                                            <span style={{ color: 'var(--text-muted)' }}>Ref:</span>
                                            <span style={{ fontWeight: '600' }}>{p.reference || '-'}</span>
                                        </div>
                                    </div>

                                    {p.description && (
                                        <div style={{ marginTop: '8px', padding: '8px', backgroundColor: 'white', borderRadius: '4px', fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                            "{p.description}"
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    <div style={{ marginTop: '24px', padding: '16px', backgroundColor: '#EFF6FF', borderRadius: '8px', display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '14px', fontWeight: '700', color: '#1E40AF' }}>Total Paid to Date</span>
                        <span style={{ fontSize: '16px', fontWeight: '800', color: '#1E40AF' }}>
                            ₹{payments.reduce((sum, p) => sum + (p.amount || 0), 0).toLocaleString()}
                        </span>
                    </div>
                </div>

                {/* Footer */}
                <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
                    <button className="btn btn-outline" onClick={onClose} style={{ padding: '8px 24px' }}>Close</button>
                </div>
            </div>
        </div>
    );
};

export default PaymentHistoryModal;

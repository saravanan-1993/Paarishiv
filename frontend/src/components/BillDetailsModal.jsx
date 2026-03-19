import React from 'react';
import { X, FileText, Calendar, IndianRupee, Hash, Briefcase, Info, CheckCircle, Percent } from 'lucide-react';

const BillDetailsModal = ({ isOpen, onClose, bill }) => {
    if (!isOpen || !bill) return null;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 1100, backdropFilter: 'blur(4px)'
        }}>
            <div className="animate-fade-in" style={{
                background: 'white', width: '100%', maxWidth: '600px',
                borderRadius: '16px', boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
                overflow: 'hidden', display: 'flex', flexDirection: 'column',
                maxHeight: '90vh'
            }}>
                {/* Header */}
                <div style={{
                    background: 'linear-gradient(135deg, #1e3a5f 0%, #2F5D8A 100%)',
                    padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', background: 'rgba(255,255,255,0.15)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <FileText size={22} color="white" />
                        </div>
                        <div>
                            <h2 style={{ color: 'white', fontSize: '18px', fontWeight: '800', margin: 0 }}>Client Bill Details</h2>
                            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', margin: 0 }}>Voucher No: {bill.bill_no}</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '8px', padding: '8px', cursor: 'pointer', color: 'white', display: 'flex' }}>
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div style={{ padding: '24px', overflowY: 'auto' }}>

                    {/* Status Banner */}
                    <div style={{
                        padding: '12px', borderRadius: '8px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        backgroundColor: bill.status === 'Paid' ? '#ECFDF5' : (bill.status === 'Partially Paid' ? '#EFF6FF' : '#FFFBEB'),
                        border: `1px solid ${bill.status === 'Paid' ? '#10B981' : (bill.status === 'Partially Paid' ? '#3B82F6' : '#F59E0B')}30`
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <CheckCircle size={18} color={bill.status === 'Paid' ? '#10B981' : (bill.status === 'Partially Paid' ? '#3B82F6' : '#F59E0B')} />
                            <span style={{ fontWeight: '700', color: bill.status === 'Paid' ? '#047857' : (bill.status === 'Partially Paid' ? '#1D4ED8' : '#B45309') }}>
                                Status: {bill.status}
                            </span>
                        </div>
                        <span style={{ fontWeight: '800', fontSize: '16px', color: bill.status === 'Paid' ? '#047857' : (bill.status === 'Partially Paid' ? '#1D4ED8' : '#B45309') }}>
                            ₹{(bill.collection_amount || 0).toLocaleString('en-IN')} Collected
                        </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '24px' }}>
                        <div style={{ padding: '16px', backgroundColor: '#F8FAFC', borderRadius: '12px', border: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--text-muted)' }}>
                                <Hash size={16} />
                                <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase' }}>Bill Number</span>
                            </div>
                            <div style={{ fontSize: '14px', fontWeight: '600' }}>{bill.bill_no}</div>
                        </div>
                        <div style={{ padding: '16px', backgroundColor: '#F8FAFC', borderRadius: '12px', border: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--text-muted)' }}>
                                <Calendar size={16} />
                                <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase' }}>Bill Date</span>
                            </div>
                            <div style={{ fontSize: '14px', fontWeight: '600' }}>{bill.date ? new Date(bill.date).toLocaleDateString() : 'N/A'}</div>
                        </div>
                        <div style={{ padding: '16px', backgroundColor: '#F8FAFC', borderRadius: '12px', border: '1px solid var(--border)', gridColumn: 'span 2' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--text-muted)' }}>
                                <Briefcase size={16} />
                                <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase' }}>Project</span>
                            </div>
                            <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--primary)' }}>{bill.project}</div>
                        </div>
                    </div>

                    <div style={{ marginBottom: '24px' }}>
                        <h3 style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-muted)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}><Info size={16} /> BILL TYPE & DESCRIPTION</h3>
                        <div style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '16px' }}>
                            <div style={{ marginBottom: '8px' }}>
                                <span style={{ background: '#F3F4F6', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', display: 'inline-block' }}>{bill.bill_type}</span>
                            </div>
                            <p style={{ fontSize: '14px', lineHeight: '1.6', color: 'var(--text-main)', margin: 0 }}>
                                {bill.description || 'No description provided for this bill.'}
                            </p>
                        </div>
                    </div>

                    <div>
                        <h3 style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-muted)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}><IndianRupee size={16} /> FINANCIAL DETAILS</h3>
                        <div style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)', backgroundColor: '#fff' }}>
                                <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Base Amount</span>
                                <span style={{ fontWeight: '600' }}>₹{(bill.amount || 0).toLocaleString('en-IN')}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)', backgroundColor: '#F8FAFC' }}>
                                <span style={{ color: 'var(--text-muted)', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}><Percent size={14} /> GST ({bill.gst_rate || 0}%)</span>
                                <span style={{ fontWeight: '600', color: '#059669' }}>+ ₹{(bill.gst_amount || 0).toLocaleString('en-IN')}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', backgroundColor: '#F0FDF4', borderTop: '2px solid #10B981' }}>
                                <span style={{ fontWeight: '800', fontSize: '15px', color: '#047857' }}>Total Invoice value</span>
                                <span style={{ fontWeight: '800', fontSize: '18px', color: '#047857' }}>₹{(bill.total_amount || 0).toLocaleString('en-IN')}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', backgroundColor: '#F8FAFC', display: 'flex', justifyContent: 'flex-end' }}>
                    <button className="btn btn-outline" onClick={onClose}>Close Details</button>
                </div>
            </div>
        </div>
    );
};

export default BillDetailsModal;

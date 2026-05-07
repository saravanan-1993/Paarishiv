import React from 'react';
import { X, FileText, Calendar, IndianRupee, Hash, Briefcase, Info, CheckCircle, Percent, Download, MessageCircle, Mail, Clock, AlertCircle } from 'lucide-react';

const BillDetailsModal = ({ isOpen, onClose, bill, onDownload, onShare }) => {
    if (!isOpen || !bill) return null;

    const totalAmt = bill.total_amount || 0;
    const collected = bill.collection_amount || 0;
    const balance = totalAmt - collected;
    const baseAmt = bill.amount || 0;
    const gstAmt = bill.gst_amount || 0;
    const gstRate = bill.gst_rate || 0;
    const halfRate = gstRate / 2;

    const statusConfig = {
        Paid: { bg: '#F0FDF4', border: '#10B981', icon: CheckCircle, color: '#059669', label: 'PAID' },
        Partial: { bg: '#EFF6FF', border: '#3B82F6', icon: Clock, color: '#2563EB', label: 'PARTIALLY PAID' },
        'Partially Paid': { bg: '#EFF6FF', border: '#3B82F6', icon: Clock, color: '#2563EB', label: 'PARTIALLY PAID' },
        Overdue: { bg: '#FFF1F2', border: '#EF4444', icon: AlertCircle, color: '#DC2626', label: 'OVERDUE' },
        Pending: { bg: '#FFFBEB', border: '#F59E0B', icon: Clock, color: '#D97706', label: 'PENDING' },
    };
    const sc = statusConfig[bill.status] || statusConfig.Pending;
    const StatusIcon = sc.icon;

    return (
        <div className="modal-overlay">
            <div className="card animate-fade-in" style={{ width: '95%', maxWidth: '640px', maxHeight: '92vh', display: 'flex', flexDirection: 'column', padding: 0, borderRadius: '16px', overflow: 'hidden' }}>

                {/* ── Header ── */}
                <div style={{ background: 'linear-gradient(135deg, #1a366b 0%, #2F5D8A 100%)', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '42px', height: '42px', background: 'rgba(255,255,255,0.15)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <FileText size={22} color="white" />
                        </div>
                        <div>
                            <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '11px', margin: 0, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Sales Invoice</p>
                            <h2 style={{ color: 'white', fontSize: '18px', fontWeight: '800', margin: 0 }}>Bill #{bill.bill_no}</h2>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '8px', padding: '8px', cursor: 'pointer', color: 'white', display: 'flex' }}>
                        <X size={18} />
                    </button>
                </div>

                {/* ── Status Banner ── */}
                <div style={{ background: sc.bg, borderBottom: `2px solid ${sc.border}`, padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <StatusIcon size={17} color={sc.color} />
                        <span style={{ fontWeight: '700', color: sc.color, fontSize: '13px' }}>{sc.label}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '11px', color: sc.color, fontWeight: '600' }}>Collected</div>
                        <div style={{ fontWeight: '800', fontSize: '15px', color: sc.color }}>₹{collected.toLocaleString('en-IN')}</div>
                    </div>
                </div>

                {/* ── Body ── */}
                <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>

                    {/* Info Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                        {[
                            { icon: Hash, label: 'Bill Number', value: bill.bill_no },
                            { icon: Calendar, label: 'Bill Date', value: bill.date ? new Date(bill.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A' },
                            { icon: Calendar, label: 'Due Date', value: bill.due_date ? new Date(bill.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—' },
                            { icon: Info, label: 'Bill Type', value: bill.bill_type || '—' },
                        ].map(({ icon: Icon, label, value }) => (
                            <div key={label} style={{ padding: '14px', backgroundColor: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', color: '#64748B' }}>
                                    <Icon size={14} />
                                    <span style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</span>
                                </div>
                                <div style={{ fontSize: '14px', fontWeight: '700', color: '#1E293B' }}>{value}</div>
                            </div>
                        ))}
                        <div style={{ padding: '14px', backgroundColor: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0', gridColumn: 'span 2' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', color: '#64748B' }}>
                                <Briefcase size={14} />
                                <span style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Project</span>
                            </div>
                            <div style={{ fontSize: '15px', fontWeight: '700', color: '#1a366b' }}>{bill.project}</div>
                        </div>
                    </div>

                    {/* Description */}
                    {bill.description && (
                        <div style={{ marginBottom: '20px', padding: '14px', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '10px' }}>
                            <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: '#2563EB', marginBottom: '6px', letterSpacing: '0.5px' }}>Description</div>
                            <p style={{ fontSize: '13px', lineHeight: '1.6', color: '#374151', margin: 0 }}>{bill.description}</p>
                        </div>
                    )}

                    {/* Financial Breakdown */}
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                            <IndianRupee size={15} color="#1a366b" />
                            <span style={{ fontSize: '12px', fontWeight: '800', color: '#1a366b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Financial Breakdown</span>
                        </div>
                        <div style={{ border: '1px solid #E2E8F0', borderRadius: '10px', overflow: 'hidden' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 16px', backgroundColor: '#fff', borderBottom: '1px solid #F1F5F9' }}>
                                <span style={{ color: '#64748B', fontSize: '13px' }}>Taxable Amount (Base)</span>
                                <span style={{ fontWeight: '700', fontSize: '13px' }}>₹{baseAmt.toLocaleString('en-IN')}</span>
                            </div>
                            {gstRate > 0 && gstAmt > 0 ? (
                                <>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 16px', backgroundColor: '#F8FAFC', borderBottom: '1px solid #F1F5F9' }}>
                                        <span style={{ color: '#64748B', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}><Percent size={13} /> CGST @ {halfRate}%</span>
                                        <span style={{ fontWeight: '600', fontSize: '13px', color: '#059669' }}>+ ₹{(gstAmt / 2).toLocaleString('en-IN')}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 16px', backgroundColor: '#F8FAFC', borderBottom: '1px solid #F1F5F9' }}>
                                        <span style={{ color: '#64748B', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}><Percent size={13} /> SGST @ {halfRate}%</span>
                                        <span style={{ fontWeight: '600', fontSize: '13px', color: '#059669' }}>+ ₹{(gstAmt / 2).toLocaleString('en-IN')}</span>
                                    </div>
                                </>
                            ) : gstAmt > 0 ? (
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 16px', backgroundColor: '#F8FAFC', borderBottom: '1px solid #F1F5F9' }}>
                                    <span style={{ color: '#64748B', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}><Percent size={13} /> GST ({gstRate}%)</span>
                                    <span style={{ fontWeight: '600', fontSize: '13px', color: '#059669' }}>+ ₹{gstAmt.toLocaleString('en-IN')}</span>
                                </div>
                            ) : null}
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 16px', background: 'linear-gradient(135deg, #1a366b, #2F5D8A)', borderTop: '2px solid #1a366b' }}>
                                <span style={{ fontWeight: '800', fontSize: '14px', color: 'white' }}>Total Invoice Value</span>
                                <span style={{ fontWeight: '800', fontSize: '17px', color: 'white' }}>₹{totalAmt.toLocaleString('en-IN')}</span>
                            </div>
                        </div>

                        {/* Collected / Balance row */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '12px' }}>
                            <div style={{ padding: '12px 16px', background: '#F0FDF4', borderRadius: '8px', border: '1px solid #BBF7D0' }}>
                                <div style={{ fontSize: '11px', fontWeight: '700', color: '#16A34A', textTransform: 'uppercase', marginBottom: '4px' }}>Collected</div>
                                <div style={{ fontWeight: '800', fontSize: '15px', color: '#15803D' }}>₹{collected.toLocaleString('en-IN')}</div>
                            </div>
                            <div style={{ padding: '12px 16px', background: balance > 0 ? '#FFF1F2' : '#F0FDF4', borderRadius: '8px', border: `1px solid ${balance > 0 ? '#FECACA' : '#BBF7D0'}` }}>
                                <div style={{ fontSize: '11px', fontWeight: '700', color: balance > 0 ? '#DC2626' : '#16A34A', textTransform: 'uppercase', marginBottom: '4px' }}>Balance Due</div>
                                <div style={{ fontWeight: '800', fontSize: '15px', color: balance > 0 ? '#DC2626' : '#15803D' }}>₹{balance.toLocaleString('en-IN')}</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Footer with Actions ── */}
                <div style={{ padding: '14px 24px', borderTop: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {onDownload && (
                            <button
                                onClick={onDownload}
                                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', border: '1px solid #10B981', borderRadius: '8px', background: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: '#059669' }}
                            >
                                <Download size={14} /> Download PDF
                            </button>
                        )}
                        {onShare && (
                            <>
                                <button
                                    onClick={() => onShare('whatsapp')}
                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', border: '1px solid #16A34A', borderRadius: '8px', background: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: '#16A34A' }}
                                >
                                    <MessageCircle size={14} /> WhatsApp
                                </button>
                                <button
                                    onClick={() => onShare('email')}
                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', border: '1px solid #2563EB', borderRadius: '8px', background: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: '#2563EB' }}
                                >
                                    <Mail size={14} /> Email
                                </button>
                            </>
                        )}
                    </div>
                    <button className="btn btn-outline" onClick={onClose} style={{ fontSize: '13px' }}>Close</button>
                </div>
            </div>
        </div>
    );
};

export default BillDetailsModal;

import React, { useState, useEffect } from 'react';
import { X, CreditCard, Calendar, FileText, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { subcontractorBillingAPI } from '../utils/api';

const PAYMENT_MODES = ['Cash', 'NEFT/RTGS', 'UPI', 'Cheque', 'Bank Transfer'];

const SubcontractorPaymentModal = ({ isOpen, onClose, bill, onSuccess }) => {
    const [paymentType, setPaymentType] = useState('full');
    const [amount, setAmount] = useState('');
    const [paymentMode, setPaymentMode] = useState('');
    const [referenceNo, setReferenceNo] = useState('');
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
    const [remarks, setRemarks] = useState('');
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});

    const payableAmount = parseFloat(bill?.total_amount || bill?.payable_amount || 0);
    const alreadyPaid = parseFloat(bill?.paid_amount || 0);
    const balanceDue = Math.max(0, payableAmount - alreadyPaid);
    const payments = bill?.payments || [];

    useEffect(() => {
        if (isOpen && bill) {
            setPaymentType('full');
            setAmount(balanceDue.toString());
            setPaymentMode('');
            setReferenceNo('');
            setPaymentDate(new Date().toISOString().split('T')[0]);
            setRemarks('');
            setErrors({});
        }
    }, [isOpen, bill]);

    useEffect(() => {
        if (paymentType === 'full') {
            setAmount(balanceDue.toString());
        }
    }, [paymentType, balanceDue]);

    if (!isOpen || !bill) return null;

    const billId = bill._id || bill.id;

    const formatCurrency = (v) => {
        const num = parseFloat(v) || 0;
        return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const formatDate = (d) => {
        if (!d) return '-';
        try {
            return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
        } catch {
            return d;
        }
    };

    const validate = () => {
        const errs = {};
        const amt = parseFloat(amount);
        if (!amount || isNaN(amt) || amt <= 0) {
            errs.amount = 'Amount must be greater than 0';
        } else if (amt > balanceDue) {
            errs.amount = `Amount cannot exceed balance of \u20B9${formatCurrency(balanceDue)}`;
        }
        if (!paymentMode) {
            errs.paymentMode = 'Payment mode is required';
        }
        if (!paymentDate) {
            errs.paymentDate = 'Date is required';
        }
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSubmit = async () => {
        if (!validate()) return;
        setLoading(true);
        try {
            await subcontractorBillingAPI.recordPayment(billId, {
                amount: parseFloat(amount),
                mode: paymentMode,
                reference: referenceNo,
                date: paymentDate,
                remarks
            });
            if (onSuccess) onSuccess();
            onClose();
        } catch (err) {
            console.error('Payment recording failed:', err);
            setErrors({ submit: err.response?.data?.detail || 'Failed to record payment. Please try again.' });
        } finally {
            setLoading(false);
        }
    };

    const styles = {
        overlay: {
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', zIndex: 9999, padding: '20px'
        },
        modal: {
            backgroundColor: '#fff', borderRadius: '12px', width: '95%', maxWidth: '600px',
            maxHeight: '90vh', display: 'flex', flexDirection: 'column',
            boxShadow: '0 25px 60px rgba(0,0,0,0.3)', overflow: 'hidden'
        },
        header: {
            background: 'linear-gradient(135deg, #1e3a5f 0%, #2F5D8A 100%)',
            padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        },
        headerLeft: { display: 'flex', alignItems: 'center', gap: '12px' },
        headerIcon: {
            width: '40px', height: '40px', background: 'rgba(255,255,255,0.15)', borderRadius: '10px',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        },
        headerTitle: { color: '#fff', fontSize: '18px', fontWeight: '800', margin: 0 },
        headerSub: { color: 'rgba(255,255,255,0.7)', fontSize: '12px', margin: 0 },
        closeBtn: {
            background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '8px',
            padding: '8px', cursor: 'pointer', color: '#fff', display: 'flex'
        },
        body: { padding: '24px', overflowY: 'auto', flex: 1 },
        billInfo: {
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '20px'
        },
        infoCard: {
            padding: '10px 12px', backgroundColor: '#f8fafc', borderRadius: '8px',
            border: '1px solid #e2e8f0', textAlign: 'center'
        },
        infoLabel: { fontSize: '10px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', margin: 0 },
        infoValue: { fontSize: '13px', fontWeight: '600', color: '#1e293b', margin: '4px 0 0' },
        summaryGrid: {
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '24px'
        },
        summaryCard: {
            padding: '16px', borderRadius: '10px', textAlign: 'center'
        },
        summaryLabel: { fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', margin: 0 },
        summaryAmount: { fontSize: '18px', fontWeight: '800', margin: '6px 0 0' },
        toggleGroup: {
            display: 'flex', gap: '0', marginBottom: '20px', borderRadius: '8px',
            overflow: 'hidden', border: '1px solid #e2e8f0'
        },
        toggleBtn: (active) => ({
            flex: 1, padding: '10px 16px', border: 'none', cursor: 'pointer',
            fontSize: '13px', fontWeight: '700', transition: 'all 0.2s',
            backgroundColor: active ? '#1e3a5f' : '#fff',
            color: active ? '#fff' : '#64748b'
        }),
        formGroup: { marginBottom: '16px' },
        label: { display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '6px' },
        input: {
            width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px',
            fontSize: '14px', outline: 'none', backgroundColor: '#fff', boxSizing: 'border-box',
            transition: 'border-color 0.2s'
        },
        inputError: {
            width: '100%', padding: '10px 12px', border: '1px solid #ef4444', borderRadius: '8px',
            fontSize: '14px', outline: 'none', backgroundColor: '#fef2f2', boxSizing: 'border-box'
        },
        inputDisabled: {
            width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px',
            fontSize: '14px', outline: 'none', backgroundColor: '#f1f5f9', boxSizing: 'border-box',
            color: '#64748b'
        },
        select: {
            width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px',
            fontSize: '14px', outline: 'none', backgroundColor: '#fff', boxSizing: 'border-box',
            cursor: 'pointer'
        },
        selectError: {
            width: '100%', padding: '10px 12px', border: '1px solid #ef4444', borderRadius: '8px',
            fontSize: '14px', outline: 'none', backgroundColor: '#fef2f2', boxSizing: 'border-box',
            cursor: 'pointer'
        },
        textarea: {
            width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px',
            fontSize: '14px', outline: 'none', resize: 'vertical', minHeight: '60px',
            boxSizing: 'border-box', fontFamily: 'inherit'
        },
        errorText: { color: '#ef4444', fontSize: '11px', marginTop: '4px' },
        submitBtn: {
            width: '100%', padding: '12px', backgroundColor: '#1e3a5f', color: '#fff',
            border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '700',
            cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: '8px', opacity: loading ? 0.7 : 1,
            transition: 'background-color 0.2s'
        },
        errorBanner: {
            padding: '12px', backgroundColor: '#fef2f2', border: '1px solid #fecaca',
            borderRadius: '8px', marginBottom: '16px', display: 'flex', alignItems: 'center',
            gap: '8px', color: '#dc2626', fontSize: '13px'
        },
        paymentsSection: { marginTop: '24px', paddingTop: '20px', borderTop: '2px solid #e2e8f0' },
        paymentsTitle: { fontSize: '14px', fontWeight: '700', color: '#1e3a5f', marginBottom: '12px' },
        paymentTable: { width: '100%', borderCollapse: 'collapse', fontSize: '12px' },
        pth: {
            backgroundColor: '#f1f5f9', padding: '8px 10px', fontSize: '11px',
            fontWeight: '700', color: '#475569', textAlign: 'left',
            borderBottom: '1px solid #e2e8f0'
        },
        ptd: {
            padding: '8px 10px', borderBottom: '1px solid #f1f5f9', fontSize: '12px',
            color: '#334155'
        }
    };

    return (
        <div style={styles.overlay} onClick={onClose}>
            <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div style={styles.header}>
                    <div style={styles.headerLeft}>
                        <div style={styles.headerIcon}>
                            <CreditCard size={22} color="white" />
                        </div>
                        <div>
                            <h2 style={styles.headerTitle}>Record Payment</h2>
                            <p style={styles.headerSub}>
                                {bill.contractor_name || 'Contractor'} - {bill.project_name || 'Project'}
                            </p>
                        </div>
                    </div>
                    <button
                        style={styles.closeBtn}
                        onClick={onClose}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div style={styles.body}>
                    {/* Bill Info */}
                    <div style={styles.billInfo}>
                        <div style={styles.infoCard}>
                            <p style={styles.infoLabel}>Bill No</p>
                            <p style={styles.infoValue}>{bill.bill_no || billId?.slice(-6)?.toUpperCase() || '-'}</p>
                        </div>
                        <div style={styles.infoCard}>
                            <p style={styles.infoLabel}>Contractor</p>
                            <p style={styles.infoValue}>{bill.contractor_name || '-'}</p>
                        </div>
                        <div style={styles.infoCard}>
                            <p style={styles.infoLabel}>Project</p>
                            <p style={styles.infoValue}>{bill.project_name || '-'}</p>
                        </div>
                    </div>

                    {/* Bill Summary */}
                    <div style={styles.summaryGrid}>
                        <div style={{ ...styles.summaryCard, backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                            <p style={{ ...styles.summaryLabel, color: '#15803d' }}>Payable Amount</p>
                            <p style={{ ...styles.summaryAmount, color: '#15803d' }}>{'\u20B9'}{formatCurrency(payableAmount)}</p>
                        </div>
                        <div style={{ ...styles.summaryCard, backgroundColor: '#eff6ff', border: '1px solid #bfdbfe' }}>
                            <p style={{ ...styles.summaryLabel, color: '#1d4ed8' }}>Already Paid</p>
                            <p style={{ ...styles.summaryAmount, color: '#1d4ed8' }}>{'\u20B9'}{formatCurrency(alreadyPaid)}</p>
                        </div>
                        <div style={{ ...styles.summaryCard, backgroundColor: '#fef2f2', border: '1px solid #fecaca' }}>
                            <p style={{ ...styles.summaryLabel, color: '#dc2626' }}>Balance Due</p>
                            <p style={{ ...styles.summaryAmount, color: '#dc2626' }}>{'\u20B9'}{formatCurrency(balanceDue)}</p>
                        </div>
                    </div>

                    {/* Error banner */}
                    {errors.submit && (
                        <div style={styles.errorBanner}>
                            <AlertCircle size={16} />
                            {errors.submit}
                        </div>
                    )}

                    {/* No balance check */}
                    {balanceDue <= 0 ? (
                        <div style={{ padding: '24px', textAlign: 'center', color: '#15803d', backgroundColor: '#f0fdf4', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
                            <CheckCircle2 size={32} style={{ margin: '0 auto 8px' }} />
                            <p style={{ fontWeight: '700', fontSize: '15px', margin: 0 }}>Fully Paid</p>
                            <p style={{ fontSize: '13px', color: '#16a34a', margin: '4px 0 0' }}>This bill has been fully paid. No balance due.</p>
                        </div>
                    ) : (
                        <>
                            {/* Payment Type Toggle */}
                            <div style={styles.formGroup}>
                                <label style={styles.label}>Payment Type</label>
                                <div style={styles.toggleGroup}>
                                    <button
                                        style={styles.toggleBtn(paymentType === 'full')}
                                        onClick={() => setPaymentType('full')}
                                        type="button"
                                    >
                                        Full Payment
                                    </button>
                                    <button
                                        style={styles.toggleBtn(paymentType === 'partial')}
                                        onClick={() => setPaymentType('partial')}
                                        type="button"
                                    >
                                        Partial Payment
                                    </button>
                                </div>
                            </div>

                            {/* Amount */}
                            <div style={styles.formGroup}>
                                <label style={styles.label}>Amount ({'\u20B9'})</label>
                                {paymentType === 'full' ? (
                                    <input
                                        type="text"
                                        value={formatCurrency(balanceDue)}
                                        readOnly
                                        style={styles.inputDisabled}
                                    />
                                ) : (
                                    <>
                                        <input
                                            type="number"
                                            value={amount}
                                            onChange={(e) => { setAmount(e.target.value); setErrors(prev => ({ ...prev, amount: '' })); }}
                                            placeholder="Enter payment amount"
                                            style={errors.amount ? styles.inputError : styles.input}
                                            min="0"
                                            max={balanceDue}
                                            step="0.01"
                                        />
                                        {errors.amount && <div style={styles.errorText}>{errors.amount}</div>}
                                    </>
                                )}
                            </div>

                            {/* Payment Mode */}
                            <div style={styles.formGroup}>
                                <label style={styles.label}>Payment Mode *</label>
                                <select
                                    value={paymentMode}
                                    onChange={(e) => { setPaymentMode(e.target.value); setErrors(prev => ({ ...prev, paymentMode: '' })); }}
                                    style={errors.paymentMode ? styles.selectError : styles.select}
                                >
                                    <option value="">Select payment mode</option>
                                    {PAYMENT_MODES.map(mode => (
                                        <option key={mode} value={mode}>{mode}</option>
                                    ))}
                                </select>
                                {errors.paymentMode && <div style={styles.errorText}>{errors.paymentMode}</div>}
                            </div>

                            {/* Reference No */}
                            <div style={styles.formGroup}>
                                <label style={styles.label}>Reference No (UTR / Cheque No)</label>
                                <input
                                    type="text"
                                    value={referenceNo}
                                    onChange={(e) => setReferenceNo(e.target.value)}
                                    placeholder="Enter reference number"
                                    style={styles.input}
                                />
                            </div>

                            {/* Date */}
                            <div style={styles.formGroup}>
                                <label style={styles.label}>Date *</label>
                                <input
                                    type="date"
                                    value={paymentDate}
                                    onChange={(e) => { setPaymentDate(e.target.value); setErrors(prev => ({ ...prev, paymentDate: '' })); }}
                                    style={errors.paymentDate ? styles.inputError : styles.input}
                                />
                                {errors.paymentDate && <div style={styles.errorText}>{errors.paymentDate}</div>}
                            </div>

                            {/* Remarks */}
                            <div style={styles.formGroup}>
                                <label style={styles.label}>Remarks</label>
                                <textarea
                                    value={remarks}
                                    onChange={(e) => setRemarks(e.target.value)}
                                    placeholder="Add any notes about this payment..."
                                    style={styles.textarea}
                                    rows={2}
                                />
                            </div>

                            {/* Submit */}
                            <button
                                style={styles.submitBtn}
                                onClick={handleSubmit}
                                disabled={loading}
                                onMouseEnter={(e) => { if (!loading) e.currentTarget.style.backgroundColor = '#162d4a'; }}
                                onMouseLeave={(e) => { if (!loading) e.currentTarget.style.backgroundColor = '#1e3a5f'; }}
                            >
                                {loading ? (
                                    <>
                                        <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 size={16} />
                                        Record Payment
                                    </>
                                )}
                            </button>
                        </>
                    )}

                    {/* Past Payments */}
                    {payments.length > 0 && (
                        <div style={styles.paymentsSection}>
                            <h3 style={styles.paymentsTitle}>Past Payments ({payments.length})</h3>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={styles.paymentTable}>
                                    <thead>
                                        <tr>
                                            <th style={styles.pth}>Date</th>
                                            <th style={styles.pth}>Amount</th>
                                            <th style={styles.pth}>Mode</th>
                                            <th style={styles.pth}>Reference</th>
                                            <th style={styles.pth}>Recorded By</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {payments.map((p, idx) => (
                                            <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#f8fafc' }}>
                                                <td style={styles.ptd}>{formatDate(p.date)}</td>
                                                <td style={{ ...styles.ptd, fontWeight: '600', fontFamily: "'Courier New', monospace" }}>
                                                    {'\u20B9'}{formatCurrency(p.amount)}
                                                </td>
                                                <td style={styles.ptd}>{p.mode || '-'}</td>
                                                <td style={styles.ptd}>{p.reference || '-'}</td>
                                                <td style={styles.ptd}>{p.recorded_by || '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    );
};

export default SubcontractorPaymentModal;

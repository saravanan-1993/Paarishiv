import React, { useState } from 'react';
import { X, CheckCircle2, Calendar, CreditCard, User, FileText, AlertCircle } from 'lucide-react';
import { financeAPI } from '../utils/api';

const IndianRupee = ({ size, className, style, color }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
        <path d="M6 3h12" />
        <path d="M6 8h12" />
        <path d="M6 13l8.5 8" />
        <path d="M6 13h3" />
        <path d="M9 13c6.667 0 6.667-10 0-10" />
    </svg>
);

const ProcessPaymentModal = ({ isOpen, onClose, invoice, onPaymentProcessed }) => {
    const [invoiceNo, setInvoiceNo] = useState('');
    const [baseAmount, setBaseAmount] = useState('');
    const [gstPercent, setGstPercent] = useState('18');
    const [paymentMode, setPaymentMode] = useState('NEFT/RTGS');
    const [reference, setReference] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(false);
    const [invoiceFile, setInvoiceFile] = useState(null);
    const [remarks, setRemarks] = useState('');
    const [paymentType, setPaymentType] = useState('Full');
    const [partialAmount, setPartialAmount] = useState('');
    const [items, setItems] = useState([]);

    React.useEffect(() => {
        if (invoice) {
            // Priority 1: Use stored base_amount if available (best for partial payments)
            if (invoice.base_amount) {
                setBaseAmount(invoice.base_amount.toString());
            }
            // Priority 2: Use items to compute base amount
            else if (invoice.items && invoice.items.length > 0 && invoice.items.some(it => it.price)) {
                const computed = invoice.items.reduce((sum, item) => sum + (parseFloat(item.received_qty || 0) * parseFloat(item.price || 0)), 0);
                setBaseAmount(computed.toString());
            }
            // Priority 3: Fallback to total (only for clean invoices with no GST recorded yet)
            else if (invoice.total_amount) {
                setBaseAmount(invoice.total_amount.toString());
            } else {
                setBaseAmount('');
            }

            if (invoice.gst_percent) {
                setGstPercent(invoice.gst_percent.toString());
            }

            if (invoice.invoice_no) {
                setInvoiceNo(invoice.invoice_no);
            } else {
                setInvoiceNo('');
            }
            if (invoice.items) {
                setItems(invoice.items.map(it => ({ ...it, price: it.price || '' })));
            } else {
                setItems([]);
            }
            setPaymentType('Full');
            setPartialAmount('');
            setRemarks('');
        }
    }, [invoice]);

    if (!isOpen || !invoice) return null;

    const isLocked = (invoice.paid_amount || 0) > 0;

    const gstAmount = (parseFloat(baseAmount || 0) * parseFloat(gstPercent || 0)) / 100;
    const totalAmount = parseFloat(baseAmount || 0) + gstAmount;

    // Correctly calculate remaining balance
    const remainingBalance = Math.max(0, totalAmount - (invoice.paid_amount || 0));

    const handleItemPriceChange = (index, val) => {
        const newItems = [...items];
        newItems[index].price = val;
        setItems(newItems);

        // Auto calculate base amount based on updated items
        const computedBase = newItems.reduce((sum, item) => sum + (parseFloat(item.received_qty || 0) * parseFloat(item.price || 0)), 0);
        if (computedBase > 0) {
            setBaseAmount(computedBase.toString());
        }
    };

    const handleProcess = async () => {
        if (!baseAmount || isNaN(parseFloat(baseAmount))) {
            alert('Please enter a valid invoice base amount.');
            return;
        }

        if (!invoiceNo) {
            alert('Please enter the Invoice Number.');
            return;
        }

        const paymentAmountToSend = paymentType === 'Full' ? remainingBalance
            : paymentType === 'Partial' ? parseFloat(partialAmount)
            : 0; // Pending = no payment

        if (paymentType === 'Full' && remainingBalance <= 0) {
            alert('This invoice is already fully paid.');
            return;
        }

        if (paymentType === 'Partial' && (!partialAmount || isNaN(paymentAmountToSend) || paymentAmountToSend <= 0)) {
            alert('Please enter a valid partial payment amount.');
            return;
        }

        if (paymentType !== 'Pending' && paymentAmountToSend > (remainingBalance + 0.01)) {
            alert(`Payment amount (₹${paymentAmountToSend.toLocaleString()}) cannot exceed the remaining balance (₹${remainingBalance.toLocaleString()}).`);
            return;
        }

        setLoading(true);
        try {
            const isPending = paymentType === 'Pending';
            const payload = {
                date,
                project: invoice.project || "General",
                category: 'Material Purchase',
                amount: paymentAmountToSend,
                base_amount: parseFloat(baseAmount),
                gst_amount: gstAmount,
                invoice_no: invoiceNo,
                paymentMode: isPending ? 'Pending' : paymentMode,
                payee: invoice.vendor,
                description: remarks || (isPending
                    ? `Invoice recorded (pending payment) — ${invoiceNo} (Ref: ${invoice.voucher_no})`
                    : `Payment for Invoice ${invoiceNo} (Ref: ${invoice.voucher_no})`),
                reference,
                grn_id: invoice.id,
                voucher_no: invoice.voucher_no,
                receipt_url: invoiceFile ? "file_uploaded.pdf" : null,
                mark_as_paid: !isPending && (paymentType === 'Full' || (Math.abs(remainingBalance - paymentAmountToSend) < 0.01)),
                items: items,
                total_amount: totalAmount,
                status: isPending ? 'Pending' : 'Paid'
            };

            await financeAPI.createExpense(payload);
            alert(isPending ? 'Invoice recorded successfully (payment pending).' : 'Invoice recorded and payment processed successfully!');
            onPaymentProcessed?.();
            onClose();
        } catch (err) {
            console.error('Payment error:', err);
            alert(`Failed to process: ${err.response?.data?.detail || err.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="card animate-fade-in" style={{
                width: '95%', maxWidth: '650px', maxHeight: '90vh',
                display: 'flex', flexDirection: 'column', padding: 0
            }}>
                {/* Header */}
                <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ padding: '10px', backgroundColor: '#ECFDF5', color: '#10B981', borderRadius: '8px' }}>
                            <CreditCard size={20} />
                        </div>
                        <h2 style={{ fontSize: '18px', fontWeight: '700' }}>Record Purchase & Payment</h2>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                        <X size={24} />
                    </button>
                </div>

                {/* Body */}
                <div style={{ padding: '24px', overflowY: 'auto', maxHeight: '75vh' }}>

                    {/* Step 1: Verification */}
                    <div style={{ marginBottom: '24px' }}>
                        <h4 style={{ fontSize: '13px', fontWeight: '800', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <FileText size={16} color="var(--primary)" /> 1. VERIFY RECEIVED ITEMS (FROM {invoice.voucher_no})
                        </h4>
                        <div style={{ backgroundColor: '#F8FAFC', borderRadius: '8px', padding: '8px', border: '1px solid var(--border)' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                <thead style={{ borderBottom: '1px solid var(--border)' }}>
                                    <tr>
                                        <th style={{ textAlign: 'left', padding: '8px', color: 'var(--text-muted)' }}>Material</th>
                                        <th style={{ textAlign: 'center', padding: '8px', color: 'var(--text-muted)' }}>Qty Received</th>
                                        <th style={{ textAlign: 'center', padding: '8px', color: 'var(--text-muted)' }}>Unit</th>
                                        <th style={{ textAlign: 'right', padding: '8px', color: 'var(--text-muted)' }}>Price/Unit (₹)</th>
                                        <th style={{ textAlign: 'right', padding: '8px', color: 'var(--text-muted)' }}>Total (₹)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items?.map((item, i) => {
                                        const subTotal = (parseFloat(item.received_qty || 0) * parseFloat(item.price || 0)) || 0;
                                        return (
                                            <tr key={i}>
                                                <td style={{ padding: '8px', fontWeight: '600' }}>{item.name}</td>
                                                <td style={{ padding: '8px', textAlign: 'center', fontWeight: '700' }}>{item.received_qty}</td>
                                                <td style={{ padding: '8px', textAlign: 'center' }}>{item.unit}</td>
                                                <td style={{ padding: '8px', textAlign: 'right' }}>
                                                    <input
                                                        type="number"
                                                        value={item.price}
                                                        onChange={(e) => handleItemPriceChange(i, e.target.value)}
                                                        placeholder="0"
                                                        disabled={isLocked}
                                                        style={{
                                                            width: '80px', padding: '4px 8px', borderRadius: '4px',
                                                            border: '1px solid var(--border)', textAlign: 'right', fontSize: '11px',
                                                            backgroundColor: isLocked ? '#f1f5f9' : 'white',
                                                            cursor: isLocked ? 'not-allowed' : 'text'
                                                        }}
                                                    />
                                                </td>
                                                <td style={{ padding: '8px', textAlign: 'right', fontWeight: '700' }}>
                                                    {subTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Step 2: Invoice Entry */}
                    <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: '#F0F9FF', borderRadius: '12px', border: '1px solid #BAE6FD' }}>
                        <h4 style={{ fontSize: '13px', fontWeight: '800', marginBottom: '16px', color: '#0369A1' }}>2. ENTER INVOICE DETAILS</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', marginBottom: '6px' }}>INVOICE NUMBER*</label>
                                <input
                                    type="text"
                                    value={invoiceNo}
                                    onChange={(e) => setInvoiceNo(e.target.value)}
                                    placeholder="Enter physical invoice no..."
                                    disabled={isLocked}
                                    style={{
                                        width: '100%', padding: '8px 12px', borderRadius: '8px',
                                        border: '1px solid #94A3B8',
                                        backgroundColor: isLocked ? '#f1f5f9' : 'white',
                                        cursor: isLocked ? 'not-allowed' : 'text'
                                    }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', marginBottom: '6px' }}>BASE AMOUNT (₹)*</label>
                                <input
                                    type="number"
                                    value={baseAmount}
                                    onChange={(e) => setBaseAmount(e.target.value)}
                                    placeholder="Amount before GST"
                                    disabled={isLocked}
                                    style={{
                                        width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #94A3B8',
                                        fontWeight: '700',
                                        backgroundColor: isLocked ? '#f1f5f9' : 'white',
                                        cursor: isLocked ? 'not-allowed' : 'text'
                                    }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', marginBottom: '6px' }}>GST PERCENT (%)</label>
                                <select
                                    value={gstPercent}
                                    onChange={(e) => setGstPercent(e.target.value)}
                                    disabled={isLocked}
                                    style={{
                                        width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #94A3B8',
                                        backgroundColor: isLocked ? '#f1f5f9' : 'white',
                                        cursor: isLocked ? 'not-allowed' : 'pointer'
                                    }}
                                >
                                    <option value="0">0%</option>
                                    <option value="5">5%</option>
                                    <option value="12">12%</option>
                                    <option value="18">18%</option>
                                    <option value="28">28%</option>
                                </select>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                                <div style={{ padding: '10px', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #BAE6FD', textAlign: 'right' }}>
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>TOTAL INVOICE (AUTO)</span>
                                    <span style={{ fontWeight: '800', fontSize: '16px', color: '#0369A1' }}>₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                </div>
                            </div>
                            <div style={{ gridColumn: 'span 2' }}>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', marginBottom: '6px' }}>REMARKS / DESCRIPTION</label>
                                <textarea
                                    value={remarks}
                                    onChange={(e) => setRemarks(e.target.value)}
                                    placeholder="Enter any remarks or notes regarding this invoice..."
                                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #94A3B8', minHeight: '60px', resize: 'vertical' }}
                                />
                            </div>
                            <div style={{ gridColumn: 'span 2' }}>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', marginBottom: '6px' }}>UPLOAD INVOICE COPY (PDF/IMAGE)</label>
                                <input
                                    type="file"
                                    onChange={(e) => setInvoiceFile(e.target.files[0])}
                                    style={{ width: '100%', fontSize: '12px' }}
                                    accept="image/*,.pdf"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Step 3: Payment Details */}
                    <div>
                        <h4 style={{ fontSize: '13px', fontWeight: '800', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <IndianRupee size={16} color="#10B981" /> 3. RECORD PAYMENT ENTRY
                        </h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '16px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '6px' }}>PAYMENT MODE</label>
                                <select
                                    value={paymentMode}
                                    onChange={(e) => setPaymentMode(e.target.value)}
                                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'white' }}
                                >
                                    <option>NEFT/RTGS</option>
                                    <option>Internal Transfer</option>
                                    <option>Cheque</option>
                                    <option>Cash</option>
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '6px' }}>DATE</label>
                                <input
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}
                                />
                            </div>
                            <div style={{ gridColumn: 'span 2' }}>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '6px' }}>TRANSACTION REF / UTR</label>
                                <input
                                    type="text"
                                    placeholder="UTR / Cheque No / Ref..."
                                    value={reference}
                                    onChange={(e) => setReference(e.target.value)}
                                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)' }}
                                />
                            </div>
                        </div>

                        {/* Payment Type Selection */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '16px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '6px' }}>PAYMENT STATUS</label>
                                <select
                                    value={paymentType}
                                    onChange={(e) => setPaymentType(e.target.value)}
                                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'white', fontWeight: '700' }}
                                >
                                    <option value="Full">Pay Remaining Balance (₹{remainingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })})</option>
                                    <option value="Partial">Partial Payment</option>
                                    <option value="Pending">Pending (Record Invoice Only)</option>
                                </select>
                            </div>
                            {paymentType === 'Partial' && (
                                <div>
                                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#0369A1', marginBottom: '6px' }}>PAYMENT AMOUNT (₹)*</label>
                                    <input
                                        type="number"
                                        value={partialAmount}
                                        onChange={(e) => setPartialAmount(e.target.value)}
                                        placeholder="Amount being paid now..."
                                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #BAE6FD', fontWeight: '800', backgroundColor: '#F0F9FF', color: '#0369A1' }}
                                    />
                                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px', display: 'block', fontWeight: '600' }}>Balance remaining after this: ₹{(remainingBalance - parseFloat(partialAmount || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '12px', backgroundColor: '#f8fafc', borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px' }}>
                    <button className="btn btn-outline" onClick={onClose} style={{ padding: '8px 20px' }}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleProcess} style={{ padding: '10px 32px' }} disabled={loading}>
                        {loading ? 'Processing...' : <><CheckCircle2 size={18} /> {paymentType === 'Pending' ? 'Record Invoice' : 'Record & Pay'}</>}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProcessPaymentModal;

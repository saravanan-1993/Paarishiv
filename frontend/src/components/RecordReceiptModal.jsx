import React, { useState, useEffect } from 'react';
import { X, Loader2, DollarSign, Calendar, FileText, User, Briefcase } from 'lucide-react';
import { projectAPI, billingAPI, financeAPI } from '../utils/api';

const RecordReceiptModal = ({ isOpen, onClose, onReceiptRecorded }) => {
    const [loading, setLoading] = useState(false);
    const [fetchingBills, setFetchingBills] = useState(false);
    const [projects, setProjects] = useState([]);
    const [bills, setBills] = useState([]);

    const [formData, setFormData] = useState({
        project: '',
        bill_id: '',
        bill_no: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        payment_mode: 'Bank',
        description: '',
        received_from: ''
    });

    useEffect(() => {
        if (isOpen) {
            loadProjects();
        }
    }, [isOpen]);

    const loadProjects = async () => {
        try {
            const res = await projectAPI.getAll();
            setProjects(res.data || []);
        } catch (err) {
            console.error('Failed to load projects:', err);
        }
    };

    const loadBills = async (projectName) => {
        setFetchingBills(true);
        try {
            const res = await billingAPI.getAll();
            const projectBills = res.data.filter(b => b.project === projectName && b.status !== 'Paid');
            setBills(projectBills);
        } catch (err) {
            console.error('Failed to load bills:', err);
        } finally {
            setFetchingBills(false);
        }
    };

    const handleProjectChange = (e) => {
        const projectName = e.target.value;
        setFormData({ ...formData, project: projectName, bill_id: '', bill_no: '' });
        if (projectName) {
            loadBills(projectName);
        } else {
            setBills([]);
        }
    };

    const handleBillChange = (e) => {
        const billId = e.target.value;
        const selectedBill = bills.find(b => b.id === billId);
        setFormData({
            ...formData,
            bill_id: billId,
            bill_no: selectedBill ? selectedBill.bill_no : '',
            amount: selectedBill ? (selectedBill.total_amount - selectedBill.collection_amount) : ''
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await financeAPI.createReceipt({
                ...formData,
                amount: parseFloat(formData.amount)
            });
            onReceiptRecorded();
            onClose();
            setFormData({
                project: '',
                bill_id: '',
                bill_no: '',
                amount: '',
                date: new Date().toISOString().split('T')[0],
                payment_mode: 'Bank',
                description: '',
                received_from: ''
            });
        } catch (err) {
            console.error('Failed to record receipt:', err);
            alert('Failed to record receipt. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '500px' }}>
                <div className="modal-header">
                    <div className="modal-title-wrapper">
                        <div className="modal-icon" style={{ backgroundColor: '#ECFDF5', color: '#10B981' }}>
                            <DollarSign size={20} />
                        </div>
                        <div>
                            <h3 className="modal-title">New Customer Receipt</h3>
                            <p className="modal-subtitle">Record money received from a client</p>
                        </div>
                    </div>
                    <button className="modal-close" onClick={onClose}><X size={20} /></button>
                </div>

                <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
                    <div style={{ display: 'grid', gap: '20px' }}>
                        <div className="form-group">
                            <label className="form-label">Project</label>
                            <div style={{ position: 'relative' }}>
                                <Briefcase size={16} className="input-icon" />
                                <select
                                    className="form-input with-icon"
                                    value={formData.project}
                                    onChange={handleProjectChange}
                                    required
                                >
                                    <option value="">Select Project</option>
                                    {projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Link to Bill (Optional)</label>
                            <div style={{ position: 'relative' }}>
                                <FileText size={16} className="input-icon" />
                                <select
                                    className="form-input with-icon"
                                    value={formData.bill_id}
                                    onChange={handleBillChange}
                                    disabled={!formData.project || fetchingBills}
                                >
                                    <option value="">Direct Receipt (No Bill)</option>
                                    {bills.map(b => (
                                        <option key={b.id} value={b.id}>
                                            {b.bill_no} (Bal: ₹{(b.total_amount - b.collection_amount).toLocaleString()})
                                        </option>
                                    ))}
                                </select>
                                {fetchingBills && <Loader2 size={16} className="spin" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)' }} />}
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div className="form-group">
                                <label className="form-label">Amount Received (₹)</label>
                                <div style={{ position: 'relative' }}>
                                    <IndianRupee size={16} className="input-icon" />
                                    <input
                                        type="number"
                                        className="form-input with-icon"
                                        placeholder="0.00"
                                        value={formData.amount}
                                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Receipt Date</label>
                                <div style={{ position: 'relative' }}>
                                    <Calendar size={16} className="input-icon" />
                                    <input
                                        type="date"
                                        className="form-input with-icon"
                                        value={formData.date}
                                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Payment Mode</label>
                            <select
                                className="form-input"
                                value={formData.payment_mode}
                                onChange={(e) => setFormData({ ...formData, payment_mode: e.target.value })}
                            >
                                <option value="Bank">Bank Transfer / NEFT</option>
                                <option value="Cash">Cash</option>
                                <option value="Cheque">Cheque</option>
                                <option value="UPI">UPI</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Description / Remarks</label>
                            <textarea
                                className="form-input"
                                rows="3"
                                placeholder="Details about the payment..."
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            ></textarea>
                        </div>
                    </div>

                    <div className="modal-footer" style={{ marginTop: '24px', padding: 0 }}>
                        <button type="button" className="btn btn-outline" onClick={onClose} disabled={loading}>
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? <><Loader2 size={18} className="spin" /> Recording...</> : 'Record Receipt'}
                        </button>
                    </div>
                </form>
            </div>
            <style>{`
                .with-icon { padding-left: 36px !important; }
                .input-icon {
                    position: absolute;
                    left: 12px;
                    top: 50%;
                    transform: translateY(-50%);
                    color: #94A3B8;
                    pointer-events: none;
                }
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
};

const IndianRupee = ({ size, className }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <path d="M6 3h12" />
        <path d="M6 8h12" />
        <path d="M6 13l8.5 8" />
        <path d="M6 13h3" />
        <path d="M9 13c6.667 0 6.667-10 0-10" />
    </svg>
);

export default RecordReceiptModal;

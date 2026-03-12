import React, { useState, useEffect } from 'react';
import { X, Calendar, Tag, IndianRupee, Upload, Briefcase, Filter } from 'lucide-react';
import { projectAPI } from '../utils/api';
import CustomSelect from './CustomSelect';

const RecordExpenseModal = ({ isOpen, onClose, onExpenseRecorded }) => {
    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        project: '',
        category: '',
        amount: '',
        paymentMode: 'Bank',
        payee: '',
        description: '',
        reference: ''
    });

    const [loading, setLoading] = useState(false);
    const [projects, setProjects] = useState([]);

    useEffect(() => {
        projectAPI.getAll().then(res => setProjects(res.data || [])).catch(() => { });
    }, []);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await onExpenseRecorded?.({
                ...formData,
                amount: parseFloat(formData.amount)
            });
            onClose();
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const categories = [
        'Site Office', 'Labour Wage', 'Material Purchase', 'Fuel/Diesel',
        'Professional Fees', 'Rent/Lease', 'Tools & Spares', 'Petty Cash', 'Others'
    ];


    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '600px', width: '95%' }}>
                <div className="modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', backgroundColor: '#ecfdf5', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                            <IndianRupee size={20} />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '18px', fontWeight: '800' }}>RECORD NEW EXPENSE</h3>
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Log site or office related expenditures</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="modal-body" style={{ padding: '24px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                        <div className="form-group">
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Date *</label>
                            <div style={{ position: 'relative' }}>
                                <Calendar size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input type="date" required value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} style={{ width: '100%', padding: '12px 12px 12px 40px', borderRadius: '8px', border: '1px solid var(--border)' }} />
                            </div>
                        </div>
                        <div className="form-group">
                            <CustomSelect
                                label="Project *"
                                options={projects.map(p => ({ value: p.name, label: p.name }))}
                                value={formData.project}
                                onChange={(val) => setFormData({ ...formData, project: val })}
                                placeholder="Select Project"
                                width="full"
                                icon={Briefcase}
                                error={!formData.project}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                        <div className="form-group">
                            <CustomSelect
                                label="Category *"
                                options={categories.map(c => ({ value: c, label: c }))}
                                value={formData.category}
                                onChange={(val) => setFormData({ ...formData, category: val })}
                                placeholder="Select Category"
                                width="full"
                                icon={Tag}
                                error={!formData.category}
                            />
                        </div>
                        <div className="form-group">
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Amount (₹) *</label>
                            <div style={{ position: 'relative' }}>
                                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontWeight: '700', color: 'var(--text-muted)' }}>₹</span>
                                <input type="number" required placeholder="0.00" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} style={{ width: '100%', padding: '12px 12px 12px 28px', borderRadius: '8px', border: '1px solid var(--border)', fontWeight: '700' }} />
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                        <div className="form-group">
                            <CustomSelect
                                label="Paid From / Mode"
                                options={[
                                    { value: 'Bank', label: 'Bank Transfer' },
                                    { value: 'Cash', label: 'Petty Cash' },
                                    { value: 'UPI', label: 'UPI / PhonePe' },
                                    { value: 'Cheque', label: 'Cheque' }
                                ]}
                                value={formData.paymentMode}
                                onChange={(val) => setFormData({ ...formData, paymentMode: val })}
                                width="full"
                                searchable={false}
                            />
                        </div>
                        <div className="form-group">
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Paid To / Payee *</label>
                            <input type="text" required placeholder="e.g. Site Supervisor" value={formData.payee} onChange={(e) => setFormData({ ...formData, payee: e.target.value })} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }} />
                        </div>
                    </div>

                    <div className="form-group" style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Description / Remark</label>
                        <textarea placeholder="Purpose of expense..." value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', minHeight: '80px', resize: 'vertical' }} />
                    </div>

                    <div className="form-group">
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Attach Bill / Receipt</label>
                        <div style={{ border: '2px dashed var(--border)', borderRadius: '8px', padding: '20px', textAlign: 'center', cursor: 'pointer' }}>
                            <Upload size={24} color="var(--text-muted)" style={{ marginBottom: '8px' }} />
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Click to upload file or drag and drop</p>
                        </div>
                    </div>

                    <div className="modal-footer" style={{ borderTop: 'none', padding: '24px 0 0 0', gap: '12px', justifyContent: 'flex-end' }}>
                        <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" style={{ fontWeight: '800' }} disabled={loading}>
                            {loading ? 'SAVING...' : 'SAVE EXPENSE'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default RecordExpenseModal;

import React, { useState, useEffect } from 'react';
import { X, IndianRupee, Loader2, Wallet } from 'lucide-react';
import { subcontractorBillingAPI, vendorAPI } from '../utils/api';
import { useToast } from '../context/ToastContext';
import CustomSelect from './CustomSelect';

const PAYMENT_MODES = ['Cash', 'NEFT/RTGS', 'UPI', 'Cheque', 'Bank Transfer'];

const SubcontractorAdvanceModal = ({ isOpen, onClose, onSuccess, projects = [], editData = null, contractors = [] }) => {
    const toast = useToast();
    const isEdit = !!editData;
    const [saving, setSaving] = useState(false);
    const [vendors, setVendors] = useState([]);
    const [form, setForm] = useState({
        contractor_name: '',
        project_id: '',
        project_name: '',
        amount: '',
        payment_mode: 'Cash',
        reference_no: '',
        payment_date: new Date().toISOString().split('T')[0],
        remarks: '',
    });

    useEffect(() => {
        if (isOpen) {
            vendorAPI.getAll().then(res => setVendors(res.data || [])).catch(() => setVendors([]));
        }
    }, [isOpen]);

    useEffect(() => {
        if (editData) {
            setForm({
                contractor_name: editData.contractor_name || '',
                project_id: editData.project_id || '',
                project_name: editData.project_name || '',
                amount: editData.amount || '',
                payment_mode: editData.payment_mode || 'Cash',
                reference_no: editData.reference_no || '',
                payment_date: editData.payment_date || new Date().toISOString().split('T')[0],
                remarks: editData.remarks || '',
            });
        }
    }, [editData]);

    if (!isOpen) return null;

    const handleProjectChange = (val) => {
        const proj = projects.find(p => p.name === val);
        setForm(f => ({ ...f, project_name: val, project_id: proj ? (proj.id || proj._id || '') : '' }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const contractor = (form.contractor_name || '').trim();
        const project = (form.project_name || '').trim();
        const amount = parseFloat(form.amount || 0);

        if (!contractor) { toast.error('Contractor name is required'); return; }
        if (!project) { toast.error('Project is required'); return; }
        if (!(amount > 0)) { toast.error('Advance amount must be greater than zero'); return; }

        const payload = {
            contractor_name: contractor,
            project_id: form.project_id,
            project_name: project,
            amount,
            payment_mode: form.payment_mode,
            reference_no: form.reference_no || '',
            payment_date: form.payment_date,
            remarks: form.remarks || '',
        };

        setSaving(true);
        try {
            if (isEdit) {
                await subcontractorBillingAPI.updateAdvance(editData.id, payload);
                toast.success(`Advance ${editData.advance_no} updated`);
            } else {
                const res = await subcontractorBillingAPI.createAdvance(payload);
                toast.success(`Advance ${res.data?.advance_no || ''} recorded`);
            }
            onSuccess && onSuccess();
        } catch (err) {
            console.error(err);
            toast.error(err?.response?.data?.detail || 'Failed to save advance');
        } finally {
            setSaving(false);
        }
    };

    const projectOptions = projects.map(p => ({ value: p.name || p.project_name, label: p.name || p.project_name }));
    // Build contractor dropdown — prefer vendors, fall back to previously-used names from parent
    const vendorOptions = vendors.map(v => ({ value: v.name || v.vendor_name, label: v.name || v.vendor_name }));
    const fallbackOptions = [...new Set(contractors.filter(Boolean))].map(c => ({ value: c, label: c }));
    const seen = new Set();
    const contractorOptions = [...vendorOptions, ...fallbackOptions].filter(o => {
        if (!o.value || seen.has(o.value)) return false;
        seen.add(o.value);
        return true;
    });

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="card animate-fade-in"
                onClick={e => e.stopPropagation()}
                style={{ width: '95%', maxWidth: '560px', maxHeight: '92vh', display: 'flex', flexDirection: 'column', padding: 0 }}
            >
                {/* Header */}
                <div className="modal-header" style={{ borderBottom: '1px solid var(--border)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                            width: '40px', height: '40px', borderRadius: '10px',
                            backgroundColor: '#EFF6FF', color: '#2563EB',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <Wallet size={20} />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '17px', fontWeight: '800' }}>
                                {isEdit ? 'Edit Advance' : 'Give Advance to Subcontractor'}
                            </h3>
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                {isEdit ? editData.advance_no : 'New advance — adjustable against future bills'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}>
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {/* Contractor */}
                    <div>
                        <label style={{ fontSize: '12px', fontWeight: '700', color: '#374151', marginBottom: '4px', display: 'block' }}>
                            Contractor Name *
                        </label>
                        <CustomSelect
                            value={form.contractor_name}
                            onChange={v => setForm(f => ({ ...f, contractor_name: v }))}
                            options={contractorOptions}
                            placeholder="Select Contractor"
                        />
                    </div>

                    {/* Project */}
                    <div>
                        <label style={{ fontSize: '12px', fontWeight: '700', color: '#374151', marginBottom: '4px', display: 'block' }}>
                            Project *
                        </label>
                        <CustomSelect
                            value={form.project_name}
                            onChange={handleProjectChange}
                            options={projectOptions}
                            placeholder="Select project"
                        />
                    </div>

                    {/* Amount + Date */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                            <label style={{ fontSize: '12px', fontWeight: '700', color: '#374151', marginBottom: '4px', display: 'block' }}>
                                Advance Amount (Rs.) *
                            </label>
                            <div style={{ position: 'relative' }}>
                                <IndianRupee size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={form.amount}
                                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                                    placeholder="0.00"
                                    style={{ width: '100%', padding: '9px 12px 9px 30px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px' }}
                                />
                            </div>
                        </div>
                        <div>
                            <label style={{ fontSize: '12px', fontWeight: '700', color: '#374151', marginBottom: '4px', display: 'block' }}>
                                Payment Date *
                            </label>
                            <input
                                type="date"
                                value={form.payment_date}
                                onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))}
                                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px' }}
                            />
                        </div>
                    </div>

                    {/* Mode + Reference */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                            <label style={{ fontSize: '12px', fontWeight: '700', color: '#374151', marginBottom: '4px', display: 'block' }}>
                                Payment Mode
                            </label>
                            <CustomSelect
                                value={form.payment_mode}
                                onChange={v => setForm(f => ({ ...f, payment_mode: v }))}
                                options={PAYMENT_MODES.map(m => ({ value: m, label: m }))}
                            />
                        </div>
                        <div>
                            <label style={{ fontSize: '12px', fontWeight: '700', color: '#374151', marginBottom: '4px', display: 'block' }}>
                                Reference No.
                            </label>
                            <input
                                type="text"
                                value={form.reference_no}
                                onChange={e => setForm(f => ({ ...f, reference_no: e.target.value }))}
                                placeholder="UTR / Cheque #"
                                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px' }}
                            />
                        </div>
                    </div>

                    {/* Remarks */}
                    <div>
                        <label style={{ fontSize: '12px', fontWeight: '700', color: '#374151', marginBottom: '4px', display: 'block' }}>
                            Remarks
                        </label>
                        <textarea
                            value={form.remarks}
                            onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
                            placeholder="e.g. Mobilization advance for foundation work"
                            rows={2}
                            style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px', resize: 'vertical' }}
                        />
                    </div>

                    <div style={{ padding: '12px', backgroundColor: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: '8px', fontSize: '12px', color: '#0C4A6E' }}>
                        Advance is saved as <strong>Draft</strong>. Submit it for admin approval — once approved, it's available for adjustment against bills and an expense entry is created.
                    </div>
                </form>

                {/* Footer */}
                <div style={{ borderTop: '1px solid var(--border)', padding: '14px 24px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button className="btn btn-outline" onClick={onClose} disabled={saving}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
                        {saving ? <><Loader2 size={16} className="spin" /> Saving...</> : (isEdit ? 'Update Advance' : 'Record Advance')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SubcontractorAdvanceModal;

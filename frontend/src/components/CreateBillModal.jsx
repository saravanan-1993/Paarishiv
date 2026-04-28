import React, { useState, useEffect } from 'react';
import { X, FileText, Calendar, IndianRupee, Percent, Hash, Building2 } from 'lucide-react';
import { projectAPI, billingAPI } from '../utils/api';
import CustomSelect from './CustomSelect';

const CreateBillModal = ({ isOpen, onClose, onBillCreated }) => {
    const [projects, setProjects] = useState([]);
    const [allBills, setAllBills] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isCustomType, setIsCustomType] = useState(false);
    const [form, setForm] = useState({
        project: '',
        bill_no: '',
        date: new Date().toISOString().split('T')[0],
        description: 'Running RA Bill',
        amount: '',
        gst_rate: '18',
        bill_type: 'Running',
    });

    useEffect(() => {
        if (isOpen) {
            Promise.all([
                projectAPI.getAll(),
                billingAPI.getAll()
            ]).then(([projRes, billRes]) => {
                const activeProjects = (projRes.data || []).filter(p => p.status !== 'Completed');
                setProjects(activeProjects);
                setAllBills(billRes.data || []);
            }).catch(() => { });
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const amount = parseFloat(form.amount) || 0;
    const gstRate = parseFloat(form.gst_rate) || 0;
    const gstAmt = Math.round((amount * gstRate / 100) * 100) / 100;
    const totalAmt = amount + gstAmt;

    // Budget Calculation Logic
    const selectedProjData = projects.find(p => p.name === form.project);
    const projectTotalBudget = selectedProjData?.budget || 0;
    const projectBilledAmt = allBills
        .filter(b => b.project === form.project)
        .reduce((sum, b) => sum + (parseFloat(b.amount) || 0), 0);
    const remainingBudget = projectTotalBudget - projectBilledAmt;
    const isExceeding = amount > remainingBudget && form.project;

    const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!form.project || !form.bill_no || !form.amount) {
            alert('Please fill all required fields.');
            return;
        }

        if (isExceeding) {
            alert(`Error: This bill exceeds the remaining project budget! \nRemaining Capacity: ₹${remainingBudget.toLocaleString('en-IN')}`);
            return;
        }

        setLoading(true);
        try {
            const res = await billingAPI.create({
                ...form,
                amount: parseFloat(form.amount),
                gst_rate: parseFloat(form.gst_rate),
            });
            onBillCreated?.(res.data);
            onClose();
            setForm({
                project: '', bill_no: '', date: new Date().toISOString().split('T')[0],
                description: 'Running RA Bill', amount: '', gst_rate: '18', bill_type: 'Running',
            });
        } catch (err) {
            console.error(err);
            const msg = err?.response?.data?.detail || 'Failed to create bill. Please try again.';
            alert(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div style={{
                background: 'white', width: '100%', maxWidth: '560px',
                borderRadius: '16px', boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
                overflow: 'visible', animation: 'fadeIn 0.2s ease',
                display: 'flex', flexDirection: 'column', maxHeight: '90vh'
            }}>
                {/* Header */}
                <div style={{
                    background: 'linear-gradient(135deg, #1e3a5f 0%, #2F5D8A 100%)',
                    padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    borderTopLeftRadius: '16px', borderTopRightRadius: '16px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', background: 'rgba(255,255,255,0.15)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <FileText size={22} color="white" />
                        </div>
                        <div>
                            <h2 style={{ color: 'white', fontSize: '18px', fontWeight: '800', margin: 0 }}>CREATE BILL</h2>
                            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', margin: 0 }}>Client Invoice / RA Bill Entry</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '8px', padding: '8px', cursor: 'pointer', color: 'white', display: 'flex' }}>
                        <X size={18} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} style={{ padding: '24px', overflowY: 'visible' }}>
                    {/* Project */}
                    <div style={{ marginBottom: '16px' }}>
                        <CustomSelect
                            label="Project *"
                            options={projects.map(p => ({ value: p.name, label: p.name }))}
                            value={form.project}
                            onChange={(val) => handleChange('project', val)}
                            placeholder="Select project"
                            width="full"
                            icon={Building2}
                            error={isExceeding}
                        />

                        {form.project && selectedProjData && (
                            <div style={{
                                marginTop: '12px', padding: '10px 14px', borderRadius: '8px',
                                backgroundColor: isExceeding ? '#FEF2F2' : '#F0FDF4',
                                border: `1px solid ${isExceeding ? '#FCA5A5' : '#BBF7D0'}`,
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                            }}>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontSize: '10px', fontWeight: '800', color: isExceeding ? '#B91C1C' : '#15803D', textTransform: 'uppercase' }}>
                                        Remaining Billing Capacity
                                    </span>
                                    <span style={{ fontSize: '15px', fontWeight: '900', color: isExceeding ? '#991B1B' : '#166534' }}>
                                        ₹{remainingBudget.toLocaleString('en-IN')}
                                    </span>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '700' }}>TOTAL BUDGET</span>
                                    <div style={{ fontSize: '12px', fontWeight: '700' }}>₹{projectTotalBudget.toLocaleString('en-IN')}</div>
                                </div>
                            </div>
                        )}
                        {isExceeding && (
                            <p style={{ color: '#EF4444', fontSize: '11px', fontWeight: '700', marginTop: '6px' }}>
                                ⚠️ This bill exceeds the total project budget!
                            </p>
                        )}
                    </div>

                    {/* Bill No + Date */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#374151', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Bill Number *
                            </label>
                            <div style={{ position: 'relative' }}>
                                <Hash size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
                                <input
                                    required
                                    type="text"
                                    placeholder="RA-001"
                                    value={form.bill_no}
                                    onChange={e => handleChange('bill_no', e.target.value)}
                                    style={{ width: '100%', padding: '11px 12px 11px 30px', borderRadius: '8px', border: '1.5px solid #E5E7EB', fontSize: '14px' }}
                                />
                            </div>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#374151', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Bill Date *
                            </label>
                            <div style={{ position: 'relative' }}>
                                <Calendar size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
                                <input
                                    required
                                    type="date"
                                    value={form.date}
                                    onChange={e => handleChange('date', e.target.value)}
                                    style={{ width: '100%', padding: '11px 12px 11px 30px', borderRadius: '8px', border: '1.5px solid #E5E7EB', fontSize: '14px' }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Description */}
                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#374151', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Description *
                        </label>
                        <input
                            required
                            type="text"
                            placeholder="Running Account Bill"
                            value={form.description}
                            onChange={e => handleChange('description', e.target.value)}
                            style={{ width: '100%', padding: '11px 12px', borderRadius: '8px', border: '1.5px solid #E5E7EB', fontSize: '14px' }}
                        />
                    </div>

                    {/* Amount + GST + Bill Type */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#374151', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Amount (INR) *
                            </label>
                            <div style={{ position: 'relative' }}>
                                <IndianRupee size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
                                <input
                                    required
                                    type="number"
                                    min="1"
                                    step="0.01"
                                    placeholder="0"
                                    value={form.amount}
                                    onChange={e => handleChange('amount', e.target.value)}
                                    style={{ width: '100%', padding: '11px 12px 11px 28px', borderRadius: '8px', border: '1.5px solid #E5E7EB', fontSize: '14px', fontWeight: '700' }}
                                />
                            </div>
                        </div>
                        <div>
                            <CustomSelect
                                label="GST Rate %"
                                options={[
                                    { value: '0', label: '0%' },
                                    { value: '5', label: '5%' },
                                    { value: '12', label: '12%' },
                                    { value: '18', label: '18%' },
                                    { value: '28', label: '28%' }
                                ]}
                                value={form.gst_rate}
                                onChange={(val) => handleChange('gst_rate', val)}
                                width="full"
                                searchable={false}
                            />
                        </div>
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#374151', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    Bill Type
                                </label>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsCustomType(!isCustomType);
                                        if (!isCustomType) handleChange('bill_type', '');
                                        else handleChange('bill_type', 'Running');
                                    }}
                                    style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: '0 4px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: '700' }}
                                >
                                    {isCustomType ? '✕ Back' : '+ Add New'}
                                </button>
                            </div>
                            {isCustomType ? (
                                <input
                                    type="text"
                                    autoFocus
                                    placeholder="Enter type..."
                                    value={form.bill_type}
                                    onChange={e => handleChange('bill_type', e.target.value)}
                                    style={{ width: '100%', padding: '11px 12px', borderRadius: '8px', border: '1.5px solid var(--primary)', fontSize: '14px', outline: 'none' }}
                                />
                            ) : (
                                <CustomSelect
                                    options={[
                                        { value: 'Running', label: 'Running' },
                                        { value: 'Final', label: 'Final' },
                                        { value: 'Advance', label: 'Advance' },
                                        { value: 'Retention', label: 'Retention' }
                                    ]}
                                    value={form.bill_type}
                                    onChange={(val) => handleChange('bill_type', val)}
                                    width="full"
                                    searchable={false}
                                />
                            )}
                        </div>
                    </div>

                    {/* Summary */}
                    {amount > 0 && (
                        <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '10px', padding: '14px 16px', marginBottom: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
                                <span style={{ color: '#374151' }}>Base Amount</span>
                                <span style={{ fontWeight: '700' }}>₹{amount.toLocaleString('en-IN')}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
                                <span style={{ color: '#374151' }}>GST ({form.gst_rate}%)</span>
                                <span style={{ fontWeight: '700', color: '#059669' }}>+ ₹{gstAmt.toLocaleString('en-IN')}</span>
                            </div>
                            <div style={{ height: '1px', background: '#BBF7D0', margin: '8px 0' }} />
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px' }}>
                                <span style={{ fontWeight: '800', color: '#065F46' }}>Total Bill Value</span>
                                <span style={{ fontWeight: '900', color: '#059669', fontSize: '17px' }}>₹{totalAmt.toLocaleString('en-IN')}</span>
                            </div>
                        </div>
                    )}

                    {/* Buttons */}
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                        <button type="button" onClick={onClose} style={{
                            padding: '11px 24px', borderRadius: '8px', border: '1.5px solid #E5E7EB',
                            background: 'white', fontWeight: '700', fontSize: '14px', cursor: 'pointer', color: '#374151'
                        }}>
                            Cancel
                        </button>
                        <button type="submit" disabled={loading || isExceeding || !form.project || !form.bill_no || !form.amount} style={{
                            padding: '11px 28px', borderRadius: '8px', border: 'none',
                            background: isExceeding ? '#9CA3AF' : 'linear-gradient(135deg, #1e3a5f, #2F5D8A)',
                            color: 'white', fontWeight: '800', fontSize: '14px', cursor: isExceeding ? 'not-allowed' : 'pointer',
                            opacity: (loading || isExceeding) ? 0.7 : 1,
                            transition: 'all 0.2s'
                        }}>
                            {loading ? 'Creating...' : isExceeding ? 'Limit Exceeded' : 'Create Bill'}
                        </button>
                    </div>
                </form>
            </div>
            <style>{`@keyframes fadeIn { from { opacity:0; transform:translateY(-20px) } to { opacity:1; transform:translateY(0) } }`}</style>
        </div>
    );
};

export default CreateBillModal;

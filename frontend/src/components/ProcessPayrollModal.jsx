import React, { useState } from 'react';
import { X, Calendar, Clock, DollarSign, CheckCircle } from 'lucide-react';

const ProcessPayrollModal = ({ isOpen, onClose, employee, onConfirm }) => {
    const [isProcessing, setIsProcessing] = useState(false);

    if (!isOpen || !employee) return null;

    const base = parseFloat(employee.basicSalary) || 0;
    const allow = parseFloat(employee.hra) || 0;
    const net = base + allow;

    // Fixed mock values for attendance since we do not have an attendance API
    const totalDays = 30;
    const presentDays = 28;
    const leaveDays = 2;

    const handleConfirm = () => {
        setIsProcessing(true);
        setTimeout(() => {
            onConfirm(employee.id);
            setIsProcessing(false);
            onClose();
        }, 1000);
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '600px', width: '95%' }}>
                <div className="modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', backgroundColor: '#f0f9ff', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0ea5e9' }}>
                            <DollarSign size={20} />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '18px', fontWeight: '800' }}>PROCESS PAYROLL</h3>
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Generate payroll for {employee.name}</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                        <X size={24} />
                    </button>
                </div>

                <div className="modal-body" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', gap: '20px', marginBottom: '24px' }}>
                        <div style={{ flex: 1, backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                            <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Attendance Summary</div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <span style={{ fontSize: '14px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}><Calendar size={14} /> Total Days</span>
                                <span style={{ fontSize: '14px', fontWeight: '700' }}>{totalDays}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <span style={{ fontSize: '14px', color: '#10B981', display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle size={14} /> Present</span>
                                <span style={{ fontSize: '14px', fontWeight: '700', color: '#10B981' }}>{presentDays}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: '14px', color: '#EF4444', display: 'flex', alignItems: 'center', gap: '6px' }}><Clock size={14} /> Leaves</span>
                                <span style={{ fontSize: '14px', fontWeight: '700', color: '#EF4444' }}>{leaveDays}</span>
                            </div>
                        </div>

                        <div style={{ flex: 1, backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                            <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Salary Details</div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <span style={{ fontSize: '14px', color: 'var(--text-main)' }}>Base Salary</span>
                                <span style={{ fontSize: '14px', fontWeight: '700' }}>₹{base.toLocaleString('en-IN')}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <span style={{ fontSize: '14px', color: 'var(--text-main)' }}>Allowances (HRA)</span>
                                <span style={{ fontSize: '14px', fontWeight: '700' }}>₹{allow.toLocaleString('en-IN')}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
                                <span style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-main)' }}>Net Payable</span>
                                <span style={{ fontSize: '15px', fontWeight: '800', color: 'var(--primary)' }}>₹{net.toLocaleString('en-IN')}</span>
                            </div>
                        </div>
                    </div>

                    <div style={{ padding: '16px', backgroundColor: '#FFFBEB', borderRadius: '8px', border: '1px solid #FDE68A', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                        <Clock size={20} color="#D97706" style={{ marginTop: '2px' }} />
                        <div>
                            <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#92400E', marginBottom: '4px' }}>Review before confirming</h4>
                            <p style={{ fontSize: '13px', color: '#B45309' }}>Once the payroll is generated, it will be marked as paid for this month and you will not be able to edit the details here.</p>
                        </div>
                    </div>
                </div>

                <div className="modal-footer" style={{ borderTop: '1px solid var(--border)', padding: '20px 24px', gap: '12px', justifyContent: 'flex-end', display: 'flex' }}>
                    <button type="button" className="btn btn-outline" onClick={onClose} disabled={isProcessing}>Cancel</button>
                    <button type="button" className="btn btn-primary" onClick={handleConfirm} disabled={isProcessing} style={{ fontWeight: '800', minWidth: '150px' }}>
                        {isProcessing ? 'PROCESSING...' : 'CONFIRM GENERATION'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProcessPayrollModal;

import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, DollarSign, CheckCircle, Loader2, Coffee } from 'lucide-react';
import { hrmsAPI } from '../utils/api';

const ProcessPayrollModal = ({ isOpen, onClose, employee, onConfirm }) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [loadingAtt, setLoadingAtt] = useState(false);

    const [totalDays, setTotalDays] = useState(employee?.payrollData?.totalDays ?? 30);
    const [presentDays, setPresentDays] = useState(employee?.payrollData?.presentDays ?? 0);
    const [casualLeave, setCasualLeave] = useState(0);
    const [lopAmount, setLopAmount] = useState(0);
    const [advanceAmount, setAdvanceAmount] = useState(0);

    const base = parseFloat(employee?.basicSalary) || 0;
    const allow = parseFloat(employee?.hra) || 0;
    const perDayRate = Math.round(base / Math.max(totalDays, 1));

    // Auto-calculate absent days and LOP
    const absentDays = Math.max(totalDays - presentDays - casualLeave, 0);
    const lopDeduction = absentDays * perDayRate;

    const defaultPf = Math.round(base * 0.12);
    const defaultPt = Math.round(base * 0.05);
    const [pfAmount, setPfAmount] = useState(employee?.payrollData?.pfAmount ?? defaultPf);
    const [ptAmount, setPtAmount] = useState(employee?.payrollData?.ptAmount ?? defaultPt);

    const grossEarnings = base + allow;
    const totalDeductions = pfAmount + ptAmount + lopDeduction + lopAmount + advanceAmount;
    const net = grossEarnings - totalDeductions;

    // Fetch live attendance when modal opens
    useEffect(() => {
        if (!isOpen || !employee) return;
        const fetchAttendance = async () => {
            setLoadingAtt(true);
            try {
                const month = employee.payrollData?.month || new Date().toISOString().slice(0, 7);
                const [year, mon] = month.split('-').map(Number);
                const daysInMonth = new Date(year, mon, 0).getDate();
                setTotalDays(daysInMonth);
                const fromDate = `${month}-01`;
                const toDate = `${month}-${String(daysInMonth).padStart(2, '0')}`;
                const res = await hrmsAPI.getAttendanceRange(fromDate, toDate);
                const records = res.data || [];
                const empId = employee.id || employee._id;
                const empCode = employee.employeeCode || employee.code || '';
                const empRecords = records.filter(r =>
                    r.employeeId === empId || r.employeeId === empCode
                );
                const present = empRecords.filter(r => r.status === 'Present').length;
                const leave = empRecords.filter(r => r.status === 'Leave').length;
                setPresentDays(present);
                setCasualLeave(leave);
            } catch (err) {
                console.error('Failed to fetch attendance:', err);
            } finally {
                setLoadingAtt(false);
            }
        };
        fetchAttendance();
    }, [isOpen, employee]);

    if (!isOpen || !employee) return null;

    const handleConfirm = () => {
        setIsProcessing(true);
        setTimeout(() => {
            onConfirm(employee.id, {
                totalDays,
                presentDays,
                casualLeave,
                absentDays,
                lopDeduction,
                leaveDays: absentDays,
                lopAmount,
                advanceAmount,
                pfAmount,
                ptAmount,
                grossEarnings,
                totalDeductions,
                netSalary: net
            });
            setIsProcessing(false);
            onClose();
        }, 1000);
    };

    return (
        <div className="modal-overlay">
            <div className="card animate-fade-in" style={{ width: '95%', maxWidth: '650px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0 }}>
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

                <div className="modal-body" style={{ padding: '24px', overflowY: 'auto' }}>
                    <div style={{ display: 'flex', gap: '20px', marginBottom: '24px' }}>
                        {/* Attendance Summary */}
                        <div style={{ flex: 1, backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                            <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '12px', textTransform: 'uppercase' }}>
                                Attendance Summary {loadingAtt && <Loader2 size={12} style={{ display: 'inline', animation: 'spin 1s linear infinite' }} />}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', alignItems: 'center' }}>
                                <span style={{ fontSize: '14px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}><Calendar size={14} /> Total Days</span>
                                <input type="number" value={totalDays} onChange={(e) => setTotalDays(parseInt(e.target.value) || 0)}
                                    style={{ width: '60px', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border)', textAlign: 'right', fontWeight: '700' }} />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', alignItems: 'center' }}>
                                <span style={{ fontSize: '14px', color: '#10B981', display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle size={14} /> Present</span>
                                <input type="number" value={presentDays} onChange={(e) => setPresentDays(parseInt(e.target.value) || 0)}
                                    style={{ width: '60px', padding: '4px 8px', borderRadius: '4px', border: '1px solid #bbf7d0', textAlign: 'right', fontWeight: '700', color: '#10B981' }} />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', alignItems: 'center' }}>
                                <span style={{ fontSize: '14px', color: '#0EA5E9', display: 'flex', alignItems: 'center', gap: '6px' }}><Coffee size={14} /> Casual Leave</span>
                                <input type="number" value={casualLeave} onChange={(e) => setCasualLeave(parseInt(e.target.value) || 0)}
                                    style={{ width: '60px', padding: '4px 8px', borderRadius: '4px', border: '1px solid #BAE6FD', textAlign: 'right', fontWeight: '700', color: '#0EA5E9' }} />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px dashed var(--border)' }}>
                                <span style={{ fontSize: '14px', color: '#EF4444', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700' }}><Clock size={14} /> Absent (LOP)</span>
                                <span style={{ fontSize: '16px', fontWeight: '800', color: '#EF4444', padding: '4px 8px' }}>{absentDays}</span>
                            </div>
                        </div>

                        {/* Salary Details */}
                        <div style={{ flex: 1, backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                            <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '12px', textTransform: 'uppercase' }}>Salary Details</div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <span style={{ fontSize: '14px', color: 'var(--text-main)' }}>Base Salary</span>
                                <span style={{ fontSize: '14px', fontWeight: '700' }}>₹{base.toLocaleString('en-IN')}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <span style={{ fontSize: '14px', color: 'var(--text-main)' }}>Allowances (HRA)</span>
                                <span style={{ fontSize: '14px', fontWeight: '700' }}>₹{allow.toLocaleString('en-IN')}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <span style={{ fontSize: '12px', color: '#94a3b8' }}>Per Day Rate</span>
                                <span style={{ fontSize: '12px', color: '#94a3b8' }}>₹{perDayRate.toLocaleString('en-IN')}/day</span>
                            </div>

                            <div style={{ marginTop: '8px', marginBottom: '8px', paddingTop: '8px', borderTop: '1px dashed var(--border)' }}>
                                <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Deductions</div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center' }}>
                                <span style={{ fontSize: '14px', color: '#6366F1', fontWeight: '600' }}>Provident Fund (PF)</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#6366F1' }}>- ₹</span>
                                    <input type="number" value={pfAmount} onChange={(e) => setPfAmount(parseFloat(e.target.value) || 0)} placeholder="0"
                                        style={{ width: '85px', padding: '4px 8px', borderRadius: '4px', border: '1px solid #c7d2fe', textAlign: 'right', fontWeight: '700', color: '#6366F1', outline: 'none' }} />
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center' }}>
                                <span style={{ fontSize: '14px', color: '#8B5CF6', fontWeight: '600' }}>Professional Tax</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#8B5CF6' }}>- ₹</span>
                                    <input type="number" value={ptAmount} onChange={(e) => setPtAmount(parseFloat(e.target.value) || 0)} placeholder="0"
                                        style={{ width: '85px', padding: '4px 8px', borderRadius: '4px', border: '1px solid #ddd6fe', textAlign: 'right', fontWeight: '700', color: '#8B5CF6', outline: 'none' }} />
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center' }}>
                                <span style={{ fontSize: '14px', color: '#EF4444', fontWeight: '600' }}>Absent Deduction ({absentDays} days)</span>
                                <span style={{ fontSize: '14px', fontWeight: '700', color: '#EF4444' }}>- ₹{lopDeduction.toLocaleString('en-IN')}</span>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center' }}>
                                <span style={{ fontSize: '14px', color: '#EF4444', fontWeight: '600' }}>Other LOP</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#EF4444' }}>- ₹</span>
                                    <input type="number" value={lopAmount} onChange={(e) => setLopAmount(parseFloat(e.target.value) || 0)} placeholder="0"
                                        style={{ width: '85px', padding: '4px 8px', borderRadius: '4px', border: '1px solid #fecaca', textAlign: 'right', fontWeight: '700', color: '#EF4444', outline: 'none' }} />
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center' }}>
                                <span style={{ fontSize: '14px', color: '#F59E0B', fontWeight: '600' }}>Salary Advance</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#F59E0B' }}>- ₹</span>
                                    <input type="number" value={advanceAmount} onChange={(e) => setAdvanceAmount(parseFloat(e.target.value) || 0)} placeholder="0"
                                        style={{ width: '85px', padding: '4px 8px', borderRadius: '4px', border: '1px solid #FDE68A', textAlign: 'right', fontWeight: '700', color: '#F59E0B', outline: 'none' }} />
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
                                <span style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-main)' }}>Net Payable</span>
                                <span style={{ fontSize: '16px', fontWeight: '900', color: 'var(--primary)' }}>₹{net.toLocaleString('en-IN')}</span>
                            </div>
                        </div>
                    </div>

                    <div style={{ padding: '16px', backgroundColor: '#FFFBEB', borderRadius: '8px', border: '1px solid #FDE68A', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                        <Clock size={20} color="#D97706" style={{ marginTop: '2px' }} />
                        <div>
                            <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#92400E', marginBottom: '4px' }}>Review before confirming</h4>
                            <p style={{ fontSize: '13px', color: '#B45309' }}>Absent days = Total - Present - Casual Leave. Absent deduction is auto-calculated from base salary. Adjust CL, PF, Professional Tax, and Salary Advance as needed.</p>
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

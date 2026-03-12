import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { employeeAPI, hrmsAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import CustomSelect from './CustomSelect';
import { User, Calendar, Briefcase, Tag } from 'lucide-react';

const ApplyLeaveModal = ({ isOpen, onClose, onLeaveApplied }) => {
    const { user } = useAuth();
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        employeeId: '',
        employeeName: '',
        leaveType: 'Casual Leave',
        fromDate: '',
        toDate: '',
        reason: ''
    });

    const isAdmin = user?.role === 'Super Admin' || user?.role === 'Administrator' || user?.role === 'HR Manager';

    useEffect(() => {
        if (isOpen && isAdmin) {
            employeeAPI.getAll()
                .then(res => setEmployees(res.data || []))
                .catch(err => {
                    console.error("Failed to fetch employees:", err);
                    setEmployees([]);
                });
        }
    }, [isOpen, isAdmin]);

    useEffect(() => {
        if (isOpen && !isAdmin && user) {
            setFormData(prev => ({
                ...prev,
                employeeId: user.employeeCode || user.id || user.username || 'EMP-LOGIN',
                employeeName: user.name || user.fullName || user.username || 'Unknown Employee'
            }));
        }
    }, [isOpen, isAdmin, user]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (loading) return;

        setLoading(true);
        try {
            // Find employee details if admin is applying for someone
            const selectedEmp = isAdmin ? employees.find(e => (e.id || e._id) === formData.employeeId) : null;

            const payload = {
                employeeId: isAdmin ? formData.employeeId : (user?.employeeCode || user?.id || user?.username),
                employeeName: isAdmin ? (selectedEmp?.fullName || "Unknown") : (user?.name || user?.fullName || user?.username || "Unknown"),
                leaveType: formData.leaveType,
                fromDate: formData.fromDate,
                toDate: formData.toDate,
                reason: formData.reason,
                status: 'Pending',
                appliedOn: new Date().toISOString()
            };

            if (!payload.employeeId) {
                throw new Error("Employee identity not found. Please log in again.");
            }

            await hrmsAPI.applyLeave(payload);
            if (onLeaveApplied) onLeaveApplied();
            onClose();
        } catch (err) {
            console.error('Failed to apply leave:', err);
            alert(err.message || 'Failed to submit leave request. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ width: '500px', borderRadius: '16px' }}>
                <div className="modal-header">
                    <h3 style={{ fontSize: '18px', fontWeight: '800' }}>Apply Leave</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                        <X size={20} />
                    </button>
                </div>
                <div className="modal-body">
                    <form id="leaveForm" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {isAdmin ? (
                            <div className="form-group">
                                <CustomSelect
                                    label="Select Employee"
                                    options={employees.map(e => ({
                                        value: e.id || e._id,
                                        label: `${e.fullName} (${e.employeeCode})`
                                    }))}
                                    value={formData.employeeId}
                                    onChange={(val) => setFormData({ ...formData, employeeId: val })}
                                    placeholder="Choose an employee..."
                                    width="full"
                                    icon={User}
                                    error={!formData.employeeId}
                                />
                            </div>
                        ) : (
                            <div className="form-group">
                                <label style={{ fontWeight: '700', fontSize: '13px', marginBottom: '8px', display: 'block' }}>Applying As</label>
                                <div style={{
                                    padding: '12px',
                                    background: '#f8fafc',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border)',
                                    fontWeight: '600',
                                    color: 'var(--text-main)'
                                }}>
                                    {user?.name || user?.fullName || user?.username} ({user?.employeeCode || user?.id})
                                </div>
                            </div>
                        )}

                        <div className="form-group">
                            <CustomSelect
                                label="Leave Type"
                                options={[
                                    { value: 'Casual Leave', label: 'Casual Leave' },
                                    { value: 'Sick Leave', label: 'Sick Leave' },
                                    { value: 'Loss of Pay', label: 'Loss of Pay' },
                                    { value: 'Earned Leave', label: 'Earned Leave' }
                                ]}
                                value={formData.leaveType}
                                onChange={(val) => setFormData({ ...formData, leaveType: val })}
                                width="full"
                                icon={Tag}
                                searchable={false}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div className="form-group">
                                <label style={{ fontWeight: '700', fontSize: '13px', marginBottom: '8px', display: 'block' }}>From Date</label>
                                <input
                                    type="date"
                                    required
                                    value={formData.fromDate}
                                    onChange={(e) => setFormData({ ...formData, fromDate: e.target.value })}
                                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}
                                />
                            </div>
                            <div className="form-group">
                                <label style={{ fontWeight: '700', fontSize: '13px', marginBottom: '8px', display: 'block' }}>To Date</label>
                                <input
                                    type="date"
                                    required
                                    value={formData.toDate}
                                    onChange={(e) => setFormData({ ...formData, toDate: e.target.value })}
                                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label style={{ fontWeight: '700', fontSize: '13px', marginBottom: '8px', display: 'block' }}>Reason</label>
                            <textarea
                                required
                                rows={3}
                                value={formData.reason}
                                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                                placeholder="Please provide a valid reason..."
                                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', resize: 'none' }}
                            ></textarea>
                        </div>
                    </form>
                </div>
                <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '20px' }}>
                    <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
                    <button
                        type="submit"
                        form="leaveForm"
                        className="btn btn-primary"
                        disabled={loading}
                        style={{ minWidth: '140px' }}
                    >
                        {loading ? 'Submitting...' : 'Submit Request'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ApplyLeaveModal;

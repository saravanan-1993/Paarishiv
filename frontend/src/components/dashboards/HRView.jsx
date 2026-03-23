import React from 'react';
import { Users, Clock, AlertTriangle, UserCheck, Calendar, Cake } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const HRView = ({ stats }) => {
    const navigate = useNavigate();

    // Default stats if backend doesn't provide them yet
    const hrmsStats = stats || {
        totalEmployees: 0,
        todayPresent: 0,
        pendingLeaves: 0,
        latecomers: 0
    };

    return (
        <div className="hr-view animate-fade-in">
            <h2 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-main)', marginBottom: '4px' }}>
                HR Dashboard
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', fontWeight: '500', marginBottom: '32px' }}>
                Overview of Employee Attendance, Leaves, and Workforce metrics.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '32px' }}>
                <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '14px', borderLeft: '4px solid #3B82F6' }}>
                    <div style={{ padding: '12px', borderRadius: '10px', backgroundColor: '#EFF6FF', color: '#3B82F6', flexShrink: 0 }}>
                        <Users size={24} />
                    </div>
                    <div>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '600', textTransform: 'uppercase' }}>Active Employees</p>
                        <h3 style={{ fontSize: '24px', fontWeight: '700', lineHeight: 1 }}>{hrmsStats.totalEmployees || 0}</h3>
                    </div>
                </div>

                <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '14px', borderLeft: '4px solid #10B981' }}>
                    <div style={{ padding: '12px', borderRadius: '10px', backgroundColor: '#ECFDF5', color: '#10B981', flexShrink: 0 }}>
                        <UserCheck size={24} />
                    </div>
                    <div>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '600', textTransform: 'uppercase' }}>Present Today</p>
                        <h3 style={{ fontSize: '24px', fontWeight: '700', lineHeight: 1 }}>{hrmsStats.todayPresent || 0}</h3>
                    </div>
                </div>

                <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '14px', borderLeft: '4px solid #F59E0B' }}>
                    <div style={{ padding: '12px', borderRadius: '10px', backgroundColor: '#FEF3C7', color: '#F59E0B', flexShrink: 0 }}>
                        <Calendar size={24} />
                    </div>
                    <div>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '600', textTransform: 'uppercase' }}>Pending Leave</p>
                        <h3 style={{ fontSize: '24px', fontWeight: '700', lineHeight: 1 }}>{hrmsStats.pendingLeaves || 0}</h3>
                    </div>
                </div>

                <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '14px', borderLeft: '4px solid #EF4444' }}>
                    <div style={{ padding: '12px', borderRadius: '10px', backgroundColor: '#FEF2F2', color: '#EF4444', flexShrink: 0 }}>
                        <Clock size={24} />
                    </div>
                    <div>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '600', textTransform: 'uppercase' }}>Latecomers</p>
                        <h3 style={{ fontSize: '24px', fontWeight: '700', lineHeight: 1 }}>{hrmsStats.latecomers || 0}</h3>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                <div className="card" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Calendar size={20} color="#F59E0B" /> Leave Requests Actions
                        </h3>
                        <button className="btn btn-outline" onClick={() => navigate('/hrms')} style={{ padding: '6px 12px', fontSize: '12px' }}>
                            Go to HRMS
                        </button>
                    </div>
                    <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
                        You have {hrmsStats.pendingLeaves || 0} pending leave requests waiting for approval.
                    </p>
                </div>

                <div className="card" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Cake size={20} color="#EC4899" /> Today's Birthdays
                        </h3>
                    </div>
                    {hrmsStats.birthdays && hrmsStats.birthdays.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {hrmsStats.birthdays.map((b, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', backgroundColor: '#FDF2F8', borderRadius: '8px' }}>
                                    <Cake size={16} color="#EC4899" />
                                    <span style={{ fontSize: '14px', fontWeight: '600' }}>{b.name}</span>
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>({b.employeeCode})</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>No birthdays today.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default HRView;

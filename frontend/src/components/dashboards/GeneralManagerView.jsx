import React from 'react';
import { Briefcase, Users, FileText, CheckCircle, AlertTriangle, Building } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const GeneralManagerView = ({ projects, pendingApprovalsAmount }) => {
    const navigate = useNavigate();

    return (
        <div className="gm-view animate-fade-in">
            <h2 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-main)', marginBottom: '4px' }}>
                General Manager Dashboard
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', fontWeight: '500', marginBottom: '32px' }}>
                Overview of Projects, Attendance, Payroll, and Site Operations.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '32px' }}>
                <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '14px', borderLeft: '4px solid #3B82F6' }}>
                    <div style={{ padding: '12px', borderRadius: '10px', backgroundColor: '#EFF6FF', color: '#3B82F6', flexShrink: 0 }}>
                        <Briefcase size={24} />
                    </div>
                    <div>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '600', textTransform: 'uppercase' }}>Active Projects</p>
                        <h3 style={{ fontSize: '24px', fontWeight: '700', lineHeight: 1 }}>{projects?.length || 0}</h3>
                    </div>
                </div>

                <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '14px', borderLeft: '4px solid #10B981' }}>
                    <div style={{ padding: '12px', borderRadius: '10px', backgroundColor: '#ECFDF5', color: '#10B981', flexShrink: 0 }}>
                        <Users size={24} />
                    </div>
                    <div>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '600', textTransform: 'uppercase' }}>Attendance Overvew</p>
                        <h3 style={{ fontSize: '24px', fontWeight: '700', lineHeight: 1 }}>Live</h3>
                    </div>
                </div>

                <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '14px', borderLeft: '4px solid #F59E0B' }}>
                    <div style={{ padding: '12px', borderRadius: '10px', backgroundColor: '#FEF3C7', color: '#F59E0B', flexShrink: 0 }}>
                        <FileText size={24} />
                    </div>
                    <div>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '600', textTransform: 'uppercase' }}>Payroll Summary</p>
                        <h3 style={{ fontSize: '24px', fontWeight: '700', lineHeight: 1 }}>Current</h3>
                    </div>
                </div>

                <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '14px', borderLeft: '4px solid #EF4444' }}>
                    <div style={{ padding: '12px', borderRadius: '10px', backgroundColor: '#FEF2F2', color: '#EF4444', flexShrink: 0 }}>
                        <CheckCircle size={24} />
                    </div>
                    <div>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '600', textTransform: 'uppercase' }}>Pending Approvals</p>
                        <h3 style={{ fontSize: '24px', fontWeight: '700', lineHeight: 1 }}>{pendingApprovalsAmount || 0}</h3>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
                <div className="card" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Building size={20} color="#3B82F6" /> Site-wise Manpower
                        </h3>
                        <button className="btn btn-outline" onClick={() => navigate('/projects')} style={{ padding: '6px 12px', fontSize: '12px' }}>
                            View Projects
                        </button>
                    </div>
                    <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
                        Detailed breakdown of workforce deployed across all active project sites.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default GeneralManagerView;

import React, { useState, useEffect } from 'react';
import { Clock, Activity, Coffee, Briefcase as BriefcaseIcon, UserCircle, LogOut, ChevronDown, CheckCircle, Package } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { attendanceAPI } from '../../utils/api';

const WorkspaceView = ({
    user
}) => {
    const navigate = useNavigate();

    // Mock user tasks and requests for now, until backend has endpoints
    const tasks = [];

    const requests = [];

    return (
        <div className="workspace-view">
            <h2 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-main)', marginBottom: '4px' }}>
                Welcome back, {user?.name || 'Engineer'}
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', fontWeight: '500', marginBottom: '32px' }}>
                Your daily tasks, attendance, and requests at a glance.
            </p>


            {/* Sub Widgets */}
            <div className="workspace-sub-widgets" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>

                {/* My Tasks */}
                <div className="card" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '8px' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <CheckCircle size={20} color="#10B981" /> My Tasks
                        </h3>
                        <button className="btn btn-outline" onClick={() => navigate('/workflow')} style={{ padding: '6px 12px', fontSize: '12px' }}>
                            View All
                        </button>
                    </div>
                    {tasks.map(t => (
                        <div key={t.id} style={{ padding: '12px', border: '1px solid var(--border)', borderRadius: '8px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                            <div>
                                <p style={{ fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>{t.name}</p>
                                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Due: {t.due} | Priority: <span style={{ color: t.priority === 'High' ? '#EF4444' : '#3B82F6' }}>{t.priority}</span></p>
                            </div>
                            <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', backgroundColor: t.status === 'Pending' ? '#FEF3C7' : '#DBEAFE', color: t.status === 'Pending' ? '#B45309' : '#1D4ED8' }}>
                                {t.status}
                            </span>
                        </div>
                    ))}
                    {tasks.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center' }}>No tasks assigned.</p>}
                </div>

                {/* My Material Requests */}
                <div className="card" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '8px' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Package size={20} color="#3B82F6" /> My Material Requests
                        </h3>
                        {/* If inventory exists, route there */}
                        <button className="btn btn-outline" onClick={() => navigate('/inventory')} style={{ padding: '6px 12px', fontSize: '12px' }}>
                            View Inventory
                        </button>
                    </div>
                    {requests.map(r => (
                        <div key={r.id} style={{ padding: '12px', border: '1px solid var(--border)', borderRadius: '8px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                            <div>
                                <p style={{ fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>{r.item}</p>
                                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Request ID: {r.id} | Date: {r.date}</p>
                            </div>
                            <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', backgroundColor: r.status === 'Pending' ? '#FEF3C7' : '#D1FAE5', color: r.status === 'Pending' ? '#B45309' : '#047857' }}>
                                {r.status}
                            </span>
                        </div>
                    ))}
                    {requests.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center' }}>No material requests.</p>}
                </div>

            </div>
        </div>
    );
};

export default WorkspaceView;

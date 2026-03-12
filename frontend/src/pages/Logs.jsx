import React, { useState } from 'react';
import { History, Search, Filter, Clock, Download, AlertTriangle, Shield, CheckCircle } from 'lucide-react';

const mockLogs = [
    { id: 101, user: 'Admin', action: 'Update Inventory', details: 'Cement (OPC) stock modified (+500)', time: '10 mins ago', type: 'info' },
    { id: 102, user: 'Suki Eng', action: 'Create DPR', details: 'DPR #2024-0354 submitted for Sky Tower', time: '45 mins ago', type: 'success' },
    { id: 103, user: 'Raj Finance', action: 'Login Attempt', details: 'Failed login attempt from IP 192.168.1.45', time: '1 hour ago', type: 'warning' },
    { id: 104, user: 'Admin', action: 'Delete User', details: 'User karthik@temp.com removed from system', time: '3 hours ago', type: 'danger' },
    { id: 105, user: 'Priya HR', action: 'Update Workforce', details: 'Attendance record modified for 15-Mar', time: '5 hours ago', type: 'info' },
    { id: 106, user: 'System', action: 'Data Backup', details: 'Cloud backup completed successfully', time: 'Yesterday', type: 'success' },
];

const Logs = () => {
    const [searchTerm, setSearchTerm] = useState('');

    return (
        <div className="animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h2 style={{ fontSize: '24px', marginBottom: '4px' }}>System Logs</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Audit trail of all system activities and security events.</p>
                </div>
                <button className="btn btn-outline" style={{ display: 'flex', gap: '8px' }}>
                    <Download size={18} />
                    Export Audit Trail
                </button>
            </div>

            <div className="card" style={{ marginBottom: '24px', padding: '16px' }}>
                <div style={{ display: 'flex', gap: '16px' }}>
                    <div style={{ flex: 1, position: 'relative' }}>
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            type="text"
                            placeholder="Filter by user, action or keyword..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ width: '100%', padding: '10px 12px 10px 40px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: '14px' }}
                        />
                    </div>
                    <button className="btn btn-outline">
                        <Filter size={18} />
                        Filters
                    </button>
                </div>
            </div>

            <div className="card" style={{ padding: '0' }}>
                {mockLogs.map((log, i) => (
                    <div key={log.id} style={{
                        padding: '16px 24px',
                        borderBottom: i === mockLogs.length - 1 ? 'none' : '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '20px'
                    }}>
                        <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--bg-main)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: log.type === 'danger' ? '#EF4444' : log.type === 'warning' ? '#F59E0B' : log.type === 'success' ? '#10B981' : '#3B82F6'
                        }}>
                            {log.type === 'danger' ? <Shield size={18} /> : log.type === 'warning' ? <AlertTriangle size={18} /> : log.type === 'success' ? <CheckCircle size={18} /> : <History size={18} />}
                        </div>

                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                                <span style={{ fontWeight: '600', color: 'var(--text-main)' }}>{log.action}</span>
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Clock size={12} /> {log.time}
                                </span>
                            </div>
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '0' }}>
                                <span style={{ color: 'var(--primary)', fontWeight: '600' }}>{log.user}:</span> {log.details}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Logs;

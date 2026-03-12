import React, { useState, useEffect } from 'react';
import { workflowAPI } from '../utils/api';
import { Clock, CheckCircle, AlertTriangle, PlayCircle, ShieldIcon } from 'lucide-react';

const WorkflowTracking = ({ projectId }) => {
    const [timeline, setTimeline] = useState([]);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    const loadData = async () => {
        setLoading(true);
        try {
            const tlRes = await workflowAPI.getTimeline(projectId);
            setTimeline(tlRes.data || []);

            const logsRes = await workflowAPI.getActivityLog(projectId);
            setLogs(logsRes.data || []);
        } catch (err) {
            console.error("Failed to load workflow", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (projectId) loadData();
    }, [projectId]);

    const getStatusColor = (status, isHold) => {
        if (status === 'Completed') return '#10B981'; // Green
        if (isHold) return '#EF4444'; // Red
        if (status === 'In Progress') return '#F59E0B'; // Yellow/Orange
        return '#3B82F6'; // Blue (Pending)
    };

    const getStatusIcon = (status, isHold) => {
        if (status === 'Completed') return <CheckCircle size={16} color="white" />;
        if (isHold) return <AlertTriangle size={16} color="white" />;
        if (status === 'In Progress') return <PlayCircle size={16} color="white" />;
        return <Clock size={16} color="white" />;
    };

    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
                <p>Loading workflow data...</p>
            </div>
        );
    }

    if (!timeline.length) {
        return (
            <div style={{ padding: '40px', textAlign: 'center' }}>
                <p style={{ color: 'var(--text-muted)' }}>No workflow initialized for this project yet.</p>
                <p style={{ fontSize: '13px', marginTop: '10px' }}>To reset or initialize, ensure it gets triggered by a core action.</p>
            </div>
        );
    }

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '30px' }}>
            <div className="card" style={{ padding: '24px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShieldIcon size={20} color="var(--primary)" /> Real-Time Project Timeline
                </h3>

                <div style={{ position: 'relative', paddingLeft: '20px' }}>
                    {/* Vertical Line */}
                    <div style={{ position: 'absolute', left: '27px', top: '10px', bottom: '10px', width: '2px', backgroundColor: '#E2E8F0', zIndex: 0 }} />

                    {timeline.map((stage, idx) => {
                        const color = getStatusColor(stage.status, stage.is_hold);
                        const isLast = idx === timeline.length - 1;

                        return (
                            <div key={idx} style={{ position: 'relative', marginBottom: isLast ? '0' : '30px', display: 'flex', gap: '20px', zIndex: 1 }}>
                                <div style={{
                                    width: '16px', height: '16px', borderRadius: '50%', backgroundColor: color,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '4px',
                                    outline: `4px solid white`
                                }}>
                                    {/* Small inner dot */}
                                </div>

                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div>
                                            <h4 style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text-main)', margin: '0 0 4px 0' }}>{stage.stage_name}</h4>
                                            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>Role: <strong>{stage.responsible_role}</strong></p>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <span style={{
                                                display: 'inline-block', padding: '4px 10px', borderRadius: '12px',
                                                fontSize: '11px', fontWeight: '700', color: color, backgroundColor: `${color}15`,
                                                textTransform: 'uppercase'
                                            }}>
                                                {stage.is_hold ? 'On Hold' : stage.status}
                                            </span>
                                            {stage.timestamp && (
                                                <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                                                    {new Date(stage.timestamp).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {stage.is_hold && (
                                        <div style={{ marginTop: '8px', padding: '8px 12px', backgroundColor: '#FEF2F2', borderRadius: '6px', borderLeft: '3px solid #EF4444' }}>
                                            <p style={{ fontSize: '12px', color: '#B91C1C', margin: 0, fontWeight: '600' }}>
                                                Delayed: Pending for {stage.hold_duration_hours} hours.
                                            </p>
                                        </div>
                                    )}
                                    {stage.remarks && (
                                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '6px', marginBottom: 0 }}>
                                            Note: {stage.remarks}
                                        </p>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="card" style={{ padding: '24px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    Activity Log
                </h3>

                {logs.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>No activities logged yet.</p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {logs.map((log) => (
                            <div key={log._id} style={{ paddingBottom: '16px', borderBottom: '1px solid #F1F5F9' }}>
                                <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-main)', margin: '0 0 6px 0' }}>
                                    {log.done_by} completed <span style={{ color: 'var(--primary)' }}>{log.action_name}</span>
                                </p>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', backgroundColor: '#F8FAFC', padding: '4px 8px', borderRadius: '6px' }}>
                                        {log.previous_status} → {log.updated_status}
                                    </span>
                                    <span style={{ fontSize: '11px', color: '#94A3B8' }}>
                                        {new Date(log.timestamp).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default WorkflowTracking;

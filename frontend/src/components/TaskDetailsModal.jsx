import React from 'react';
import { X, ClipboardList, Calendar, Info, Flag, User, Camera } from 'lucide-react';

const TaskDetailsModal = ({ isOpen, onClose, task }) => {
    if (!isOpen || !task) return null;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)'
        }}>
            <div className="animate-fade-in" style={{
                backgroundColor: 'white', width: '100%', maxWidth: '500px',
                borderRadius: '14px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
                display: 'flex', flexDirection: 'column', overflow: 'hidden', maxH: '90vh'
            }}>
                {/* Header */}
                <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', background: 'linear-gradient(135deg,#1e3a5f,#2F5D8A)' }}>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <div style={{ padding: '10px', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: '8px', color: 'white', height: 'fit-content' }}>
                            <ClipboardList size={22} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '18px', fontWeight: '700', color: 'white', marginBottom: '4px', lineHeight: '1.2' }}>{task.name}</h2>
                            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                Task ID: <strong>{task.id || 'N/A'}</strong>
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.8)', padding: '4px' }}>
                        <X size={22} />
                    </button>
                </div>

                {/* Body */}
                <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div style={{ backgroundColor: '#F8FAFC', padding: '16px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                            <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <User size={14} /> Assigned To
                            </div>
                            <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-main)' }}>{task.assignedTo || 'Unassigned'}</div>
                        </div>
                        <div style={{ backgroundColor: '#F8FAFC', padding: '16px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                            <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Flag size={14} /> Priority & Status
                            </div>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <span style={{
                                    padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700',
                                    backgroundColor: task.priority === 'High' ? '#FEF2F2' : task.priority === 'Medium' ? '#FFFBEB' : '#F0FDF4',
                                    color: task.priority === 'High' ? '#EF4444' : task.priority === 'Medium' ? '#F59E0B' : '#10B981',
                                }}>{task.priority || 'Medium'}</span>
                                <span style={{
                                    padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase',
                                    backgroundColor: task.status === 'Completed' ? '#ECFDF5' : task.status === 'In Progress' ? '#EFF6FF' : (task.status === 'Overdue' ? '#FEF2F2' : '#FFFBEB'),
                                    color: task.status === 'Completed' ? '#059669' : task.status === 'In Progress' ? '#3B82F6' : (task.status === 'Overdue' ? '#EF4444' : '#D97706'),
                                    border: `1px solid ${task.status === 'Completed' ? '#A7F3D0' : task.status === 'In Progress' ? '#BFDBFE' : (task.status === 'Overdue' ? '#FECACA' : '#FDE68A')}`
                                }}>{task.status || 'Pending'}</span>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div>
                            <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Calendar size={14} /> Start Date
                            </div>
                            <div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-main)', padding: '10px 14px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                                {task.startDate || 'Not Set'}
                            </div>
                        </div>
                        <div>
                            <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Calendar size={14} /> Due Date
                            </div>
                            <div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-main)', padding: '10px 14px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                                {task.dueDate || 'Not Set'} {task.dueTime ? `@ ${task.dueTime}` : ''}
                            </div>
                        </div>
                    </div>

                    <div>
                        <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Info size={14} /> Instructions
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: '400', color: 'var(--text-main)', padding: '16px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0', minHeight: '60px', lineHeight: '1.5' }}>
                            {task.instructions || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No instructions provided.</span>}
                        </div>
                    </div>

                    {task.completionPhoto && (
                        <div>
                            <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Camera size={14} /> Completion Proof
                            </div>
                            <img src={task.completionPhoto} alt="Task Completion" style={{ width: '100%', borderRadius: '12px', border: '1px solid var(--border)', marginTop: '4px', maxHeight: '250px', objectFit: 'cover' }} />
                            {task.remarks && (
                                <p style={{ fontSize: '13px', marginTop: '10px', fontStyle: 'italic', color: 'var(--text-muted)' }}>"{task.remarks}"</p>
                            )}
                            {task.completedAt && (
                                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Finished at: {new Date(task.completedAt).toLocaleString()}</p>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', backgroundColor: '#f8fafc' }}>
                    <button className="btn btn-primary" onClick={onClose} style={{ padding: '10px 32px' }}>Close</button>
                </div>
            </div>
        </div>
    );
};

export default TaskDetailsModal;

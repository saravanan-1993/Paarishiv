import React, { useState } from 'react';
import { X, CheckCircle2, ClipboardCheck, Users, Calendar, AlertCircle } from 'lucide-react';

const DailyReportModal = ({ isOpen, onClose, project }) => {
    const [progress, setProgress] = useState('');
    const [labour, setLabour] = useState('');
    const [materials, setMaterials] = useState('');
    const [remarks, setRemarks] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        alert('Daily Report (DPR) submitted successfully!');
        onClose();
    };

    return (
        <div className="modal-overlay" style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 2000, backdropFilter: 'blur(4px)'
        }}>
            <div className="modal-container animate-fade-in" style={{
                backgroundColor: 'white', width: '100%', maxWidth: '600px',
                borderRadius: '12px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                display: 'flex', flexDirection: 'column', maxHeight: '90vh'
            }}>
                {/* Header */}
                <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ padding: '10px', backgroundColor: '#F5F3FF', color: '#8B5CF6', borderRadius: '8px' }}>
                            <ClipboardCheck size={20} />
                        </div>
                        <h2 style={{ fontSize: '18px', fontWeight: '700' }}>Submit Daily Progress Report (DPR)</h2>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                        <X size={24} />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} style={{ padding: '24px', overflowY: 'auto' }}>
                    <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', marginBottom: '24px', fontSize: '13px' }}>
                        Project: <b>{project?.name || 'Current Project'}</b>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '8px' }}>Report Date</label>
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}
                                required
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '8px' }}>Total Labour Strength</label>
                            <input
                                type="number"
                                placeholder="Total workers on site"
                                value={labour}
                                onChange={(e) => setLabour(e.target.value)}
                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}
                                required
                            />
                        </div>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '8px' }}>Work Progress Details</label>
                        <textarea
                            placeholder="Describe work completed today (e.g. Column casting, excavation etc.)"
                            value={progress}
                            onChange={(e) => setProgress(e.target.value)}
                            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', minHeight: '100px', resize: 'vertical' }}
                            required
                        ></textarea>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '8px' }}>Materials Used Today</label>
                        <input
                            type="text"
                            placeholder="e.g. 50 bags Cement, 2 Tons Steel"
                            value={materials}
                            onChange={(e) => setMaterials(e.target.value)}
                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}
                        />
                    </div>

                    <div style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '8px' }}>Target for Tomorrow / Remarks</label>
                        <input
                            type="text"
                            placeholder="Site issues, weather, or tomorrow's plan"
                            value={remarks}
                            onChange={(e) => setRemarks(e.target.value)}
                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}
                        />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10B981', fontSize: '12px', fontWeight: '600', backgroundColor: '#ECFDF5', padding: '10px', borderRadius: '6px' }}>
                        <AlertCircle size={14} /> This report will be sent for review and status update.
                    </div>

                    <div style={{ padding: '24px 0 0', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                        <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" style={{ padding: '10px 32px' }}>
                            <CheckCircle2 size={18} /> Submit DPR
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default DailyReportModal;

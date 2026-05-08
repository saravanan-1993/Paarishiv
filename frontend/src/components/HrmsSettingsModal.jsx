import React, { useState, useEffect } from 'react';
import { X, Clock, PartyPopper, Timer, Save } from 'lucide-react';
import { hrmsAPI } from '../utils/api';

const HrmsSettingsModal = ({ isOpen, onClose, onSaved }) => {
    const [settings, setSettings] = useState({
        officeStartTime: '09:00',
        gracePeriod: 15,
        workAnniversaryWishes: true,
        birthdayWishes: true
    });
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState(null);

    useEffect(() => {
        if (isOpen) fetchSettings();
    }, [isOpen]);

    const fetchSettings = async () => {
        try {
            const res = await hrmsAPI.getSettings();
            if (res.data) setSettings(res.data);
        } catch (err) {
            console.error('Failed to fetch HRMS settings', err);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await hrmsAPI.updateSettings(settings);
            setToast({ msg: 'Settings saved successfully!', type: 'success' });
            setTimeout(() => { onSaved(); onClose(); }, 1000);
        } catch (err) {
            setToast({ msg: 'Failed to save settings', type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const Toggle = ({ checked, onChange }) => (
        <div
            onClick={() => onChange(!checked)}
            style={{
                width: '44px', height: '24px', borderRadius: '12px', cursor: 'pointer',
                backgroundColor: checked ? 'var(--primary, #3b82f6)' : '#D1D5DB',
                position: 'relative', transition: 'background-color 0.2s', flexShrink: 0
            }}
        >
            <div style={{
                width: '18px', height: '18px', borderRadius: '50%', backgroundColor: 'white',
                position: 'absolute', top: '3px', left: checked ? '23px' : '3px',
                transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
            }} />
        </div>
    );

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="card animate-fade-in" style={{ width: '480px', maxWidth: '95vw', padding: '0', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>

                {/* Toast */}
                {toast && (
                    <div style={{
                        position: 'absolute', top: '16px', left: '50%', transform: 'translateX(-50%)',
                        padding: '10px 20px', borderRadius: '8px', fontWeight: '700', fontSize: '13px', zIndex: 10,
                        backgroundColor: toast.type === 'error' ? '#FEF2F2' : '#F0FDF4',
                        color: toast.type === 'error' ? '#DC2626' : '#16A34A',
                        border: `1px solid ${toast.type === 'error' ? '#FECACA' : '#BBF7D0'}`,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)', whiteSpace: 'nowrap'
                    }}>
                        {toast.msg}
                    </div>
                )}

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '42px', height: '42px', backgroundColor: '#FEF3C7', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D97706' }}>
                            <Clock size={20} />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '17px', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>HRMS Settings</h3>
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>Attendance & notification configuration</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}>
                        <X size={22} />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

                    {/* Office Start Time */}
                    <div style={{ padding: '18px', border: '1px solid var(--border)', borderRadius: '12px', backgroundColor: '#fafafa' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
                            <Clock size={14} color="#3b82f6" /> Office Start Time
                        </label>
                        <input
                            type="time"
                            value={settings.officeStartTime}
                            onChange={(e) => setSettings({ ...settings, officeStartTime: e.target.value })}
                            required
                            style={{
                                width: '100%', padding: '10px 14px', fontSize: '15px', fontWeight: '700',
                                border: '1.5px solid var(--border)', borderRadius: '8px',
                                backgroundColor: 'white', color: 'var(--text-main)',
                                outline: 'none', boxSizing: 'border-box'
                            }}
                        />
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px', margin: '6px 0 0' }}>
                            Employees clocking in after this time + grace period are marked Late.
                        </p>
                    </div>

                    {/* Grace Period */}
                    <div style={{ padding: '18px', border: '1px solid var(--border)', borderRadius: '12px', backgroundColor: '#fafafa' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
                            <Timer size={14} color="#f59e0b" /> Grace Period (Minutes)
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <input
                                type="number"
                                value={settings.gracePeriod}
                                onChange={(e) => setSettings({ ...settings, gracePeriod: Math.max(0, Math.min(60, parseInt(e.target.value) || 0)) })}
                                min="0"
                                max="60"
                                required
                                style={{
                                    width: '100px', padding: '10px 14px', fontSize: '18px', fontWeight: '800',
                                    border: '1.5px solid var(--border)', borderRadius: '8px', textAlign: 'center',
                                    backgroundColor: 'white', color: 'var(--text-main)', outline: 'none'
                                }}
                            />
                            <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600' }}>minutes allowed after office time</span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                            {[0, 5, 10, 15, 30].map(val => (
                                <button key={val} type="button"
                                    onClick={() => setSettings({ ...settings, gracePeriod: val })}
                                    style={{
                                        padding: '4px 12px', fontSize: '12px', fontWeight: '700', borderRadius: '20px', cursor: 'pointer',
                                        border: `1.5px solid ${settings.gracePeriod === val ? 'var(--primary)' : 'var(--border)'}`,
                                        backgroundColor: settings.gracePeriod === val ? 'var(--primary)' : 'white',
                                        color: settings.gracePeriod === val ? 'white' : 'var(--text-muted)'
                                    }}>
                                    {val} min
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Celebration Wishes */}
                    <div style={{ padding: '18px', border: '1px solid var(--border)', borderRadius: '12px', backgroundColor: '#fafafa' }}>
                        <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px', margin: '0 0 16px' }}>
                            <PartyPopper size={14} color="#10b981" /> Celebration Wishes
                        </h4>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                            <div>
                                <p style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-main)', margin: 0 }}>Birthday Wishes</p>
                                <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '2px 0 0' }}>Notify employees on their birthday</p>
                            </div>
                            <Toggle checked={settings.birthdayWishes} onChange={(val) => setSettings({ ...settings, birthdayWishes: val })} />
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '12px' }}>
                            <div>
                                <p style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-main)', margin: 0 }}>Work Anniversary Wishes</p>
                                <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '2px 0 0' }}>Notify employees on their work anniversary</p>
                            </div>
                            <Toggle checked={settings.workAnniversaryWishes} onChange={(val) => setSettings({ ...settings, workAnniversaryWishes: val })} />
                        </div>
                    </div>

                    {/* Footer */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '4px' }}>
                        <button type="button" className="btn btn-outline" onClick={onClose} style={{ padding: '10px 24px' }}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={saving} style={{ padding: '10px 24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Save size={16} /> {saving ? 'Saving...' : 'Save Settings'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default HrmsSettingsModal;

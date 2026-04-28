import React, { useState, useEffect } from 'react';
import { X, Save, Clock, PartyPopper, CalendarClock } from 'lucide-react';
import { hrmsAPI } from '../utils/api';

const HrmsSettingsModal = ({ isOpen, onClose, onSaved }) => {
    const [settings, setSettings] = useState({
        officeStartTime: '09:00',
        gracePeriod: 15,
        workAnniversaryWishes: true,
        birthdayWishes: true
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchSettings();
        }
    }, [isOpen]);

    const fetchSettings = async () => {
        try {
            const res = await hrmsAPI.getSettings();
            setSettings(res.data);
        } catch (err) {
            console.error('Failed to fetch HRMS settings', err);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await hrmsAPI.updateSettings(settings);
            alert('Settings updated successfully');
            onSaved();
            onClose();
        } catch (err) {
            console.error('Failed to update settings', err);
            alert('Failed to update settings');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="card animate-fade-in" style={{ width: '95%', maxWidth: '500px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0 }}>
                <div className="modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', backgroundColor: '#fef3c7', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d97706' }}>
                            <CalendarClock size={20} />
                        </div>
                        <h3 style={{ fontSize: '18px', fontWeight: '800' }}>HRMS SETTINGS</h3>
                    </div>
                    <button onClick={onClose} className="icon-btn"><X size={24} /></button>
                </div>

                <form onSubmit={handleSubmit} className="modal-body">
                    <div className="form-group" style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: '700', marginBottom: '8px' }}>
                            <Clock size={16} className="text-primary" /> Office Start Time
                        </label>
                        <input
                            type="time"
                            value={settings.officeStartTime}
                            onChange={(e) => setSettings({ ...settings, officeStartTime: e.target.value })}
                            className="form-control"
                            required
                        />
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Used to calculate late arrivals.</p>
                    </div>

                    <div className="form-group" style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: '700', marginBottom: '8px' }}>
                            Grace Period (Minutes)
                        </label>
                        <input
                            type="number"
                            value={settings.gracePeriod}
                            onChange={(e) => setSettings({ ...settings, gracePeriod: parseInt(e.target.value) || 0 })}
                            className="form-control"
                            min="0"
                            max="60"
                            required
                        />
                    </div>

                    <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '12px', marginBottom: '24px' }}>
                        <h4 style={{ fontSize: '13px', fontWeight: '800', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <PartyPopper size={16} className="text-success" /> CELEBRATION WISHES
                        </h4>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                            <span style={{ fontSize: '14px', fontWeight: '600' }}>Show Birthday Wishes</span>
                            <input
                                type="checkbox"
                                checked={settings.birthdayWishes}
                                onChange={(e) => setSettings({ ...settings, birthdayWishes: e.target.checked })}
                                style={{ width: '20px', height: '20px' }}
                            />
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '14px', fontWeight: '600' }}>Show Work Anniversary Wishes</span>
                            <input
                                type="checkbox"
                                checked={settings.workAnniversaryWishes}
                                onChange={(e) => setSettings({ ...settings, workAnniversaryWishes: e.target.checked })}
                                style={{ width: '20px', height: '20px' }}
                            />
                        </div>
                    </div>

                    <div className="modal-footer" style={{ padding: '0' }}>
                        <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={saving}>
                            {saving ? 'Saving...' : 'Save Settings'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default HrmsSettingsModal;

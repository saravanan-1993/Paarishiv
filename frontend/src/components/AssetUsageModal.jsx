import React, { useState } from 'react';
import { X, Clock, Gauge, User, MapPin } from 'lucide-react';
import { fleetAPI } from '../utils/api';

const AssetUsageModal = ({ isOpen, onClose, onLogAdded, fleet }) => {
    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        asset: '',
        site: '',
        hoursUsed: '',
        dieselConsumed: '',
        engineer: ''
    });
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const selectedAsset = fleet.find(f => f.id === formData.asset);
            
            const logData = {
                date: formData.date,
                assetId: formData.asset,
                assetName: selectedAsset?.name || formData.asset,
                site: formData.site,
                qty: parseFloat(formData.dieselConsumed),
                hoursRun: parseFloat(formData.hoursUsed),
                engineer: formData.engineer,
                type: 'Consumption'
            };

            await fleetAPI.addFuelLog(logData);
            
            onLogAdded({
                ...formData,
                hoursUsed: `${formData.hoursUsed}h`,
                dieselConsumed: `${formData.dieselConsumed}L`
            });
            onClose();
        } catch (err) {
            console.error('Error saving fuel log:', err);
            alert('Failed to save usage log');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '500px', width: '95%' }}>
                <div className="modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', backgroundColor: '#f0fdf4', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a' }}>
                            <Clock size={20} />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '18px', fontWeight: '800' }}>DAILY USAGE LOG</h3>
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Record equipment hours & fuel</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="modal-body" style={{ padding: '24px' }}>
                    <div className="form-group" style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Select Machine *</label>
                        <select required value={formData.asset} onChange={(e) => setFormData({ ...formData, asset: e.target.value })} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                            <option value="">Choose equipment</option>
                            {fleet.map(f => <option key={f.id} value={f.id}>{f.id} - {f.name}</option>)}
                        </select>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                        <div className="form-group">
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Hours Run *</label>
                            <input type="number" step="0.5" required placeholder="e.g. 8.5" value={formData.hoursUsed} onChange={(e) => setFormData({ ...formData, hoursUsed: e.target.value })} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }} />
                        </div>
                        <div className="form-group">
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Diesel Used (L) *</label>
                            <input type="number" required placeholder="Liters" value={formData.dieselConsumed} onChange={(e) => setFormData({ ...formData, dieselConsumed: e.target.value })} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }} />
                        </div>
                    </div>

                    <div className="form-group" style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Site Location *</label>
                        <input type="text" required placeholder="Current Site" value={formData.site} onChange={(e) => setFormData({ ...formData, site: e.target.value })} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }} />
                    </div>

                    <div className="form-group">
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Responsible Engineer *</label>
                        <input type="text" required placeholder="Name" value={formData.engineer} onChange={(e) => setFormData({ ...formData, engineer: e.target.value })} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }} />
                    </div>

                    <div className="modal-footer" style={{ borderTop: 'none', padding: '24px 0 0 0', gap: '12px', justifyContent: 'flex-end' }}>
                        <button type="button" className="btn btn-outline" onClick={onClose} disabled={loading}>Cancel</button>
                        <button type="submit" className="btn btn-primary" style={{ fontWeight: '800' }} disabled={loading}>
                            {loading ? 'SAVING...' : 'SAVE LOG'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AssetUsageModal;

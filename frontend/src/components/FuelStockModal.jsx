import React, { useState, useEffect } from 'react';
import { X, Droplets } from 'lucide-react';
import { fleetAPI, projectAPI } from '../utils/api';

const FuelStockModal = ({ isOpen, onClose, onStockAdded, projectName = 'All Sites' }) => {
    const [formData, setFormData] = useState({
        qty: '',
        rate: '',
        totalAmount: 0,
        supplier: '',
        site: projectName !== 'All Sites' ? projectName : '',
        billNo: '',
        remarks: '',
    });
    const [loading, setLoading] = useState(false);
    const [projects, setProjects] = useState([]);

    useEffect(() => {
        if (isOpen) {
            projectAPI.getAll().then(res => setProjects(res.data || [])).catch(() => {});
            setFormData(prev => ({
                ...prev,
                qty: '', rate: '', totalAmount: 0, supplier: '', billNo: '', remarks: '',
                site: projectName !== 'All Sites' ? projectName : '',
            }));
        }
    }, [isOpen, projectName]);

    if (!isOpen) return null;

    const handleQtyRateChange = (field, value) => {
        const newFormData = { ...formData, [field]: value };
        const qty = parseFloat(newFormData.qty) || 0;
        const rate = parseFloat(newFormData.rate) || 0;
        setFormData({ ...newFormData, totalAmount: qty * rate });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const user = JSON.parse(localStorage.getItem('erp_user') || '{}');
            const qty = parseFloat(formData.qty) || 0;
            const rate = parseFloat(formData.rate) || 0;
            if (qty <= 0 || rate <= 0) {
                alert('Please enter valid quantity and rate');
                setLoading(false);
                return;
            }
            if (!formData.site) {
                alert('Please select a site/project');
                setLoading(false);
                return;
            }
            const dataToSave = {
                date: new Date().toISOString(),
                qty,
                rate,
                totalAmount: qty * rate,
                supplier: formData.supplier || '',
                billNo: formData.billNo || '',
                site: formData.site,
                remarks: formData.remarks || '',
                addedBy: user.username || 'System'
            };
            await fleetAPI.addFuelStock(dataToSave);
            onStockAdded();
            onClose();
        } catch (err) {
            console.error('Error adding fuel stock:', err);
            const detail = err.response?.data?.detail;
            alert(typeof detail === 'string' ? detail : 'Failed to add fuel stock');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay-nested">
            <div className="card animate-fade-in" style={{ width: '95%', maxWidth: '500px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0 }}>
                <div className="modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', backgroundColor: '#e0f2fe', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284c7' }}>
                            <Droplets size={20} />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '18px', fontWeight: '800' }}>ADD FUEL STOCK</h3>
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Purchase entry for diesel</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="modal-body" style={{ padding: '24px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                        <div className="form-group">
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Quantity (Liters) *</label>
                            <input type="number" required placeholder="0.00" value={formData.qty} onChange={(e) => handleQtyRateChange('qty', e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }} />
                        </div>
                        <div className="form-group">
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Rate per Liter *</label>
                            <div style={{ position: 'relative' }}>
                                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>{'\u20B9'}</span>
                                <input type="number" step="0.01" required placeholder="0.00" value={formData.rate} onChange={(e) => handleQtyRateChange('rate', e.target.value)} style={{ width: '100%', padding: '12px 12px 12px 24px', borderRadius: '8px', border: '1px solid var(--border)' }} />
                            </div>
                        </div>
                    </div>

                    <div className="form-group" style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Total Amount</label>
                        <input type="text" readOnly value={`\u20B9 ${formData.totalAmount.toLocaleString('en-IN')}`} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: '#F8FAFC', fontWeight: '700', color: 'var(--primary)' }} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                        <div className="form-group">
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Supplier Name</label>
                            <input type="text" placeholder="Petrol Bunk / Vendor" value={formData.supplier} onChange={(e) => setFormData({ ...formData, supplier: e.target.value })} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }} />
                        </div>
                        <div className="form-group">
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Bill / Voucher No</label>
                            <input type="text" placeholder="Reference #" value={formData.billNo} onChange={(e) => setFormData({ ...formData, billNo: e.target.value })} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }} />
                        </div>
                    </div>

                    <div className="form-group" style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Site / Project *</label>
                        {projectName !== 'All Sites' ? (
                            <input
                                type="text"
                                readOnly
                                value={formData.site}
                                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: '#F1F5F9' }}
                            />
                        ) : (
                            <select
                                required
                                value={formData.site}
                                onChange={(e) => setFormData({ ...formData, site: e.target.value })}
                                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}
                            >
                                <option value="">Select Site / Project</option>
                                <option value="Warehouse">Warehouse</option>
                                {projects.map(p => (
                                    <option key={p._id || p.id} value={p.name}>{p.name}</option>
                                ))}
                            </select>
                        )}
                    </div>

                    <div className="form-group">
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Remarks</label>
                        <textarea rows="2" placeholder="Any additional notes..." value={formData.remarks} onChange={(e) => setFormData({ ...formData, remarks: e.target.value })} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', resize: 'none' }}></textarea>
                    </div>

                    <div className="modal-footer" style={{ borderTop: 'none', padding: '24px 0 0 0', gap: '12px', justifyContent: 'flex-end' }}>
                        <button type="button" className="btn btn-outline" onClick={onClose} disabled={loading}>Cancel</button>
                        <button type="submit" className="btn btn-primary" style={{ fontWeight: '800' }} disabled={loading}>
                            {loading ? 'SAVING...' : 'SAVE STOCK ENTRY'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default FuelStockModal;

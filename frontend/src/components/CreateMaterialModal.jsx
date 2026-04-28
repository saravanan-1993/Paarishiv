import React, { useState } from 'react';
import { X, Package, Loader2, Ruler } from 'lucide-react';
import { materialAPI } from '../utils/api';
import PremiumSelect from './PremiumSelect';

const CreateMaterialModal = ({ isOpen, onClose, onSuccess }) => {
    const [isSaving, setIsSaving] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        category: 'Construction',
        unit: 'Nos',
        stock_handling_type: 'Direct Site'
    });

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const res = await materialAPI.create(formData);
            if (onSuccess) onSuccess(res.data || formData);
            setFormData({ name: '', category: 'Construction', unit: 'Nos', stock_handling_type: 'Direct Site' });
            onClose();
        } catch (err) {
            console.error('Failed to create material:', err);
            alert('Failed to save material.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="modal-overlay-nested">
            <div className="card animate-fade-in" style={{ width: '90%', maxWidth: '400px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0 }}>
                <div className="modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', backgroundColor: '#eff6ff', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>
                            <Package size={20} />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '18px', fontWeight: '800' }}>Add Material</h3>
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Create a new master material</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="modal-body" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Material Name *</label>
                            <input
                                required
                                autoFocus
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                type="text"
                                placeholder="e.g. Cement 53 Grade"
                                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Category *</label>
                            <input
                                required
                                value={formData.category}
                                onChange={e => setFormData({ ...formData, category: e.target.value })}
                                type="text"
                                placeholder="e.g. Construction"
                                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Base Unit *</label>
                            <PremiumSelect
                                options={[
                                    { value: 'Nos', label: 'Nos' },
                                    { value: 'Kgs', label: 'Kgs' },
                                    { value: 'Tons', label: 'Tons' },
                                    { value: 'Cft', label: 'Cft' },
                                    { value: 'Bags', label: 'Bags' },
                                    { value: 'Meters', label: 'Meters' },
                                    { value: 'Ltr', label: 'Ltr' }
                                ]}
                                value={formData.unit}
                                onChange={(val) => setFormData({ ...formData, unit: val })}
                                icon={Ruler}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Stock Handling Type *</label>
                            <PremiumSelect
                                options={[
                                    { value: 'Direct Site', label: 'Direct Site (Auto consume)' },
                                    { value: 'Warehouse Controlled', label: 'Warehouse Controlled' }
                                ]}
                                value={formData.stock_handling_type}
                                onChange={(val) => setFormData({ ...formData, stock_handling_type: val })}
                                icon={Package}
                            />
                        </div>
                    </div>

                    <div className="modal-footer" style={{ borderTop: 'none', padding: '24px 0 0 0', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                        <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
                        <button type="submit" disabled={isSaving} className="btn btn-primary" style={{ fontWeight: '800' }}>
                            {isSaving ? <Loader2 size={16} className="animate-spin" /> : 'Save Material'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateMaterialModal;

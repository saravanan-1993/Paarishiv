import React, { useState, useRef, useEffect } from 'react';
import { X, Package, Loader2, Ruler, Plus, ChevronDown, Check } from 'lucide-react';
import { materialAPI } from '../utils/api';
import { useToast } from '../context/ToastContext';
import PremiumSelect from './PremiumSelect';

const DEFAULT_UNITS = ['Nos', 'Kgs', 'Tons', 'Cft', 'Bags', 'Meters', 'Ltr', 'Sqft', 'Rmt', 'Cu.m', 'Sets', 'Rolls'];

const UnitSelect = ({ value, onChange }) => {
    const [open, setOpen] = useState(false);
    const [units, setUnits] = useState(DEFAULT_UNITS);
    const [addingNew, setAddingNew] = useState(false);
    const [customUnit, setCustomUnit] = useState('');
    const dropdownRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setOpen(false);
                setAddingNew(false);
                setCustomUnit('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (addingNew && inputRef.current) inputRef.current.focus();
    }, [addingNew]);

    const handleSelect = (unit) => {
        onChange(unit);
        setOpen(false);
        setAddingNew(false);
        setCustomUnit('');
    };

    const handleAddCustom = () => {
        const trimmed = customUnit.trim();
        if (!trimmed) return;
        if (!units.includes(trimmed)) setUnits(prev => [...prev, trimmed]);
        handleSelect(trimmed);
    };

    return (
        <div ref={dropdownRef} style={{ position: 'relative' }}>
            <button
                type="button"
                onClick={() => { setOpen(o => !o); setAddingNew(false); setCustomUnit(''); }}
                style={{
                    width: '100%', padding: '12px 38px 12px 38px', borderRadius: '8px',
                    border: '1px solid var(--border)', background: 'white', textAlign: 'left',
                    fontSize: '14px', fontWeight: '600', cursor: 'pointer', display: 'flex',
                    alignItems: 'center', justifyContent: 'space-between'
                }}
            >
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Ruler size={16} style={{ color: 'var(--text-muted)' }} />
                    {value || 'Select unit'}
                </span>
                <ChevronDown size={16} style={{ color: 'var(--text-muted)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </button>

            {open && (
                <div style={{
                    position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                    background: 'white', border: '1px solid var(--border)', borderRadius: '10px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 9999, overflow: 'hidden'
                }}>
                    <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                        {units.map(u => (
                            <button
                                key={u} type="button"
                                onClick={() => handleSelect(u)}
                                style={{
                                    width: '100%', padding: '10px 14px', textAlign: 'left',
                                    background: value === u ? '#EFF6FF' : 'transparent',
                                    border: 'none', cursor: 'pointer', fontSize: '14px',
                                    fontWeight: value === u ? '700' : '500',
                                    color: value === u ? '#2563EB' : 'var(--text-main)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                                }}
                                onMouseEnter={e => { if (value !== u) e.currentTarget.style.background = '#F8FAFC'; }}
                                onMouseLeave={e => { if (value !== u) e.currentTarget.style.background = 'transparent'; }}
                            >
                                {u}
                                {value === u && <Check size={14} />}
                            </button>
                        ))}
                    </div>

                    <div style={{ borderTop: '1px solid var(--border)' }}>
                        {addingNew ? (
                            <div style={{ display: 'flex', gap: '6px', padding: '8px' }}>
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={customUnit}
                                    onChange={e => setCustomUnit(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddCustom(); } if (e.key === 'Escape') { setAddingNew(false); setCustomUnit(''); } }}
                                    placeholder="e.g. MT, RM, Quintal..."
                                    style={{ flex: 1, padding: '8px 10px', borderRadius: '6px', border: '1px solid #3b82f6', fontSize: '13px', outline: 'none' }}
                                />
                                <button
                                    type="button" onClick={handleAddCustom}
                                    style={{ padding: '8px 12px', borderRadius: '6px', background: '#2563EB', color: 'white', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '700' }}
                                >
                                    Add
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setAddingNew(true)}
                                style={{
                                    width: '100%', padding: '10px 14px', textAlign: 'left',
                                    background: 'transparent', border: 'none', cursor: 'pointer',
                                    fontSize: '13px', fontWeight: '700', color: '#2563EB',
                                    display: 'flex', alignItems: 'center', gap: '8px'
                                }}
                            >
                                <Plus size={14} /> Add Custom Unit
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const CreateMaterialModal = ({ isOpen, onClose, onSuccess }) => {
    const toast = useToast();
    const [isSaving, setIsSaving] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        category: 'Construction',
        unit: 'Nos',
        stock_handling_type: 'Warehouse Controlled'
    });

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const res = await materialAPI.create(formData);
            if (onSuccess) onSuccess(res.data || formData);
            setFormData({ name: '', category: 'Construction', unit: 'Nos', stock_handling_type: 'Warehouse Controlled' });
            onClose();
        } catch (err) {
            console.error('Failed to create material:', err);
            toast.error('Failed to save material.');
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
                            <UnitSelect
                                value={formData.unit}
                                onChange={val => setFormData({ ...formData, unit: val })}
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

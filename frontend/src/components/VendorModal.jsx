import React, { useState } from 'react';
import { X, User, Phone, MapPin, Building2, Tag, FileText, Globe, Loader2, Mail } from 'lucide-react';
import { vendorAPI } from '../utils/api';

const VendorModal = ({ isOpen, onClose, onSuccess, vendor: vendorToEdit }) => {
    const isEditMode = !!vendorToEdit;
    const [isSaving, setIsSaving] = useState(false);
    const [showCustomCategory, setShowCustomCategory] = useState(false);
    const [formData, setFormData] = useState(
        vendorToEdit
            ? { name: vendorToEdit.name || '', contact: vendorToEdit.contact || '', phone: vendorToEdit.phone || '', email: vendorToEdit.email || '', category: vendorToEdit.category || '', gstin: vendorToEdit.gstin || '', location: vendorToEdit.location || '', website: vendorToEdit.website || '', rate_card: vendorToEdit.rate_card || [] }
            : { name: '', contact: '', phone: '', email: '', category: '', gstin: '', location: '', website: '', rate_card: [] }
    );

    // Re-sync form when vendorToEdit changes (switching vendors)
    React.useEffect(() => {
        if (vendorToEdit) {
            setFormData({ name: vendorToEdit.name || '', contact: vendorToEdit.contact || '', phone: vendorToEdit.phone || '', email: vendorToEdit.email || '', category: vendorToEdit.category || '', gstin: vendorToEdit.gstin || '', location: vendorToEdit.location || '', website: vendorToEdit.website || '', rate_card: vendorToEdit.rate_card || [] });
        } else {
            setFormData({ name: '', contact: '', phone: '', email: '', category: '', gstin: '', location: '', website: '', rate_card: [] });
        }
    }, [vendorToEdit]);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const payload = { name: formData.name, category: formData.category, gstin: formData.gstin, contact: formData.contact, location: formData.location, phone: formData.phone, email: formData.email, rate_card: formData.rate_card };
            if (isEditMode) {
                await vendorAPI.update(vendorToEdit.id || vendorToEdit._id, payload);
            } else {
                await vendorAPI.create(payload);
            }
            if (onSuccess) onSuccess();
            onClose();
        } catch (err) {
            console.error('Failed to save vendor:', err);
            const errorMsg = err.response?.data?.detail || 'Failed to save vendor. Please check the connection.';
            alert(errorMsg);
        } finally {
            setIsSaving(false);
        }
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const addRate = () => {
        setFormData({ ...formData, rate_card: [...formData.rate_card, { role: '', rate: '' }] });
    };

    const updateRate = (index, field, value) => {
        const newRates = [...formData.rate_card];
        newRates[index][field] = value;
        setFormData({ ...formData, rate_card: newRates });
    };

    const removeRate = (index) => {
        const newRates = formData.rate_card.filter((_, i) => i !== index);
        setFormData({ ...formData, rate_card: newRates });
    };

    return (
        <div className="modal-overlay" style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(4px)'
        }}>
            <div className="modal-container animate-fade-in" style={{
                backgroundColor: 'white',
                width: '100%',
                maxWidth: '700px',
                borderRadius: '12px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
                display: 'flex',
                flexDirection: 'column',
                maxHeight: '90vh'
            }}>
                {/* Header */}
                <div style={{
                    padding: '20px 24px',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <h2 style={{ fontSize: '20px', fontWeight: '700' }}>{isEditMode ? `Edit Vendor — ${vendorToEdit.name}` : 'Add New Vendor'}</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                        <X size={24} />
                    </button>
                </div>

                {/* Form Body */}
                <form id="vendorForm" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                    <div style={{ padding: '24px', overflowY: 'auto' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            <div style={{ gridColumn: 'span 2' }}>
                                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Company Name*</label>
                                <div style={{ position: 'relative' }}>
                                    <Building2 size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                    <input
                                        name="name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        type="text"
                                        placeholder="e.g. Acme Construction Supplies"
                                        style={{ width: '100%', padding: '10px 12px 10px 40px', borderRadius: '8px', border: '1px solid var(--border)' }}
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Primary Contact Person*</label>
                                <div style={{ position: 'relative' }}>
                                    <User size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                    <input
                                        name="contact"
                                        value={formData.contact}
                                        onChange={handleChange}
                                        type="text"
                                        placeholder="Full Name"
                                        style={{ width: '100%', padding: '10px 12px 10px 40px', borderRadius: '8px', border: '1px solid var(--border)' }}
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Phone Number*</label>
                                <div style={{ position: 'relative' }}>
                                    <Phone size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                    <input
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handleChange}
                                        type="tel"
                                        placeholder="+91 XXXX XXX XXX"
                                        style={{ width: '100%', padding: '10px 12px 10px 40px', borderRadius: '8px', border: '1px solid var(--border)' }}
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Email Address*</label>
                                <div style={{ position: 'relative' }}>
                                    <Mail size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                    <input
                                        name="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        type="email"
                                        placeholder="vendor@example.com"
                                        style={{ width: '100%', padding: '10px 12px 10px 40px', borderRadius: '8px', border: '1px solid var(--border)' }}
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Category*</label>
                                <div style={{ position: 'relative' }}>
                                    <Tag size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                    {showCustomCategory ? (
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <input
                                                type="text"
                                                name="category"
                                                value={formData.category}
                                                onChange={handleChange}
                                                placeholder="Enter custom category"
                                                style={{ flex: 1, padding: '10px 12px 10px 40px', borderRadius: '8px', border: '1px solid var(--border)' }}
                                                required
                                            />
                                            <button type="button" onClick={() => { setShowCustomCategory(false); setFormData(prev => ({ ...prev, category: '' })); }} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: '#f1f5f9', cursor: 'pointer', fontSize: '12px' }}>Back</button>
                                        </div>
                                    ) : (
                                        <select
                                            name="category"
                                            value={formData.category}
                                            onChange={(e) => {
                                                if (e.target.value === '__custom__') {
                                                    setShowCustomCategory(true);
                                                    setFormData(prev => ({ ...prev, category: '' }));
                                                } else {
                                                    handleChange(e);
                                                }
                                            }}
                                            style={{ width: '100%', padding: '10px 12px 10px 40px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'white' }}
                                            required
                                        >
                                            <option value="">Select Category</option>
                                            <option value="material">Material Supplier</option>
                                            <option value="labor">Labor Contractor</option>
                                            <option value="equipment">Equipment Rental</option>
                                            <option value="subcontractor">Subcontractor</option>
                                            <option value="__custom__">+ Add Custom Category</option>
                                        </select>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>GST Number</label>
                                <div style={{ position: 'relative' }}>
                                    <FileText size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                    <input
                                        name="gstin"
                                        value={formData.gstin}
                                        onChange={handleChange}
                                        type="text"
                                        placeholder="22AAAAA0000A1Z5"
                                        style={{ width: '100%', padding: '10px 12px 10px 40px', borderRadius: '8px', border: '1px solid var(--border)' }}
                                    />
                                </div>
                            </div>

                            <div style={{ gridColumn: 'span 2' }}>
                                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Address</label>
                                <div style={{ position: 'relative' }}>
                                    <MapPin size={18} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--text-muted)' }} />
                                    <textarea
                                        name="location"
                                        value={formData.location}
                                        onChange={handleChange}
                                        placeholder="Full business address..."
                                        style={{ width: '100%', padding: '10px 12px 10px 40px', borderRadius: '8px', border: '1px solid var(--border)', minHeight: '80px', fontFamily: 'inherit' }}
                                    ></textarea>
                                </div>
                            </div>

                            {formData.category === 'labor' && (
                                <div style={{ gridColumn: 'span 2', marginTop: '10px', padding: '16px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                        <h3 style={{ fontSize: '15px', fontWeight: '700' }}>Labour Rate Card</h3>
                                        <button type="button" onClick={addRate} style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            + Add Rate
                                        </button>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {formData.rate_card.map((rate, index) => (
                                            <div key={index} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                                <input
                                                    type="text"
                                                    value={rate.role}
                                                    onChange={(e) => updateRate(index, 'role', e.target.value)}
                                                    placeholder="Role (e.g. Mason)"
                                                    style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)' }}
                                                    required
                                                />
                                                <input
                                                    type="number"
                                                    value={rate.rate}
                                                    onChange={(e) => updateRate(index, 'rate', e.target.value)}
                                                    placeholder="Rate per day (₹)"
                                                    style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)' }}
                                                    required
                                                />
                                                <button type="button" onClick={() => removeRate(index)} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '4px' }}>
                                                    <X size={18} />
                                                </button>
                                            </div>
                                        ))}
                                        {formData.rate_card.length === 0 && (
                                            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No rates added. Click "Add Rate" to define daily wages.</p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer Buttons */}
                    <div style={{
                        padding: '20px 24px',
                        borderTop: '1px solid var(--border)',
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: '12px',
                        backgroundColor: '#f8fafc'
                    }}>
                        <button type="button" className="btn btn-outline" onClick={onClose} style={{ padding: '10px 24px' }}>Cancel</button>
                        <button type="submit" disabled={isSaving} className="btn btn-primary" style={{ padding: '10px 32px' }}>
                            {isSaving ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : isEditMode ? 'Update Vendor' : 'Save Vendor'}
                        </button>
                    </div>
                </form >
            </div >
            <style>{`
                .animate-spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div >
    );
};

export default VendorModal;

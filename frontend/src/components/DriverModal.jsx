import React, { useState, useEffect } from 'react';
import { employeeAPI } from '../utils/api';
import { X, UserPlus, Phone, CreditCard, Calendar, Save, Loader2, Edit3, ShieldCheck } from 'lucide-react';

const DriverModal = ({ isOpen, onClose, onSaved, driver = null }) => {
    const isEdit = !!driver;
    const [submitting, setSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        fullName: '',
        phone: '',
        email: '',
        password: '1234', // Default password for new drivers
        dailyWage: '0',
        licenseNumber: '',
        licenseExpiry: '',
        status: 'Active',
        salaryType: 'daily',
        roles: ['Driver'],
        designation: 'Driver',
        department: 'Fleet'
    });

    useEffect(() => {
        if (driver) {
            setFormData({
                fullName: driver.fullName || '',
                phone: driver.phone || '',
                email: driver.email || '',
                password: '', // Don't pre-fill password for editing
                dailyWage: driver.dailyWage || '0',
                licenseNumber: driver.licenseNumber || '',
                licenseExpiry: driver.licenseExpiry || '',
                status: driver.status || 'Active',
                salaryType: driver.salaryType || 'daily',
                roles: driver.roles || ['Driver'],
                designation: driver.designation || 'Driver',
                department: driver.department || 'Fleet'
            });
        } else {
            setFormData({
                fullName: '',
                phone: '',
                email: '',
                password: '1234',
                dailyWage: '0',
                licenseNumber: '',
                licenseExpiry: '',
                status: 'Active',
                salaryType: 'daily',
                roles: ['Driver'],
                designation: 'Driver',
                department: 'Fleet'
            });
        }
    }, [driver, isOpen]);

    if (!isOpen) return null;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const data = {
                ...formData,
                dailyWage: parseFloat(formData.dailyWage) || 0,
                employeeCode: formData.employeeCode || "", // Ensure it's not undefined
                password: formData.password || '123456', // Ensure password for new drivers
                email: formData.email || `${formData.fullName.toLowerCase().replace(/\s/g, '').slice(0, 10)}${formData.phone.slice(-4)}@fleet.com`
            };

            if (isEdit) {
                // Remove password on edit if empty to prevent accidental reset
                const updateData = { ...data };
                if (!updateData.password) delete updateData.password;
                delete updateData.id;
                delete updateData._id;
                
                await employeeAPI.update(driver.id || driver._id, updateData);
            } else {
                await employeeAPI.create(data);
            }
            onSaved();
            onClose();
        } catch (err) {
            console.error(err);
            alert(err.response?.data?.detail || 'Failed to save driver details');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="modal-overlay" style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 1000,
            backdropFilter: 'blur(4px)'
        }}>
            <div className="modal-content animate-slide-up" style={{
                backgroundColor: 'white', borderRadius: '16px',
                width: '100%', maxWidth: '500px',
                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
            }}>
                <div style={{
                    padding: '20px 24px', borderBottom: '1px solid #e2e8f0',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', backgroundColor: 'var(--primary-bg)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                            {isEdit ? <Edit3 size={20} /> : <UserPlus size={20} />}
                        </div>
                        <h2 style={{ fontSize: '18px', fontWeight: '800' }}>{isEdit ? 'EDIT DRIVER' : 'ADD NEW DRIVER'}</h2>
                    </div>
                    <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b' }}>
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Full Name *</label>
                            <input
                                name="fullName"
                                required
                                value={formData.fullName}
                                onChange={handleChange}
                                placeholder="Enter driver name"
                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px solid #e2e8f0' }}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Phone Number *</label>
                                <div style={{ position: 'relative' }}>
                                    <Phone size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                                    <input
                                        name="phone"
                                        required
                                        value={formData.phone}
                                        onChange={handleChange}
                                        placeholder="Mobile no."
                                        style={{ width: '100%', padding: '10px 10px 10px 36px', borderRadius: '8px', border: '1.5px solid #e2e8f0' }}
                                    />
                                </div>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Daily Salary (₹) *</label>
                                <input
                                    name="dailyWage"
                                    required
                                    type="number"
                                    value={formData.dailyWage}
                                    onChange={handleChange}
                                    placeholder="Per day wage"
                                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px solid #e2e8f0' }}
                                />
                            </div>
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>License Number</label>
                            <div style={{ position: 'relative' }}>
                                <ShieldCheck size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                                <input
                                    name="licenseNumber"
                                    value={formData.licenseNumber}
                                    onChange={handleChange}
                                    placeholder="DL Number"
                                    style={{ width: '100%', padding: '10px 10px 10px 36px', borderRadius: '8px', border: '1.5px solid #e2e8f0' }}
                                />
                            </div>
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>License Expiry</label>
                            <div style={{ position: 'relative' }}>
                                <Calendar size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                                <input
                                    name="licenseExpiry"
                                    type="date"
                                    value={formData.licenseExpiry}
                                    onChange={handleChange}
                                    style={{ width: '100%', padding: '10px 10px 10px 36px', borderRadius: '8px', border: '1.5px solid #e2e8f0' }}
                                />
                            </div>
                        </div>

                    </div>

                    <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
                        <button type="button" onClick={onClose} className="btn btn-outline" style={{ flex: 1 }}>CANCEL</button>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={submitting}
                            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                        >
                            {submitting ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                            {submitting ? 'SAVING...' : 'SAVE DRIVER'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default DriverModal;

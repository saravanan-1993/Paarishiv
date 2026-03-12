import React, { useState, useEffect, useRef } from 'react';
import { X, Building2, User, Phone, CheckSquare, Square, ChevronDown } from 'lucide-react';
import { projectAPI } from '../utils/api';

const AddContractorModal = ({ isOpen, onClose, onContractorAdded }) => {
    const [formData, setFormData] = useState({
        companyName: '',
        type: '',
        contactPerson: '',
        phone: '',
        email: '',
        gstin: '',
        address: ''
    });

    const [availableProjects, setAvailableProjects] = useState([]);
    const [selectedProjects, setSelectedProjects] = useState([]);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            projectAPI.getAll()
                .then(res => setAvailableProjects(res.data))
                .catch(err => console.error("Failed to load projects:", err));
        } else {
            // Reset when closed
            setFormData({
                companyName: '', type: '', contactPerson: '', phone: '', email: '', gstin: '', address: ''
            });
            setSelectedProjects([]);
            setIsDropdownOpen(false);
        }
    }, [isOpen]);

    // Close dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    if (!isOpen) return null;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const toggleProject = (projectName) => {
        if (selectedProjects.includes(projectName)) {
            setSelectedProjects(prev => prev.filter(p => p !== projectName));
        } else {
            setSelectedProjects(prev => [...prev, projectName]);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onContractorAdded({
            company: formData.companyName,
            type: formData.type,
            projects: selectedProjects.join(', '),
            contact: formData.contactPerson,
            status: 'Active',
            ...formData
        });
        onClose();
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '600px', width: '95%' }}>
                <div className="modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', backgroundColor: '#f0f9ff', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0ea5e9' }}>
                            <Building2 size={20} />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '18px', fontWeight: '800' }}>ADD CONTRACTOR</h3>
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Register a new vendor or contractor</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="modal-body" style={{ padding: '24px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
                        <div className="form-group">
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px', textTransform: 'uppercase' }}>Company Name *</label>
                            <input name="companyName" required value={formData.companyName} onChange={handleChange} type="text" placeholder="e.g. SVS Earth Movers" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }} />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            <div className="form-group">
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px', textTransform: 'uppercase' }}>Work Type *</label>
                                <input name="type" required value={formData.type} onChange={handleChange} type="text" placeholder="e.g. Excavation / Electrical" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }} />
                            </div>

                            <div className="form-group" ref={dropdownRef}>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px', textTransform: 'uppercase' }}>Assigned Project(s)</label>
                                <div style={{ position: 'relative' }}>
                                    <div
                                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                        style={{
                                            width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)',
                                            background: '#fff', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                            minHeight: '45px'
                                        }}
                                    >
                                        <span style={{ color: selectedProjects.length ? '#111827' : '#9CA3AF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {selectedProjects.length > 0 ? selectedProjects.join(', ') : 'Select Project(s)'}
                                        </span>
                                        <ChevronDown size={16} color="#6B7280" />
                                    </div>

                                    {isDropdownOpen && (
                                        <div style={{
                                            position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px',
                                            background: '#fff', border: '1px solid var(--border)', borderRadius: '8px',
                                            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', zIndex: 50, maxHeight: '200px', overflowY: 'auto'
                                        }}>
                                            {availableProjects.length === 0 ? (
                                                <div style={{ padding: '12px', textAlign: 'center', color: '#6B7280', fontSize: '13px' }}>No projects available</div>
                                            ) : (
                                                availableProjects.map((p) => {
                                                    const isSelected = selectedProjects.includes(p.name);
                                                    return (
                                                        <div
                                                            key={p._id}
                                                            onClick={() => toggleProject(p.name)}
                                                            style={{
                                                                padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '8px',
                                                                cursor: 'pointer', borderBottom: '1px solid #F3F4F6',
                                                                backgroundColor: isSelected ? '#F9FAFB' : '#fff',
                                                                transition: 'background-color 0.2s'
                                                            }}
                                                        >
                                                            {isSelected ? <CheckSquare size={16} color="var(--primary)" /> : <Square size={16} color="#9CA3AF" />}
                                                            <span style={{ fontSize: '13px', fontWeight: isSelected ? '600' : '500', color: isSelected ? 'var(--primary)' : '#374151' }}>
                                                                {p.name}
                                                            </span>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            <div className="form-group">
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px', textTransform: 'uppercase' }}>Contact Person *</label>
                                <input name="contactPerson" required value={formData.contactPerson} onChange={handleChange} type="text" placeholder="Full Name" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }} />
                            </div>
                            <div className="form-group">
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px', textTransform: 'uppercase' }}>Phone Number *</label>
                                <input name="phone" required value={formData.phone} onChange={handleChange} type="text" placeholder="Phone" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }} />
                            </div>
                        </div>

                        <div className="form-group">
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px', textTransform: 'uppercase' }}>GSTIN Number</label>
                            <input name="gstin" value={formData.gstin} onChange={handleChange} type="text" placeholder="22AAAAA0000A1Z5" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }} />
                        </div>
                    </div>

                    <div className="modal-footer" style={{ borderTop: 'none', padding: '24px 0 0 0', gap: '12px', justifyContent: 'flex-end', display: 'flex' }}>
                        <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" style={{ fontWeight: '800' }}>SAVE CONTRACTOR</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddContractorModal;


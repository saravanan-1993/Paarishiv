import React, { useState } from 'react';
import { X, HardHat, User, MapPin, Wallet, Calendar, Plus, Info } from 'lucide-react';

const AddLabourModal = ({ isOpen, onClose, onLabourAdded }) => {
    const [categories, setCategories] = useState(['Mason', 'Helper', 'Bent-bar', 'Electrician', 'Plumber']);
    const [isAddingNewCat, setIsAddingNewCat] = useState(false);
    const [newCatName, setNewCatName] = useState('');

    const [formData, setFormData] = useState({
        name: '',
        category: '',
        site: '',
        wageRate: '',
        phone: '',
        idProof: '',
        joiningDate: new Date().toISOString().split('T')[0]
    });

    if (!isOpen) return null;

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name === 'category' && value === 'ADD_NEW') {
            setIsAddingNewCat(true);
            return;
        }
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleAddNewCategory = () => {
        if (newCatName.trim()) {
            setCategories([...categories, newCatName.trim()]);
            setFormData(prev => ({ ...prev, category: newCatName.trim() }));
            setNewCatName('');
            setIsAddingNewCat(false);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onLabourAdded({
            name: formData.name,
            cat: formData.category,
            site: formData.site,
            rate: `₹${formData.wageRate}`,
            ot: '0h',
            status: 'Working',
            ...formData
        });
        onClose();
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '550px', width: '95%' }}>
                <div className="modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', backgroundColor: '#fff7ed', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f97316' }}>
                            <HardHat size={20} />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '18px', fontWeight: '800' }}>ADD LABOURER</h3>
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Enroll a daily wage worker</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="modal-body" style={{ padding: '24px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
                        <div className="form-group">
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Full Name *</label>
                            <input name="name" required value={formData.name} onChange={handleChange} type="text" placeholder="Labourer Name" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }} />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            <div className="form-group">
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Category *</label>
                                {!isAddingNewCat ? (
                                    <select name="category" required value={formData.category} onChange={handleChange} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                        <option value="">Select category</option>
                                        {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                        <option value="ADD_NEW" style={{ fontWeight: 'bold', color: 'var(--primary)' }}>+ Add New Category</option>
                                    </select>
                                ) : (
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <input
                                            type="text"
                                            placeholder="Enter category"
                                            value={newCatName}
                                            onChange={(e) => setNewCatName(e.target.value)}
                                            style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid var(--primary)' }}
                                            autoFocus
                                        />
                                        <button type="button" onClick={handleAddNewCategory} className="btn btn-primary" style={{ padding: '0 12px' }}><Plus size={18} /></button>
                                        <button type="button" onClick={() => setIsAddingNewCat(false)} className="btn btn-outline" style={{ padding: '0 12px' }}><X size={18} /></button>
                                    </div>
                                )}
                            </div>
                            <div className="form-group">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                                    <label style={{ fontSize: '13px', fontWeight: '700' }}>Assigned Site *</label>
                                    <div className="tooltip-container" style={{ position: 'relative', cursor: 'help' }}>
                                        <Info size={14} style={{ color: 'var(--text-muted)' }} />
                                        <div style={{
                                            position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
                                            backgroundColor: '#1e293b', color: 'white', padding: '8px', borderRadius: '6px',
                                            fontSize: '11px', width: '200px', visibility: 'hidden', opacity: 0, transition: '0.2s', zIndex: 10
                                        }} className="tooltip">
                                            The physical construction site (Project) where this worker is currently posted.
                                        </div>
                                    </div>
                                </div>
                                <input name="site" required value={formData.site} onChange={handleChange} type="text" placeholder="e.g. Sky Tower Project" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }} />
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            <div className="form-group">
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Daily Wage Rate (₹) *</label>
                                <input name="wageRate" required value={formData.wageRate} onChange={handleChange} type="number" placeholder="per day" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }} />
                            </div>
                            <div className="form-group">
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Contact Number</label>
                                <input name="phone" value={formData.phone} onChange={handleChange} type="text" placeholder="Mobile" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }} />
                            </div>
                        </div>
                    </div>

                    <div className="modal-footer" style={{ borderTop: 'none', padding: '24px 0 0 0', gap: '12px', justifyContent: 'flex-end' }}>
                        <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" style={{ fontWeight: '800' }}>ADD LABOUR</button>
                    </div>
                </form>
            </div>
            <style>{`
                .form-group:hover .tooltip { visibility: visible !important; opacity: 1 !important; transform: translateX(-50%) translateY(-5px) !important; }
            `}</style>
        </div>
    );
};

export default AddLabourModal;

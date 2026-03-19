import React, { useState } from 'react';
import { X, ArrowRightLeft, Package, Truck, User, MapPin, Layers, Hash } from 'lucide-react';

const TransferModal = ({ isOpen, onClose, onTransferAdded, projects = [] }) => {
    // Combine Main Yard with actual projects
    const projectNames = ['Main Yard / Store', ...projects.map(p => p.name).filter(n => n !== 'Main Yard / Store')];

    // Simulated stock/fleet per site
    const siteInventory = {
        'Sky Tower Residence': {
            materials: ['Cement (OPC)', 'Steel Bars', 'Bricks'],
            equipment: ['JCB-001 Excavator', 'Mixer-04']
        },
        'Grand Mall Extension': {
            materials: ['Sand', 'Paint (White)', 'Tiles'],
            equipment: ['Crane-02', 'Truck-09']
        },
        'Main Yard / Store': {
            materials: ['Cement', 'Steel', 'Sand', 'Bricks', 'Electrical Cables'],
            equipment: ['Excavator-10', 'Backhoe-02', 'Mini Truck']
        },
        'Riverside Bridge': {
            materials: ['Gravel', 'Reinforcement Rails'],
            equipment: ['Drilling Rig']
        }
    };

    const [formData, setFormData] = useState({
        type: 'Material',
        item: '',
        from: '',
        to: '',
        qty: '',
        unit: 'Units',
        vehicle: '',
        driver: '',
        date: new Date().toISOString().split('T')[0]
    });

    if (!isOpen) return null;

    const getAvailableItems = () => {
        if (!formData.from) return [];
        const inv = siteInventory[formData.from];
        if (inv) {
            return formData.type === 'Material' ? inv.materials : inv.equipment;
        }
        // Fallback items if the project has no dummy entries defined yet
        return formData.type === 'Material'
            ? ['Cement', 'Steel Bars', 'Bricks', 'Sand', 'Tiles', 'Gravel', 'Paint']
            : ['Crane', 'Excavator', 'Backup Generator', 'Truck', 'Drilling Rig'];
    };
    const availableItems = getAvailableItems();

    const handleSubmit = (e) => {
        e.preventDefault();
        onTransferAdded({
            id: `TRF${Math.floor(Math.random() * 900) + 100}`,
            status: 'In Transit',
            ...formData,
            item: formData.type === 'Material' ? `${formData.qty} ${formData.unit} of ${formData.item}` : formData.item
        });
        onClose();
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '600px', width: '95%', paddingBottom: '0' }}>
                <div className="modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', backgroundColor: '#eff6ff', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>
                            <ArrowRightLeft size={20} />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '18px', fontWeight: '800' }}>INTER-SITE TRANSFER</h3>
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Move assets between sites intelligently</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="modal-body" style={{ padding: '24px 24px 12px 24px' }}>
                    {/* STEP 1: SITE SELECTION */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                        <div className="form-group">
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>From Site/Yard *</label>
                            <select required value={formData.from} onChange={(e) => setFormData({ ...formData, from: e.target.value, item: '' })}
                                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                <option value="">Select Source</option>
                                {projectNames.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>To Destination *</label>
                            <select required value={formData.to} onChange={(e) => setFormData({ ...formData, to: e.target.value })}
                                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                <option value="">Select Destination</option>
                                {projectNames.filter(p => p !== formData.from).map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* STEP 2: TRANSFER TYPE */}
                    <div className="form-group" style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Transfer Type *</label>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            {['Material', 'Equipment'].map(t => (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, type: t, item: '' })}
                                    style={{
                                        flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid var(--border)',
                                        backgroundColor: formData.type === t ? 'var(--primary)' : 'white',
                                        color: formData.type === t ? 'white' : 'var(--text-main)',
                                        fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                                    }}
                                >
                                    {t === 'Material' ? <Package size={16} /> : <Truck size={16} />}
                                    {t}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* STEP 3: ITEM SELECTION & QTY */}
                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Select {formData.type} *</label>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                            <div style={{ flex: formData.type === 'Material' ? 2 : 1 }}>
                                <select required value={formData.item} onChange={(e) => setFormData({ ...formData, item: e.target.value })}
                                    disabled={!formData.from}
                                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: !formData.from ? '#f8fafc' : 'white' }}>
                                    <option value="">{formData.from ? `Select Available ${formData.type}` : 'Please select a source site first'}</option>
                                    {availableItems.map(item => <option key={item} value={item}>{item}</option>)}
                                </select>
                            </div>

                            {formData.type === 'Material' && (
                                <>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ position: 'relative' }}>
                                            <Hash size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                            <input type="number" required placeholder="Qty" value={formData.qty} onChange={(e) => setFormData({ ...formData, qty: e.target.value })}
                                                style={{ width: '100%', padding: '12px 12px 12px 30px', borderRadius: '8px', border: '1px solid var(--border)' }} />
                                        </div>
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <select value={formData.unit} onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                                            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                            <option value="Bags">Bags</option>
                                            <option value="Tons">Tons</option>
                                            <option value="Units">Units</option>
                                            <option value="Trucks">Trucks</option>
                                            <option value="Litres">Litres</option>
                                        </select>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                        <div className="form-group">
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Vehicle Details *</label>
                            <input type="text" required placeholder="Truck No / Details" value={formData.vehicle} onChange={(e) => setFormData({ ...formData, vehicle: e.target.value })}
                                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }} />
                        </div>
                        <div className="form-group">
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Driver Name</label>
                            <input type="text" placeholder="Name" value={formData.driver} onChange={(e) => setFormData({ ...formData, driver: e.target.value })}
                                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }} />
                        </div>
                    </div>

                    <div className="modal-footer" style={{ borderTop: 'none', padding: '12px 0 20px 0', gap: '12px', justifyContent: 'flex-end' }}>
                        <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" style={{ fontWeight: '800' }}>INITIATE TRANSFER</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default TransferModal;

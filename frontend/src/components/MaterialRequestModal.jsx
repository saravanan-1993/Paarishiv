import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { projectAPI, materialAPI } from '../utils/api';
import CreateMaterialModal from './CreateMaterialModal';

const MaterialRequestModal = ({ isOpen, onClose }) => {
    const [items, setItems] = useState([{ name: '', quantity: '', unit: 'Bags' }]);
    const [projects, setProjects] = useState([]);
    const [materials, setMaterials] = useState([]);
    const [showMaterialModal, setShowMaterialModal] = useState(false);
    const [newMaterialRowId, setNewMaterialRowId] = useState(null);

    useEffect(() => {
        if (isOpen) {
            projectAPI.getAll().then(res => setProjects(res.data || [])).catch(() => { });
            materialAPI.getAll().then(res => setMaterials(res.data || [])).catch(() => { });
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const addItem = () => setItems([...items, { name: '', quantity: '', unit: 'Bags' }]);
    const removeItem = (idx) => setItems(items.filter((_, i) => i !== idx));
    const updateItem = (idx, field, val) => {
        const newItems = [...items];
        newItems[idx][field] = val;
        setItems(newItems);
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(4px)'
        }}>
            <div className="card animate-fade-in" style={{ width: '600px', backgroundColor: 'white', padding: '32px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <h2 style={{ fontSize: '20px' }}>Create Material Request</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={24} /></button>
                </div>

                <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600' }}>Project</label>
                    <select style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-main)' }}>
                        <option value="">Select Project</option>
                        {projects.map(p => <option key={p._id || p.id} value={p.name}>{p.name}</option>)}
                    </select>
                </div>

                <div style={{ marginBottom: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <label style={{ fontSize: '14px', fontWeight: '600' }}>Items Requested</label>
                        <button onClick={addItem} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: '600', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Plus size={16} /> Add More
                        </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {items.map((item, idx) => (
                            <div key={idx} style={{ display: 'flex', gap: '12px' }}>
                                <select
                                    style={{ flex: 2, padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'white' }}
                                    value={item.name}
                                    onChange={(e) => {
                                        if (e.target.value === '__add_new__') {
                                            setNewMaterialRowId(idx);
                                            setShowMaterialModal(true);
                                        } else {
                                            updateItem(idx, 'name', e.target.value);
                                            const selectedMaterial = materials.find(m => m.name === e.target.value);
                                            if (selectedMaterial) updateItem(idx, 'unit', selectedMaterial.unit);
                                        }
                                    }}
                                >
                                    <option value="">Select Material</option>
                                    {materials.map(m => <option key={m.id || m._id} value={m.name}>{m.name}</option>)}
                                    <option value="__add_new__" style={{ fontWeight: 'bold', color: 'var(--primary)' }}>+ Add New Material</option>
                                </select>
                                <input
                                    placeholder="Qty"
                                    type="number"
                                    style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}
                                    value={item.quantity}
                                    onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                                />
                                <select
                                    style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}
                                    value={item.unit}
                                    onChange={(e) => updateItem(idx, 'unit', e.target.value)}
                                >
                                    <option>Bags</option>
                                    <option>Tons</option>
                                    <option>Kg</option>
                                    <option>Grams</option>
                                    <option>Liters</option>
                                    <option>Meters</option>
                                    <option>Feet</option>
                                    <option>Sq.ft</option>
                                    <option>Cu.ft</option>
                                    <option>Cu.m</option>
                                    <option>Pieces</option>
                                    <option>Units</option>
                                    <option>Nos</option>
                                    <option>Boxes</option>
                                    <option>Bundles</option>
                                    <option>Trips</option>
                                    <option>Brass</option>
                                </select>
                                {items.length > 1 && (
                                    <button onClick={() => removeItem(idx)} style={{ color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 size={20} /></button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
                    <button className="btn btn-outline" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" style={{ flex: 2 }} onClick={onClose}>Submit Request</button>
                </div>
            </div>


            {showMaterialModal && (
                <CreateMaterialModal
                    isOpen={showMaterialModal}
                    onClose={() => {
                        setShowMaterialModal(false);
                        if (newMaterialRowId !== null) updateItem(newMaterialRowId, 'name', '');
                    }}
                    onSuccess={(newMat) => {
                        setMaterials(prev => [...prev, newMat]);
                        if (newMaterialRowId !== null) {
                            updateItem(newMaterialRowId, 'name', newMat.name);
                            updateItem(newMaterialRowId, 'unit', newMat.unit);
                        }
                        setShowMaterialModal(false);
                    }}
                />
            )}
        </div>
    );
};

export default MaterialRequestModal;

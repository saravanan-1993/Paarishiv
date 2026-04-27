import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Loader2 } from 'lucide-react';
import { projectAPI, materialAPI, inventoryAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import CreateMaterialModal from './CreateMaterialModal';

const MaterialRequestModal = ({ isOpen, onClose, onSuccess }) => {
    const { user } = useAuth();
    const [items, setItems] = useState([{ name: '', quantity: '', unit: 'Nos' }]);
    const [selectedProject, setSelectedProject] = useState('');
    const [priority, setPriority] = useState('Medium');
    const [projects, setProjects] = useState([]);
    const [materials, setMaterials] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showMaterialModal, setShowMaterialModal] = useState(false);
    const [newMaterialRowId, setNewMaterialRowId] = useState(null);

    // Derive unique units from materials master
    const availableUnits = React.useMemo(() => {
        const units = new Set(materials.map(m => m.unit).filter(Boolean));
        // Ensure common defaults exist
        ['Nos', 'Bags', 'Kg', 'Tons', 'Liters', 'Meters', 'Sq.ft', 'Cu.ft', 'Cu.m', 'Pieces', 'Units', 'Boxes', 'Bundles'].forEach(u => units.add(u));
        return [...units].sort();
    }, [materials]);

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

                <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                    <div style={{ flex: 2 }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600' }}>Project *</label>
                        <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-main)' }}>
                            <option value="">Select Project</option>
                            {projects.map(p => <option key={p._id || p.id} value={p.name}>{p.name}</option>)}
                        </select>
                    </div>
                    <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600' }}>Priority</label>
                        <select value={priority} onChange={e => setPriority(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-main)' }}>
                            <option>Low</option><option>Medium</option><option>High</option>
                        </select>
                    </div>
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
                                    {availableUnits.map(u => <option key={u} value={u}>{u}</option>)}
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
                    <button className="btn btn-primary" style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }} disabled={loading} onClick={async () => {
                        if (!selectedProject) { alert('Please select a project'); return; }
                        const validItems = items.filter(i => i.name && parseFloat(i.quantity) > 0);
                        if (validItems.length === 0) { alert('Add at least one item with name and quantity'); return; }
                        setLoading(true);
                        try {
                            const proj = projects.find(p => p.name === selectedProject);
                            await inventoryAPI.createRequest({
                                project_id: proj?._id || proj?.id || '',
                                project_name: selectedProject,
                                engineer_id: user?.name || user?.username || '',
                                requested_items: validItems.map(i => ({ name: i.name, quantity: parseFloat(i.quantity), unit: i.unit })),
                                priority,
                            });
                            setItems([{ name: '', quantity: '', unit: 'Nos' }]);
                            setSelectedProject('');
                            setPriority('Medium');
                            onSuccess?.();
                            onClose();
                        } catch (err) {
                            console.error('Failed to submit request:', err);
                            alert(err?.response?.data?.detail || 'Failed to submit material request');
                        } finally { setLoading(false); }
                    }}>
                        {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                        Submit Request
                    </button>
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

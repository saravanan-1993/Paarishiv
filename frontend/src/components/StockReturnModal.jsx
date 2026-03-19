import React, { useState, useEffect } from 'react';
import { X, ArrowDownLeft, Loader2, Briefcase, Package } from 'lucide-react';
import { projectAPI, materialAPI, inventoryAPI } from '../utils/api';
import PremiumSelect from './PremiumSelect';

const StockReturnModal = ({ isOpen, onClose, onSuccess }) => {
    const [isSaving, setIsSaving] = useState(false);
    const [projects, setProjects] = useState([]);
    const [projectInventory, setProjectInventory] = useState([]);
    const [loadingInventory, setLoadingInventory] = useState(false);

    const [formData, setFormData] = useState({
        project_id: '',
        material_name: '',
        quantity: 1
    });

    useEffect(() => {
        if (isOpen) {
            const load = async () => {
                const res = await projectAPI.getAll();
                setProjects(res.data || []);
            };
            load();
        }
    }, [isOpen]);

    useEffect(() => {
        if (formData.project_id) {
            const fetchInv = async () => {
                setLoadingInventory(true);
                try {
                    const proj = projects.find(p => (p._id || p.id) === formData.project_id);
                    const res = await materialAPI.getInventoryByProject(proj.name);
                    setProjectInventory(res.data || []);
                } catch (err) {
                    console.error('Fetch inv error:', err);
                } finally {
                    setLoadingInventory(false);
                }
            };
            fetchInv();
        }
    }, [formData.project_id, projects]);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        const proj = projects.find(p => (p._id || p.id) === formData.project_id);
        const invItem = projectInventory.find(i => i.material_name === formData.material_name);

        if (!proj || !invItem) return alert('Invalid selection');
        if (formData.quantity > invItem.stock) return alert(`Maximum available at site is ${invItem.stock}`);

        setIsSaving(true);
        try {
            await inventoryAPI.returnStock({
                project_name: proj.name,
                items: [{
                    material_name: formData.material_name, // Backend uses 'name' in items list?
                    name: formData.material_name,
                    quantity: Number(formData.quantity)
                }]
            });
            onSuccess();
        } catch (err) {
            console.error('Return error:', err);
            alert('Failed to process return');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="modal-overlay" style={{ zIndex: 1100, backgroundColor: 'rgba(0,0,0,0.6)' }}>
            <div className="modal-content animate-fade-in" style={{ maxWidth: '400px', width: '90%' }}>
                <div className="modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', backgroundColor: '#fef2f2', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626' }}>
                            <ArrowDownLeft size={20} />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '18px', fontWeight: '800' }}>Stock Return</h3>
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Return items from Site to Warehouse</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} /></button>
                </div>

                <form onSubmit={handleSubmit} className="modal-body" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Select Project (From) *</label>
                            <PremiumSelect
                                options={projects.map(p => ({ value: p._id || p.id, label: p.name }))}
                                value={formData.project_id}
                                onChange={(val) => setFormData({ ...formData, project_id: val, material_name: '' })}
                                icon={Briefcase}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Select Material *</label>
                            <PremiumSelect
                                options={projectInventory.map(i => ({ value: i.material_name, label: `${i.material_name} (Avail: ${i.stock} ${i.unit})` }))}
                                value={formData.material_name}
                                onChange={(val) => setFormData({ ...formData, material_name: val })}
                                icon={Package}
                                disabled={!formData.project_id || loadingInventory}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Quantity to Return *</label>
                            <input
                                type="number"
                                required
                                min="0.01"
                                step="any"
                                value={formData.quantity}
                                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}
                                disabled={!formData.material_name}
                            />
                        </div>
                    </div>

                    <div style={{ marginTop: '32px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                        <button type="button" onClick={onClose} className="btn btn-outline" style={{ fontWeight: '700' }}>Cancel</button>
                        <button type="submit" disabled={isSaving || !formData.material_name} className="btn btn-primary" style={{ fontWeight: '800' }}>
                            {isSaving ? <Loader2 size={18} className="animate-spin" /> : 'CONFIRM RETURN'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default StockReturnModal;

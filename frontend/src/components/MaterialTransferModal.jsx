import React, { useState, useEffect } from 'react';
import { X, ArrowRight, Loader2, Package, Search } from 'lucide-react';
import { projectAPI, inventoryAPI, materialAPI } from '../utils/api';

const MaterialTransferModal = ({ isOpen, onClose, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [projects, setProjects] = useState([]);
    const [allProjects, setAllProjects] = useState([]);
    const [fromProject, setFromProject] = useState('');
    const [toProject, setToProject] = useState('');
    const [availableItems, setAvailableItems] = useState([]);
    const [selectedItems, setSelectedItems] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (isOpen) {
            projectAPI.getAll().then(res => setProjects(res.data || []));
            projectAPI.getAll({ all: true }).then(res => setAllProjects(res.data || []));
            setFromProject('');
            setToProject('');
            setAvailableItems([]);
            setSelectedItems([]);
        }
    }, [isOpen]);

    useEffect(() => {
        if (fromProject) {
            setAvailableItems([]);
            materialAPI.getInventoryByProject(fromProject).then(res => {
                const availableStock = (res.data || []).filter(item => item.stock > 0);
                setAvailableItems(availableStock);
            }).catch(err => {
                console.error("Failed to fetch project inventory", err);
            });
        } else {
            setAvailableItems([]);
        }
    }, [fromProject]);

    const handleAddItem = (item) => {
        if (selectedItems.find(i => i.name === item.material_name)) return;
        setSelectedItems([...selectedItems, {
            name: item.material_name,
            qty: 0,
            maxQty: item.stock,
            unit: item.unit || 'Nos',
        }]);
    };

    const handleItemChange = (index, field, value) => {
        const newItems = [...selectedItems];
        newItems[index][field] = value;
        setSelectedItems(newItems);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!fromProject || !toProject || selectedItems.length === 0) {
            alert('Please fill all details');
            return;
        }
        if (fromProject === toProject) {
            alert('Source and Destination projects cannot be the same');
            return;
        }

        setLoading(true);
        try {
            await inventoryAPI.requestTransfer({
                from_project: fromProject,
                to_project: toProject,
                items: selectedItems.map(it => ({
                    ...it,
                    quantity: parseFloat(it.qty)
                }))
            });
            alert('Transfer request submitted for Coordinator approval.');
            if (onSuccess) onSuccess();
            onClose();
        } catch (err) {
            console.error('Transfer failed:', err);
            alert('Failed to submit transfer request.');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const filteredItems = availableItems.filter(i =>
        i.material_name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="modal-overlay" style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)'
        }}>
            <form onSubmit={handleSubmit} className="modal-container animate-fade-in" style={{
                backgroundColor: 'white', width: '100%', maxWidth: '800px',
                borderRadius: '12px', display: 'flex', flexDirection: 'column', maxHeight: '90vh'
            }}>
                <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ padding: '10px', backgroundColor: '#eff6ff', borderRadius: '8px', color: '#3b82f6' }}>
                            <Package size={20} />
                        </div>
                        <h2 style={{ fontSize: '18px', fontWeight: '700' }}>Site to Site Material Transfer</h2>
                    </div>
                    <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} /></button>
                </div>

                <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', gap: '24px' }}>
                    {/* Left: Selection */}
                    <div style={{ flex: 1 }}>
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px' }}>From Project (Source)</label>
                            <select required value={fromProject} onChange={(e) => setFromProject(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                <option value="">-- Select Source --</option>
                                {projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                            </select>
                        </div>

                        <div style={{ textAlign: 'center', margin: '12px 0', color: 'var(--text-muted)' }}>
                            <ArrowRight size={20} />
                        </div>

                        <div style={{ marginBottom: '24px' }}>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px' }}>To Project (Destination)</label>
                            <select required value={toProject} onChange={(e) => setToProject(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                <option value="">-- Select Destination --</option>
                                {allProjects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                            </select>
                        </div>

                        <div style={{ position: 'relative', marginBottom: '12px' }}>
                            <Search size={16} style={{ position: 'absolute', left: '12px', top: '52%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input
                                placeholder="Search materials..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '14px' }}
                            />
                        </div>
                        <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px' }}>
                            {filteredItems.length > 0 ? (
                                filteredItems.map(item => (
                                    <div key={item.id} onClick={() => handleAddItem(item)} style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', borderRadius: '4px', hover: { backgroundColor: '#f8fafc' } }} className="hover-item">
                                        <span style={{ fontSize: '14px', fontWeight: '500' }}>{item.material_name}</span>
                                        <span style={{ fontSize: '12px', fontWeight: '800', color: '#10b981', background: '#dcfce7', padding: '2px 6px', borderRadius: '4px' }}>
                                            {item.stock} {item.unit}
                                        </span>
                                    </div>
                                ))
                            ) : (
                                <div style={{ padding: '20px', textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)' }}>
                                    {!fromProject ? 'Please select a Source Project to view available stock' : 'No stock available to transfer from this project'}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: Transfer List */}
                    <div style={{ flex: 1.5, backgroundColor: '#f8fafc', padding: '20px', borderRadius: '12px' }}>
                        <h3 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            Transfer List ({selectedItems.length})
                        </h3>
                        {selectedItems.map((item, idx) => (
                            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 40px', gap: '12px', marginBottom: '12px', alignItems: 'center' }}>
                                <div style={{ fontSize: '14px', fontWeight: '600' }}>
                                    {item.name}
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '400' }}>Max: {item.maxQty} {item.unit}</div>
                                </div>
                                <input
                                    type="number"
                                    placeholder="Qty"
                                    min="0"
                                    max={item.maxQty}
                                    value={item.qty}
                                    onChange={(e) => {
                                        let val = parseFloat(e.target.value);
                                        if (isNaN(val)) val = '';
                                        else if (val > item.maxQty) val = item.maxQty;
                                        else if (val < 0) val = 0;
                                        handleItemChange(idx, 'qty', val);
                                    }}
                                    style={{ padding: '6px', border: '1px solid var(--border)', borderRadius: '4px', width: '100%' }}
                                />
                                <button type="button" onClick={() => setSelectedItems(selectedItems.filter((_, i) => i !== idx))} style={{ color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer' }}><X size={16} /></button>
                            </div>
                        ))}
                        {selectedItems.length === 0 && <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '14px' }}>Select items from the left to transfer</div>}
                    </div>
                </div>

                <div style={{ padding: '20px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
                    <button type="submit" disabled={loading || selectedItems.length === 0} className="btn btn-primary">
                        {loading ? <Loader2 size={16} className="animate-spin" /> : 'SUBMIT TRANSFER REQUEST'}
                    </button>
                </div>
            </form>
            <style>{`.hover-item:hover { background-color: #f1f5f9; }`}</style>
        </div>
    );
};

export default MaterialTransferModal;

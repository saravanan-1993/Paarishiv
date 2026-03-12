import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, ShoppingCart, Calendar, Building2, IndianRupee, Loader2, ChevronDown, Check } from 'lucide-react';
import { projectAPI, vendorAPI, purchaseOrderAPI, materialAPI, inventoryAPI } from '../utils/api';
import CreateMaterialModal from './CreateMaterialModal';

const POModal = ({ isOpen, onClose, onSuccess }) => {
    const [isSaving, setIsSaving] = useState(false);
    const [vendors, setVendors] = useState([]);
    const [projects, setProjects] = useState([]);
    const [materials, setMaterials] = useState([]);
    const [formData, setFormData] = useState({
        vendor_name: '',
        project_name: '',
        expected_delivery: '',
        notes: '',
        request_id: '',
        is_direct: true
    });
    const [approvedRequests, setApprovedRequests] = useState([]);
    const [consolidatedRequests, setConsolidatedRequests] = useState([]);
    const [items, setItems] = useState([{ id: Date.now(), name: '', qty: '', unit: 'Nos', rate: '' }]);
    const [showMaterialModal, setShowMaterialModal] = useState(false);
    const [newMaterialRowId, setNewMaterialRowId] = useState(null);

    // Custom dropdown states
    const [isVendorDropdownOpen, setIsVendorDropdownOpen] = useState(false);
    const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);

    useEffect(() => {
        if (isOpen) {
            projectAPI.getAll().then(res => setProjects(res.data || [])).catch(() => { });
            vendorAPI.getAll().then(res => setVendors(res.data || [])).catch(() => { });
            materialAPI.getAll().then(res => setMaterials(res.data || [])).catch(() => { });

            // Fetch approved requests
            inventoryAPI.getRequests().then(res => {
                const approved = (res.data || []).filter(r => r.status === 'Approved');
                setApprovedRequests(approved);
            }).catch(() => { });

            // Fetch consolidated requests
            inventoryAPI.getConsolidated().then(res => {
                const pending = (res.data || []).filter(r => r.status === 'Consolidated');
                setConsolidatedRequests(pending);
            }).catch(() => { });
        }
    }, [isOpen]);

    const handleRequestSelect = (requestId) => {
        const req = approvedRequests.find(r => r.id === requestId);
        if (req) {
            setFormData({
                ...formData,
                project_name: req.project_name,
                request_id: req.id,
                is_consolidated: false,
                is_direct: false
            });
            setItems(req.requested_items.map(it => ({
                id: Date.now() + Math.random(),
                name: it.name,
                qty: it.quantity,
                unit: it.unit,
                rate: ''
            })));
        }
    };

    const handleConsolidatedSelect = (conId) => {
        const con = consolidatedRequests.find(c => c.id === conId);
        if (con) {
            setFormData({
                ...formData,
                project_name: con.sites.length > 1 ? 'Multiple Sites (Bulk Purchase)' : con.sites[0],
                request_id: con.id,
                is_consolidated: true,
                is_direct: false,
                notes: `Consolidated from: ${con.sites.join(', ')}`
            });
            setItems(con.items.map(it => ({
                id: Date.now() + Math.random(),
                name: it.name,
                qty: it.quantity,
                unit: it.unit,
                site_quantities: it.site_quantities || null,
                rate: ''
            })));
        }
    };

    const addItem = () => {
        setItems([...items, { id: Date.now(), name: '', qty: '', unit: 'Nos', rate: '' }]);
    };

    const removeItem = (id) => {
        if (items.length > 1) {
            setItems(items.filter(item => item.id !== id));
        }
    };

    const handleItemChange = (id, field, value) => {
        setItems(items.map(item => {
            if (item.id === id) {
                const updatedItem = { ...item, [field]: value };
                // If material name is changed, automatically update the unit
                if (field === 'name') {
                    const selectedMaterial = materials.find(m => m.name === value);
                    if (selectedMaterial) {
                        updatedItem.unit = selectedMaterial.unit;
                    }
                }
                return updatedItem;
            }
            return item;
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.vendor_name || !formData.project_name || !formData.expected_delivery) {
            alert('Please fill all required fields');
            return;
        }

        setIsSaving(true);
        try {
            const total_amount = items.reduce((sum, item) => sum + (parseFloat(item.qty || 0) * parseFloat(item.rate || 0)), 0);
            await purchaseOrderAPI.create({
                ...formData,
                items: items.map(({ id, ...rest }) => ({
                    ...rest,
                    qty: parseFloat(rest.qty || 0),
                    rate: rest.rate === '' ? null : parseFloat(rest.rate)
                })),
                total_amount: total_amount || 0,
                status: 'Pending'
            });
            if (onSuccess) onSuccess();
            onClose();
        } catch (err) {
            console.error('Failed to create PO:', err);
            alert('Failed to save purchase order.');
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)'
        }}>
            <form onSubmit={handleSubmit} className="modal-container animate-fade-in" style={{
                backgroundColor: 'white', width: '100%', maxWidth: '900px',
                borderRadius: '12px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                display: 'flex', flexDirection: 'column', maxHeight: '90vh'
            }}>
                {/* Header */}
                <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ padding: '10px', backgroundColor: 'var(--bg-main)', borderRadius: '8px', color: 'var(--primary)' }}>
                            <ShoppingCart size={20} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '18px', fontWeight: '700' }}>
                                Create Purchase Order {formData.is_direct && <span style={{ fontSize: '10px', backgroundColor: '#FEF3C7', color: '#D97706', padding: '2px 8px', borderRadius: '4px', verticalAlign: 'middle', marginLeft: '8px' }}>DIRECT ENTRY</span>}
                            </h2>
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                {formData.is_direct ? 'Manual procurement entry without site request' : 'Generate procurement request from site requirements'}
                            </p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                        <X size={24} />
                    </button>
                </div>

                {/* Body */}
                <div style={{ padding: '24px', overflowY: 'auto' }}>

                    {/* Approved Requests Selection */}
                    {(approvedRequests.length > 0 || consolidatedRequests.length > 0) && (
                        <div style={{ marginBottom: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            {approvedRequests.length > 0 && (
                                <div style={{ padding: '16px', backgroundColor: '#f0f9ff', borderRadius: '12px', border: '1px solid #bae6fd' }}>
                                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#0369a1', marginBottom: '8px', textTransform: 'uppercase' }}>Individual Site Request</label>
                                    <select
                                        onChange={(e) => handleRequestSelect(e.target.value)}
                                        value={!formData.is_consolidated ? formData.request_id : ''}
                                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #bae6fd', fontSize: '14px' }}
                                    >
                                        <option value="">-- Select Site Request --</option>
                                        {approvedRequests.map(r => (
                                            <option key={r.id} value={r.id}>{r.project_name} ({r.engineer_id})</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            {consolidatedRequests.length > 0 && (
                                <div style={{ padding: '16px', backgroundColor: '#f5f3ff', borderRadius: '12px', border: '1px solid #ddd6fe' }}>
                                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#5b21b6', marginBottom: '8px', textTransform: 'uppercase' }}>Consolidated Bulk Request</label>
                                    <select
                                        onChange={(e) => handleConsolidatedSelect(e.target.value)}
                                        value={formData.is_consolidated ? formData.request_id : ''}
                                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd6fe', fontSize: '14px' }}
                                    >
                                        <option value="">-- Select Consolidated --</option>
                                        {consolidatedRequests.map(c => (
                                            <option key={c.id} value={c.id}>#CON-{c.id.slice(-6).toUpperCase()} ({c.sites.length} Sites)</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '32px' }}>
                        <div style={{ position: 'relative' }}>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Select Vendor*</label>
                            <Building2 size={16} style={{ position: 'absolute', left: '12px', top: '40px', color: 'var(--text-muted)' }} />
                            <div
                                onClick={() => { setIsVendorDropdownOpen(!isVendorDropdownOpen); setIsProjectDropdownOpen(false); }}
                                style={{
                                    width: '100%', padding: '10px 12px 10px 36px', borderRadius: '8px',
                                    border: '1px solid ' + (isVendorDropdownOpen ? 'var(--primary)' : 'var(--border)'),
                                    backgroundColor: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    color: formData.vendor_name ? 'var(--text-main)' : 'var(--text-muted)',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <span style={{ fontWeight: formData.vendor_name ? '600' : '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {formData.vendor_name || 'Choose a vendor...'}
                                </span>
                                <ChevronDown size={16} />
                            </div>

                            {isVendorDropdownOpen && (
                                <>
                                    <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setIsVendorDropdownOpen(false)}></div>
                                    <div className="animate-fade-in" style={{
                                        position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '8px',
                                        backgroundColor: 'white', border: '1px solid var(--border)', borderRadius: '12px',
                                        boxShadow: '0 10px 25px rgba(0,0,0,0.1)', zIndex: 50, maxHeight: '220px', overflowY: 'auto'
                                    }}>
                                        {vendors.length === 0 && <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>No vendors found</div>}
                                        {vendors.map((v, idx) => (
                                            <div
                                                key={v.id}
                                                onClick={() => { setFormData({ ...formData, vendor_name: v.name }); setIsVendorDropdownOpen(false); }}
                                                style={{
                                                    padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                    borderBottom: idx === vendors.length - 1 ? 'none' : '1px solid #f1f5f9',
                                                    backgroundColor: formData.vendor_name === v.name ? '#f8fafc' : 'white',
                                                    transition: 'all 0.1s'
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = formData.vendor_name === v.name ? '#f8fafc' : 'white'}
                                            >
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <span style={{ fontWeight: formData.vendor_name === v.name ? '700' : '600', color: formData.vendor_name === v.name ? 'var(--primary)' : 'var(--text-main)', fontSize: '14px' }}>{v.name}</span>
                                                </div>
                                                {formData.vendor_name === v.name && <Check size={16} color="var(--primary)" />}
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                        <div style={{ position: 'relative' }}>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Project Site / Selection*</label>
                            <div
                                onClick={() => { setIsProjectDropdownOpen(!isProjectDropdownOpen); setIsVendorDropdownOpen(false); }}
                                style={{
                                    width: '100%', padding: '10px 12px', borderRadius: '8px',
                                    border: '1px solid ' + (isProjectDropdownOpen ? 'var(--primary)' : 'var(--border)'),
                                    backgroundColor: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    color: formData.project_name ? 'var(--text-main)' : 'var(--text-muted)',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <span style={{ fontWeight: formData.project_name ? '600' : '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {formData.project_name || 'Select a project...'}
                                </span>
                                <ChevronDown size={16} />
                            </div>

                            {isProjectDropdownOpen && (
                                <>
                                    <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setIsProjectDropdownOpen(false)}></div>
                                    <div className="animate-fade-in" style={{
                                        position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '8px',
                                        backgroundColor: 'white', border: '1px solid var(--border)', borderRadius: '12px',
                                        boxShadow: '0 10px 25px rgba(0,0,0,0.1)', zIndex: 50, maxHeight: '220px', overflowY: 'auto'
                                    }}>
                                        {projects.length === 0 && <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>No projects found</div>}
                                        {projects.map((p, idx) => (
                                            <div
                                                key={p._id || p.id}
                                                onClick={() => { setFormData({ ...formData, project_name: p.name }); setIsProjectDropdownOpen(false); }}
                                                style={{
                                                    padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                    borderBottom: idx === projects.length - 1 ? 'none' : '1px solid #f1f5f9',
                                                    backgroundColor: formData.project_name === p.name ? '#f8fafc' : 'white',
                                                    transition: 'all 0.1s'
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = formData.project_name === p.name ? '#f8fafc' : 'white'}
                                            >
                                                <span style={{ fontWeight: formData.project_name === p.name ? '700' : '600', color: formData.project_name === p.name ? 'var(--primary)' : 'var(--text-main)', fontSize: '14px' }}>{p.name}</span>
                                                {formData.project_name === p.name && <Check size={16} color="var(--primary)" />}
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Expected Delivery*</label>
                            <div style={{ position: 'relative' }}>
                                <Calendar size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input
                                    required
                                    type="date"
                                    value={formData.expected_delivery}
                                    onChange={(e) => setFormData({ ...formData, expected_delivery: e.target.value })}
                                    style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: '8px', border: '1px solid var(--border)' }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Items Table */}
                    <div style={{ marginBottom: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h3 style={{ fontSize: '15px', fontWeight: '700' }}>Material Items</h3>
                            <button type="button" onClick={addItem} className="btn btn-outline btn-sm" style={{ padding: '6px 12px', fontSize: '12px' }}>
                                <Plus size={14} /> Add Item
                            </button>
                        </div>
                        <table className="data-table" style={{ border: '1px solid var(--border)' }}>
                            <thead style={{ backgroundColor: '#f8fafc' }}>
                                <tr>
                                    <th style={{ width: '40%' }}>Material Name</th>
                                    <th>Quantity</th>
                                    <th>Unit</th>
                                    <th>Rate (₹)</th>
                                    <th>Subtotal (₹)</th>
                                    <th style={{ width: '50px' }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item, index) => (
                                    <tr key={item.id}>
                                        <td>
                                            <select
                                                required
                                                value={item.name}
                                                onChange={(e) => {
                                                    if (e.target.value === '__add_new__') {
                                                        setNewMaterialRowId(item.id);
                                                        setShowMaterialModal(true);
                                                    } else {
                                                        handleItemChange(item.id, 'name', e.target.value);
                                                    }
                                                }}
                                                style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', padding: '4px' }}
                                            >
                                                <option value="">Select Material</option>
                                                {materials.map(m => (
                                                    <option key={m.id || m._id} value={m.name}>{m.name}</option>
                                                ))}
                                                <option value="__add_new__" style={{ fontWeight: 'bold', color: 'var(--primary)' }}>+ Add New Material</option>
                                            </select>
                                            {item.site_quantities && (
                                                <div style={{ marginTop: '8px', padding: '6px', backgroundColor: '#f8fafc', borderRadius: '4px', border: '1px dashed #cbd5e1' }}>
                                                    <div style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '4px' }}>SITE ALLOCATION</div>
                                                    {Object.entries(item.site_quantities).map(([site, qty]) => (
                                                        <div key={site} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-main)' }}>
                                                            <span>{site}</span>
                                                            <span style={{ fontWeight: '600' }}>{qty} {item.unit}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </td>
                                        <td>
                                            <input
                                                required
                                                type="number"
                                                placeholder="0"
                                                value={item.qty}
                                                onChange={(e) => handleItemChange(item.id, 'qty', e.target.value)}
                                                style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none' }}
                                            />
                                        </td>
                                        <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                                            {item.unit}
                                        </td>
                                        <td>
                                            <input
                                                type="number"
                                                placeholder="0.00"
                                                value={item.rate}
                                                onChange={(e) => handleItemChange(item.id, 'rate', e.target.value)}
                                                style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none' }}
                                            />
                                        </td>
                                        <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--primary)', paddingRight: '10px' }}>
                                            ₹{((parseFloat(item.qty || 0) * parseFloat(item.rate || 0))).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td>
                                            {items.length > 1 && (
                                                <button type="button" onClick={() => removeItem(item.id)} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer' }}>
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px', borderTop: '2px solid var(--border)', paddingTop: '16px' }}>
                        <div style={{ textAlign: 'right' }}>
                            <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Grand Total</p>
                            <h3 style={{ fontSize: '24px', fontWeight: '900', color: 'var(--primary)' }}>
                                ₹{items.reduce((sum, item) => sum + (parseFloat(item.qty || 0) * parseFloat(item.rate || 0)), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </h3>
                        </div>
                    </div>

                    <div style={{ marginTop: '24px' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Purchase Notes / Instructions</label>
                        <textarea
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            placeholder="Any special instructions for the vendor..."
                            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', minHeight: '80px', fontFamily: 'inherit' }}
                        ></textarea>
                    </div>
                </div>

                {/* Footer */}
                <div style={{ padding: '20px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '12px', backgroundColor: '#f8fafc', borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px' }}>
                    <button type="button" className="btn btn-outline" onClick={onClose} style={{ padding: '10px 24px' }}>Cancel</button>
                    <button type="submit" disabled={isSaving} className="btn btn-primary" style={{ padding: '10px 32px' }}>
                        {isSaving ? <Loader2 size={16} className="animate-spin" /> : 'Submit for Approval'}
                    </button>
                </div>
            </form>

            {showMaterialModal && (
                <CreateMaterialModal
                    isOpen={showMaterialModal}
                    onClose={() => {
                        setShowMaterialModal(false);
                        // Reset the dropdown value if they cancelled creating material
                        if (newMaterialRowId) {
                            handleItemChange(newMaterialRowId, 'name', '');
                        }
                    }}
                    onSuccess={(newMat) => {
                        setMaterials(prev => [...prev, newMat]);
                        if (newMaterialRowId) {
                            // Update this item's material and unit
                            handleItemChange(newMaterialRowId, 'name', newMat.name);
                            handleItemChange(newMaterialRowId, 'unit', newMat.unit);
                        }
                        setShowMaterialModal(false);
                    }}
                />
            )}
        </div>
    );
};

export default POModal;

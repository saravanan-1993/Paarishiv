import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, ShoppingCart, Calendar, Building2, IndianRupee, Loader2, ChevronDown, Check, Users, User } from 'lucide-react';
import { projectAPI, vendorAPI, purchaseOrderAPI, materialAPI, inventoryAPI } from '../utils/api';
import CreateMaterialModal from './CreateMaterialModal';
import CustomSelect from './CustomSelect';

const POModal = ({ isOpen, onClose, onSuccess, requestId: requestIdProp }) => {
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
    const [items, setItems] = useState([{ id: Date.now(), name: '', qty: '', unit: 'Nos', rate: '', vendor_name: '' }]);
    const [showMaterialModal, setShowMaterialModal] = useState(false);
    const [newMaterialRowId, setNewMaterialRowId] = useState(null);

    // Multi-vendor mode toggle
    const [isMultiVendor, setIsMultiVendor] = useState(false);

    // Warehouse stock info (read-only)
    const [warehouseStock, setWarehouseStock] = useState({});

    const checkWarehouseForItems = async (itemsList) => {
        try {
            const names = itemsList.map(it => it.name).filter(Boolean);
            if (!names.length) return;
            const res = await inventoryAPI.checkWarehouseAvailability({ material_names: names });
            const whData = res.data || {};
            setWarehouseStock(whData);
            // Auto-fill rate from last purchase if item has no rate
            const updatedItems = itemsList.map(it => {
                const wh = whData[it.name];
                if (wh?.last_rate > 0 && (!it.rate || it.rate === '' || parseFloat(it.rate) === 0)) {
                    return { ...it, rate: wh.last_rate };
                }
                return it;
            });
            setItems(updatedItems);
        } catch (err) {
            console.warn('Warehouse check failed:', err);
        }
    };

    useEffect(() => {
        if (isOpen) {
            projectAPI.getAll().then(res => setProjects(res.data || [])).catch(() => { });
            vendorAPI.getAll().then(res => setVendors(res.data || [])).catch(() => { });
            materialAPI.getAll().then(res => setMaterials(res.data || [])).catch(() => { });

            // Fetch approved requests
            inventoryAPI.getRequests().then(res => {
                const approved = (res.data || []).filter(r => r.status === 'Approved');
                setApprovedRequests(approved);
                if (requestIdProp) {
                    const match = approved.find(r => r.id === requestIdProp);
                    if (match) {
                        handleRequestSelect(requestIdProp);
                    }
                }
            }).catch(() => { });

            // Fetch consolidated requests
            inventoryAPI.getConsolidated().then(res => {
                const pending = (res.data || []).filter(r => r.status === 'Consolidated');
                setConsolidatedRequests(pending);
                if (requestIdProp && !approvedRequests.find(r => r.id === requestIdProp)) {
                    const match = pending.find(r => r.id === requestIdProp);
                    if (match) handleConsolidatedSelect(requestIdProp);
                }
            }).catch(() => { });
        }
    }, [isOpen, requestIdProp]);

    // When switching to multi-vendor mode, copy top-level vendor to all items that don't have one
    const toggleMultiVendor = () => {
        if (!isMultiVendor) {
            // Switching TO multi-vendor: propagate current vendor_name to items without one
            if (formData.vendor_name) {
                setItems(prev => prev.map(item => ({
                    ...item,
                    vendor_name: item.vendor_name || formData.vendor_name
                })));
            }
        } else {
            // Switching back to single vendor: take the first item's vendor as the global one
            const firstVendor = items.find(it => it.vendor_name)?.vendor_name || formData.vendor_name;
            setFormData(prev => ({ ...prev, vendor_name: firstVendor }));
        }
        setIsMultiVendor(!isMultiVendor);
    };

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
            const newItems = req.requested_items.map(it => ({
                id: Date.now() + Math.random(),
                name: it.name,
                qty: it.quantity,
                unit: it.unit,
                rate: '',
                vendor_name: ''
            }));
            setItems(newItems);
            checkWarehouseForItems(newItems);
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
            const newItems = con.items.map(it => ({
                id: Date.now() + Math.random(),
                name: it.name,
                qty: it.quantity,
                unit: it.unit,
                site_quantities: it.site_quantities || null,
                rate: '',
                vendor_name: ''
            }));
            setItems(newItems);
            checkWarehouseForItems(newItems);
        }
    };

    const addItem = () => {
        setItems([...items, { id: Date.now(), name: '', qty: '', unit: 'Nos', rate: '', vendor_name: isMultiVendor ? '' : formData.vendor_name }]);
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

    // Apply a single vendor to all items (bulk assign)
    const applyVendorToAll = (vendorName) => {
        setItems(items.map(item => ({ ...item, vendor_name: vendorName })));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.project_name || !formData.expected_delivery) {
            alert('Please fill all required fields');
            return;
        }

        // Validate vendor assignment
        if (isMultiVendor) {
            const unassigned = items.filter(i => i.name && parseFloat(i.qty) > 0 && !i.vendor_name);
            if (unassigned.length > 0) {
                alert(`Please assign a vendor to all items. ${unassigned.length} item(s) have no vendor assigned.`);
                return;
            }
        } else if (!formData.vendor_name) {
            alert('Please select a vendor');
            return;
        }

        const validItems = items.filter(i => i.name && parseFloat(i.qty) > 0);
        if (validItems.length === 0) {
            alert('Please add at least one item with name and quantity');
            return;
        }

        setIsSaving(true);
        try {
            const total_amount = items.reduce((sum, item) => sum + (parseFloat(item.qty || 0) * parseFloat(item.rate || 0)), 0);
            const submitItems = items.map(({ id, ...rest }) => ({
                ...rest,
                qty: parseFloat(rest.qty || 0),
                rate: rest.rate === '' ? null : parseFloat(rest.rate),
                vendor_name: isMultiVendor ? rest.vendor_name : (formData.vendor_name || null)
            }));

            await purchaseOrderAPI.create({
                ...formData,
                vendor_name: isMultiVendor ? '' : formData.vendor_name,
                items: submitItems,
                total_amount: total_amount || 0,
                status: 'Pending',
                is_multi_vendor: isMultiVendor
            });
            alert('Purchase order created successfully.');
            if (onSuccess) onSuccess();
            onClose();
        } catch (err) {
            console.error('Failed to create PO:', err);
            alert(err.response?.data?.detail || 'Failed to save purchase order.');
        } finally {
            setIsSaving(false);
        }
    };

    // Group items by vendor for the summary section
    const getVendorSummary = () => {
        const groups = {};
        items.forEach(item => {
            if (!item.name || !parseFloat(item.qty)) return;
            const vn = item.vendor_name || 'Unassigned';
            if (!groups[vn]) groups[vn] = { items: 0, total: 0 };
            groups[vn].items += 1;
            groups[vn].total += (parseFloat(item.qty || 0) * parseFloat(item.rate || 0));
        });
        return groups;
    };

    if (!isOpen) return null;

    const vendorSummary = isMultiVendor ? getVendorSummary() : null;

    return (
        <div className="modal-overlay">
            <form onSubmit={handleSubmit} className="card animate-fade-in" style={{
                width: '95%', maxWidth: '1050px', maxHeight: '90vh',
                display: 'flex', flexDirection: 'column', padding: 0
            }}>
                {/* Header */}
                <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ padding: '10px', backgroundColor: 'var(--bg-main)', borderRadius: '8px', color: 'var(--primary)' }}>
                            <ShoppingCart size={20} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '18px', fontWeight: '700' }}>
                                Create Purchase Order
                                {formData.is_direct && <span style={{ fontSize: '10px', backgroundColor: '#FEF3C7', color: '#D97706', padding: '2px 8px', borderRadius: '4px', verticalAlign: 'middle', marginLeft: '8px' }}>DIRECT ENTRY</span>}
                                {isMultiVendor && <span style={{ fontSize: '10px', backgroundColor: '#DBEAFE', color: '#1D4ED8', padding: '2px 8px', borderRadius: '4px', verticalAlign: 'middle', marginLeft: '8px' }}>MULTI-VENDOR</span>}
                            </h2>
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                {isMultiVendor
                                    ? 'Assign different vendors to each material item'
                                    : formData.is_direct ? 'Manual procurement entry without site request' : 'Generate procurement request from site requirements'}
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

                    {/* Multi-Vendor Toggle */}
                    <div style={{
                        marginBottom: '20px', padding: '12px 16px', backgroundColor: isMultiVendor ? '#EFF6FF' : '#F8FAFC',
                        borderRadius: '10px', border: `1px solid ${isMultiVendor ? '#BFDBFE' : 'var(--border)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {isMultiVendor ? <Users size={18} style={{ color: '#1D4ED8' }} /> : <User size={18} style={{ color: 'var(--text-muted)' }} />}
                            <div>
                                <p style={{ fontSize: '13px', fontWeight: '600', color: isMultiVendor ? '#1D4ED8' : 'var(--text-main)' }}>
                                    {isMultiVendor ? 'Multi-Vendor Mode' : 'Single Vendor Mode'}
                                </p>
                                <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                    {isMultiVendor ? 'Each item can be assigned to a different vendor' : 'All items will be ordered from one vendor'}
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={toggleMultiVendor}
                            style={{
                                padding: '6px 16px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                                border: `1px solid ${isMultiVendor ? '#1D4ED8' : 'var(--border)'}`,
                                backgroundColor: isMultiVendor ? '#1D4ED8' : 'white',
                                color: isMultiVendor ? 'white' : 'var(--text-main)',
                            }}
                        >
                            {isMultiVendor ? 'Switch to Single Vendor' : 'Enable Multi-Vendor'}
                        </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: isMultiVendor ? '1fr 1fr' : 'repeat(3, 1fr)', gap: '20px', marginBottom: '32px' }}>
                        {/* Show single vendor selector only in single-vendor mode */}
                        {!isMultiVendor && (
                            <div>
                                <CustomSelect
                                    label="Select Vendor*"
                                    options={vendors.map(v => ({ value: v.name, label: v.name }))}
                                    value={formData.vendor_name}
                                    onChange={val => setFormData({ ...formData, vendor_name: val })}
                                    placeholder="Choose a vendor..."
                                    icon={Building2}
                                    width="full"
                                    searchable={true}
                                />
                            </div>
                        )}
                        <div>
                            <CustomSelect
                                label="Project Site*"
                                options={[
                                    { value: 'Warehouse', label: 'Warehouse' },
                                    ...projects.map(p => ({ value: p.name, label: p.name }))
                                ]}
                                value={formData.project_name}
                                onChange={val => setFormData({ ...formData, project_name: val })}
                                placeholder="Select a project..."
                                width="full"
                                searchable={true}
                            />
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

                    {/* Bulk vendor assign for multi-vendor mode */}
                    {isMultiVendor && (
                        <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>Quick assign to all:</span>
                            <select
                                onChange={(e) => { if (e.target.value) applyVendorToAll(e.target.value); e.target.value = ''; }}
                                style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '12px' }}
                            >
                                <option value="">-- Apply vendor to all items --</option>
                                {vendors.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
                            </select>
                        </div>
                    )}

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
                                    <th style={{ width: isMultiVendor ? '22%' : '30%' }}>Material Name</th>
                                    {isMultiVendor && <th style={{ width: '20%' }}>Vendor</th>}
                                    <th>Qty</th>
                                    <th>Unit</th>
                                    <th>Warehouse</th>
                                    <th>Rate ({'\u20B9'})</th>
                                    <th>Subtotal ({'\u20B9'})</th>
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
                                        {isMultiVendor && (
                                            <td>
                                                <select
                                                    required
                                                    value={item.vendor_name}
                                                    onChange={(e) => handleItemChange(item.id, 'vendor_name', e.target.value)}
                                                    style={{
                                                        width: '100%', border: 'none', background: 'transparent', outline: 'none', padding: '4px',
                                                        color: item.vendor_name ? 'var(--text-main)' : '#94A3B8',
                                                        fontWeight: item.vendor_name ? '600' : '400'
                                                    }}
                                                >
                                                    <option value="">Select Vendor</option>
                                                    {vendors.map(v => (
                                                        <option key={v.name} value={v.name}>{v.name}</option>
                                                    ))}
                                                </select>
                                            </td>
                                        )}
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
                                            {(() => {
                                                const wh = warehouseStock[item.name];
                                                const whQty = wh?.stock || 0;
                                                const reqQty = parseFloat(item.qty || 0);
                                                const sufficient = whQty >= reqQty && reqQty > 0;
                                                const mat = materials.find(m => m.name === item.name);
                                                const isWhControlled = mat && (mat.stock_handling_type === 'Warehouse Controlled' || mat.tracking_type === 'Warehouse Controlled' || mat.stock_handling_type === 'Warehouse');
                                                if (!item.name) return <span style={{ color: '#94A3B8', fontSize: 11 }}>—</span>;
                                                return (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                        <span style={{
                                                            fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                                                            backgroundColor: sufficient ? '#DCFCE7' : whQty > 0 ? '#FEF3C7' : '#F1F5F9',
                                                            color: sufficient ? '#15803D' : whQty > 0 ? '#92400E' : '#94A3B8',
                                                        }} title={sufficient ? 'Available in warehouse — use Inventory → Send to Site' : ''}>
                                                            {whQty}
                                                        </span>
                                                        {isWhControlled && (
                                                            <span style={{ fontSize: 9, fontWeight: 700, color: '#6366F1', backgroundColor: '#EEF2FF', padding: '1px 4px', borderRadius: 3, textAlign: 'center' }}>
                                                                WH Controlled
                                                            </span>
                                                        )}
                                                    </div>
                                                );
                                            })()}
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
                                            {'\u20B9'}{((parseFloat(item.qty || 0) * parseFloat(item.rate || 0))).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
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

                    {/* Vendor-wise Summary for multi-vendor mode */}
                    {isMultiVendor && vendorSummary && Object.keys(vendorSummary).length > 0 && (
                        <div style={{
                            marginBottom: '24px', padding: '16px', backgroundColor: '#F0F9FF',
                            borderRadius: '10px', border: '1px solid #BAE6FD'
                        }}>
                            <h4 style={{ fontSize: '13px', fontWeight: '700', color: '#0369A1', marginBottom: '12px', textTransform: 'uppercase' }}>
                                Vendor-wise Breakdown
                            </h4>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
                                {Object.entries(vendorSummary).map(([vendor, data]) => (
                                    <div key={vendor} style={{
                                        padding: '10px 14px', backgroundColor: 'white', borderRadius: '8px',
                                        border: `1px solid ${vendor === 'Unassigned' ? '#FCA5A5' : '#E0E7FF'}`,
                                    }}>
                                        <p style={{
                                            fontSize: '12px', fontWeight: '700', marginBottom: '4px',
                                            color: vendor === 'Unassigned' ? '#DC2626' : '#1E40AF'
                                        }}>
                                            {vendor}
                                        </p>
                                        <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                            {data.items} item{data.items > 1 ? 's' : ''} &middot; {'\u20B9'}{data.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px', borderTop: '2px solid var(--border)', paddingTop: '16px' }}>
                        <div style={{ textAlign: 'right' }}>
                            <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Grand Total</p>
                            <h3 style={{ fontSize: '24px', fontWeight: '900', color: 'var(--primary)' }}>
                                {'\u20B9'}{items.reduce((sum, item) => sum + (parseFloat(item.qty || 0) * parseFloat(item.rate || 0)), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
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
                        if (newMaterialRowId) {
                            handleItemChange(newMaterialRowId, 'name', '');
                        }
                    }}
                    onSuccess={(newMat) => {
                        setMaterials(prev => [...prev, newMat]);
                        if (newMaterialRowId) {
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

import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Truck, Loader2 } from 'lucide-react';
import { inventoryAPI, projectAPI } from '../utils/api';
import { useToast } from '../context/ToastContext';

const DirectIssueModal = ({ isOpen, onClose, onSuccess, pendingDeployments = [] }) => {
    const toast = useToast();
    const [saving, setSaving] = useState(false);
    const [projects, setProjects] = useState([]);
    const [warehouseStock, setWarehouseStock] = useState([]);
    const [selectedProject, setSelectedProject] = useState('');
    const [items, setItems] = useState([{ id: Date.now(), name: '', quantity: '', unit: 'Nos' }]);

    // Group pending warehouse deployments by project. Only show items where
    // the material exists in the central warehouse master — i.e. the
    // material is "warehouse-controlled" (even if current stock is 0).
    // Site-only materials that the warehouse never stocks (e.g. Bricks
    // delivered direct to site) are filtered out — they can't be issued
    // via Send-to-Site so they don't belong in this modal. Quantity is
    // pre-filled with the FULL outstanding demand so admin sees what's
    // still owed; rows where Quantity > Available go red and block submit.
    const warehouseMaterialNames = new Set((warehouseStock || []).map(w => w.material_name));
    const deploymentsByProject = (() => {
        const map = {};
        for (const d of pendingDeployments || []) {
            if (!d.project_name) continue;
            if (!warehouseMaterialNames.has(d.material_name)) continue;
            const pending = parseFloat(d.pending_qty || 0);
            if (pending <= 0) continue;
            if (!map[d.project_name]) map[d.project_name] = {
                items: {}, poAttributions: [], requestAttributions: [],
            };
            const existing = map[d.project_name].items[d.material_name];
            if (existing) {
                existing.quantity += pending;
            } else {
                map[d.project_name].items[d.material_name] = {
                    name: d.material_name,
                    quantity: pending,
                    unit: d.unit || 'Nos',
                };
            }
            if (d.source === 'material_request' && d.request_id) {
                map[d.project_name].requestAttributions.push({
                    request_id: d.request_id,
                    material_name: d.material_name,
                    quantity: pending,
                });
            } else if (d.po_id) {
                map[d.project_name].poAttributions.push({
                    po_id: d.po_id,
                    material_name: d.material_name,
                    quantity: pending,
                });
            }
        }
        return Object.fromEntries(Object.entries(map).map(([p, v]) => [p, {
            items: Object.values(v.items),
            poAttributions: v.poAttributions,
            requestAttributions: v.requestAttributions,
        }]));
    })();

    useEffect(() => {
        if (!isOpen) return;
        setSelectedProject('');
        setItems([{ id: Date.now(), name: '', quantity: '', unit: 'Nos' }]);
        Promise.all([
            projectAPI.getAll(),
            inventoryAPI.getWarehouse(),
        ]).then(([pRes, wRes]) => {
            setProjects((pRes.data || []).filter(p => p.status !== 'Completed'));
            setWarehouseStock(wRes.data || []);
        }).catch(() => {});
    }, [isOpen]);

    // When admin picks a project that has pending warehouse deployments,
    // auto-fill the items list. They can still adjust quantities before
    // submitting.
    const handleProjectChange = (projectName) => {
        setSelectedProject(projectName);
        const dep = deploymentsByProject[projectName];
        if (dep && dep.items.length > 0) {
            setItems(dep.items.map((it, idx) => ({
                id: Date.now() + idx,
                name: it.name,
                quantity: String(it.quantity),
                unit: it.unit || 'Nos',
            })));
            toast.info(`Auto-filled ${dep.items.length} pending item${dep.items.length > 1 ? 's' : ''} for ${projectName}.`);
        }
    };

    if (!isOpen) return null;

    const updateItem = (id, field, val) => {
        setItems(items.map(it => {
            if (it.id !== id) return it;
            const updated = { ...it, [field]: val };
            if (field === 'name') {
                const wh = warehouseStock.find(w => w.material_name === val);
                if (wh) updated.unit = wh.unit || 'Nos';
            }
            return updated;
        }));
    };
    const addItem = () => setItems([...items, { id: Date.now() + Math.random(), name: '', quantity: '', unit: 'Nos' }]);
    const removeItem = (id) => { if (items.length > 1) setItems(items.filter(it => it.id !== id)); };

    const getAvailable = (name) => {
        const wh = warehouseStock.find(w => w.material_name === name);
        return wh ? wh.stock : 0;
    };

    const handleSubmit = async () => {
        if (!selectedProject) { toast.warning('Select a destination project'); return; }
        const valid = items.filter(it => it.name && parseFloat(it.quantity) > 0);
        if (!valid.length) { toast.warning('Add at least one item with quantity'); return; }
        // Check stock
        for (const it of valid) {
            const avail = getAvailable(it.name);
            if (parseFloat(it.quantity) > avail) {
                toast.warning(`Insufficient stock for ${it.name}. Available: ${avail}, Requested: ${it.quantity}`);
                return;
            }
        }

        setSaving(true);
        try {
            // When the project has pending deployments, attribute the issue
            // to the originating PO line and/or material-request line so the
            // backend can decrement the right pending counter. Each
            // attribution is capped at the actual issued qty.
            const dep = deploymentsByProject[selectedProject];
            let poAttribs = null;
            let reqAttribs = null;
            if (dep) {
                // Track remaining issued qty per material name as we consume
                // it across attributions.
                const issuedByName = {};
                for (const it of valid) {
                    issuedByName[it.name] = (issuedByName[it.name] || 0) + parseFloat(it.quantity);
                }
                // Material-request attributions consumed first (these
                // represent "DPR shortfall" demand which is the user's main
                // scenario; consuming them first clears that backlog).
                const allocate = (sources, mapper) => {
                    const out = [];
                    for (const a of sources) {
                        const remaining = issuedByName[a.material_name];
                        if (!remaining || remaining <= 0) continue;
                        const take = Math.min(remaining, a.quantity);
                        out.push(mapper(a, take));
                        issuedByName[a.material_name] = remaining - take;
                    }
                    return out.length ? out : null;
                };
                reqAttribs = allocate(dep.requestAttributions, (a, q) => ({
                    request_id: a.request_id, material_name: a.material_name, quantity: q,
                }));
                poAttribs = allocate(dep.poAttributions, (a, q) => ({
                    po_id: a.po_id, material_name: a.material_name, quantity: q,
                }));
            }
            await inventoryAPI.bulkWarehouseIssue({
                request_id: '',
                project_name: selectedProject,
                items: valid.map(it => ({ name: it.name, quantity: parseFloat(it.quantity), unit: it.unit })),
                po_attributions: poAttribs,
                request_attributions: reqAttribs,
            });
            toast.success(`${valid.length} materials sent to ${selectedProject}`);
            onSuccess?.();
            onClose();
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.detail || 'Failed to issue materials');
        }
        setSaving(false);
    };

    return (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="card animate-fade-in" style={{ width: '95%', maxWidth: 700, maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0 }}>
                <div style={header}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#DBEAFE', color: '#1D4ED8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Truck size={18} />
                        </div>
                        <div>
                            <div style={{ fontSize: 17, fontWeight: 800 }}>Send to Site</div>
                            <div style={{ fontSize: 12, color: '#64748B' }}>Issue materials from warehouse to project site</div>
                        </div>
                    </div>
                    <button onClick={onClose} style={iconBtn}><X size={20} /></button>
                </div>

                <div style={body}>
                    <div style={{ marginBottom: 16 }}>
                        <label style={labelStyle}>Destination Project *</label>
                        <select value={selectedProject} onChange={e => handleProjectChange(e.target.value)} style={inputStyle}>
                            <option value="">Select project...</option>
                            {projects.map(p => {
                                const dep = deploymentsByProject[p.name];
                                // After the auto-fill refactor, every pending
                                // item — whether the warehouse can fulfill it
                                // now or not — sits in `dep.items`. To decide
                                // the indicator we check whether the warehouse
                                // has stock for at least one of those items.
                                const hasPending = !!(dep && dep.items.length > 0);
                                const hasShippable = hasPending && dep.items.some(it => {
                                    const w = warehouseStock.find(x => x.material_name === it.name);
                                    return (w?.stock || 0) > 0;
                                });
                                let prefix = '';
                                let suffix = '';
                                if (hasShippable) { prefix = '🔔 '; suffix = ' (pending — warehouse ready)'; }
                                else if (hasPending) { prefix = '⏳ '; suffix = ' (pending — awaiting warehouse stock)'; }
                                return (
                                    <option key={p._id || p.id} value={p.name}>
                                        {prefix}{p.name}{suffix}
                                    </option>
                                );
                            })}
                        </select>
                        {selectedProject && deploymentsByProject[selectedProject] && deploymentsByProject[selectedProject].items.length > 0 && (
                            <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, backgroundColor: '#FEF3C7', border: '1px solid #FDE68A', display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: '#92400E', fontWeight: 600 }}>
                                <span>📦</span>
                                <span>This project has pending demand the warehouse can fulfill now. Items below were auto-filled — review Quantity and the resulting Stock (remaining warehouse balance) before submitting.</span>
                            </div>
                        )}
                    </div>

                    <div style={{ border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden', marginBottom: 12 }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                            <thead>
                                <tr style={{ backgroundColor: '#F8FAFC' }}>
                                    <th style={th}>Material</th>
                                    <th style={{ ...th, width: 80 }}>Available</th>
                                    <th style={{ ...th, width: 90 }}>Quantity</th>
                                    <th style={{ ...th, width: 80 }}>Stock</th>
                                    <th style={{ ...th, width: 70 }}>Unit</th>
                                    <th style={{ ...th, width: 36 }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map(it => {
                                    const avail = getAvailable(it.name);
                                    const qty = parseFloat(it.quantity) || 0;
                                    const over = it.name && qty > avail;
                                    // Remaining warehouse stock after this issue.
                                    // Clamp at 0 so we never show a negative —
                                    // the red over-commit colour signals the
                                    // problem, the number stays sensible.
                                    const remaining = it.name ? Math.max(0, avail - qty) : null;
                                    return (
                                        <tr key={it.id} style={{ borderTop: '1px solid #F1F5F9' }}>
                                            <td style={td}>
                                                <select value={it.name} onChange={e => updateItem(it.id, 'name', e.target.value)} style={cellInput}>
                                                    <option value="">Select material</option>
                                                    {warehouseStock.map(w => (
                                                        <option key={w.material_name} value={w.material_name}>{w.material_name} ({w.stock} {w.unit})</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td style={{ ...td, textAlign: 'center' }}>
                                                {it.name ? (
                                                    <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                                                        backgroundColor: over ? '#FEE2E2' : avail > 0 ? '#DCFCE7' : '#F1F5F9',
                                                        color: over ? '#B91C1C' : avail > 0 ? '#15803D' : '#94A3B8' }}>
                                                        {avail}
                                                    </span>
                                                ) : '—'}
                                            </td>
                                            <td style={td}>
                                                <input
                                                    type="number" min="0"
                                                    value={it.quantity}
                                                    onChange={e => updateItem(it.id, 'quantity', e.target.value)}
                                                    style={{
                                                        ...cellInput,
                                                        textAlign: 'center', fontWeight: 700,
                                                        border: over ? '1px solid #EF4444' : cellInput.border,
                                                        backgroundColor: over ? '#FEF2F2' : 'white',
                                                        color: over ? '#B91C1C' : 'inherit',
                                                    }}
                                                    placeholder="0"
                                                />
                                            </td>
                                            <td style={{ ...td, textAlign: 'center' }}>
                                                {/* Stock = what's left in warehouse AFTER this send.
                                                    Helps admin verify they're not depleting too much.
                                                    Greys to "—" until a material is picked. */}
                                                {it.name ? (
                                                    <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                                                        backgroundColor: over ? '#FEE2E2' : qty > 0 ? '#DBEAFE' : '#F1F5F9',
                                                        color: over ? '#B91C1C' : qty > 0 ? '#1D4ED8' : '#94A3B8' }}>
                                                        {remaining}
                                                    </span>
                                                ) : '—'}
                                            </td>
                                            <td style={{ ...td, color: '#64748B', fontSize: 12 }}>{it.unit}</td>
                                            <td style={td}>
                                                <button onClick={() => removeItem(it.id)} disabled={items.length <= 1}
                                                    style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', padding: 4 }}>
                                                    <Trash2 size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <button onClick={addItem} style={addBtn}><Plus size={14} /> Add Material</button>
                </div>

                {(() => {
                    // Any row asking for more than warehouse has on hand blocks
                    // submit. The Send-to-Site action can't issue what isn't
                    // there — admin must lower the qty or wait for stock.
                    const hasOver = items.some(it => {
                        if (!it.name) return false;
                        const q = parseFloat(it.quantity) || 0;
                        return q > 0 && q > getAvailable(it.name);
                    });
                    const disabled = saving || hasOver;
                    return (
                        <>
                            {hasOver && (
                                <div style={{ padding: '10px 22px', backgroundColor: '#FEF2F2', borderTop: '1px solid #FECACA', color: '#B91C1C', fontSize: 12, fontWeight: 600 }}>
                                    One or more rows ask for more than the warehouse has. Reduce the quantity to within Available, or wait for the warehouse to be replenished. The pending demand will stay on the alert until fully shipped.
                                </div>
                            )}
                            <div style={footer}>
                                <button onClick={onClose} style={cancelBtn}>Cancel</button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={disabled}
                                    title={hasOver ? 'Quantity exceeds Available stock — fix first' : ''}
                                    style={{ ...saveBtn, opacity: disabled ? 0.55 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
                                >
                                    {saving ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Truck size={16} />}
                                    Send to Site
                                </button>
                            </div>
                        </>
                    );
                })()}
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
        </div>
    );
};

const header = { padding: '18px 22px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' };
const body = { padding: '18px 22px', overflowY: 'auto', flex: 1 };
const footer = { padding: '14px 22px', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end', gap: 10 };
const iconBtn = { background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', padding: 4 };
const labelStyle = { fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4, display: 'block' };
const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13, outline: 'none' };
const th = { padding: '10px 12px', textAlign: 'left', fontSize: 11, color: '#64748B', fontWeight: 700, textTransform: 'uppercase' };
const td = { padding: '8px 10px', verticalAlign: 'middle' };
const cellInput = { width: '100%', padding: '7px 9px', borderRadius: 6, border: '1px solid #E2E8F0', fontSize: 13, outline: 'none' };
const addBtn = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px dashed #3B82F6', backgroundColor: '#EFF6FF', color: '#1D4ED8', fontSize: 12, fontWeight: 600, cursor: 'pointer', marginTop: 8 };
const cancelBtn = { padding: '9px 18px', borderRadius: 8, border: '1px solid #E2E8F0', backgroundColor: 'white', cursor: 'pointer', fontWeight: 600, color: '#475569' };
const saveBtn = { padding: '9px 18px', borderRadius: 8, border: 'none', backgroundColor: '#3B82F6', color: 'white', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };

export default DirectIssueModal;

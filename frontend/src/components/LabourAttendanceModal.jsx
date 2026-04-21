import React, { useState, useEffect, useMemo } from 'react';
import { X, Plus, Trash2, Users, Loader2, Save } from 'lucide-react';
import { labourAttendanceAPI, vendorAPI } from '../utils/api';

const emptyRow = () => ({
    id: Date.now() + Math.random(),
    party: '',
    category: '',
    count: '',
    daily_wage: '',
    shift: '1',
    ot: '0',
});

const LabourAttendanceModal = ({ isOpen, onClose, onSuccess, project, existingRecord }) => {
    const isEdit = !!existingRecord?.id;
    const [saving, setSaving] = useState(false);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [siteRemarks, setSiteRemarks] = useState('');
    const [rows, setRows] = useState([emptyRow()]);
    const [contractors, setContractors] = useState([]);
    const [allVendors, setAllVendors] = useState([]);
    const [prevRecords, setPrevRecords] = useState([]);

    // Fetch vendors (contractors with rate cards) on open
    useEffect(() => {
        if (!isOpen) return;
        vendorAPI.getAll().then(res => {
            const vendors = res.data || [];
            setAllVendors(vendors);
            const labourContractors = vendors.filter(v => {
                const cat = (v.category || '').toLowerCase();
                const type = (v.type || '').toLowerCase();
                return cat.includes('labor') || cat.includes('labour') || cat.includes('contractor') ||
                       type.includes('labor') || type.includes('labour') || type.includes('contractor');
            });
            setContractors(labourContractors.length > 0 ? labourContractors : vendors);
        }).catch(() => {});

        // Load previous records for copy
        if (project) {
            labourAttendanceAPI.getAll({ project_id: project._id || project.id }).then(r => {
                setPrevRecords((r.data || []).slice(0, 5));
            }).catch(() => {});
        }

        if (existingRecord) {
            setDate(existingRecord.date || new Date().toISOString().split('T')[0]);
            setSiteRemarks(existingRecord.site_remarks || '');
            setRows(
                (existingRecord.categories || []).map((c, i) => ({
                    id: i + Date.now(),
                    party: c.party || '',
                    category: c.category || '',
                    count: c.count ?? '',
                    daily_wage: c.daily_wage ?? '',
                    shift: c.shift ?? '1',
                    ot: c.ot ?? '0',
                }))
            );
        } else {
            setDate(new Date().toISOString().split('T')[0]);
            setSiteRemarks('');
            setRows([emptyRow()]);
        }
    }, [isOpen, existingRecord, project]);

    // Get rate card categories for a selected contractor
    const getCategoriesForParty = (partyName) => {
        const vendor = [...contractors, ...allVendors].find(v => v.name === partyName);
        if (!vendor || !vendor.rate_card) return [];
        return vendor.rate_card.filter(rc => rc.role).map(rc => ({
            role: rc.role,
            rate: rc.rate || 0,
        }));
    };

    const totalCount = useMemo(() => rows.reduce((s, r) => s + (parseInt(r.count) || 0), 0), [rows]);
    const totalCost = useMemo(() => {
        return rows.reduce((s, r) => {
            const count = parseInt(r.count) || 0;
            const wage = parseFloat(r.daily_wage) || 0;
            const ot = parseFloat(r.ot) || 0;
            const shift = parseFloat(r.shift) || 1;
            let cost = count * wage * shift;
            if (ot > 0 && wage > 0 && count > 0) cost += count * (wage / 8) * 1.5 * ot;
            return s + cost;
        }, 0);
    }, [rows]);

    if (!isOpen) return null;

    const updateRow = (id, key, val) => setRows(rows.map(r => r.id === id ? { ...r, [key]: val } : r));

    const handlePartyChange = (rowId, partyName) => {
        setRows(rows.map(r => {
            if (r.id !== rowId) return r;
            return { ...r, party: partyName, category: '', daily_wage: '' };
        }));
    };

    const handleCategoryChange = (rowId, categoryName, partyName) => {
        const cats = getCategoriesForParty(partyName);
        const match = cats.find(c => c.role === categoryName);
        setRows(rows.map(r => {
            if (r.id !== rowId) return r;
            return { ...r, category: categoryName, daily_wage: match ? match.rate : r.daily_wage };
        }));
    };

    const addRow = () => setRows([...rows, emptyRow()]);
    const removeRow = (id) => { if (rows.length > 1) setRows(rows.filter(r => r.id !== id)); };

    const copyFromPrevious = (rec) => {
        const copied = (rec.categories || []).map((c, i) => ({
            id: i + Date.now(),
            party: c.party || '',
            category: c.category || '',
            count: c.count ?? '',
            daily_wage: c.daily_wage ?? '',
            shift: c.shift ?? '1',
            ot: '0',
        }));
        if (copied.length) setRows(copied);
    };

    const handleSave = async () => {
        const validRows = rows.filter(r => r.party.trim() && r.category.trim() && (parseInt(r.count) || 0) > 0);
        if (!validRows.length) { alert('Add at least one entry with party, category, and count'); return; }
        if (!date) { alert('Select a date'); return; }

        const payload = {
            project_id: project._id || project.id || '',
            project_name: project.name || '',
            date,
            categories: validRows.map(r => ({
                party: r.party.trim(),
                category: r.category.trim(),
                count: parseInt(r.count) || 0,
                daily_wage: parseFloat(r.daily_wage) || 0,
                shift: r.shift || '1',
                ot: r.ot || '0',
                overtime_count: parseInt(r.count) || 0,
                overtime_hours: parseFloat(r.ot) || 0,
            })),
            site_remarks: siteRemarks,
        };

        setSaving(true);
        try {
            if (isEdit) await labourAttendanceAPI.update(existingRecord.id, payload);
            else await labourAttendanceAPI.create(payload);
            onSuccess?.();
        } catch (err) {
            console.error(err);
            alert(err.response?.data?.detail || 'Failed to save attendance');
        }
        setSaving(false);
    };

    return (
        <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div style={modal}>
                <div style={header}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={iconCircle}><Users size={18} /></div>
                        <div>
                            <div style={{ fontSize: 17, fontWeight: 800 }}>{isEdit ? 'Edit' : 'Mark'} Labour Attendance</div>
                            <div style={{ fontSize: 12, color: '#64748B' }}>{project?.name || 'Project'}</div>
                        </div>
                    </div>
                    <button onClick={onClose} style={iconBtn}><X size={20} /></button>
                </div>

                <div style={body}>
                    {/* Date + Copy + Summary */}
                    <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                        <div>
                            <label style={labelStyle}>Date *</label>
                            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inputStyle, width: 180 }} />
                        </div>
                        {prevRecords.length > 0 && !isEdit && (
                            <div>
                                <label style={labelStyle}>Copy from previous</label>
                                <select
                                    onChange={e => { const rec = prevRecords.find(r => r.id === e.target.value); if (rec) copyFromPrevious(rec); }}
                                    style={{ ...inputStyle, width: 240 }} defaultValue=""
                                >
                                    <option value="" disabled>Select a previous record...</option>
                                    {prevRecords.map(r => (
                                        <option key={r.id} value={r.id}>{r.date} — {r.total_count || 0} labour</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        <div style={{ display: 'flex', gap: 12, marginLeft: 'auto' }}>
                            <StatBadge label="Total Labour" value={totalCount} color="#3B82F6" />
                            <StatBadge label="Day Cost" value={`₹${Math.round(totalCost).toLocaleString('en-IN')}`} color="#10B981" />
                        </div>
                    </div>

                    {/* Table */}
                    <div style={{ border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                            <thead>
                                <tr style={{ backgroundColor: '#F8FAFC' }}>
                                    <th style={{ ...th, minWidth: 180 }}>Party / Contractor</th>
                                    <th style={{ ...th, minWidth: 160 }}>Workforce Category</th>
                                    <th style={{ ...th, width: 80 }}>Count</th>
                                    <th style={{ ...th, width: 100 }}>Wage (₹)</th>
                                    <th style={{ ...th, width: 70 }}>Shift</th>
                                    <th style={{ ...th, width: 70 }}>OT (Hr)</th>
                                    <th style={{ ...th, width: 110, textAlign: 'right' }}>Cost</th>
                                    <th style={{ ...th, width: 36 }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map(r => {
                                    const count = parseInt(r.count) || 0;
                                    const wage = parseFloat(r.daily_wage) || 0;
                                    const ot = parseFloat(r.ot) || 0;
                                    const shift = parseFloat(r.shift) || 1;
                                    let cost = count * wage * shift;
                                    if (ot > 0 && wage > 0 && count > 0) cost += count * (wage / 8) * 1.5 * ot;
                                    const partyCats = getCategoriesForParty(r.party);

                                    return (
                                        <tr key={r.id} style={{ borderTop: '1px solid #F1F5F9' }}>
                                            <td style={td}>
                                                <select value={r.party} onChange={e => handlePartyChange(r.id, e.target.value)} style={cellInput}>
                                                    <option value="">Select Contractor</option>
                                                    {contractors.map((c, i) => (
                                                        <option key={i} value={c.name}>{c.name}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td style={td}>
                                                <select value={r.category} onChange={e => handleCategoryChange(r.id, e.target.value, r.party)} style={cellInput}>
                                                    <option value="">Select Category</option>
                                                    {partyCats.map((cat, i) => (
                                                        <option key={i} value={cat.role}>{cat.role} (₹{cat.rate})</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td style={td}>
                                                <input type="number" min="0" value={r.count} onChange={e => updateRow(r.id, 'count', e.target.value)}
                                                    style={{ ...cellInput, textAlign: 'center', fontWeight: 700 }} placeholder="0" />
                                            </td>
                                            <td style={td}>
                                                <input type="number" min="0" value={r.daily_wage} onChange={e => updateRow(r.id, 'daily_wage', e.target.value)}
                                                    style={{ ...cellInput, backgroundColor: '#F8FAFC' }} placeholder="₹" />
                                            </td>
                                            <td style={td}>
                                                <input type="number" min="1" value={r.shift} onChange={e => updateRow(r.id, 'shift', e.target.value)}
                                                    style={{ ...cellInput, textAlign: 'center' }} />
                                            </td>
                                            <td style={td}>
                                                <input type="number" min="0" step="0.5" value={r.ot} onChange={e => updateRow(r.id, 'ot', e.target.value)}
                                                    style={{ ...cellInput, textAlign: 'center' }} />
                                            </td>
                                            <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: '#0F172A', fontSize: 13, whiteSpace: 'nowrap' }}>
                                                ₹{Math.round(cost).toLocaleString('en-IN')}
                                            </td>
                                            <td style={td}>
                                                <button onClick={() => removeRow(r.id)} style={trashBtn} disabled={rows.length <= 1}><Trash2 size={14} /></button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot>
                                <tr style={{ backgroundColor: '#F1F5F9' }}>
                                    <td style={{ ...td, fontWeight: 800 }} colSpan={2}>Total</td>
                                    <td style={{ ...td, textAlign: 'center', fontWeight: 800 }}>{totalCount}</td>
                                    <td colSpan={3}></td>
                                    <td style={{ ...td, textAlign: 'right', fontWeight: 800, color: '#1D4ED8' }}>₹{Math.round(totalCost).toLocaleString('en-IN')}</td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    <button onClick={addRow} style={addBtn}><Plus size={14} /> Add Entry</button>

                    <div style={{ marginTop: 14 }}>
                        <label style={labelStyle}>Site Remarks</label>
                        <textarea rows={2} value={siteRemarks} onChange={e => setSiteRemarks(e.target.value)}
                            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} placeholder="Weather, delays, notes..." />
                    </div>
                </div>

                <div style={footer}>
                    <button onClick={onClose} style={cancelBtn} disabled={saving}>Cancel</button>
                    <button onClick={handleSave} style={saveBtn} disabled={saving}>
                        {saving ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={16} />}
                        {isEdit ? 'Update' : 'Save Attendance'}
                    </button>
                </div>
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
        </div>
    );
};

const StatBadge = ({ label, value, color }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 8, border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: color }} />
        <span style={{ fontSize: 12, color: '#64748B' }}>{label}:</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{value}</span>
    </div>
);

const overlay = { position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: 20 };
const modal = { backgroundColor: 'white', borderRadius: 14, width: '100%', maxWidth: 1000, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' };
const header = { padding: '18px 22px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' };
const body = { padding: '18px 22px', overflowY: 'auto', flex: 1 };
const footer = { padding: '14px 22px', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end', gap: 10 };
const iconBtn = { background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', padding: 4 };
const iconCircle = { width: 36, height: 36, borderRadius: 10, backgroundColor: '#DBEAFE', color: '#1D4ED8', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const labelStyle = { fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4, display: 'block' };
const inputStyle = { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13, outline: 'none' };
const th = { padding: '10px 12px', textAlign: 'left', fontSize: 11, color: '#64748B', fontWeight: 700, textTransform: 'uppercase' };
const td = { padding: '8px 10px', verticalAlign: 'middle' };
const cellInput = { width: '100%', padding: '7px 9px', borderRadius: 6, border: '1px solid #E2E8F0', fontSize: 13, outline: 'none' };
const trashBtn = { background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', padding: 4 };
const addBtn = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px dashed #3B82F6', backgroundColor: '#EFF6FF', color: '#1D4ED8', fontSize: 12, fontWeight: 600, cursor: 'pointer', marginTop: 10 };
const cancelBtn = { padding: '9px 18px', borderRadius: 8, border: '1px solid #E2E8F0', backgroundColor: 'white', cursor: 'pointer', fontWeight: 600, color: '#475569' };
const saveBtn = { padding: '9px 18px', borderRadius: 8, border: 'none', backgroundColor: '#3B82F6', color: 'white', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };

export default LabourAttendanceModal;

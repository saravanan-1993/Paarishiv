import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, FileText, Calendar, Building2, Loader2, Download, Upload, Calculator } from 'lucide-react';
import { subcontractorBillingAPI, vendorAPI, projectAPI, labourAttendanceAPI } from '../utils/api';
import CustomSelect from './CustomSelect';

const UNIT_OPTIONS = ['Cft', 'Sft', 'Rmt', 'Nos', 'Kg', 'Bag', 'Cum', 'Sqm'];

const SubcontractorBillModal = ({ isOpen, onClose, onSuccess, editData }) => {
    const [billType, setBillType] = useState('work_based');
    const [formData, setFormData] = useState({
        contractor_name: '', project_name: '', project_id: '',
        bill_date: new Date().toISOString().split('T')[0],
        period_from: '', period_to: '', agreement_no: ''
    });
    const [mbookEntries, setMbookEntries] = useState([
        { sno: 1, description: '', nos: 1, length: 0, breadth: 0, height: 0, quantity: 0, unit: 'Cft', rate: 0, amount: 0, remarks: '' }
    ]);
    const [dayEntries, setDayEntries] = useState([
        { date: '', category: '', count: 0, daily_wage: 0, amount: 0 }
    ]);
    const [deductions, setDeductions] = useState([
        { description: 'Advance Recovery', amount: 0 },
        { description: 'Material Supplied', amount: 0 }
    ]);
    const [gstPercent, setGstPercent] = useState(0);
    const [mbookMeta, setMbookMeta] = useState({
        page_no: '', serial_no: '',
        measured_by: { name: '', designation: '', date: '' },
        checked_by: { name: '', designation: '', date: '' },
        verified_by: { name: '', designation: '', date: '' },
    });
    const [dprWork, setDprWork] = useState([]);
    const [showDprImport, setShowDprImport] = useState(false);
    const [notes, setNotes] = useState('');
    const [vendors, setVendors] = useState([]);
    const [projects, setProjects] = useState([]);
    const [isSaving, setIsSaving] = useState(false);
    const [dprReferences, setDprReferences] = useState([]);
    const [dprSelected, setDprSelected] = useState({});
    const [dprLoading, setDprLoading] = useState(false);
    const [attendanceData, setAttendanceData] = useState([]);
    const [showAttendanceImport, setShowAttendanceImport] = useState(false);
    const [attendanceLoading, setAttendanceLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            vendorAPI.getAll().then(res => setVendors(res.data || [])).catch(() => {});
            projectAPI.getAll().then(res => setProjects(res.data || [])).catch(() => {});
        }
    }, [isOpen]);

    useEffect(() => {
        if (isOpen && editData) {
            setBillType(editData.bill_type || 'work_based');
            setFormData({
                contractor_name: editData.contractor_name || '',
                project_name: editData.project_name || '',
                project_id: editData.project_id || '',
                bill_date: editData.bill_date || new Date().toISOString().split('T')[0],
                period_from: editData.period_from || '',
                period_to: editData.period_to || '',
                agreement_no: editData.agreement_no || ''
            });
            if (editData.mbook_entries?.length > 0) {
                setMbookEntries(editData.mbook_entries);
            }
            if (editData.day_entries?.length > 0) {
                setDayEntries(editData.day_entries);
            }
            if (editData.deductions?.length > 0) {
                setDeductions(editData.deductions);
            } else {
                setDeductions([
                    { description: 'Advance Recovery', amount: 0 },
                    { description: 'Material Supplied', amount: 0 }
                ]);
            }
            setGstPercent(editData.gst_percent || 0);
            setMbookMeta({
                page_no: editData.mbook_page_no || '',
                serial_no: editData.mbook_serial_no || '',
                measured_by: editData.measured_by || { name: '', designation: '', date: '' },
                checked_by: editData.checked_by || { name: '', designation: '', date: '' },
                verified_by: editData.verified_by || { name: '', designation: '', date: '' },
            });
            setNotes(editData.notes || '');
            setDprReferences(editData.dpr_references || []);
        }
    }, [isOpen, editData]);

    // Reset form when modal closes
    useEffect(() => {
        if (!isOpen) {
            setBillType('work_based');
            setFormData({
                contractor_name: '', project_name: '', project_id: '',
                bill_date: new Date().toISOString().split('T')[0],
                period_from: '', period_to: '', agreement_no: ''
            });
            setMbookEntries([{ sno: 1, description: '', nos: 1, length: 0, breadth: 0, height: 0, quantity: 0, unit: 'Cft', rate: 0, amount: 0, remarks: '' }]);
            setDayEntries([{ date: '', category: '', count: 0, daily_wage: 0, amount: 0 }]);
            setDeductions([{ description: 'Advance Recovery', amount: 0 }, { description: 'Material Supplied', amount: 0 }]);
            setGstPercent(0);
            setMbookMeta({
                page_no: '', serial_no: '',
                measured_by: { name: '', designation: '', date: '' },
                checked_by: { name: '', designation: '', date: '' },
                verified_by: { name: '', designation: '', date: '' },
            });
            setNotes('');
            setDprReferences([]);
            setDprWork([]);
            setShowDprImport(false);
            setDprSelected({});
            setAttendanceData([]);
            setShowAttendanceImport(false);
        }
    }, [isOpen]);

    const updateMbookEntry = (index, field, value) => {
        setMbookEntries(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };
            const e = updated[index];
            let qty = e.nos || 1;
            if (e.length > 0) qty *= e.length;
            if (e.breadth > 0) qty *= e.breadth;
            if (e.height > 0) qty *= e.height;
            updated[index].quantity = parseFloat(qty.toFixed(2));
            updated[index].amount = parseFloat((updated[index].quantity * (updated[index].rate || 0)).toFixed(2));
            return updated;
        });
    };

    const addMbookEntry = () => {
        setMbookEntries(prev => [...prev, {
            sno: prev.length + 1, description: '', nos: 1, length: 0, breadth: 0, height: 0,
            quantity: 0, unit: 'Cft', rate: 0, amount: 0, remarks: ''
        }]);
    };

    const removeMbookEntry = (index) => {
        if (mbookEntries.length <= 1) return;
        setMbookEntries(prev => {
            const updated = prev.filter((_, i) => i !== index);
            return updated.map((e, i) => ({ ...e, sno: i + 1 }));
        });
    };

    const updateDayEntry = (index, field, value) => {
        setDayEntries(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };
            const e = updated[index];
            updated[index].amount = parseFloat(((e.count || 0) * (e.daily_wage || 0)).toFixed(2));
            return updated;
        });
    };

    const addDayEntry = () => {
        setDayEntries(prev => [...prev, { date: '', category: '', count: 0, daily_wage: 0, amount: 0 }]);
    };

    const removeDayEntry = (index) => {
        if (dayEntries.length <= 1) return;
        setDayEntries(prev => prev.filter((_, i) => i !== index));
    };

    const addDeduction = () => {
        setDeductions(prev => [...prev, { description: '', amount: 0 }]);
    };

    const removeDeduction = (index) => {
        setDeductions(prev => prev.filter((_, i) => i !== index));
    };

    const updateDeduction = (index, field, value) => {
        setDeductions(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };
            return updated;
        });
    };

    // Financial calculations
    const grossAmount = billType === 'work_based'
        ? mbookEntries.reduce((s, e) => s + (e.amount || 0), 0)
        : dayEntries.reduce((s, e) => s + (e.amount || 0), 0);
    const totalDeductions = deductions.reduce((s, d) => s + (parseFloat(d.amount) || 0), 0);
    const netAmount = grossAmount - totalDeductions;
    const gstAmount = netAmount * (gstPercent / 100);
    const payableAmount = netAmount + gstAmount;

    const formatCurrency = (val) => {
        return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(val || 0);
    };

    // DPR Import
    const handleDprImport = async () => {
        if (!formData.contractor_name || !formData.project_name) {
            alert('Please select contractor and project first');
            return;
        }
        setDprLoading(true);
        try {
            const res = await subcontractorBillingAPI.getDprWork({
                contractor_name: formData.contractor_name,
                project_name: formData.project_name
            });
            setDprWork(res.data || []);
            setShowDprImport(true);
            setDprSelected({});
        } catch (err) {
            alert('Failed to fetch DPR work entries');
        } finally {
            setDprLoading(false);
        }
    };

    const toggleDprSelection = (index) => {
        setDprSelected(prev => ({ ...prev, [index]: !prev[index] }));
    };

    const importSelectedDpr = () => {
        const selected = dprWork.filter((_, i) => dprSelected[i]);
        if (selected.length === 0) {
            alert('Please select at least one DPR entry');
            return;
        }
        const newEntries = selected.map((item, idx) => ({
            sno: mbookEntries.length + idx + 1,
            description: item.work_title || item.description || '',
            nos: 1,
            length: 0,
            breadth: 0,
            height: 0,
            quantity: parseFloat(item.progress) || 0,
            unit: item.unit || 'Cft',
            rate: 0,
            amount: 0,
            remarks: `DPR: ${item.dpr_date || ''}`
        }));
        const refs = selected.map(item => ({
            dpr_id: item.dpr_id || item.id,
            dpr_date: item.dpr_date,
            work_title: item.work_title || item.description
        }));
        setMbookEntries(prev => [...prev, ...newEntries]);
        setDprReferences(prev => [...prev, ...refs]);
        setShowDprImport(false);
        setDprSelected({});
    };

    // Attendance Import
    const handleAttendanceImport = async () => {
        if (!formData.contractor_name || !formData.project_name) {
            alert('Please select contractor and project first');
            return;
        }
        if (!formData.period_from || !formData.period_to) {
            alert('Please set period from and period to dates first');
            return;
        }
        setAttendanceLoading(true);
        try {
            const res = await labourAttendanceAPI.getAll({
                project_name: formData.project_name,
                date_from: formData.period_from,
                date_to: formData.period_to
            });
            const allEntries = res.data || [];
            const contractorEntries = allEntries.filter(
                e => (e.contractor_name || '').toLowerCase() === formData.contractor_name.toLowerCase()
            );
            setAttendanceData(contractorEntries);
            setShowAttendanceImport(true);
        } catch (err) {
            alert('Failed to fetch attendance data');
        } finally {
            setAttendanceLoading(false);
        }
    };

    const importAttendanceEntries = () => {
        if (attendanceData.length === 0) {
            alert('No attendance entries to import');
            return;
        }
        const newEntries = attendanceData.map(item => ({
            date: item.date || '',
            category: item.category || item.worker_type || '',
            count: item.workers || item.count || 1,
            daily_wage: item.daily_wage || item.wage || 0,
            amount: (item.workers || item.count || 1) * (item.daily_wage || item.wage || 0)
        }));
        setDayEntries(prev => [...prev.filter(e => e.date || e.category), ...newEntries]);
        setShowAttendanceImport(false);
    };

    const handleSubmit = async (submitForApproval = false) => {
        if (!formData.contractor_name || !formData.project_name) {
            alert('Please select contractor and project');
            return;
        }

        // Ensure numeric fields are proper numbers (not strings from inputs)
        const cleanMbookEntries = mbookEntries.map(e => ({
            sno: parseInt(e.sno) || 0,
            description: e.description || '',
            nos: parseFloat(e.nos) || 0,
            length: parseFloat(e.length) || 0,
            breadth: parseFloat(e.breadth) || 0,
            height: parseFloat(e.height) || 0,
            quantity: parseFloat(e.quantity) || 0,
            unit: e.unit || 'Cft',
            rate: parseFloat(e.rate) || 0,
            amount: parseFloat(e.amount) || 0,
            remarks: e.remarks || ''
        }));

        const cleanDayEntries = dayEntries.map(e => ({
            date: e.date || '',
            category: e.category || '',
            count: parseInt(e.count) || 0,
            daily_wage: parseFloat(e.daily_wage) || 0,
            amount: parseFloat(e.amount) || 0
        }));

        const cleanDeductions = deductions
            .filter(d => parseFloat(d.amount) > 0)
            .map(d => ({ description: d.description || '', amount: parseFloat(d.amount) || 0 }));

        const payload = {
            ...formData,
            bill_type: billType,
            mbook_entries: billType === 'work_based' ? cleanMbookEntries : [],
            day_entries: billType === 'day_based' ? cleanDayEntries : [],
            dpr_references: dprReferences,
            gross_amount: parseFloat(grossAmount) || 0,
            deductions: cleanDeductions,
            total_deductions: parseFloat(totalDeductions) || 0,
            net_amount: parseFloat(netAmount) || 0,
            gst_percent: parseFloat(gstPercent) || 0,
            gst_amount: parseFloat(gstAmount) || 0,
            payable_amount: parseFloat(payableAmount) || 0,
            mbook_page_no: mbookMeta.page_no || '',
            mbook_serial_no: mbookMeta.serial_no || '',
            measured_by: mbookMeta.measured_by || { name: '', designation: '', date: '' },
            checked_by: mbookMeta.checked_by || { name: '', designation: '', date: '' },
            verified_by: mbookMeta.verified_by || { name: '', designation: '', date: '' },
            notes: notes || '',
        };

        setIsSaving(true);
        try {
            if (editData) {
                await subcontractorBillingAPI.update(editData.id, payload);
            } else {
                const res = await subcontractorBillingAPI.create(payload);
                if (submitForApproval && res.data?.id) {
                    await subcontractorBillingAPI.submit(res.data.id);
                }
            }
            if (onSuccess) onSuccess();
            onClose();
        } catch (err) {
            const detail = err.response?.data?.detail;
            const msg = typeof detail === 'string' ? detail
                : Array.isArray(detail) ? detail.map(e => e.msg || e.message || JSON.stringify(e)).join(', ')
                : 'Failed to save bill';
            alert(msg);
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    const inputStyle = {
        width: '100%', padding: '8px 12px', borderRadius: '8px',
        border: '1px solid var(--border)', fontSize: '13px',
        backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)'
    };

    const labelStyle = {
        display: 'block', fontSize: '11px', fontWeight: '600',
        color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase'
    };

    const thStyle = {
        padding: '8px 6px', fontSize: '11px', fontWeight: '600',
        color: 'var(--text-muted)', textTransform: 'uppercase',
        borderBottom: '2px solid var(--border)', textAlign: 'left',
        whiteSpace: 'nowrap'
    };

    const tdStyle = {
        padding: '4px 4px', verticalAlign: 'middle'
    };

    const cellInputStyle = {
        width: '100%', padding: '6px 8px', borderRadius: '6px',
        border: '1px solid var(--border)', fontSize: '12px',
        backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)'
    };

    const numInputStyle = {
        ...cellInputStyle, textAlign: 'right', width: '70px'
    };

    const sectionTitleStyle = {
        fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)',
        marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px'
    };

    return (
        <div className="modal-overlay">
            <div className="card animate-fade-in" style={{
                width: '95%', maxWidth: '1100px', maxHeight: '90vh',
                display: 'flex', flexDirection: 'column', padding: 0
            }}>
                {/* Header */}
                <div style={{
                    padding: '20px 24px', borderBottom: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                            padding: '10px', backgroundColor: 'var(--bg-main)',
                            borderRadius: '8px', color: 'var(--primary)'
                        }}>
                            <FileText size={20} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '18px', fontWeight: '700' }}>
                                {editData ? 'Edit Subcontractor Bill' : 'Create Subcontractor Bill'}
                            </h2>
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                {billType === 'work_based' ? 'M-Book measurement based billing' : 'Day-based labour billing'}
                            </p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} style={{
                        background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)'
                    }}>
                        <X size={24} />
                    </button>
                </div>

                {/* Body */}
                <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>

                    {/* Bill Type Tabs */}
                    <div style={{
                        display: 'flex', gap: '0', marginBottom: '24px',
                        borderRadius: '10px', overflow: 'hidden',
                        border: '1px solid var(--border)', width: 'fit-content'
                    }}>
                        <button type="button" onClick={() => setBillType('work_based')} style={{
                            padding: '10px 24px', fontSize: '13px', fontWeight: '600',
                            border: 'none', cursor: 'pointer',
                            backgroundColor: billType === 'work_based' ? 'var(--primary)' : 'var(--bg-card)',
                            color: billType === 'work_based' ? '#fff' : 'var(--text-secondary)',
                            display: 'flex', alignItems: 'center', gap: '6px'
                        }}>
                            <Calculator size={14} />
                            Work-Based (M-Book)
                        </button>
                        <button type="button" onClick={() => setBillType('day_based')} style={{
                            padding: '10px 24px', fontSize: '13px', fontWeight: '600',
                            border: 'none', cursor: 'pointer',
                            backgroundColor: billType === 'day_based' ? 'var(--primary)' : 'var(--bg-card)',
                            color: billType === 'day_based' ? '#fff' : 'var(--text-secondary)',
                            display: 'flex', alignItems: 'center', gap: '6px'
                        }}>
                            <Calendar size={14} />
                            Day-Based
                        </button>
                    </div>

                    {/* Header Fields */}
                    <div style={{
                        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px'
                    }}>
                        <div>
                            <label style={labelStyle}>Contractor *</label>
                            <CustomSelect
                                options={vendors.map(v => ({ value: v.name || v.vendor_name, label: v.name || v.vendor_name }))}
                                value={formData.contractor_name}
                                onChange={(val) => setFormData(prev => ({ ...prev, contractor_name: val }))}
                                placeholder="Select Contractor"
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Project *</label>
                            <CustomSelect
                                options={projects.map(p => ({ value: p.name || p.project_name, label: p.name || p.project_name }))}
                                value={formData.project_name}
                                onChange={(val) => {
                                    const proj = projects.find(p => (p.name || p.project_name) === val);
                                    setFormData(prev => ({
                                        ...prev,
                                        project_name: val,
                                        project_id: proj?._id || proj?.id || ''
                                    }));
                                }}
                                placeholder="Select Project"
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Bill Date</label>
                            <input type="date" value={formData.bill_date}
                                onChange={(e) => setFormData(prev => ({ ...prev, bill_date: e.target.value }))}
                                style={inputStyle}
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Period From</label>
                            <input type="date" value={formData.period_from}
                                onChange={(e) => setFormData(prev => ({ ...prev, period_from: e.target.value }))}
                                style={inputStyle}
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Period To</label>
                            <input type="date" value={formData.period_to}
                                onChange={(e) => setFormData(prev => ({ ...prev, period_to: e.target.value }))}
                                style={inputStyle}
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Agreement No</label>
                            <input type="text" value={formData.agreement_no}
                                onChange={(e) => setFormData(prev => ({ ...prev, agreement_no: e.target.value }))}
                                placeholder="Enter agreement number"
                                style={inputStyle}
                            />
                        </div>
                    </div>

                    {/* ===== WORK-BASED (M-Book) MODE ===== */}
                    {billType === 'work_based' && (
                        <>
                            {/* Import from DPR */}
                            <div style={{ marginBottom: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                                <button type="button" onClick={handleDprImport} disabled={dprLoading} style={{
                                    padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: '600',
                                    border: '1px solid #3B82F6', backgroundColor: '#EFF6FF', color: '#1D4ED8',
                                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                                }}>
                                    {dprLoading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                                    Import from DPR
                                </button>
                            </div>

                            {/* DPR Import Panel */}
                            {showDprImport && (
                                <div style={{
                                    marginBottom: '20px', padding: '16px', borderRadius: '10px',
                                    border: '1px solid #BFDBFE', backgroundColor: '#F0F9FF'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                        <h4 style={{ fontSize: '13px', fontWeight: '700', color: '#1E40AF' }}>
                                            DPR Work Entries
                                        </h4>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button type="button" onClick={importSelectedDpr} style={{
                                                padding: '6px 14px', borderRadius: '6px', fontSize: '11px', fontWeight: '600',
                                                border: 'none', backgroundColor: '#2563EB', color: '#fff', cursor: 'pointer'
                                            }}>
                                                Import Selected
                                            </button>
                                            <button type="button" onClick={() => setShowDprImport(false)} style={{
                                                padding: '6px 14px', borderRadius: '6px', fontSize: '11px', fontWeight: '600',
                                                border: '1px solid #93C5FD', backgroundColor: '#fff', color: '#1D4ED8', cursor: 'pointer'
                                            }}>
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                    {dprWork.length === 0 ? (
                                        <p style={{ fontSize: '12px', color: '#6B7280', textAlign: 'center', padding: '16px' }}>
                                            No DPR work entries found for this contractor and project.
                                        </p>
                                    ) : (
                                        <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                            {dprWork.map((item, idx) => (
                                                <label key={idx} style={{
                                                    display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px',
                                                    borderRadius: '6px', marginBottom: '4px', cursor: 'pointer',
                                                    backgroundColor: dprSelected[idx] ? '#DBEAFE' : '#fff',
                                                    border: `1px solid ${dprSelected[idx] ? '#60A5FA' : '#E5E7EB'}`
                                                }}>
                                                    <input type="checkbox" checked={!!dprSelected[idx]}
                                                        onChange={() => toggleDprSelection(idx)}
                                                        style={{ accentColor: '#2563EB' }}
                                                    />
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ fontSize: '12px', fontWeight: '600', color: '#1F2937' }}>
                                                            {item.work_title || item.description || 'Untitled'}
                                                        </div>
                                                        <div style={{ fontSize: '11px', color: '#6B7280', display: 'flex', gap: '12px', marginTop: '2px' }}>
                                                            <span>Project: {item.project_name || formData.project_name}</span>
                                                            <span>Date: {item.dpr_date || '-'}</span>
                                                            <span>Progress: {item.progress || '-'}</span>
                                                        </div>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* M-Book Measurement Table */}
                            <div style={sectionTitleStyle}>
                                <Calculator size={16} />
                                M-Book Measurements
                            </div>
                            <div style={{ overflowX: 'auto', marginBottom: '20px' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '950px' }}>
                                    <thead>
                                        <tr>
                                            <th style={{ ...thStyle, width: '40px' }}>S.No</th>
                                            <th style={{ ...thStyle, minWidth: '180px' }}>Description of Item</th>
                                            <th style={{ ...thStyle, width: '60px' }}>Nos</th>
                                            <th style={{ ...thStyle, width: '70px' }}>L (Length)</th>
                                            <th style={{ ...thStyle, width: '70px' }}>B (Breadth)</th>
                                            <th style={{ ...thStyle, width: '70px' }}>H/D</th>
                                            <th style={{ ...thStyle, width: '80px' }}>Quantity</th>
                                            <th style={{ ...thStyle, width: '70px' }}>Unit</th>
                                            <th style={{ ...thStyle, width: '80px' }}>Rate</th>
                                            <th style={{ ...thStyle, width: '90px' }}>Amount</th>
                                            <th style={{ ...thStyle, minWidth: '100px' }}>Remarks</th>
                                            <th style={{ ...thStyle, width: '36px' }}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {mbookEntries.map((entry, idx) => (
                                            <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                                                <td style={tdStyle}>
                                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', paddingLeft: '8px' }}>{entry.sno}</span>
                                                </td>
                                                <td style={tdStyle}>
                                                    <input type="text" value={entry.description}
                                                        onChange={(e) => updateMbookEntry(idx, 'description', e.target.value)}
                                                        placeholder="Work description"
                                                        style={{ ...cellInputStyle, width: '100%' }}
                                                    />
                                                </td>
                                                <td style={tdStyle}>
                                                    <input type="number" value={entry.nos}
                                                        onChange={(e) => updateMbookEntry(idx, 'nos', parseFloat(e.target.value) || 0)}
                                                        style={numInputStyle} min="0" step="1"
                                                    />
                                                </td>
                                                <td style={tdStyle}>
                                                    <input type="number" value={entry.length}
                                                        onChange={(e) => updateMbookEntry(idx, 'length', parseFloat(e.target.value) || 0)}
                                                        style={numInputStyle} min="0" step="0.01"
                                                    />
                                                </td>
                                                <td style={tdStyle}>
                                                    <input type="number" value={entry.breadth}
                                                        onChange={(e) => updateMbookEntry(idx, 'breadth', parseFloat(e.target.value) || 0)}
                                                        style={numInputStyle} min="0" step="0.01"
                                                    />
                                                </td>
                                                <td style={tdStyle}>
                                                    <input type="number" value={entry.height}
                                                        onChange={(e) => updateMbookEntry(idx, 'height', parseFloat(e.target.value) || 0)}
                                                        style={numInputStyle} min="0" step="0.01"
                                                    />
                                                </td>
                                                <td style={tdStyle}>
                                                    <span style={{
                                                        display: 'block', padding: '6px 8px', fontSize: '12px',
                                                        fontWeight: '600', textAlign: 'right', color: 'var(--primary)',
                                                        backgroundColor: 'var(--bg-main)', borderRadius: '6px'
                                                    }}>
                                                        {entry.quantity}
                                                    </span>
                                                </td>
                                                <td style={tdStyle}>
                                                    <select value={entry.unit}
                                                        onChange={(e) => updateMbookEntry(idx, 'unit', e.target.value)}
                                                        style={{ ...cellInputStyle, width: '70px', padding: '6px 4px' }}
                                                    >
                                                        {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                                                    </select>
                                                </td>
                                                <td style={tdStyle}>
                                                    <input type="number" value={entry.rate}
                                                        onChange={(e) => updateMbookEntry(idx, 'rate', parseFloat(e.target.value) || 0)}
                                                        style={numInputStyle} min="0" step="0.01"
                                                    />
                                                </td>
                                                <td style={tdStyle}>
                                                    <span style={{
                                                        display: 'block', padding: '6px 8px', fontSize: '12px',
                                                        fontWeight: '700', textAlign: 'right', color: '#059669',
                                                        backgroundColor: '#F0FDF4', borderRadius: '6px'
                                                    }}>
                                                        {formatCurrency(entry.amount)}
                                                    </span>
                                                </td>
                                                <td style={tdStyle}>
                                                    <input type="text" value={entry.remarks}
                                                        onChange={(e) => updateMbookEntry(idx, 'remarks', e.target.value)}
                                                        placeholder="Remarks"
                                                        style={{ ...cellInputStyle, width: '100%' }}
                                                    />
                                                </td>
                                                <td style={tdStyle}>
                                                    <button type="button" onClick={() => removeMbookEntry(idx)}
                                                        disabled={mbookEntries.length <= 1}
                                                        style={{
                                                            background: 'none', border: 'none', cursor: mbookEntries.length <= 1 ? 'not-allowed' : 'pointer',
                                                            color: mbookEntries.length <= 1 ? '#D1D5DB' : '#EF4444', padding: '4px'
                                                        }}
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <button type="button" onClick={addMbookEntry} style={{
                                padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: '600',
                                border: '1px dashed var(--border)', backgroundColor: 'var(--bg-main)',
                                color: 'var(--primary)', cursor: 'pointer', display: 'flex',
                                alignItems: 'center', gap: '6px', marginBottom: '24px'
                            }}>
                                <Plus size={14} /> Add Row
                            </button>

                            {/* M-Book Metadata */}
                            <div style={{
                                padding: '16px', borderRadius: '10px', border: '1px solid var(--border)',
                                backgroundColor: 'var(--bg-main)', marginBottom: '24px'
                            }}>
                                <div style={sectionTitleStyle}>
                                    <FileText size={16} />
                                    M-Book Details
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                                    <div>
                                        <label style={labelStyle}>Page No</label>
                                        <input type="text" value={mbookMeta.page_no}
                                            onChange={(e) => setMbookMeta(prev => ({ ...prev, page_no: e.target.value }))}
                                            placeholder="Page number" style={inputStyle}
                                        />
                                    </div>
                                    <div>
                                        <label style={labelStyle}>Serial No</label>
                                        <input type="text" value={mbookMeta.serial_no}
                                            onChange={(e) => setMbookMeta(prev => ({ ...prev, serial_no: e.target.value }))}
                                            placeholder="Serial number" style={inputStyle}
                                        />
                                    </div>
                                </div>
                                {['measured_by', 'checked_by', 'verified_by'].map((role) => (
                                    <div key={role} style={{
                                        display: 'grid', gridTemplateColumns: '120px 1fr 1fr 1fr', gap: '12px',
                                        alignItems: 'center', marginBottom: '8px'
                                    }}>
                                        <span style={{
                                            fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)',
                                            textTransform: 'capitalize'
                                        }}>
                                            {role.replace('_', ' ')}:
                                        </span>
                                        <input type="text" value={mbookMeta[role].name}
                                            onChange={(e) => setMbookMeta(prev => ({
                                                ...prev, [role]: { ...prev[role], name: e.target.value }
                                            }))}
                                            placeholder="Name" style={inputStyle}
                                        />
                                        <input type="text" value={mbookMeta[role].designation}
                                            onChange={(e) => setMbookMeta(prev => ({
                                                ...prev, [role]: { ...prev[role], designation: e.target.value }
                                            }))}
                                            placeholder="Designation" style={inputStyle}
                                        />
                                        <input type="date" value={mbookMeta[role].date}
                                            onChange={(e) => setMbookMeta(prev => ({
                                                ...prev, [role]: { ...prev[role], date: e.target.value }
                                            }))}
                                            style={inputStyle}
                                        />
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {/* ===== DAY-BASED MODE ===== */}
                    {billType === 'day_based' && (
                        <>
                            {/* Import from Attendance */}
                            <div style={{ marginBottom: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                                <button type="button" onClick={handleAttendanceImport} disabled={attendanceLoading} style={{
                                    padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: '600',
                                    border: '1px solid #8B5CF6', backgroundColor: '#F5F3FF', color: '#6D28D9',
                                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                                }}>
                                    {attendanceLoading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                                    Import from Attendance
                                </button>
                            </div>

                            {/* Attendance Import Panel */}
                            {showAttendanceImport && (
                                <div style={{
                                    marginBottom: '20px', padding: '16px', borderRadius: '10px',
                                    border: '1px solid #C4B5FD', backgroundColor: '#F5F3FF'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                        <h4 style={{ fontSize: '13px', fontWeight: '700', color: '#5B21B6' }}>
                                            Attendance Entries ({attendanceData.length} found)
                                        </h4>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button type="button" onClick={importAttendanceEntries} style={{
                                                padding: '6px 14px', borderRadius: '6px', fontSize: '11px', fontWeight: '600',
                                                border: 'none', backgroundColor: '#7C3AED', color: '#fff', cursor: 'pointer'
                                            }}>
                                                Import All
                                            </button>
                                            <button type="button" onClick={() => setShowAttendanceImport(false)} style={{
                                                padding: '6px 14px', borderRadius: '6px', fontSize: '11px', fontWeight: '600',
                                                border: '1px solid #C4B5FD', backgroundColor: '#fff', color: '#6D28D9', cursor: 'pointer'
                                            }}>
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                    {attendanceData.length === 0 ? (
                                        <p style={{ fontSize: '12px', color: '#6B7280', textAlign: 'center', padding: '16px' }}>
                                            No attendance entries found for this contractor in the selected period.
                                        </p>
                                    ) : (
                                        <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                            {attendanceData.map((item, idx) => (
                                                <div key={idx} style={{
                                                    display: 'flex', gap: '16px', padding: '8px 12px',
                                                    borderRadius: '6px', marginBottom: '4px', backgroundColor: '#fff',
                                                    border: '1px solid #E5E7EB', fontSize: '12px'
                                                }}>
                                                    <span style={{ fontWeight: '600' }}>{item.date || '-'}</span>
                                                    <span>{item.category || item.worker_type || '-'}</span>
                                                    <span>{item.workers || item.count || 0} workers</span>
                                                    <span style={{ color: '#059669' }}>
                                                        @{formatCurrency(item.daily_wage || item.wage || 0)}/day
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Day Entries Table */}
                            <div style={sectionTitleStyle}>
                                <Calendar size={16} />
                                Day Entries
                            </div>
                            <div style={{ overflowX: 'auto', marginBottom: '20px' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr>
                                            <th style={{ ...thStyle, width: '140px' }}>Date</th>
                                            <th style={{ ...thStyle, minWidth: '160px' }}>Category</th>
                                            <th style={{ ...thStyle, width: '90px' }}>Workers</th>
                                            <th style={{ ...thStyle, width: '120px' }}>Daily Wage (Rs.)</th>
                                            <th style={{ ...thStyle, width: '120px' }}>Amount (Rs.)</th>
                                            <th style={{ ...thStyle, width: '36px' }}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {dayEntries.map((entry, idx) => (
                                            <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                                                <td style={tdStyle}>
                                                    <input type="date" value={entry.date}
                                                        onChange={(e) => updateDayEntry(idx, 'date', e.target.value)}
                                                        style={cellInputStyle}
                                                    />
                                                </td>
                                                <td style={tdStyle}>
                                                    <input type="text" value={entry.category}
                                                        onChange={(e) => updateDayEntry(idx, 'category', e.target.value)}
                                                        placeholder="e.g., Mason, Helper, Carpenter"
                                                        style={{ ...cellInputStyle, width: '100%' }}
                                                    />
                                                </td>
                                                <td style={tdStyle}>
                                                    <input type="number" value={entry.count}
                                                        onChange={(e) => updateDayEntry(idx, 'count', parseFloat(e.target.value) || 0)}
                                                        style={numInputStyle} min="0" step="1"
                                                    />
                                                </td>
                                                <td style={tdStyle}>
                                                    <input type="number" value={entry.daily_wage}
                                                        onChange={(e) => updateDayEntry(idx, 'daily_wage', parseFloat(e.target.value) || 0)}
                                                        style={numInputStyle} min="0" step="1"
                                                    />
                                                </td>
                                                <td style={tdStyle}>
                                                    <span style={{
                                                        display: 'block', padding: '6px 8px', fontSize: '12px',
                                                        fontWeight: '700', textAlign: 'right', color: '#059669',
                                                        backgroundColor: '#F0FDF4', borderRadius: '6px'
                                                    }}>
                                                        {formatCurrency(entry.amount)}
                                                    </span>
                                                </td>
                                                <td style={tdStyle}>
                                                    <button type="button" onClick={() => removeDayEntry(idx)}
                                                        disabled={dayEntries.length <= 1}
                                                        style={{
                                                            background: 'none', border: 'none',
                                                            cursor: dayEntries.length <= 1 ? 'not-allowed' : 'pointer',
                                                            color: dayEntries.length <= 1 ? '#D1D5DB' : '#EF4444', padding: '4px'
                                                        }}
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <button type="button" onClick={addDayEntry} style={{
                                padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: '600',
                                border: '1px dashed var(--border)', backgroundColor: 'var(--bg-main)',
                                color: 'var(--primary)', cursor: 'pointer', display: 'flex',
                                alignItems: 'center', gap: '6px', marginBottom: '24px'
                            }}>
                                <Plus size={14} /> Add Row
                            </button>
                        </>
                    )}

                    {/* ===== DEDUCTIONS (both modes) ===== */}
                    <div style={{
                        padding: '16px', borderRadius: '10px', border: '1px solid var(--border)',
                        backgroundColor: 'var(--bg-main)', marginBottom: '24px'
                    }}>
                        <div style={{ ...sectionTitleStyle, justifyContent: 'space-between' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Trash2 size={16} />
                                Deductions
                            </span>
                            <button type="button" onClick={addDeduction} style={{
                                padding: '4px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: '600',
                                border: '1px dashed var(--border)', backgroundColor: 'var(--bg-card)',
                                color: 'var(--primary)', cursor: 'pointer', display: 'flex',
                                alignItems: 'center', gap: '4px'
                            }}>
                                <Plus size={12} /> Add
                            </button>
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr>
                                    <th style={{ ...thStyle, textAlign: 'left' }}>Description</th>
                                    <th style={{ ...thStyle, width: '150px', textAlign: 'right' }}>Amount (Rs.)</th>
                                    <th style={{ ...thStyle, width: '36px' }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {deductions.map((ded, idx) => (
                                    <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td style={tdStyle}>
                                            <input type="text" value={ded.description}
                                                onChange={(e) => updateDeduction(idx, 'description', e.target.value)}
                                                placeholder="Deduction description"
                                                style={{ ...cellInputStyle, width: '100%' }}
                                            />
                                        </td>
                                        <td style={tdStyle}>
                                            <input type="number" value={ded.amount}
                                                onChange={(e) => updateDeduction(idx, 'amount', parseFloat(e.target.value) || 0)}
                                                style={{ ...numInputStyle, width: '140px' }} min="0" step="0.01"
                                            />
                                        </td>
                                        <td style={tdStyle}>
                                            <button type="button" onClick={() => removeDeduction(idx)} style={{
                                                background: 'none', border: 'none', cursor: 'pointer',
                                                color: '#EF4444', padding: '4px'
                                            }}>
                                                <Trash2 size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* ===== FINANCIAL SUMMARY ===== */}
                    <div style={{
                        display: 'flex', justifyContent: 'flex-end', marginBottom: '24px'
                    }}>
                        <div style={{
                            padding: '20px 24px', borderRadius: '10px',
                            border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)',
                            minWidth: '320px'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Gross Amount:</span>
                                <span style={{ fontSize: '13px', fontWeight: '600' }}>Rs. {formatCurrency(grossAmount)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <span style={{ fontSize: '13px', color: '#EF4444' }}>Total Deductions:</span>
                                <span style={{ fontSize: '13px', fontWeight: '600', color: '#EF4444' }}>-Rs. {formatCurrency(totalDeductions)}</span>
                            </div>
                            <div style={{
                                display: 'flex', justifyContent: 'space-between', marginBottom: '12px',
                                paddingBottom: '12px', borderBottom: '1px solid var(--border)'
                            }}>
                                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Net Amount:</span>
                                <span style={{ fontSize: '13px', fontWeight: '600' }}>Rs. {formatCurrency(netAmount)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>GST (%):</span>
                                <input type="number" value={gstPercent}
                                    onChange={(e) => setGstPercent(parseFloat(e.target.value) || 0)}
                                    style={{ ...numInputStyle, width: '80px' }} min="0" max="100" step="0.5"
                                />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>GST Amount:</span>
                                <span style={{ fontSize: '13px', fontWeight: '600' }}>Rs. {formatCurrency(gstAmount)}</span>
                            </div>
                            <div style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                paddingTop: '12px', borderTop: '2px solid var(--primary)'
                            }}>
                                <span style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>Payable Amount:</span>
                                <span style={{ fontSize: '18px', fontWeight: '800', color: '#059669' }}>Rs. {formatCurrency(payableAmount)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Notes */}
                    <div style={{ marginBottom: '8px' }}>
                        <label style={labelStyle}>Notes / Remarks</label>
                        <textarea value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Any additional notes for this bill..."
                            rows={3}
                            style={{
                                ...inputStyle, resize: 'vertical', fontFamily: 'inherit'
                            }}
                        />
                    </div>
                </div>

                {/* Footer */}
                <div style={{
                    padding: '16px 24px', borderTop: '1px solid var(--border)',
                    display: 'flex', justifyContent: 'flex-end', gap: '12px',
                    backgroundColor: 'var(--bg-main)'
                }}>
                    <button type="button" onClick={onClose} style={{
                        padding: '10px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: '600',
                        border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)',
                        color: 'var(--text-secondary)', cursor: 'pointer'
                    }}>
                        Cancel
                    </button>
                    <button type="button" onClick={() => handleSubmit(false)} disabled={isSaving} style={{
                        padding: '10px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: '600',
                        border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)',
                        color: 'var(--primary)', cursor: isSaving ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', gap: '6px'
                    }}>
                        {isSaving && <Loader2 size={14} className="animate-spin" />}
                        Save as Draft
                    </button>
                    {!editData && (
                        <button type="button" onClick={() => handleSubmit(true)} disabled={isSaving} style={{
                            padding: '10px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: '600',
                            border: 'none', backgroundColor: 'var(--primary)', color: '#fff',
                            cursor: isSaving ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', gap: '6px'
                        }}>
                            {isSaving && <Loader2 size={14} className="animate-spin" />}
                            Submit for Approval
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SubcontractorBillModal;

import React, { useState, useEffect, useMemo } from 'react';
import { X, Plus, Trash2, FileText, IndianRupee, Loader2 } from 'lucide-react';
import { quotationAPI } from '../utils/api';

const emptyItem = () => ({
    id: Date.now() + Math.random(),
    item_name: '',
    description: '',
    unit: 'Nos',
    qty: '',
    rate: '',
});

const DEFAULT_TERMS = `1. Prices are valid for the quotation validity period only.
2. All works shall comply with applicable IS codes.
3. GST and applicable taxes as per government norms.
4. Any change in scope will be charged extra.`;

const DEFAULT_PAYMENT = `1. 30% advance with work order confirmation.
2. 40% on achievement of 50% physical progress.
3. 25% on practical completion of work.
4. 5% retention released after defect liability period.`;

const QuotationModal = ({ isOpen, onClose, onSuccess, initial }) => {
    const isEdit = !!initial?.id;
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        client_name: '',
        client_email: '',
        client_phone: '',
        client_address: '',
        project_name: '',
        project_address: '',
        scope_of_work: '',
        validity: '30 days',
        payment_schedule: DEFAULT_PAYMENT,
        terms_conditions: DEFAULT_TERMS,
        notes: '',
        status: 'Draft',
    });
    const [items, setItems] = useState([emptyItem()]);

    useEffect(() => {
        if (!isOpen) return;
        if (initial) {
            setForm({
                client_name: initial.client_name || '',
                client_email: initial.client_email || '',
                client_phone: initial.client_phone || '',
                client_address: initial.client_address || '',
                project_name: initial.project_name || '',
                project_address: initial.project_address || '',
                scope_of_work: initial.scope_of_work || '',
                validity: initial.validity || '30 days',
                payment_schedule: initial.payment_schedule || DEFAULT_PAYMENT,
                terms_conditions: initial.terms_conditions || DEFAULT_TERMS,
                notes: initial.notes || '',
                status: initial.status || 'Draft',
            });
            setItems((initial.items && initial.items.length)
                ? initial.items.map((it, idx) => ({
                    id: idx + Date.now(),
                    item_name: it.item_name || '',
                    description: it.description || '',
                    unit: it.unit || 'Nos',
                    qty: it.qty ?? '',
                    rate: it.rate ?? '',
                }))
                : [emptyItem()]);
        } else {
            setForm({
                client_name: '',
                client_email: '',
                client_phone: '',
                client_address: '',
                project_name: '',
                project_address: '',
                scope_of_work: '',
                validity: '30 days',
                payment_schedule: DEFAULT_PAYMENT,
                terms_conditions: DEFAULT_TERMS,
                notes: '',
                status: 'Draft',
            });
            setItems([emptyItem()]);
        }
    }, [isOpen, initial]);

    const total = useMemo(() => {
        return items.reduce((sum, it) => {
            const qty = parseFloat(it.qty) || 0;
            const rate = parseFloat(it.rate) || 0;
            return sum + qty * rate;
        }, 0);
    }, [items]);

    if (!isOpen) return null;

    const updateItem = (id, key, value) => {
        setItems(items.map(it => it.id === id ? { ...it, [key]: value } : it));
    };
    const addItem = () => setItems([...items, emptyItem()]);
    const removeItem = (id) => {
        if (items.length <= 1) return;
        setItems(items.filter(it => it.id !== id));
    };

    const handleSave = async () => {
        if (!form.client_name.trim()) { alert('Client name is required'); return; }
        if (!form.project_name.trim()) { alert('Project name is required'); return; }
        const validItems = items
            .filter(it => it.item_name.trim())
            .map(it => ({
                item_name: it.item_name.trim(),
                description: it.description || '',
                unit: it.unit || 'Nos',
                qty: parseFloat(it.qty) || 0,
                rate: parseFloat(it.rate) || 0,
                amount: (parseFloat(it.qty) || 0) * (parseFloat(it.rate) || 0),
            }));
        if (validItems.length === 0) { alert('Add at least one BOQ item'); return; }

        const payload = {
            ...form,
            items: validItems,
            total_amount: validItems.reduce((s, it) => s + it.amount, 0),
        };

        setSaving(true);
        try {
            if (isEdit) await quotationAPI.update(initial.id, payload);
            else await quotationAPI.create(payload);
            onSuccess?.();
        } catch (err) {
            console.error(err);
            alert(err.response?.data?.detail || 'Failed to save quotation');
        }
        setSaving(false);
    };

    return (
        <div style={overlayStyle} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div style={modalStyle}>
                <div style={headerStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#DBEAFE', color: '#1D4ED8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <FileText size={18} />
                        </div>
                        <div>
                            <div style={{ fontSize: 17, fontWeight: 800, color: '#0F172A' }}>
                                {isEdit ? `Edit Quotation ${initial?.quotation_no || ''}` : 'Create Quotation'}
                            </div>
                            <div style={{ fontSize: 12, color: '#64748B' }}>Detailed Construction Quotation & BOQ</div>
                        </div>
                    </div>
                    <button onClick={onClose} style={iconBtn}><X size={20} /></button>
                </div>

                <div style={bodyStyle}>
                    {/* Client */}
                    <Section title="Client Details">
                        <Row>
                            <Field label="Client Name *">
                                <input style={inputStyle} value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} />
                            </Field>
                            <Field label="Client Email">
                                <input style={inputStyle} type="email" value={form.client_email} onChange={(e) => setForm({ ...form, client_email: e.target.value })} />
                            </Field>
                        </Row>
                        <Row>
                            <Field label="Phone (with country code for WhatsApp)">
                                <input style={inputStyle} value={form.client_phone} onChange={(e) => setForm({ ...form, client_phone: e.target.value })} placeholder="+91 98XXXXXXXX" />
                            </Field>
                            <Field label="Client Address">
                                <input style={inputStyle} value={form.client_address} onChange={(e) => setForm({ ...form, client_address: e.target.value })} />
                            </Field>
                        </Row>
                    </Section>

                    {/* Project / Summary */}
                    <Section title="Quotation Summary">
                        <Row>
                            <Field label="Project Name *">
                                <input style={inputStyle} value={form.project_name} onChange={(e) => setForm({ ...form, project_name: e.target.value })} />
                            </Field>
                            <Field label="Project / Site Address">
                                <input style={inputStyle} value={form.project_address} onChange={(e) => setForm({ ...form, project_address: e.target.value })} />
                            </Field>
                        </Row>
                        <Row>
                            <Field label="Scope of Work">
                                <input style={inputStyle} value={form.scope_of_work} onChange={(e) => setForm({ ...form, scope_of_work: e.target.value })} placeholder="e.g. G+2 RCC Framed Residential Construction" />
                            </Field>
                            <Field label="Validity">
                                <input style={inputStyle} value={form.validity} onChange={(e) => setForm({ ...form, validity: e.target.value })} placeholder="30 days" />
                            </Field>
                        </Row>
                    </Section>

                    {/* BOQ items */}
                    <Section title="Detailed Brief Quotation (BOQ)" right={
                        <button onClick={addItem} style={addBtn}><Plus size={14} /> Add Item</button>
                    }>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                <thead>
                                    <tr style={{ backgroundColor: '#F8FAFC' }}>
                                        <th style={boqTh}>#</th>
                                        <th style={{ ...boqTh, minWidth: 220 }}>Item / Description</th>
                                        <th style={{ ...boqTh, width: 90 }}>Unit</th>
                                        <th style={{ ...boqTh, width: 90 }}>Qty</th>
                                        <th style={{ ...boqTh, width: 120 }}>Rate (₹)</th>
                                        <th style={{ ...boqTh, width: 130, textAlign: 'right' }}>Amount</th>
                                        <th style={{ ...boqTh, width: 40 }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((it, idx) => {
                                        const qty = parseFloat(it.qty) || 0;
                                        const rate = parseFloat(it.rate) || 0;
                                        return (
                                            <tr key={it.id} style={{ borderTop: '1px solid #F1F5F9' }}>
                                                <td style={boqTd}>{idx + 1}</td>
                                                <td style={boqTd}>
                                                    <input style={boqInput} value={it.item_name} placeholder="Item name"
                                                        onChange={(e) => updateItem(it.id, 'item_name', e.target.value)} />
                                                    <input style={{ ...boqInput, marginTop: 4, fontSize: 11, color: '#64748B' }} value={it.description}
                                                        placeholder="Description / specification (optional)"
                                                        onChange={(e) => updateItem(it.id, 'description', e.target.value)} />
                                                </td>
                                                <td style={boqTd}>
                                                    <input style={boqInput} value={it.unit} onChange={(e) => updateItem(it.id, 'unit', e.target.value)} />
                                                </td>
                                                <td style={boqTd}>
                                                    <input style={boqInput} type="number" min="0" step="any" value={it.qty}
                                                        onChange={(e) => updateItem(it.id, 'qty', e.target.value)} />
                                                </td>
                                                <td style={boqTd}>
                                                    <input style={boqInput} type="number" min="0" step="any" value={it.rate}
                                                        onChange={(e) => updateItem(it.id, 'rate', e.target.value)} />
                                                </td>
                                                <td style={{ ...boqTd, textAlign: 'right', fontWeight: 700, color: '#0F172A' }}>
                                                    ₹{(qty * rate).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                                </td>
                                                <td style={boqTd}>
                                                    <button onClick={() => removeItem(it.id)} style={trashBtn} disabled={items.length <= 1}>
                                                        <Trash2 size={14} />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr style={{ backgroundColor: '#F1F5F9' }}>
                                        <td colSpan={5} style={{ ...boqTd, textAlign: 'right', fontWeight: 800 }}>Total Amount</td>
                                        <td style={{ ...boqTd, textAlign: 'right', fontWeight: 800, color: '#1D4ED8' }}>
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                                <IndianRupee size={13} />{total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                            </span>
                                        </td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </Section>

                    <Section title="Payment Schedule">
                        <textarea rows={4} style={textareaStyle} value={form.payment_schedule}
                            onChange={(e) => setForm({ ...form, payment_schedule: e.target.value })} />
                    </Section>

                    <Section title="Terms & Conditions">
                        <textarea rows={5} style={textareaStyle} value={form.terms_conditions}
                            onChange={(e) => setForm({ ...form, terms_conditions: e.target.value })} />
                    </Section>

                    {isEdit && (
                        <Section title="Status">
                            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} style={{ ...inputStyle, maxWidth: 240 }}>
                                <option value="Draft">Draft</option>
                                <option value="Sent">Sent</option>
                                <option value="Accepted">Accepted</option>
                                <option value="Rejected">Rejected</option>
                            </select>
                        </Section>
                    )}
                </div>

                <div style={footerStyle}>
                    <button onClick={onClose} style={cancelBtn} disabled={saving}>Cancel</button>
                    <button onClick={handleSave} style={saveBtn} disabled={saving}>
                        {saving ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <FileText size={16} />}
                        {isEdit ? 'Save Changes' : 'Create Quotation'}
                    </button>
                </div>
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
        </div>
    );
};

const Section = ({ title, right, children }) => (
    <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1E3A8A' }}>{title}</h4>
            {right}
        </div>
        {children}
    </div>
);

const Row = ({ children }) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 10 }}>{children}</div>
);

const Field = ({ label, children }) => (
    <div>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4, display: 'block' }}>{label}</label>
        {children}
    </div>
);

const overlayStyle = {
    position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20,
};
const modalStyle = {
    backgroundColor: 'white', borderRadius: 14, width: '100%', maxWidth: 980,
    maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
};
const headerStyle = {
    padding: '18px 22px', borderBottom: '1px solid #E2E8F0',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
};
const bodyStyle = { padding: '18px 22px', overflowY: 'auto', flex: 1 };
const footerStyle = {
    padding: '14px 22px', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end', gap: 10,
};
const inputStyle = {
    width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13, outline: 'none',
};
const textareaStyle = { ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 };
const iconBtn = { background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', padding: 4 };
const addBtn = {
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8,
    border: '1px dashed #3B82F6', backgroundColor: '#EFF6FF', color: '#1D4ED8', fontSize: 12, fontWeight: 600, cursor: 'pointer',
};
const trashBtn = {
    background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', padding: 4,
};
const boqTh = { padding: '8px 10px', textAlign: 'left', fontSize: 11, color: '#64748B', fontWeight: 700, textTransform: 'uppercase' };
const boqTd = { padding: '8px 10px', verticalAlign: 'top' };
const boqInput = { width: '100%', padding: '7px 9px', borderRadius: 6, border: '1px solid #E2E8F0', fontSize: 13, outline: 'none' };
const cancelBtn = { padding: '9px 18px', borderRadius: 8, border: '1px solid #E2E8F0', backgroundColor: 'white', cursor: 'pointer', fontWeight: 600, color: '#475569' };
const saveBtn = {
    padding: '9px 18px', borderRadius: 8, border: 'none', backgroundColor: '#3B82F6', color: 'white',
    fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
};

export default QuotationModal;

import React, { useState } from 'react';
import { X, Plus, Trash2, Download, Printer, Save, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { materialAPI } from '../utils/api';

const MRNModal = ({ isOpen, onClose }) => {
    const [materials, setMaterials] = useState([]);
    const [items, setItems] = useState([{ id: 1, code: '', desc: '', uom: '', ordered: '', received: '', accepted: '', rejected: '', batch: '', remarks: '' }]);
    const [details, setDetails] = useState({
        mrnNo: 'MRN-2024-001',
        invoiceNo: '',
        receiptDate: new Date().toISOString().split('T')[0],
        deliveryNoteNo: '',
        poNo: '',
        vehicleNo: '',
        supplierDetails: '',
        grnRef: '',
        packagingCondition: 'Good',
        inspectionRequired: 'No',
        observations: ''
    });

    React.useEffect(() => {
        if (isOpen) {
            materialAPI.getAll().then(res => setMaterials(res.data || [])).catch(() => { });
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const addItem = () => {
        setItems([...items, { id: items.length + 1, code: '', desc: '', uom: '', ordered: '', received: '', accepted: '', rejected: '', batch: '', remarks: '' }]);
    };

    const removeItem = (id) => {
        if (items.length > 1) {
            setItems(items.filter(item => item.id !== id));
        }
    };

    const updateItem = (id, field, value) => {
        const newItems = items.map(item => {
            if (item.id === id) {
                const updatedItem = { ...item, [field]: value };
                if (field === 'desc') {
                    const selected = materials.find(m => m.name === value);
                    if (selected) {
                        updatedItem.uom = selected.unit;
                    }
                }
                return updatedItem;
            }
            return item;
        });
        setItems(newItems);
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(6px)'
        }}>
            <div className="card animate-fade-in" style={{
                width: '95vw',
                maxWidth: '1100px',
                height: '95vh',
                backgroundColor: 'white',
                display: 'flex',
                flexDirection: 'column',
                padding: '0',
                overflow: 'hidden',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
            }}>
                {/* Header */}
                <div style={{ padding: '20px 32px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', backgroundColor: '#0F172A', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                            <FileText size={20} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '18px', color: '#0F172A', fontWeight: '700' }}>Material Received Note (MRN)</h2>
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>PAARISHIV HOMES - Site Inventory Entry</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={24} /></button>
                </div>

                {/* Scrollable Content */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>

                    {/* MRN Info Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px', marginBottom: '32px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label className="mrn-label">MRN No.</label>
                                <input value={details.mrnNo} readOnly className="mrn-input" style={{ backgroundColor: '#F1F5F9' }} />
                            </div>
                            <div>
                                <label className="mrn-label">Date of Receipt</label>
                                <input type="date" value={details.receiptDate} onChange={(e) => setDetails({ ...details, receiptDate: e.target.value })} className="mrn-input" />
                            </div>
                            <div>
                                <label className="mrn-label">Purchase Order (PO) No.</label>
                                <input placeholder="Enter PO Number" value={details.poNo} onChange={(e) => setDetails({ ...details, poNo: e.target.value })} className="mrn-input" />
                            </div>
                            <div>
                                <label className="mrn-label">Supplier Name & Address</label>
                                <textarea rows="2" placeholder="Enter Supplier Details" value={details.supplierDetails} onChange={(e) => setDetails({ ...details, supplierDetails: e.target.value })} className="mrn-input" style={{ resize: 'none' }} />
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label className="mrn-label">Supplier Invoice/Challan No. & Date</label>
                                <input placeholder="Invoice No. / Date" value={details.invoiceNo} onChange={(e) => setDetails({ ...details, invoiceNo: e.target.value })} className="mrn-input" />
                            </div>
                            <div>
                                <label className="mrn-label">Delivery Note No.</label>
                                <input placeholder="DN Number" value={details.deliveryNoteNo} onChange={(e) => setDetails({ ...details, deliveryNoteNo: e.target.value })} className="mrn-input" />
                            </div>
                            <div>
                                <label className="mrn-label">Transporter / Vehicle No.</label>
                                <input placeholder="Vehicle Number" value={details.vehicleNo} onChange={(e) => setDetails({ ...details, vehicleNo: e.target.value })} className="mrn-input" />
                            </div>
                            <div>
                                <label className="mrn-label">GRN/Delivery Ref. No. (if any)</label>
                                <input placeholder="Reference Number" value={details.grnRef} onChange={(e) => setDetails({ ...details, grnRef: e.target.value })} className="mrn-input" />
                            </div>
                        </div>
                    </div>

                    {/* Material Details Table */}
                    <div style={{ marginBottom: '32px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h3 style={{ fontSize: '16px', fontWeight: '700' }}>Material Details</h3>
                            <button className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={addItem}>
                                <Plus size={14} /> Add Material
                            </button>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table className="mrn-table">
                                <thead>
                                    <tr>
                                        <th style={{ minWidth: '40px' }}>S.No</th>
                                        <th style={{ minWidth: '100px' }}>Item Code</th>
                                        <th style={{ minWidth: '200px' }}>Material Description</th>
                                        <th style={{ minWidth: '80px' }}>UOM</th>
                                        <th style={{ minWidth: '80px' }}>Qty Ordered</th>
                                        <th style={{ minWidth: '80px' }}>Qty Received</th>
                                        <th style={{ minWidth: '80px' }}>Qty Accepted</th>
                                        <th style={{ minWidth: '80px' }}>Qty Rejected</th>
                                        <th style={{ minWidth: '100px' }}>Batch No.</th>
                                        <th style={{ minWidth: '150px' }}>Remarks</th>
                                        <th style={{ minWidth: '40px' }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((item, index) => (
                                        <tr key={item.id}>
                                            <td style={{ textAlign: 'center' }}>{index + 1}</td>
                                            <td><input value={item.code} onChange={(e) => updateItem(item.id, 'code', e.target.value)} className="table-input" placeholder="CODE" /></td>
                                            <td>
                                                <select value={item.desc} onChange={(e) => updateItem(item.id, 'desc', e.target.value)} className="table-input">
                                                    <option value="">Select Material</option>
                                                    {materials.map(m => (
                                                        <option key={m.id || m._id} value={m.name}>{m.name}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td><input value={item.uom} readOnly className="table-input" placeholder="Unit" style={{ backgroundColor: '#f8fafc' }} /></td>
                                            <td><input type="number" value={item.ordered} onChange={(e) => updateItem(item.id, 'ordered', e.target.value)} className="table-input" placeholder="0" /></td>
                                            <td><input type="number" value={item.received} onChange={(e) => updateItem(item.id, 'received', e.target.value)} className="table-input" placeholder="0" /></td>
                                            <td><input type="number" value={item.accepted} onChange={(e) => updateItem(item.id, 'accepted', e.target.value)} className="table-input" placeholder="0" /></td>
                                            <td><input type="number" value={item.rejected} onChange={(e) => updateItem(item.id, 'rejected', e.target.value)} className="table-input" placeholder="0" /></td>
                                            <td><input value={item.batch} onChange={(e) => updateItem(item.id, 'batch', e.target.value)} className="table-input" placeholder="Batch" /></td>
                                            <td><input value={item.remarks} onChange={(e) => updateItem(item.id, 'remarks', e.target.value)} className="table-input" placeholder="..." /></td>
                                            <td>
                                                <button onClick={() => removeItem(item.id)} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer' }}>
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Condition on Receipt Section */}
                    <div className="card" style={{ padding: '24px', backgroundColor: '#F8FAFC', marginBottom: '32px' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '20px' }}>Condition on Receipt</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '40px' }}>
                            <div>
                                <p style={{ fontSize: '13px', fontWeight: '600', marginBottom: '12px' }}>Packaging Condition:</p>
                                <div style={{ display: 'flex', gap: '20px' }}>
                                    {['Good', 'Damaged', 'Others'].map(cond => (
                                        <label key={cond} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                                            <input
                                                type="radio"
                                                name="packaging"
                                                checked={details.packagingCondition === cond}
                                                onChange={() => setDetails({ ...details, packagingCondition: cond })}
                                            /> {cond}
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <p style={{ fontSize: '13px', fontWeight: '600', marginBottom: '12px' }}>Inspection Required:</p>
                                <div style={{ display: 'flex', gap: '24px' }}>
                                    {['Yes', 'No'].map(ans => (
                                        <label key={ans} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                                            <input
                                                type="radio"
                                                name="inspection"
                                                checked={details.inspectionRequired === ans}
                                                onChange={() => setDetails({ ...details, inspectionRequired: ans })}
                                            /> {ans}
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div style={{ marginTop: '20px' }}>
                            <label className="mrn-label">Observation / Remarks</label>
                            <input
                                placeholder="Enter any site observations"
                                value={details.observations}
                                onChange={(e) => setDetails({ ...details, observations: e.target.value })}
                                className="mrn-input"
                            />
                        </div>
                    </div>

                    {/* Acknowledgement Footer */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '60px', marginTop: '40px' }}>
                        <div style={{ borderTop: '1px solid #CBD5E1', paddingTop: '16px' }}>
                            <p style={{ fontSize: '13px', fontWeight: '700', marginBottom: '2px' }}>Received By (Site Engineer)</p>
                            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '40px' }}>I confirm the quantity received as per above details.</p>
                            <div style={{ fontSize: '12px', borderBottom: '1px dotted #94A3B8', width: '200px' }}></div>
                            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Name & Signature</p>
                        </div>
                        <div style={{ borderTop: '1px solid #CBD5E1', paddingTop: '16px' }}>
                            <p style={{ fontSize: '13px', fontWeight: '700', marginBottom: '2px' }}>Verified By (Project Engineer)</p>
                            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '40px' }}>Verified against PO and Invoice details.</p>
                            <div style={{ fontSize: '12px', borderBottom: '1px dotted #94A3B8', width: '200px' }}></div>
                            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Name & Signature</p>
                        </div>
                    </div>

                </div>

                {/* Footer Actions */}
                <div style={{ padding: '24px 32px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '12px', backgroundColor: '#F8FAFC' }}>
                    <button className="btn btn-outline"><Printer size={18} /> Print MRN</button>
                    <button className="btn btn-outline"><Download size={18} /> Export PDF</button>
                    <button className="btn btn-primary" style={{ padding: '12px 32px' }} onClick={onClose}>
                        <CheckCircle size={18} /> Save & Update Stock
                    </button>
                </div>
            </div>

            <style>{`
                .mrn-label {
                    display: block;
                    margin-bottom: 6px;
                    font-size: 13px;
                    font-weight: 600;
                    color: #334155;
                }
                .mrn-input {
                    width: 100%;
                    padding: 10px 12px;
                    border-radius: 8px;
                    border: 1px solid #E2E8F0;
                    outline: none;
                    font-size: 14px;
                    transition: border-color 0.2s;
                }
                .mrn-input:focus {
                    border-color: #0F172A;
                }
                .mrn-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 12px;
                }
                .mrn-table th {
                    background-color: #F1F5F9;
                    padding: 12px 10px;
                    text-align: left;
                    border: 1px solid #E2E8F0;
                    color: #475569;
                    font-weight: 700;
                    text-transform: uppercase;
                    font-size: 10px;
                    letter-spacing: 0.5px;
                }
                .mrn-table td {
                    padding: 0;
                    border: 1px solid #E2E8F0;
                }
                .table-input {
                    width: 100%;
                    padding: 10px;
                    border: none;
                    outline: none;
                    background: transparent;
                }
                .table-input:focus {
                    background-color: #F8FAFC;
                }
            `}</style>
        </div>
    );
};

export default MRNModal;

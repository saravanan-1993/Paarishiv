import React from 'react';
import { X, Package, Calendar, Truck, User, MapPin, ClipboardCheck, FileText, Download } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const GRNDetailModal = ({ isOpen, onClose, grn }) => {
    if (!isOpen || !grn) return null;

    const formattedDate = grn.created_at ? new Date(grn.created_at).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    }) : '\u2014';

    const grnNum = `GRN-${grn.id.slice(-6).toUpperCase()}`;

    const handleDownloadSlip = () => {
        try {
            const doc = new jsPDF();

            // Header
            doc.setFontSize(20);
            doc.setTextColor(59, 130, 246);
            doc.setFont('helvetica', 'bold');
            doc.text('Goods Received Note', 14, 22);

            doc.setFontSize(12);
            doc.setTextColor(15, 23, 42);
            doc.text(grnNum, 14, 32);

            doc.setFontSize(10);
            doc.setTextColor(100, 116, 139);
            doc.setFont('helvetica', 'normal');
            doc.text(`Date: ${formattedDate}`, 14, 40);
            doc.text(`Status: ${grn.status || 'Received'}`, 14, 46);

            // Details table using autoTable for proper layout
            autoTable(doc, {
                startY: 52,
                body: [
                    ['Reference PO', `PO-${(grn.po_id || '').slice(-6).toUpperCase()}`, 'Vehicle', grn.vehicle_number || 'N/A'],
                    ['Vendor', grn.vendor_name || 'N/A', 'Invoice', grn.invoice_number || 'N/A'],
                    ['Project', grn.project_name || 'N/A', '', ''],
                ],
                theme: 'plain',
                styles: { fontSize: 10, cellPadding: 3 },
                columnStyles: {
                    0: { fontStyle: 'bold', cellWidth: 30, textColor: [100, 116, 139] },
                    1: { cellWidth: 65 },
                    2: { fontStyle: 'bold', cellWidth: 25, textColor: [100, 116, 139] },
                    3: { cellWidth: 55 },
                },
                margin: { left: 14, right: 14 },
            });

            // Items Table
            const items = grn.items || [];
            const detailsEndY = (doc.lastAutoTable?.finalY || 80) + 6;
            autoTable(doc, {
                startY: detailsEndY,
                head: [['S.No', 'Item Name', 'Unit', 'PO Qty', 'Received', 'Rejected']],
                body: items.map((item, i) => [
                    i + 1,
                    item.name || 'Item',
                    item.unit || 'Nos',
                    item.po_qty || 0,
                    item.received_qty || 0,
                    item.rejected_qty || 0
                ]),
                theme: 'striped',
                headStyles: { fillColor: [59, 130, 246] },
                styles: { fontSize: 10 },
            });

            // Footer
            const finalY = (doc.lastAutoTable?.finalY || 150) + 20;
            doc.setFontSize(10);
            doc.setTextColor(100, 116, 139);
            doc.text('Received By: ___________________', 14, finalY);
            doc.text('Checked By: ___________________', 110, finalY);
            doc.text('Date: ___________________', 14, finalY + 10);

            doc.setFontSize(8);
            doc.text('This is a system-generated GRN slip.', 14, finalY + 25);

            doc.save(`${grnNum}_Slip.pdf`);
        } catch (err) {
            console.error('GRN PDF error:', err);
            alert('Failed to generate PDF');
        }
    };

    return (
        <div className="modal-overlay" style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)'
        }}>
            <div className="card animate-fade-in" style={{
                backgroundColor: 'white', width: '100%', maxWidth: '700px',
                borderRadius: '12px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                display: 'flex', flexDirection: 'column', maxHeight: '90vh'
            }}>
                <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', backgroundColor: '#f0f9ff', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0ea5e9' }}>
                            <Package size={20} />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '18px', fontWeight: '800' }}>{grnNum}</h3>
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Received on {formattedDate}</p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span className="badge badge-success">{grn.status}</span>
                        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', marginLeft: '8px' }}>
                            <X size={24} />
                        </button>
                    </div>
                </div>

                <div style={{ padding: '24px', overflowY: 'auto' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <h4 style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '800', textTransform: 'uppercase', marginBottom: '8px' }}>Reference PO</h4>
                                <div style={{ fontWeight: '700', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <FileText size={16} /> PO-{grn.po_id.slice(-6).toUpperCase()}
                                </div>
                            </div>
                            <div>
                                <h4 style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '800', textTransform: 'uppercase', marginBottom: '8px' }}>Vehicle Details</h4>
                                <div style={{ fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Truck size={16} color="#f97316" /> {grn.vehicle_number || 'N/A'}
                                </div>
                                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>Invoice: {grn.invoice_number || 'N/A'}</div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <h4 style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '800', textTransform: 'uppercase', marginBottom: '8px' }}>Verification Status</h4>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981', fontWeight: '700', fontSize: '13px' }}>
                                    <ClipboardCheck size={16} /> Verified & Updated Stock
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style={{ marginBottom: '24px' }}>
                        <h4 style={{ fontSize: '14px', fontWeight: '800', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>Items Received</h4>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f8fafc' }}>
                                    <th style={{ textAlign: 'left', padding: '10px', fontSize: '12px', color: 'var(--text-muted)' }}>ITEM</th>
                                    <th style={{ textAlign: 'right', padding: '10px', fontSize: '12px', color: 'var(--text-muted)' }}>PO QTY</th>
                                    <th style={{ textAlign: 'right', padding: '10px', fontSize: '12px', color: 'var(--text-muted)' }}>RECEIVED</th>
                                    <th style={{ textAlign: 'right', padding: '10px', fontSize: '12px', color: 'var(--text-muted)' }}>REJECTED</th>
                                </tr>
                            </thead>
                            <tbody>
                                {grn.items?.map((item, i) => (
                                    <tr key={i}>
                                        <td style={{ padding: '10px', borderBottom: '1px solid var(--border)', fontSize: '13px', fontWeight: '600' }}>{item.name}</td>
                                        <td style={{ textAlign: 'right', padding: '10px', borderBottom: '1px solid var(--border)', fontSize: '13px' }}>{item.po_qty} {item.unit}</td>
                                        <td style={{ textAlign: 'right', padding: '10px', borderBottom: '1px solid var(--border)', fontSize: '13px', color: '#10b981', fontWeight: '700' }}>{item.received_qty}</td>
                                        <td style={{ textAlign: 'right', padding: '10px', borderBottom: '1px solid var(--border)', fontSize: '13px', color: '#ef4444' }}>{item.rejected_qty}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div style={{ padding: '20px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '12px', backgroundColor: '#f8fafc', borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px' }}>
                    <button className="btn btn-outline" style={{ marginRight: 'auto' }} onClick={handleDownloadSlip}>
                        <Download size={18} /> DOWNLOAD SLIP
                    </button>
                    <button className="btn btn-outline" onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    );
};

export default GRNDetailModal;

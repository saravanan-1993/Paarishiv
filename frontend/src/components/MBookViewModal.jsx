import React from 'react';
import { X, Download, BookOpen } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const MBookViewModal = ({ isOpen, onClose, bill }) => {
    if (!isOpen || !bill) return null;

    const entries = bill.mbook_entries || [];
    const measuredBy = bill.measured_by || {};
    const checkedBy = bill.checked_by || {};
    const verifiedBy = bill.verified_by || {};

    const grandTotal = entries.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

    const formatDate = (d) => {
        if (!d) return '-';
        try {
            return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
        } catch {
            return d;
        }
    };

    const formatCurrency = (v) => {
        const num = parseFloat(v) || 0;
        return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const handleExportPDF = () => {
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        const pageWidth = doc.internal.pageSize.getWidth();

        // Company Header
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('PAARI SHIV HOMES', pageWidth / 2, 18, { align: 'center' });
        doc.setFontSize(12);
        doc.text('MEASUREMENT BOOK (MB)', pageWidth / 2, 26, { align: 'center' });

        doc.setDrawColor(0);
        doc.setLineWidth(0.5);
        doc.line(20, 30, pageWidth - 20, 30);

        // Work Details
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        const detailsY = 36;
        const leftCol = 22;
        const rightCol = pageWidth / 2 + 10;

        doc.setFont('helvetica', 'bold');
        doc.text('Name of Work:', leftCol, detailsY);
        doc.setFont('helvetica', 'normal');
        doc.text(bill.notes || bill.project_name || '-', leftCol + 32, detailsY);

        doc.setFont('helvetica', 'bold');
        doc.text('Date of Measurement:', rightCol, detailsY);
        doc.setFont('helvetica', 'normal');
        doc.text(formatDate(bill.bill_date), rightCol + 42, detailsY);

        doc.setFont('helvetica', 'bold');
        doc.text('Agreement No:', leftCol, detailsY + 6);
        doc.setFont('helvetica', 'normal');
        doc.text(bill.agreement_no || '-', leftCol + 32, detailsY + 6);

        doc.setFont('helvetica', 'bold');
        doc.text('Pg No:', rightCol, detailsY + 6);
        doc.setFont('helvetica', 'normal');
        doc.text(String(bill.mbook_page_no || '-'), rightCol + 42, detailsY + 6);

        doc.setFont('helvetica', 'bold');
        doc.text('Name of Contractor:', leftCol, detailsY + 12);
        doc.setFont('helvetica', 'normal');
        doc.text(bill.contractor_name || '-', leftCol + 42, detailsY + 12);

        doc.setFont('helvetica', 'bold');
        doc.text('Serial No:', rightCol, detailsY + 12);
        doc.setFont('helvetica', 'normal');
        doc.text(String(bill.mbook_serial_no || '-'), rightCol + 42, detailsY + 12);

        doc.setFont('helvetica', 'bold');
        doc.text('Location:', leftCol, detailsY + 18);
        doc.setFont('helvetica', 'normal');
        doc.text(bill.project_name || '-', leftCol + 32, detailsY + 18);

        doc.setFont('helvetica', 'bold');
        doc.text('Name of Engineer:', rightCol, detailsY + 18);
        doc.setFont('helvetica', 'normal');
        doc.text(measuredBy.name || '-', rightCol + 42, detailsY + 18);

        // Table
        const tableData = entries.map((e, i) => [
            i + 1,
            e.description || '-',
            e.nos || '-',
            e.length || '-',
            e.breadth || '-',
            e.height || '-',
            parseFloat(e.quantity || 0).toFixed(2),
            e.unit || '-',
            formatCurrency(e.rate),
            formatCurrency(e.amount),
            e.remarks || ''
        ]);

        // Grand total row
        tableData.push([
            '', '', '', '', '', '', '', '', { content: 'Grand Total:', styles: { fontStyle: 'bold', halign: 'right' } },
            { content: formatCurrency(grandTotal), styles: { fontStyle: 'bold' } },
            ''
        ]);

        doc.autoTable({
            startY: detailsY + 24,
            head: [['S.No', 'Description of Item', 'Nos', 'L', 'B', 'H/D', 'Quantity', 'Unit', 'Rate', 'Amount', 'Remarks']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [30, 58, 95], fontSize: 8, fontStyle: 'bold', halign: 'center' },
            styles: { fontSize: 7.5, cellPadding: 2 },
            columnStyles: {
                0: { halign: 'center', cellWidth: 12 },
                1: { cellWidth: 55 },
                2: { halign: 'center', cellWidth: 14 },
                3: { halign: 'center', cellWidth: 16 },
                4: { halign: 'center', cellWidth: 16 },
                5: { halign: 'center', cellWidth: 16 },
                6: { halign: 'right', cellWidth: 20 },
                7: { halign: 'center', cellWidth: 16 },
                8: { halign: 'right', cellWidth: 22 },
                9: { halign: 'right', cellWidth: 26 },
                10: { cellWidth: 30 }
            },
            margin: { left: 15, right: 15 }
        });

        // Signoff section
        let signY = doc.lastAutoTable.finalY + 16;
        const colWidth = (pageWidth - 40) / 3;

        // Check if signoff fits on current page
        if (signY + 30 > doc.internal.pageSize.getHeight() - 10) {
            doc.addPage();
            signY = 20;
        }

        const signSections = [
            { title: 'Measurement Recorded By:', data: measuredBy },
            { title: 'Checked By:', data: checkedBy },
            { title: 'Verified By:', data: verifiedBy }
        ];

        signSections.forEach((section, idx) => {
            const x = 20 + idx * colWidth;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.text(section.title, x, signY);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.text(`Name: ${section.data.name || '-'}`, x, signY + 7);
            doc.text(`Designation: ${section.data.designation || '-'}`, x, signY + 13);
            doc.text(`Date: ${formatDate(section.data.date)}`, x, signY + 19);
        });

        const fileName = `MBook_${bill.contractor_name || 'Bill'}_${bill.bill_date || 'undated'}.pdf`;
        doc.save(fileName);
    };

    const styles = {
        overlay: {
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', zIndex: 9999, padding: '20px'
        },
        modal: {
            backgroundColor: '#fff', borderRadius: '12px', width: '95%', maxWidth: '1000px',
            maxHeight: '90vh', display: 'flex', flexDirection: 'column',
            boxShadow: '0 25px 60px rgba(0,0,0,0.3)', overflow: 'hidden'
        },
        header: {
            background: 'linear-gradient(135deg, #1e3a5f 0%, #2F5D8A 100%)',
            padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        },
        headerLeft: { display: 'flex', alignItems: 'center', gap: '12px' },
        headerIcon: {
            width: '40px', height: '40px', background: 'rgba(255,255,255,0.15)', borderRadius: '10px',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        },
        headerTitle: { color: '#fff', fontSize: '18px', fontWeight: '800', margin: 0 },
        headerSub: { color: 'rgba(255,255,255,0.7)', fontSize: '12px', margin: 0 },
        headerActions: { display: 'flex', gap: '8px' },
        btnIcon: {
            background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '8px',
            padding: '8px', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center',
            gap: '6px', fontSize: '13px', fontWeight: '600', transition: 'background 0.2s'
        },
        body: { padding: '24px', overflowY: 'auto', flex: 1 },
        companyHeader: { textAlign: 'center', marginBottom: '20px' },
        companyName: { fontSize: '20px', fontWeight: '800', color: '#1e3a5f', margin: 0, letterSpacing: '1px' },
        mbTitle: { fontSize: '14px', fontWeight: '700', color: '#64748b', margin: '4px 0 0', textTransform: 'uppercase', letterSpacing: '0.5px' },
        detailsGrid: {
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 32px',
            marginBottom: '20px', padding: '16px', backgroundColor: '#f8fafc',
            borderRadius: '8px', border: '1px solid #e2e8f0'
        },
        detailRow: { display: 'flex', gap: '8px', fontSize: '13px', padding: '4px 0' },
        detailLabel: { fontWeight: '700', color: '#475569', minWidth: '160px', whiteSpace: 'nowrap' },
        detailValue: { color: '#1e293b', fontFamily: "'Courier New', monospace" },
        table: {
            width: '100%', borderCollapse: 'collapse', fontSize: '12px',
            border: '1px solid #cbd5e1'
        },
        th: {
            backgroundColor: '#1e3a5f', color: '#fff', padding: '10px 8px',
            fontSize: '11px', fontWeight: '700', textAlign: 'center',
            borderRight: '1px solid rgba(255,255,255,0.2)', whiteSpace: 'nowrap'
        },
        td: {
            padding: '8px', borderBottom: '1px solid #e2e8f0',
            borderRight: '1px solid #e2e8f0', textAlign: 'center', fontSize: '12px'
        },
        tdRight: {
            padding: '8px', borderBottom: '1px solid #e2e8f0',
            borderRight: '1px solid #e2e8f0', textAlign: 'right', fontSize: '12px',
            fontFamily: "'Courier New', monospace"
        },
        tdLeft: {
            padding: '8px', borderBottom: '1px solid #e2e8f0',
            borderRight: '1px solid #e2e8f0', textAlign: 'left', fontSize: '12px'
        },
        totalRow: { backgroundColor: '#f1f5f9', fontWeight: '700' },
        totalLabel: {
            padding: '10px 8px', textAlign: 'right', fontSize: '13px',
            fontWeight: '800', color: '#1e3a5f', borderBottom: '2px solid #1e3a5f'
        },
        totalValue: {
            padding: '10px 8px', textAlign: 'right', fontSize: '14px',
            fontWeight: '800', color: '#1e3a5f', fontFamily: "'Courier New', monospace",
            borderBottom: '2px solid #1e3a5f'
        },
        signoffGrid: {
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px',
            marginTop: '24px', paddingTop: '20px', borderTop: '2px solid #e2e8f0'
        },
        signoffBox: {
            padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px',
            border: '1px solid #e2e8f0'
        },
        signoffTitle: { fontSize: '12px', fontWeight: '800', color: '#1e3a5f', marginBottom: '10px', textTransform: 'uppercase' },
        signoffRow: { display: 'flex', gap: '8px', fontSize: '12px', marginBottom: '4px' },
        signoffLabel: { fontWeight: '600', color: '#64748b', minWidth: '80px' },
        signoffValue: { color: '#1e293b' }
    };

    return (
        <div style={styles.overlay} onClick={onClose}>
            <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div style={styles.header}>
                    <div style={styles.headerLeft}>
                        <div style={styles.headerIcon}>
                            <BookOpen size={22} color="white" />
                        </div>
                        <div>
                            <h2 style={styles.headerTitle}>Measurement Book</h2>
                            <p style={styles.headerSub}>
                                {bill.contractor_name || 'Contractor'} - {bill.project_name || 'Project'}
                            </p>
                        </div>
                    </div>
                    <div style={styles.headerActions}>
                        <button
                            style={styles.btnIcon}
                            onClick={handleExportPDF}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
                        >
                            <Download size={16} />
                            Export PDF
                        </button>
                        <button
                            style={{ ...styles.btnIcon, padding: '8px' }}
                            onClick={onClose}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div style={styles.body}>
                    {/* Company Header */}
                    <div style={styles.companyHeader}>
                        <h1 style={styles.companyName}>PAARI SHIV HOMES</h1>
                        <p style={styles.mbTitle}>Measurement Book (MB)</p>
                    </div>

                    {/* Work Details */}
                    <div style={styles.detailsGrid}>
                        <div style={styles.detailRow}>
                            <span style={styles.detailLabel}>Name of Work:</span>
                            <span style={styles.detailValue}>{bill.notes || bill.project_name || '-'}</span>
                        </div>
                        <div style={styles.detailRow}>
                            <span style={styles.detailLabel}>Date of Measurement:</span>
                            <span style={styles.detailValue}>{formatDate(bill.bill_date)}</span>
                        </div>
                        <div style={styles.detailRow}>
                            <span style={styles.detailLabel}>Agreement No:</span>
                            <span style={styles.detailValue}>{bill.agreement_no || '-'}</span>
                        </div>
                        <div style={styles.detailRow}>
                            <span style={styles.detailLabel}>Pg No:</span>
                            <span style={styles.detailValue}>{bill.mbook_page_no || '-'}</span>
                        </div>
                        <div style={styles.detailRow}>
                            <span style={styles.detailLabel}>Name of Contractor:</span>
                            <span style={styles.detailValue}>{bill.contractor_name || '-'}</span>
                        </div>
                        <div style={styles.detailRow}>
                            <span style={styles.detailLabel}>Serial No:</span>
                            <span style={styles.detailValue}>{bill.mbook_serial_no || '-'}</span>
                        </div>
                        <div style={styles.detailRow}>
                            <span style={styles.detailLabel}>Location:</span>
                            <span style={styles.detailValue}>{bill.project_name || '-'}</span>
                        </div>
                        <div style={styles.detailRow}>
                            <span style={styles.detailLabel}>Name of Engineer:</span>
                            <span style={styles.detailValue}>{measuredBy.name || '-'}</span>
                        </div>
                    </div>

                    {/* Measurement Table */}
                    <div style={{ overflowX: 'auto', marginBottom: '8px' }}>
                        <table style={styles.table}>
                            <thead>
                                <tr>
                                    <th style={styles.th}>S.No</th>
                                    <th style={{ ...styles.th, textAlign: 'left', minWidth: '160px' }}>Description of Item</th>
                                    <th style={styles.th}>Nos</th>
                                    <th style={styles.th}>L</th>
                                    <th style={styles.th}>B</th>
                                    <th style={styles.th}>H/D</th>
                                    <th style={styles.th}>Quantity</th>
                                    <th style={styles.th}>Unit</th>
                                    <th style={styles.th}>Rate</th>
                                    <th style={styles.th}>Amount</th>
                                    <th style={{ ...styles.th, borderRight: 'none' }}>Remarks</th>
                                </tr>
                            </thead>
                            <tbody>
                                {entries.length === 0 ? (
                                    <tr>
                                        <td colSpan={11} style={{ ...styles.td, textAlign: 'center', padding: '24px', color: '#94a3b8' }}>
                                            No measurement entries found
                                        </td>
                                    </tr>
                                ) : (
                                    entries.map((entry, idx) => (
                                        <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#f8fafc' }}>
                                            <td style={styles.td}>{entry.sno || idx + 1}</td>
                                            <td style={styles.tdLeft}>{entry.description || '-'}</td>
                                            <td style={styles.td}>{entry.nos || '-'}</td>
                                            <td style={styles.td}>{entry.length || '-'}</td>
                                            <td style={styles.td}>{entry.breadth || '-'}</td>
                                            <td style={styles.td}>{entry.height || '-'}</td>
                                            <td style={styles.tdRight}>{parseFloat(entry.quantity || 0).toFixed(2)}</td>
                                            <td style={styles.td}>{entry.unit || '-'}</td>
                                            <td style={styles.tdRight}>{formatCurrency(entry.rate)}</td>
                                            <td style={styles.tdRight}>{formatCurrency(entry.amount)}</td>
                                            <td style={{ ...styles.tdLeft, borderRight: 'none' }}>{entry.remarks || '-'}</td>
                                        </tr>
                                    ))
                                )}
                                {/* Grand Total Row */}
                                {entries.length > 0 && (
                                    <tr style={styles.totalRow}>
                                        <td colSpan={9} style={styles.totalLabel}>Grand Total</td>
                                        <td style={styles.totalValue}>{formatCurrency(grandTotal)}</td>
                                        <td style={{ ...styles.totalValue, borderRight: 'none' }}></td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Signoff Section */}
                    <div style={styles.signoffGrid}>
                        <div style={styles.signoffBox}>
                            <div style={styles.signoffTitle}>Measurement Recorded By</div>
                            <div style={styles.signoffRow}>
                                <span style={styles.signoffLabel}>Name:</span>
                                <span style={styles.signoffValue}>{measuredBy.name || '-'}</span>
                            </div>
                            <div style={styles.signoffRow}>
                                <span style={styles.signoffLabel}>Designation:</span>
                                <span style={styles.signoffValue}>{measuredBy.designation || '-'}</span>
                            </div>
                            <div style={styles.signoffRow}>
                                <span style={styles.signoffLabel}>Date:</span>
                                <span style={styles.signoffValue}>{formatDate(measuredBy.date)}</span>
                            </div>
                        </div>
                        <div style={styles.signoffBox}>
                            <div style={styles.signoffTitle}>Checked By</div>
                            <div style={styles.signoffRow}>
                                <span style={styles.signoffLabel}>Name:</span>
                                <span style={styles.signoffValue}>{checkedBy.name || '-'}</span>
                            </div>
                            <div style={styles.signoffRow}>
                                <span style={styles.signoffLabel}>Designation:</span>
                                <span style={styles.signoffValue}>{checkedBy.designation || '-'}</span>
                            </div>
                            <div style={styles.signoffRow}>
                                <span style={styles.signoffLabel}>Date:</span>
                                <span style={styles.signoffValue}>{formatDate(checkedBy.date)}</span>
                            </div>
                        </div>
                        <div style={styles.signoffBox}>
                            <div style={styles.signoffTitle}>Verified By</div>
                            <div style={styles.signoffRow}>
                                <span style={styles.signoffLabel}>Name:</span>
                                <span style={styles.signoffValue}>{verifiedBy.name || '-'}</span>
                            </div>
                            <div style={styles.signoffRow}>
                                <span style={styles.signoffLabel}>Designation:</span>
                                <span style={styles.signoffValue}>{verifiedBy.designation || '-'}</span>
                            </div>
                            <div style={styles.signoffRow}>
                                <span style={styles.signoffLabel}>Date:</span>
                                <span style={styles.signoffValue}>{formatDate(verifiedBy.date)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MBookViewModal;

import React, { useState } from 'react';
import { X, CheckCircle2, AlertCircle, ShoppingCart, Truck, Package, IndianRupee, History, FileText, Download } from 'lucide-react';
import { vendorAPI } from '../utils/api';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const VendorDetailModal = ({ isOpen, onClose, vendor }) => {
    const [ledgerData, setLedgerData] = useState({ ledger: [], stats: { total_po: 0, total_received: 0, total_paid: 0, balance: 0 } });
    const [loading, setLoading] = useState(false);

    React.useEffect(() => {
        if (isOpen && vendor?.id) {
            setLoading(true);
            vendorAPI.getLedger(vendor.id)
                .then(res => setLedgerData(res.data))
                .catch(err => console.error(err))
                .finally(() => setLoading(false));
        }
    }, [isOpen, vendor]);

    const handleDownloadLedger = () => {
        if (!ledgerData.ledger || ledgerData.ledger.length === 0) {
            alert("No ledger data available to download.");
            return;
        }

        try {
            const doc = new jsPDF();
            const { stats } = ledgerData;

            // Header
            doc.setFontSize(22);
            doc.setTextColor(59, 130, 246);
            doc.setFont("helvetica", "bold");
            doc.text("VENDOR LEDGER REPORT", 14, 22);

            doc.setFontSize(10);
            doc.setTextColor(100, 116, 139);
            doc.setFont("helvetica", "normal");
            doc.text(`Generated: ${new Date().toLocaleDateString()}`, 196, 22, { align: "right" });

            // Vendor Info
            doc.setDrawColor(226, 232, 240);
            doc.line(14, 28, 196, 28);

            doc.setFontSize(14);
            doc.setTextColor(30, 41, 59);
            doc.setFont("helvetica", "bold");
            doc.text(vendor.name || 'N/A', 14, 38);

            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(100, 116, 139);
            let infoY = 44;
            if (vendor.category) { doc.text(`Category: ${vendor.category}`, 14, infoY); infoY += 5; }
            if (vendor.location) { doc.text(`Address: ${vendor.location}`, 14, infoY); infoY += 5; }
            if (vendor.phone) { doc.text(`Phone: ${vendor.phone}`, 14, infoY); infoY += 5; }
            if (vendor.email) { doc.text(`Email: ${vendor.email}`, 14, infoY); infoY += 5; }
            if (vendor.gstin) { doc.text(`GSTIN: ${vendor.gstin}`, 14, infoY); infoY += 5; }

            // Summary Stats
            infoY += 5;
            doc.setDrawColor(226, 232, 240);
            doc.line(14, infoY, 196, infoY);
            infoY += 8;

            doc.setFontSize(11);
            doc.setTextColor(30, 41, 59);
            doc.setFont("helvetica", "bold");
            doc.text("SUMMARY", 14, infoY);
            infoY += 8;

            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);
            const formatAmt = (v) => `Rs. ${(v || 0).toLocaleString('en-IN')}`;
            doc.text(`Total Ordered (POs):  ${formatAmt(stats.total_po)}`, 14, infoY); infoY += 6;
            doc.text(`Total Billed (GRNs):  ${formatAmt(stats.total_received)}`, 14, infoY); infoY += 6;
            doc.text(`Total Paid:  ${formatAmt(stats.total_paid)}`, 14, infoY); infoY += 6;
            doc.setFont("helvetica", "bold");
            doc.setTextColor(239, 68, 68);
            doc.text(`Balance Payable:  ${formatAmt(stats.balance)}`, 14, infoY); infoY += 10;

            // Ledger Table
            const formatDate = (d) => {
                if (!d) return '—';
                try { return new Date(d).toLocaleDateString('en-IN'); } catch { return String(d); }
            };

            const tableData = ledgerData.ledger.map(row => [
                formatDate(row.date),
                row.type || '—',
                row.ref || '—',
                formatAmt(row.amount),
                row.method || '—',
                row.status || '—'
            ]);

            autoTable(doc, {
                startY: infoY,
                head: [['Date', 'Activity Type', 'Reference', 'Amount', 'Mode/Method', 'Status']],
                body: tableData,
                theme: 'striped',
                headStyles: { fillColor: [59, 130, 246], fontStyle: 'bold' },
                styles: { fontSize: 9 },
                columnStyles: { 3: { halign: 'right' } }
            });

            doc.save(`Vendor_Ledger_${vendor.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (error) {
            console.error('PDF generation error:', error);
            alert('Failed to generate report.');
        }
    };

    if (!isOpen || !vendor) return null;

    const stats = [
        { label: 'Total Ordered (POs)', value: `₹${ledgerData.stats.total_po.toLocaleString()}`, icon: Package, color: '#3B82F6' },
        { label: 'Total Billed (GRNs)', value: `₹${ledgerData.stats.total_received.toLocaleString()}`, icon: Truck, color: '#8B5CF6' },
        { label: 'Total Paid', value: `₹${ledgerData.stats.total_paid.toLocaleString()}`, icon: IndianRupee, color: '#10B981' },
        { label: 'Balance Payable', value: `₹${ledgerData.stats.balance.toLocaleString()}`, icon: AlertCircle, color: '#EF4444' },
    ];
    const history = ledgerData.ledger;

    return (
        <div className="modal-overlay" style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)'
        }}>
            <div className="card animate-fade-in" style={{
                backgroundColor: 'white', width: '100%', maxWidth: '850px',
                borderRadius: '12px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                display: 'flex', flexDirection: 'column', maxHeight: '90vh'
            }}>
                {/* Header */}
                <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <span className="badge badge-success" style={{ fontSize: '10px' }}>Active Vendor</span>
                        </div>
                        <h2 style={{ fontSize: '24px', fontWeight: '800' }}>{vendor.name}</h2>
                        <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>{vendor.location} • {vendor.category} Vendor</p>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                        <X size={24} />
                    </button>
                </div>

                {/* Body */}
                <div style={{ padding: '24px', overflowY: 'auto' }}>
                    {/* Stats */}
                    <div style={{ display: 'flex', gap: '20px', marginBottom: '32px' }}>
                        {stats.map((stat, i) => (
                            <div key={i} className="card" style={{ flex: 1, padding: '20px', backgroundColor: '#f8fafc', border: '1px solid var(--border)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                                    <div style={{ padding: '8px', borderRadius: '6px', backgroundColor: 'white', color: stat.color, boxShadow: 'var(--shadow-sm)' }}>
                                        <stat.icon size={18} />
                                    </div>
                                    <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{stat.label}</span>
                                </div>
                                <h3 style={{ fontSize: '20px', fontWeight: '800' }}>{stat.value}</h3>
                            </div>
                        ))}
                    </div>

                    {/* Ledger / History */}
                    <div>
                        <h3 style={{ fontSize: '17px', fontWeight: '700', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <History size={20} color="var(--primary)" />
                            Transaction History & Ledger
                        </h3>
                        <table className="data-table" style={{ border: '1px solid var(--border)' }}>
                            <thead style={{ backgroundColor: '#f8fafc' }}>
                                <tr>
                                    <th>Date</th>
                                    <th>Activity Type</th>
                                    <th>Reference</th>
                                    <th>Amount</th>
                                    <th>Mode/Method</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                                            No transactions yet for this vendor.
                                        </td>
                                    </tr>
                                ) : history.map((row, i) => (
                                    <tr key={i}>
                                        <td style={{ fontWeight: '500' }}>{row.date}</td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                {row.type === 'Payment' ? <IndianRupee size={14} color="#10B981" /> : <Truck size={14} color="#3B82F6" />}
                                                <span style={{ fontWeight: '600', fontSize: '13px' }}>{row.type}</span>
                                            </div>
                                        </td>
                                        <td style={{ fontFamily: 'monospace', color: 'var(--primary)', fontWeight: '700' }}>{row.ref}</td>
                                        <td style={{ fontWeight: '700' }}>{row.amount}</td>
                                        <td style={{ fontSize: '12px' }}>{row.method}</td>
                                        <td>
                                            <span className={`badge ${row.status === 'Paid' ? 'badge-success' : row.status === 'Invoiced' ? 'badge-info' : 'badge-warning'}`}>
                                                {row.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Footer */}
                <div style={{ padding: '24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <button className="btn btn-outline" onClick={handleDownloadLedger} style={{ padding: '10px 24px' }}>
                        <Download size={18} /> Download Report
                    </button>
                    <button className="btn btn-primary" style={{ padding: '10px 24px' }}>
                        <ShoppingCart size={18} /> Create New PO
                    </button>
                </div>
            </div>
        </div>
    );
};

export default VendorDetailModal;

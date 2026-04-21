import React, { useState, useEffect, useMemo } from 'react';
import {
    FileText, Plus, Search, Eye, Edit3, Trash2, Mail, Download,
    IndianRupee, Loader2, Calendar, Building2
} from 'lucide-react';
import { quotationAPI, settingsAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { hasPermission } from '../utils/rbac';
import QuotationModal from '../components/QuotationModal';
import QuotationDetailModal from '../components/QuotationDetailModal';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const WhatsAppIcon = ({ size = 16 }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.464 3.488" />
    </svg>
);

const fmtINR = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

const STATUS_COLORS = {
    Draft: { bg: '#F1F5F9', color: '#475569' },
    Sent: { bg: '#DBEAFE', color: '#1D4ED8' },
    Accepted: { bg: '#DCFCE7', color: '#15803D' },
    Rejected: { bg: '#FEE2E2', color: '#B91C1C' },
};

const Quotations = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [quotations, setQuotations] = useState([]);
    const [companyInfo, setCompanyInfo] = useState({ companyName: 'CIVIL ERP' });
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [detailOpen, setDetailOpen] = useState(false);
    const [detailRow, setDetailRow] = useState(null);
    const [sendingId, setSendingId] = useState(null);

    const canEdit = hasPermission(user, 'Accounts', 'edit');
    const canDelete = hasPermission(user, 'Accounts', 'delete');

    const loadData = async () => {
        setLoading(true);
        try {
            const [qres, cres] = await Promise.all([
                quotationAPI.getAll(),
                settingsAPI.getCompany().catch(() => ({ data: null })),
            ]);
            setQuotations(qres.data || []);
            if (cres?.data) setCompanyInfo(cres.data);
        } catch (err) {
            console.error('Failed to load quotations', err);
        }
        setLoading(false);
    };

    useEffect(() => { loadData(); }, []);

    const filtered = useMemo(() => {
        return quotations.filter(q => {
            if (statusFilter !== 'All' && q.status !== statusFilter) return false;
            const needle = search.toLowerCase().trim();
            if (!needle) return true;
            return (
                (q.quotation_no || '').toLowerCase().includes(needle) ||
                (q.client_name || '').toLowerCase().includes(needle) ||
                (q.project_name || '').toLowerCase().includes(needle)
            );
        });
    }, [quotations, search, statusFilter]);

    const totals = useMemo(() => {
        const totalValue = quotations.reduce((s, q) => s + Number(q.total_amount || 0), 0);
        const sent = quotations.filter(q => q.status === 'Sent').length;
        const accepted = quotations.filter(q => q.status === 'Accepted').length;
        return { totalValue, count: quotations.length, sent, accepted };
    }, [quotations]);

    const handleCreate = () => { setEditing(null); setIsModalOpen(true); };
    const handleEdit = (q) => { setEditing(q); setIsModalOpen(true); };
    const handleView = (q) => { setDetailRow(q); setDetailOpen(true); };

    const handleDelete = async (q) => {
        if (!window.confirm(`Delete quotation ${q.quotation_no}?`)) return;
        try {
            await quotationAPI.delete(q.id);
            await loadData();
        } catch (err) {
            console.error(err);
            alert(err.response?.data?.detail || 'Failed to delete quotation');
        }
    };

    const handleSendEmail = async (q) => {
        let email = q.client_email;
        if (!email) {
            email = window.prompt('Enter client email to send this quotation:');
            if (!email) return;
        } else {
            const proceed = window.confirm(`Send quotation ${q.quotation_no} to ${email} (with PDF attachment)?`);
            if (!proceed) return;
        }
        setSendingId(q.id);
        try {
            const doc = buildQuotationPDF(q);
            const blob = doc.output('blob');
            const filename = `${q.quotation_no || 'Quotation'}.pdf`;
            const fd = new FormData();
            fd.append('email', email);
            fd.append('pdf_file', blob, filename);
            await quotationAPI.sendEmail(q.id, fd);
            alert(`Quotation ${q.quotation_no} emailed to ${email} with PDF attached.`);
            await loadData();
        } catch (err) {
            console.error(err);
            alert(err.response?.data?.detail || 'Failed to send email. Check SMTP settings.');
        }
        setSendingId(null);
    };

    const handleWhatsApp = async (q) => {
        setSendingId(q.id);
        let pdfUrl = '';
        try {
            const doc = buildQuotationPDF(q);
            const blob = doc.output('blob');
            const filename = `${q.quotation_no || 'Quotation'}.pdf`;
            const fd = new FormData();
            fd.append('pdf_file', blob, filename);
            const res = await quotationAPI.uploadPDF(q.id, fd);
            pdfUrl = res?.data?.url || '';
            // If Cloudinary not configured, backend falls back to /static/uploads/<file>.
            // Convert a relative URL to an absolute one so it works when shared.
            if (pdfUrl && pdfUrl.startsWith('/')) {
                pdfUrl = `${window.location.origin}${pdfUrl}`;
            }
        } catch (err) {
            console.error('PDF upload failed, falling back to text-only WhatsApp:', err);
            // Download the PDF locally as a fallback so the user can attach it manually.
            try { buildQuotationPDF(q).save(`${q.quotation_no}.pdf`); } catch (e) { }
        }
        setSendingId(null);

        const amount = fmtINR(q.total_amount);
        const lines = [
            `Hello ${q.client_name || ''},`,
            '',
            `Please find our detailed construction quotation & BOQ:`,
            '',
            `Quotation No: ${q.quotation_no}`,
            `Project: ${q.project_name}`,
            `Total Amount: ${amount}`,
            `Validity: ${q.validity || '30 days'}`,
        ];
        if (pdfUrl) {
            lines.push('', `PDF: ${pdfUrl}`);
        } else {
            lines.push('', '(PDF has been downloaded to your device — please attach it to this chat.)');
        }
        lines.push('', `Regards,`, `${companyInfo.companyName || 'Civil ERP'}`);

        const phone = (q.client_phone || '').replace(/\D/g, '');
        const url = phone
            ? `https://wa.me/${phone}?text=${encodeURIComponent(lines.join('\n'))}`
            : `https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`;
        window.open(url, '_blank');
    };

    const handleDownloadPDF = (q) => {
        try {
            const doc = buildQuotationPDF(q);
            doc.save(`${q.quotation_no || 'Quotation'}_${(q.client_name || 'Client').replace(/\s+/g, '_')}.pdf`);
        } catch (err) {
            console.error('PDF generation failed', err);
            alert('Failed to generate PDF. See console.');
        }
    };

    const buildQuotationPDF = (q) => {
        const doc = new jsPDF('p', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const mx = 14; // margin-x
        const contentW = pageWidth - mx * 2;
        let y = 16;

        // Shared colors
        const blue = [30, 58, 138];     // #1e3a8a — headings
        const blueAccent = [59, 130, 246]; // #3b82f6 — lines, table header
        const dark = [15, 23, 42];      // #0f172a — body text
        const muted = [100, 116, 139];  // #64748b — label text
        const subtle = [71, 85, 105];   // #475569 — value text

        const ensureSpace = (needed) => {
            if (y + needed > pageHeight - 20) { doc.addPage(); y = 16; }
        };

        // Helper: draw a "Label : Value" row pair using autoTable (one row, two columns)
        const drawInfoTable = (rows, startY, colWidths = [22, 68]) => {
            if (!rows.length) return startY;
            autoTable(doc, {
                startY,
                body: rows,
                theme: 'plain',
                styles: { fontSize: 9, cellPadding: { top: 1.5, bottom: 1.5, left: 1, right: 1 }, textColor: subtle },
                columnStyles: {
                    0: { cellWidth: colWidths[0], fontStyle: 'bold', textColor: muted },
                    1: { cellWidth: colWidths[1], textColor: dark },
                },
                margin: { left: mx },
                tableWidth: colWidths[0] + colWidths[1],
            });
            return doc.lastAutoTable?.finalY || startY;
        };

        // ─── Header ───────────────────────────────────────────────────────────
        doc.setFontSize(18);
        doc.setTextColor(...blue);
        doc.setFont('helvetica', 'bold');
        doc.text('Detailed Construction Quotation & BOQ', mx, y);
        y += 2;
        doc.setDrawColor(...blueAccent);
        doc.setLineWidth(0.7);
        doc.line(mx, y, pageWidth - mx, y);
        y += 5;

        doc.setFontSize(9);
        doc.setTextColor(...muted);
        doc.setFont('helvetica', 'normal');
        doc.text(`Quotation No: ${q.quotation_no}`, mx, y);
        doc.text(`Date: ${fmtDate(q.created_at || new Date())}`, pageWidth - mx, y, { align: 'right' });
        y += 7;

        // ─── Company + Client (side-by-side via two autoTables) ───────────────
        const halfW = (contentW - 6) / 2;
        const labelW = 22;
        const valW = halfW - labelW - 2;

        // Company column
        doc.setFontSize(11);
        doc.setTextColor(...blue);
        doc.setFont('helvetica', 'bold');
        doc.text('Company Details', mx, y);
        doc.text('Client Details', mx + halfW + 6, y);
        y += 2;

        const companyRows = [];
        companyRows.push([{ content: companyInfo.companyName || 'Civil ERP', colSpan: 2, styles: { fontStyle: 'bold', textColor: dark, fontSize: 10 } }]);
        if (companyInfo.address) companyRows.push(['Address', String(companyInfo.address)]);
        if (companyInfo.phone) companyRows.push(['Phone', String(companyInfo.phone)]);
        if (companyInfo.email) companyRows.push(['Email', String(companyInfo.email)]);
        const gst = companyInfo.gst || companyInfo.gstin;
        if (gst) companyRows.push(['GSTIN', String(gst)]);

        const clientRows = [];
        clientRows.push([{ content: q.client_name || '-', colSpan: 2, styles: { fontStyle: 'bold', textColor: dark, fontSize: 10 } }]);
        if (q.client_address) clientRows.push(['Address', String(q.client_address)]);
        if (q.client_phone) clientRows.push(['Phone', String(q.client_phone)]);
        if (q.client_email) clientRows.push(['Email', String(q.client_email)]);

        // Draw both side-by-side
        autoTable(doc, {
            startY: y,
            body: companyRows,
            theme: 'plain',
            styles: { fontSize: 9, cellPadding: { top: 1.5, bottom: 1.5, left: 1, right: 1 }, textColor: subtle },
            columnStyles: {
                0: { cellWidth: labelW, fontStyle: 'bold', textColor: muted },
                1: { cellWidth: valW, textColor: dark },
            },
            margin: { left: mx },
            tableWidth: halfW,
        });
        const companyEndY = doc.lastAutoTable?.finalY || y;

        autoTable(doc, {
            startY: y,
            body: clientRows,
            theme: 'plain',
            styles: { fontSize: 9, cellPadding: { top: 1.5, bottom: 1.5, left: 1, right: 1 }, textColor: subtle },
            columnStyles: {
                0: { cellWidth: labelW, fontStyle: 'bold', textColor: muted },
                1: { cellWidth: valW, textColor: dark },
            },
            margin: { left: mx + halfW + 6 },
            tableWidth: halfW,
        });
        const clientEndY = doc.lastAutoTable?.finalY || y;

        y = Math.max(companyEndY, clientEndY) + 6;

        // ─── Quotation Summary ───────────────────────────────────────────────
        ensureSpace(30);
        doc.setFontSize(11);
        doc.setTextColor(...blue);
        doc.setFont('helvetica', 'bold');
        doc.text('Quotation Summary', mx, y);
        y += 2;

        const summaryRows = [];
        summaryRows.push(['Project', q.project_name || '-']);
        if (q.project_address) summaryRows.push(['Site Address', q.project_address]);
        if (q.scope_of_work) summaryRows.push(['Scope of Work', q.scope_of_work]);
        summaryRows.push(['Validity', q.validity || '30 days']);

        y = drawInfoTable(summaryRows, y, [30, contentW - 32]);
        y += 6;

        // ─── BOQ Table ──────────────────────────────────────────────────────
        ensureSpace(30);
        doc.setFontSize(11);
        doc.setTextColor(...blue);
        doc.setFont('helvetica', 'bold');
        doc.text('Detailed Brief Quotation (BOQ)', mx, y);
        y += 3;

        const boqRows = (q.items || []).map((it, idx) => {
            const qty = Number(it.qty || 0);
            const rate = Number(it.rate || 0);
            const amt = Number(it.amount || qty * rate);
            const name = it.item_name + (it.description ? `\n${it.description}` : '');
            return [idx + 1, name, it.unit || '', qty, `Rs. ${rate.toLocaleString('en-IN')}`, `Rs. ${amt.toLocaleString('en-IN')}`];
        });

        autoTable(doc, {
            startY: y,
            head: [['S.No', 'Item / Description', 'Unit', 'Qty', 'Rate', 'Amount']],
            body: boqRows.length ? boqRows : [['', 'No items', '', '', '', '']],
            theme: 'grid',
            headStyles: { fillColor: blueAccent, textColor: 255, fontStyle: 'bold', fontSize: 9 },
            styles: { fontSize: 9, cellPadding: 4, textColor: dark },
            columnStyles: {
                0: { cellWidth: 14, halign: 'center' },
                2: { cellWidth: 20, halign: 'center' },
                3: { cellWidth: 18, halign: 'center' },
                4: { cellWidth: 32, halign: 'right' },
                5: { cellWidth: 34, halign: 'right' },
            },
            foot: [['', '', '', '', 'Total Amount', `Rs. ${Number(q.total_amount || 0).toLocaleString('en-IN')}`]],
            footStyles: { fillColor: [241, 245, 249], textColor: dark, fontStyle: 'bold', fontSize: 9 },
            margin: { left: mx, right: mx },
        });
        y = (doc.lastAutoTable?.finalY || y) + 8;

        // ─── Payment Schedule ────────────────────────────────────────────────
        if (q.payment_schedule) {
            ensureSpace(22);
            doc.setFontSize(11);
            doc.setTextColor(...blue);
            doc.setFont('helvetica', 'bold');
            doc.text('Payment Schedule', mx, y);
            y += 5;
            doc.setFontSize(9);
            doc.setTextColor(...subtle);
            doc.setFont('helvetica', 'normal');
            const psLines = doc.splitTextToSize(String(q.payment_schedule), contentW);
            ensureSpace(psLines.length * 4 + 4);
            doc.text(psLines, mx, y);
            y += psLines.length * 4 + 6;
        }

        // ─── Terms & Conditions ──────────────────────────────────────────────
        if (q.terms_conditions) {
            ensureSpace(22);
            doc.setFontSize(11);
            doc.setTextColor(...blue);
            doc.setFont('helvetica', 'bold');
            doc.text('Terms & Conditions', mx, y);
            y += 5;
            doc.setFontSize(9);
            doc.setTextColor(...subtle);
            doc.setFont('helvetica', 'normal');
            const tcLines = doc.splitTextToSize(String(q.terms_conditions), contentW);
            ensureSpace(tcLines.length * 4 + 4);
            doc.text(tcLines, mx, y);
            y += tcLines.length * 4 + 6;
        }

        // ─── Authorized Signatory ────────────────────────────────────────────
        ensureSpace(24);
        y += 8;
        doc.setDrawColor(148, 163, 184);
        doc.setLineWidth(0.4);
        doc.line(pageWidth - mx - 65, y, pageWidth - mx, y);
        y += 5;
        doc.setFontSize(10);
        doc.setTextColor(...dark);
        doc.setFont('helvetica', 'bold');
        doc.text('Authorized Signatory', pageWidth - mx, y, { align: 'right' });
        y += 4;
        doc.setFontSize(9);
        doc.setTextColor(...muted);
        doc.setFont('helvetica', 'normal');
        doc.text(companyInfo.companyName || 'Civil ERP', pageWidth - mx, y, { align: 'right' });

        return doc;
    };

    const StatusBadge = ({ status }) => {
        const c = STATUS_COLORS[status] || STATUS_COLORS.Draft;
        return (
            <span style={{
                display: 'inline-block', padding: '4px 10px', borderRadius: '999px',
                fontSize: '12px', fontWeight: 600, backgroundColor: c.bg, color: c.color
            }}>
                {status}
            </span>
        );
    };

    const IconBtn = ({ icon: Icon, title, onClick, color = '#64748B', disabled = false }) => (
        <button
            onClick={onClick}
            disabled={disabled}
            title={title}
            style={{
                background: 'none', border: '1px solid #E2E8F0', cursor: disabled ? 'not-allowed' : 'pointer',
                padding: '6px', borderRadius: '6px', color, display: 'inline-flex', alignItems: 'center',
                justifyContent: 'center', opacity: disabled ? 0.5 : 1
            }}
        >
            <Icon size={16} />
        </button>
    );

    return (
        <div style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: 'var(--text-main, #0F172A)' }}>
                        Quotations
                    </h1>
                    <p style={{ margin: '4px 0 0', color: 'var(--text-muted, #64748B)', fontSize: 14 }}>
                        Detailed construction quotation & BOQ — create, share & track.
                    </p>
                </div>
                {canEdit && (
                    <button
                        onClick={handleCreate}
                        className="btn btn-primary"
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px',
                            borderRadius: 10, border: 'none', backgroundColor: '#3B82F6', color: 'white',
                            fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 6px rgba(59,130,246,0.3)'
                        }}
                    >
                        <Plus size={18} /> Create Quotation
                    </button>
                )}
            </div>

            {/* Stat cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginBottom: 20 }}>
                <StatCard icon={FileText} label="Total Quotations" value={totals.count} accent="#3B82F6" />
                <StatCard icon={IndianRupee} label="Total Value" value={fmtINR(totals.totalValue)} accent="#10B981" />
                <StatCard icon={Mail} label="Sent" value={totals.sent} accent="#6366F1" />
                <StatCard icon={Building2} label="Accepted" value={totals.accepted} accent="#F59E0B" />
            </div>

            {/* Filters */}
            <div style={{ backgroundColor: 'white', padding: 16, borderRadius: 12, border: '1px solid #E2E8F0', marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 260, position: 'relative' }}>
                    <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                    <input
                        placeholder="Search by quotation no, client or project…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{ width: '100%', padding: '10px 14px 10px 36px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 14, outline: 'none' }}
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 14, minWidth: 160 }}
                >
                    <option value="All">All Statuses</option>
                    <option value="Draft">Draft</option>
                    <option value="Sent">Sent</option>
                    <option value="Accepted">Accepted</option>
                    <option value="Rejected">Rejected</option>
                </select>
            </div>

            {/* Table */}
            <div style={{ backgroundColor: 'white', borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                {loading ? (
                    <div style={{ padding: 60, textAlign: 'center', color: '#64748B' }}>
                        <Loader2 size={28} style={{ animation: 'spin 1s linear infinite' }} />
                        <div style={{ marginTop: 8 }}>Loading quotations…</div>
                        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                    </div>
                ) : filtered.length === 0 ? (
                    <div style={{ padding: 60, textAlign: 'center', color: '#64748B' }}>
                        <FileText size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
                        <div style={{ fontWeight: 600, fontSize: 16, color: '#0F172A' }}>No quotations yet</div>
                        <div style={{ fontSize: 13, marginTop: 4 }}>
                            Click "Create Quotation" to build your first detailed construction quote.
                        </div>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#F8FAFC', textAlign: 'left' }}>
                                    <th style={thStyle}>Quotation No</th>
                                    <th style={thStyle}>Client</th>
                                    <th style={thStyle}>Project</th>
                                    <th style={thStyle}>Date</th>
                                    <th style={{ ...thStyle, textAlign: 'right' }}>Amount</th>
                                    <th style={thStyle}>Status</th>
                                    <th style={{ ...thStyle, textAlign: 'center', width: 260 }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((q) => (
                                    <tr key={q.id} style={{ borderTop: '1px solid #F1F5F9' }}>
                                        <td style={tdStyle}>
                                            <div style={{ fontWeight: 700, color: '#0F172A' }}>{q.quotation_no}</div>
                                            <div style={{ fontSize: 11, color: '#94A3B8' }}>{q.validity || '30 days'}</div>
                                        </td>
                                        <td style={tdStyle}>
                                            <div style={{ fontWeight: 600 }}>{q.client_name}</div>
                                            <div style={{ fontSize: 12, color: '#64748B' }}>{q.client_email || q.client_phone || '—'}</div>
                                        </td>
                                        <td style={tdStyle}>{q.project_name}</td>
                                        <td style={tdStyle}>
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#475569', fontSize: 13 }}>
                                                <Calendar size={12} /> {fmtDate(q.created_at)}
                                            </span>
                                        </td>
                                        <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: '#0F172A' }}>
                                            {fmtINR(q.total_amount)}
                                        </td>
                                        <td style={tdStyle}><StatusBadge status={q.status || 'Draft'} /></td>
                                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                                            <div style={{ display: 'inline-flex', gap: 6 }}>
                                                <IconBtn icon={Eye} title="View" onClick={() => handleView(q)} color="#3B82F6" />
                                                <IconBtn icon={Download} title="Download PDF" onClick={() => handleDownloadPDF(q)} color="#0EA5E9" />
                                                <IconBtn
                                                    icon={sendingId === q.id ? Loader2 : Mail}
                                                    title="Send Email"
                                                    onClick={() => handleSendEmail(q)}
                                                    color="#6366F1"
                                                    disabled={sendingId === q.id}
                                                />
                                                <IconBtn icon={WhatsAppIcon} title="Share on WhatsApp" onClick={() => handleWhatsApp(q)} color="#25D366" />
                                                {canEdit && <IconBtn icon={Edit3} title="Edit" onClick={() => handleEdit(q)} color="#F59E0B" />}
                                                {canDelete && <IconBtn icon={Trash2} title="Delete" onClick={() => handleDelete(q)} color="#EF4444" />}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <QuotationModal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setEditing(null); }}
                onSuccess={() => { setIsModalOpen(false); setEditing(null); loadData(); }}
                initial={editing}
            />

            <QuotationDetailModal
                isOpen={detailOpen}
                onClose={() => { setDetailOpen(false); setDetailRow(null); }}
                quotation={detailRow}
                companyInfo={companyInfo}
                onSendEmail={handleSendEmail}
                onWhatsApp={handleWhatsApp}
                onDownloadPDF={handleDownloadPDF}
            />
        </div>
    );
};

const StatCard = ({ icon: Icon, label, value, accent }) => (
    <div style={{ backgroundColor: 'white', padding: 16, borderRadius: 12, border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 42, height: 42, borderRadius: 10, backgroundColor: `${accent}15`, color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={20} />
        </div>
        <div>
            <div style={{ fontSize: 12, color: '#64748B', fontWeight: 500 }}>{label}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#0F172A' }}>{value}</div>
        </div>
    </div>
);

const thStyle = { padding: '12px 16px', fontSize: 12, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.3 };
const tdStyle = { padding: '14px 16px', fontSize: 13, color: '#334155', verticalAlign: 'middle' };

export default Quotations;

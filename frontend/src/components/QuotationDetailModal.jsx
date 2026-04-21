import React from 'react';
import { X, Mail, Download, FileText, Building2, User, Calendar } from 'lucide-react';

const WhatsAppIcon = ({ size = 16 }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.464 3.488" />
    </svg>
);

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

const QuotationDetailModal = ({ isOpen, onClose, quotation, companyInfo = {}, onSendEmail, onWhatsApp, onDownloadPDF }) => {
    if (!isOpen || !quotation) return null;

    const q = quotation;

    return (
        <div style={overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div style={modal}>
                <div style={header}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={iconCircle}><FileText size={18} /></div>
                        <div>
                            <div style={{ fontSize: 17, fontWeight: 800 }}>Detailed Construction Quotation & BOQ</div>
                            <div style={{ fontSize: 12, color: '#64748B' }}>
                                {q.quotation_no} · <Calendar size={10} style={{ display: 'inline', verticalAlign: '-1px' }} /> {fmtDate(q.created_at)}
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} style={iconBtn}><X size={20} /></button>
                </div>

                <div style={body}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, marginBottom: 16 }}>
                        <InfoCard icon={Building2} title="Company Details" lines={[
                            companyInfo.companyName || 'Civil ERP',
                            companyInfo.address,
                            [companyInfo.phone, companyInfo.email].filter(Boolean).join(' | '),
                            (companyInfo.gst || companyInfo.gstin) ? `GSTIN: ${companyInfo.gst || companyInfo.gstin}` : null,
                        ].filter(Boolean)} />
                        <InfoCard icon={User} title="Client Details" lines={[
                            q.client_name,
                            q.client_address,
                            [q.client_phone, q.client_email].filter(Boolean).join(' | '),
                        ].filter(Boolean)} />
                    </div>

                    <Section title="Quotation Summary">
                        <Grid>
                            <KV label="Project" value={q.project_name} />
                            {q.project_address && <KV label="Site Address" value={q.project_address} />}
                            {q.scope_of_work && <KV label="Scope of Work" value={q.scope_of_work} />}
                            <KV label="Validity" value={q.validity || '30 days'} />
                            <KV label="Status" value={<StatusBadge status={q.status} />} />
                            {q.sent_to && <KV label="Last Sent To" value={`${q.sent_to} · ${fmtDate(q.sent_at)}`} />}
                        </Grid>
                    </Section>

                    <Section title="Detailed Brief Quotation (BOQ)">
                        <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: 10 }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                <thead>
                                    <tr style={{ backgroundColor: '#3B82F6', color: 'white' }}>
                                        <th style={th}>S.No</th>
                                        <th style={th}>Item / Description</th>
                                        <th style={th}>Unit</th>
                                        <th style={th}>Qty</th>
                                        <th style={{ ...th, textAlign: 'right' }}>Rate</th>
                                        <th style={{ ...th, textAlign: 'right' }}>Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(q.items || []).map((it, i) => {
                                        const qty = Number(it.qty || 0);
                                        const rate = Number(it.rate || 0);
                                        const amt = Number(it.amount || qty * rate);
                                        return (
                                            <tr key={i} style={{ borderTop: '1px solid #F1F5F9' }}>
                                                <td style={td}>{i + 1}</td>
                                                <td style={td}>
                                                    <div style={{ fontWeight: 600 }}>{it.item_name}</div>
                                                    {it.description && <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{it.description}</div>}
                                                </td>
                                                <td style={{ ...td, textAlign: 'center' }}>{it.unit}</td>
                                                <td style={{ ...td, textAlign: 'center' }}>{qty}</td>
                                                <td style={{ ...td, textAlign: 'right' }}>{fmt(rate)}</td>
                                                <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{fmt(amt)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr style={{ backgroundColor: '#F1F5F9' }}>
                                        <td colSpan={5} style={{ ...td, textAlign: 'right', fontWeight: 800 }}>Total Amount</td>
                                        <td style={{ ...td, textAlign: 'right', fontWeight: 800, color: '#1D4ED8' }}>{fmt(q.total_amount)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </Section>

                    {q.payment_schedule && (
                        <Section title="Payment Schedule">
                            <div style={preBlock}>{q.payment_schedule}</div>
                        </Section>
                    )}

                    {q.terms_conditions && (
                        <Section title="Terms & Conditions">
                            <div style={preBlock}>{q.terms_conditions}</div>
                        </Section>
                    )}

                    <div style={{ marginTop: 28, textAlign: 'right' }}>
                        <div style={{ display: 'inline-block', borderTop: '1px solid #cbd5e1', paddingTop: 6, minWidth: 220 }}>
                            <div style={{ fontWeight: 700 }}>Authorized Signatory</div>
                            <div style={{ color: '#64748B', fontSize: 12 }}>{companyInfo.companyName || 'Civil ERP'}</div>
                        </div>
                    </div>
                </div>

                <div style={footer}>
                    <button onClick={() => onDownloadPDF(q)} style={{ ...btn, borderColor: '#0EA5E9', color: '#0284C7' }}>
                        <Download size={15} /> Download PDF
                    </button>
                    <button onClick={() => onWhatsApp(q)} style={{ ...btn, borderColor: '#25D366', color: '#15803D' }}>
                        <WhatsAppIcon size={15} /> Share on WhatsApp
                    </button>
                    <button onClick={() => onSendEmail(q)} style={{ ...btn, backgroundColor: '#3B82F6', color: 'white', border: 'none' }}>
                        <Mail size={15} /> Send Email
                    </button>
                </div>
            </div>
        </div>
    );
};

const StatusBadge = ({ status }) => {
    const map = {
        Draft: { bg: '#F1F5F9', color: '#475569' },
        Sent: { bg: '#DBEAFE', color: '#1D4ED8' },
        Accepted: { bg: '#DCFCE7', color: '#15803D' },
        Rejected: { bg: '#FEE2E2', color: '#B91C1C' },
    };
    const c = map[status] || map.Draft;
    return <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, backgroundColor: c.bg, color: c.color }}>{status || 'Draft'}</span>;
};

const InfoCard = ({ icon: Icon, title, lines }) => (
    <div style={{ border: '1px solid #E2E8F0', borderRadius: 10, padding: 14, backgroundColor: '#F8FAFC' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: '#1E3A8A', fontWeight: 700, fontSize: 13 }}>
            <Icon size={16} /> {title}
        </div>
        {lines.map((l, i) => (
            <div key={i} style={{ fontSize: 13, color: i === 0 ? '#0F172A' : '#475569', fontWeight: i === 0 ? 700 : 400, marginBottom: 2 }}>{l}</div>
        ))}
    </div>
);

const Section = ({ title, children }) => (
    <div style={{ marginBottom: 16 }}>
        <h4 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 700, color: '#1E3A8A' }}>{title}</h4>
        {children}
    </div>
);

const Grid = ({ children }) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>{children}</div>
);

const KV = ({ label, value }) => (
    <div style={{ border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px 10px', backgroundColor: 'white' }}>
        <div style={{ fontSize: 11, color: '#94A3B8', textTransform: 'uppercase', fontWeight: 600, letterSpacing: 0.4 }}>{label}</div>
        <div style={{ fontSize: 13, color: '#0F172A', fontWeight: 600, marginTop: 2 }}>{value || '-'}</div>
    </div>
);

const overlay = { position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: 20 };
const modal = { backgroundColor: 'white', borderRadius: 14, width: '100%', maxWidth: 980, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' };
const header = { padding: '18px 22px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' };
const body = { padding: '18px 22px', overflowY: 'auto', flex: 1 };
const footer = { padding: '14px 22px', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' };
const iconBtn = { background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', padding: 4 };
const iconCircle = { width: 36, height: 36, borderRadius: 10, backgroundColor: '#DBEAFE', color: '#1D4ED8', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const th = { padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3 };
const td = { padding: '10px 12px', fontSize: 13, color: '#334155', verticalAlign: 'top' };
const preBlock = { whiteSpace: 'pre-wrap', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: 12, fontSize: 13, color: '#334155', lineHeight: 1.6 };
const btn = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 8, border: '1px solid', backgroundColor: 'white', fontWeight: 600, cursor: 'pointer', fontSize: 13 };

export default QuotationDetailModal;

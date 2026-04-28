import React, { useState, useEffect, useMemo } from 'react';
import {
    Users, IndianRupee, Search, Calendar, Download, Loader2,
    CreditCard, X, CheckCircle
} from 'lucide-react';
import { labourAttendanceAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const fmtDate = (d) => {
    if (!d) return '-';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '-';
    return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const LabourWages = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [records, setRecords] = useState([]);
    const [payments, setPayments] = useState([]);
    const [projectFilter, setProjectFilter] = useState('All');
    const [search, setSearch] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [activeTab, setActiveTab] = useState('Pending');
    const [payModal, setPayModal] = useState(null); // record to pay
    const [paying, setPaying] = useState(false);

    const loadData = async () => {
        setLoading(true);
        try {
            const params = {};
            if (dateFrom) params.date_from = dateFrom;
            if (dateTo) params.date_to = dateTo;
            const [rRes, pRes] = await Promise.all([
                labourAttendanceAPI.getAll(params),
                labourAttendanceAPI.getSalaryPayments({}),
            ]);
            setRecords(rRes.data || []);
            setPayments(pRes.data || []);
        } catch (err) {
            console.error('Failed to load wages data', err);
        }
        setLoading(false);
    };

    useEffect(() => { loadData(); }, [dateFrom, dateTo]);

    // Set of paid record keys: "projectName||date"
    const paidKeys = useMemo(() => {
        const s = new Set();
        (payments || []).forEach(p => s.add(`${p.project_name}||${p.date}`));
        return s;
    }, [payments]);

    const isPaid = (rec) => paidKeys.has(`${rec.project_name}||${rec.date}`);

    const filtered = useMemo(() => {
        return records.filter(r => {
            if (projectFilter !== 'All' && r.project_name !== projectFilter) return false;
            if (search) {
                const q = search.toLowerCase();
                const cats = (r.categories || []).map(c => `${c.party} ${c.category}`).join(' ').toLowerCase();
                if (!r.project_name.toLowerCase().includes(q) && !cats.includes(q)) return false;
            }
            return true;
        });
    }, [records, projectFilter, search]);

    const totals = useMemo(() => ({
        totalCost: filtered.reduce((s, r) => s + (r.day_cost || 0), 0),
        totalHeads: filtered.reduce((s, r) => s + (r.total_count || 0), 0),
        days: filtered.length,
    }), [filtered]);

    const handlePay = async (rec) => {
        setPaying(true);
        try {
            await labourAttendanceAPI.processSalary({
                project_name: rec.project_name,
                party: (rec.categories || []).map(c => c.party).filter(Boolean).join(', '),
                category: (rec.categories || []).map(c => c.category).join(', '),
                date: rec.date,
                period_from: rec.date,
                period_to: rec.date,
                total_heads: rec.total_count || 0,
                total_days: 1,
                daily_wage: 0,
                total_amount: rec.day_cost || 0,
                deductions: 0,
                net_amount: rec.day_cost || 0,
                payment_mode: 'Cash',
            });
            alert(`Payment of ${fmt(rec.day_cost)} processed for ${rec.project_name} — ${fmtDate(rec.date)}`);
            setPayModal(null);
            await loadData();
        } catch (err) {
            console.error(err);
            alert(err.response?.data?.detail || 'Failed to process payment');
        }
        setPaying(false);
    };

    const handleDownloadPDF = () => {
        const doc = new jsPDF();
        doc.setFontSize(16);
        doc.setTextColor(30, 58, 138);
        doc.setFont('helvetica', 'bold');
        doc.text('Labour Wages Report', 14, 18);
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.setFont('helvetica', 'normal');
        const period = [dateFrom, dateTo].filter(Boolean).join(' to ') || 'All Dates';
        doc.text(`Period: ${period} | Project: ${projectFilter}`, 14, 24);

        autoTable(doc, {
            startY: 30,
            head: [['#', 'Date', 'Project', 'Breakdown', 'Total', 'Day Cost', 'Status']],
            body: filtered.map((r, i) => [
                i + 1, r.date, r.project_name,
                (r.categories || []).map(c => `${c.party ? c.party + '-' : ''}${c.category}: ${c.count}`).join(', '),
                r.total_count, `Rs. ${(r.day_cost || 0).toLocaleString('en-IN')}`,
                isPaid(r) ? 'Paid' : 'Pending',
            ]),
            theme: 'grid',
            headStyles: { fillColor: [59, 130, 246] },
            styles: { fontSize: 8 },
        });
        doc.save('Labour_Wages_Report.pdf');
    };

    return (
        <div style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Labour Wages</h1>
                    <p style={{ margin: '4px 0 0', color: '#64748B', fontSize: 14 }}>Date-wise labour attendance and salary processing.</p>
                </div>
                <button onClick={handleDownloadPDF} style={primaryBtn} disabled={!filtered.length}>
                    <Download size={16} /> Download Report
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
                <StatCard icon={Calendar} label="Days Recorded" value={totals.days} color="#3B82F6" />
                <StatCard icon={Users} label="Total Heads" value={totals.totalHeads} color="#10B981" />
                <StatCard icon={IndianRupee} label="Total Wages" value={fmt(totals.totalCost)} color="#F59E0B" />
                <StatCard icon={CreditCard} label="Payments Made" value={payments.length} color="#8B5CF6" />
            </div>

            <div style={{ backgroundColor: 'white', padding: 16, borderRadius: 12, border: '1px solid #E2E8F0', marginBottom: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, marginBottom: 12 }}>
                    <div style={{ position: 'relative' }}>
                        <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                        <input placeholder="Search project or category..." value={search} onChange={e => setSearch(e.target.value)}
                            style={{ width: '100%', padding: '10px 14px 10px 34px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13, outline: 'none' }} />
                    </div>
                    <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)}
                        style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13, minWidth: 180 }}>
                        <option value="All">All Projects</option>
                        {[...new Set(records.map(r => r.project_name))].map(p => <option key={p}>{p}</option>)}
                    </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 4, display: 'block' }}>From Date</label>
                        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                            style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13 }} />
                    </div>
                    <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 4, display: 'block' }}>To Date</label>
                        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                            style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13 }} />
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                {['Pending', 'Awaiting Verification', 'Paid'].map(t => {
                    const count = t === 'Pending' ? filtered.filter(r => r.verified && !isPaid(r)).length
                        : t === 'Awaiting Verification' ? filtered.filter(r => !r.verified && !isPaid(r)).length
                        : payments.length;
                    return (
                        <button key={t} onClick={() => setActiveTab(t)}
                            style={{ padding: '8px 18px', borderRadius: 8, border: 'none', backgroundColor: activeTab === t ? '#3B82F6' : '#F1F5F9', color: activeTab === t ? 'white' : '#475569', fontWeight: 600, cursor: 'pointer', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            {t}
                            {count > 0 && <span style={{ backgroundColor: activeTab === t ? 'rgba(255,255,255,0.3)' : '#E2E8F0', padding: '1px 7px', borderRadius: 10, fontSize: 11, fontWeight: 700 }}>{count}</span>}
                        </button>
                    );
                })}
            </div>

            <div style={{ backgroundColor: 'white', borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                {loading ? (
                    <div style={{ padding: 60, textAlign: 'center', color: '#64748B' }}>
                        <Loader2 size={28} style={{ animation: 'spin 1s linear infinite' }} />
                        <div style={{ marginTop: 8 }}>Loading...</div>
                        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                    </div>
                ) : (activeTab === 'Pending' || activeTab === 'Awaiting Verification') ? (
                    <div style={{ overflowX: 'auto' }}>
                        {(() => {
                            const isAwaiting = activeTab === 'Awaiting Verification';
                            const rows = filtered.filter(r => !isPaid(r) && (isAwaiting ? !r.verified : r.verified));
                            return (
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: '#F8FAFC' }}>
                                            <th style={thStyle}>Date</th>
                                            <th style={thStyle}>Project</th>
                                            <th style={thStyle}>Breakdown</th>
                                            <th style={{ ...thStyle, textAlign: 'center' }}>Total</th>
                                            <th style={{ ...thStyle, textAlign: 'right' }}>Day Cost</th>
                                            <th style={thStyle}>Marked By</th>
                                            {!isAwaiting && <th style={thStyle}>Verified By</th>}
                                            <th style={{ ...thStyle, textAlign: 'center', width: 120 }}>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.length === 0 ? (
                                            <tr><td colSpan={isAwaiting ? 7 : 8} style={{ padding: 60, textAlign: 'center', color: '#64748B' }}>
                                                {isAwaiting ? 'No records awaiting verification.' : 'No verified records pending payment.'}
                                            </td></tr>
                                        ) : rows.map((r) => (
                                            <tr key={r.id} style={{ borderTop: '1px solid #F1F5F9' }}>
                                                <td style={{ ...tdStyle, fontWeight: 700 }}>{fmtDate(r.date)}</td>
                                                <td style={{ ...tdStyle, fontWeight: 700 }}>{r.project_name}</td>
                                                <td style={tdStyle}>
                                                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                                        {(() => {
                                                            const merged = {};
                                                            (r.categories || []).forEach(c => {
                                                                const key = `${c.party || ''}||${c.category || ''}`;
                                                                if (!merged[key]) merged[key] = { party: c.party, category: c.category, count: 0 };
                                                                merged[key].count += (c.count || 0);
                                                            });
                                                            return Object.values(merged).map((m, j) => (
                                                                <span key={j} style={{ padding: '2px 8px', borderRadius: 6, backgroundColor: '#F1F5F9', fontSize: 11, fontWeight: 600 }}>
                                                                    {m.party ? `${m.party}-` : ''}{m.category}: {m.count}
                                                                </span>
                                                            ));
                                                        })()}
                                                    </div>
                                                </td>
                                                <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 800, fontSize: 15 }}>{r.total_count}</td>
                                                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }}>{fmt(r.day_cost)}</td>
                                                <td style={{ ...tdStyle, color: '#64748B', fontSize: 12 }}>{r.marked_by}</td>
                                                {!isAwaiting && <td style={{ ...tdStyle, color: '#059669', fontSize: 12, fontWeight: 600 }}>{r.verified_by}</td>}
                                                <td style={{ ...tdStyle, textAlign: 'center' }}>
                                                    {isAwaiting ? (
                                                        <span style={{ padding: '4px 12px', borderRadius: 6, backgroundColor: '#FEF3C7', color: '#92400E', fontSize: 11, fontWeight: 700 }}>
                                                            Awaiting
                                                        </span>
                                                    ) : (
                                                        <button onClick={() => setPayModal(r)}
                                                            style={{ padding: '5px 16px', borderRadius: 6, border: 'none', backgroundColor: '#10B981', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                                                            Pay
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            );
                        })()}
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#F8FAFC' }}>
                                    <th style={thStyle}>#</th>
                                    <th style={thStyle}>Date</th>
                                    <th style={thStyle}>Project</th>
                                    <th style={thStyle}>Category</th>
                                    <th style={{ ...thStyle, textAlign: 'center' }}>Heads</th>
                                    <th style={{ ...thStyle, textAlign: 'right' }}>Amount</th>
                                    <th style={thStyle}>Paid By</th>
                                    <th style={thStyle}>Paid On</th>
                                </tr>
                            </thead>
                            <tbody>
                                {payments.length === 0 ? (
                                    <tr><td colSpan={8} style={{ padding: 60, textAlign: 'center', color: '#64748B' }}>No payments yet.</td></tr>
                                ) : payments.map((p, i) => (
                                    <tr key={i} style={{ borderTop: '1px solid #F1F5F9' }}>
                                        <td style={tdStyle}>{i + 1}</td>
                                        <td style={{ ...tdStyle, fontWeight: 700 }}>{fmtDate(p.date || p.period_from)}</td>
                                        <td style={{ ...tdStyle, fontWeight: 700 }}>{p.project_name}</td>
                                        <td style={tdStyle}>{p.category}</td>
                                        <td style={{ ...tdStyle, textAlign: 'center' }}>{p.total_heads}</td>
                                        <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: '#10B981' }}>{fmt(p.net_amount)}</td>
                                        <td style={tdStyle}>{p.processed_by}</td>
                                        <td style={tdStyle}>{fmtDate(p.created_at)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Payment Detail Modal */}
            {payModal && (
                <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setPayModal(null); }}>
                    <div className="card animate-fade-in" style={{ width: '95%', maxWidth: 750, maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'auto' }}>
                        <div style={{ padding: '18px 22px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div>
                                <div style={{ fontSize: 17, fontWeight: 800 }}>Process Labour Payment</div>
                                <div style={{ fontSize: 12, color: '#64748B' }}>{payModal.project_name} — {fmtDate(payModal.date)}</div>
                            </div>
                            <button onClick={() => setPayModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}><X size={20} /></button>
                        </div>

                        <div style={{ padding: '18px 22px' }}>
                            {/* Summary */}
                            <div style={{ display: 'flex', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
                                <div style={summaryCard}><span style={{ color: '#64748B', fontSize: 11 }}>Date</span><span style={{ fontWeight: 800 }}>{fmtDate(payModal.date)}</span></div>
                                <div style={summaryCard}><span style={{ color: '#64748B', fontSize: 11 }}>Project</span><span style={{ fontWeight: 800 }}>{payModal.project_name}</span></div>
                                <div style={summaryCard}><span style={{ color: '#64748B', fontSize: 11 }}>Total Labour</span><span style={{ fontWeight: 800, fontSize: 18 }}>{payModal.total_count}</span></div>
                                <div style={summaryCard}><span style={{ color: '#64748B', fontSize: 11 }}>Marked By</span><span style={{ fontWeight: 800 }}>{payModal.marked_by}</span></div>
                            </div>

                            {/* Breakdown Table */}
                            <div style={{ border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden', marginBottom: 18 }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                    <thead>
                                        <tr style={{ backgroundColor: '#3B82F6', color: 'white' }}>
                                            <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, fontSize: 11 }}>PARTY / CONTRACTOR</th>
                                            <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, fontSize: 11 }}>CATEGORY</th>
                                            <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, fontSize: 11 }}>COUNT</th>
                                            <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, fontSize: 11 }}>SHIFT</th>
                                            <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, fontSize: 11 }}>WAGE</th>
                                            <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, fontSize: 11 }}>COST</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(payModal.categories || []).map((c, i) => {
                                            const count = c.count || 0;
                                            const wage = c.daily_wage || 0;
                                            const shift = parseFloat(c.shift) || 1;
                                            const ot = parseFloat(c.ot) || 0;
                                            let cost = count * wage * shift;
                                            if (ot > 0 && wage > 0 && count > 0) cost += count * (wage / 8) * 1.5 * ot;
                                            return (
                                                <tr key={i} style={{ borderTop: '1px solid #F1F5F9' }}>
                                                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{c.party || '-'}</td>
                                                    <td style={{ padding: '10px 12px' }}>
                                                        <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, backgroundColor: '#DBEAFE', color: '#1D4ED8' }}>{c.category}</span>
                                                    </td>
                                                    <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700 }}>{count}</td>
                                                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>{shift}</td>
                                                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>{fmt(wage)}</td>
                                                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700 }}>{fmt(Math.round(cost))}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    <tfoot>
                                        <tr style={{ backgroundColor: '#F1F5F9' }}>
                                            <td colSpan={2} style={{ padding: '12px', fontWeight: 800, textAlign: 'right' }}>Total</td>
                                            <td style={{ padding: '12px', textAlign: 'center', fontWeight: 800 }}>{payModal.total_count}</td>
                                            <td></td>
                                            <td></td>
                                            <td style={{ padding: '12px', textAlign: 'right', fontWeight: 800, color: '#1D4ED8', fontSize: 15 }}>{fmt(payModal.day_cost)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>

                            {payModal.site_remarks && (
                                <div style={{ padding: 10, borderRadius: 8, backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', fontSize: 13, color: '#475569', marginBottom: 18 }}>
                                    <strong>Site Remarks:</strong> {payModal.site_remarks}
                                </div>
                            )}
                        </div>

                        <div style={{ padding: '14px 22px', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontSize: 14 }}>
                                <span style={{ color: '#64748B' }}>Pay Amount:</span>
                                <span style={{ fontWeight: 800, fontSize: 20, color: '#0F172A', marginLeft: 8 }}>{fmt(payModal.day_cost)}</span>
                            </div>
                            <div style={{ display: 'flex', gap: 10 }}>
                                <button onClick={() => setPayModal(null)} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #E2E8F0', backgroundColor: 'white', cursor: 'pointer', fontWeight: 600, color: '#475569' }}>
                                    Cancel
                                </button>
                                <button onClick={() => handlePay(payModal)} disabled={paying}
                                    style={{ padding: '9px 22px', borderRadius: 8, border: 'none', backgroundColor: '#10B981', color: 'white', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
                                    {paying ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle size={16} />}
                                    Confirm Payment
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const StatCard = ({ icon: Icon, label, value, color }) => (
    <div style={{ backgroundColor: 'white', padding: 16, borderRadius: 12, border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 42, height: 42, borderRadius: 10, backgroundColor: `${color}15`, color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={20} />
        </div>
        <div>
            <div style={{ fontSize: 12, color: '#64748B', fontWeight: 500 }}>{label}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#0F172A' }}>{value}</div>
        </div>
    </div>
);

const primaryBtn = { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 10, border: 'none', backgroundColor: '#3B82F6', color: 'white', fontWeight: 600, cursor: 'pointer' };
const thStyle = { padding: '12px 14px', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', textAlign: 'left' };
const tdStyle = { padding: '12px 14px', fontSize: 13, color: '#334155' };
const modalStyle = { backgroundColor: 'white', borderRadius: 14, width: '100%', maxWidth: 750, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 50px rgba(0,0,0,0.3)', overflow: 'auto' };
const summaryCard = { flex: 1, minWidth: 120, padding: '10px 14px', borderRadius: 10, border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: 2, backgroundColor: '#F8FAFC' };

export default LabourWages;

import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    FileText, Download, Printer, Eye, BarChart2, IndianRupee, Users,
    Package, HardHat, TrendingUp, Calendar, Filter, Search, X,
    CheckCircle2, Clock, AlertTriangle, Building2, ChevronDown, Briefcase, Loader2, Wallet, Calculator
} from 'lucide-react';
import PremiumSelect from '../components/PremiumSelect';
import CustomSelect from '../components/CustomSelect';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { projectAPI, materialAPI, labourAPI, financeAPI, hrmsAPI, billingAPI, settingsAPI, inventoryAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { hasPermission } from '../utils/rbac';

const fmt = (n) => {
    if (!n && n !== 0) return '₹0';
    if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
    if (n >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
    return `₹${Number(n).toLocaleString('en-IN')}`;
};

// ─── Report template catalogue ─────────────────────────────────────────────
const REPORT_TEMPLATES = [
    {
        id: 'R001', category: 'Financial', title: 'Project Budget Summary',
        description: 'Budget vs. actual spend across all active projects.',
        icon: IndianRupee, color: '#3B82F6', bg: '#EFF6FF',
        frequency: 'Monthly', lastGenerated: '20 Feb 2026',
    },
    {
        id: 'R002', category: 'Financial', title: 'Accounts Payable Report',
        description: 'Outstanding invoices, vendor dues and payment schedule.',
        icon: IndianRupee, color: '#8B5CF6', bg: '#F5F3FF',
        frequency: 'Weekly', lastGenerated: '18 Feb 2026',
    },
    {
        id: 'R003', category: 'Project', title: 'Project Progress Report',
        description: 'Task completion rates, milestones, and DPR summary.',
        icon: Building2, color: '#10B981', bg: '#ECFDF5',
        frequency: 'Weekly', lastGenerated: '20 Feb 2026',
    },
    {
        id: 'R004', category: 'Project', title: 'DPR Consolidated',
        description: 'Daily progress report consolidation across all sites.',
        icon: FileText, color: '#059669', bg: '#ECFDF5',
        frequency: 'Daily', lastGenerated: '21 Feb 2026',
    },
    {
        id: 'R005', category: 'HRMS', title: 'Attendance & Labour Report',
        description: 'Employee and daily-wage labour attendance for the period.',
        icon: Users, color: '#F59E0B', bg: '#FFFBEB',
        frequency: 'Monthly', lastGenerated: '01 Feb 2026',
    },
    {
        id: 'R006', category: 'HRMS', title: 'Payroll Summary',
        description: 'Net payable, deductions, and allowance breakdown.',
        icon: IndianRupee, color: '#EF4444', bg: '#FEF2F2',
        frequency: 'Monthly', lastGenerated: '01 Feb 2026',
    },
    {
        id: 'R007', category: 'Inventory', title: 'Material Stock Report',
        description: 'Current stock levels, consumption, and reorder alerts.',
        icon: Package, color: '#6366F1', bg: '#EEF2FF',
        frequency: 'Weekly', lastGenerated: '18 Feb 2026',
    },
    {
        id: 'R008', category: 'Inventory', title: 'GRN Analytics',
        description: 'Detailed analysis of goods received and supply chain logs.',
        icon: Package, color: '#14B8A6', bg: '#F0FDFA',
        frequency: 'Weekly', lastGenerated: '18 Feb 2026',
    },
    {
        id: 'R009', category: 'Plant', title: 'Equipment Utilisation',
        description: 'Hours run, diesel consumed, and downtime analysis.',
        icon: HardHat, color: '#F97316', bg: '#FFF7ED',
        frequency: 'Weekly', lastGenerated: '17 Feb 2026',
    },
    {
        id: 'R010', category: 'Financial', title: 'Expense Analytics',
        description: 'Detailed breakdown of site and office expenditures.',
        icon: IndianRupee, color: '#EC4899', bg: '#FDF2F8',
        frequency: 'Monthly', lastGenerated: '23 Feb 2026',
    },
    {
        id: 'R011', category: 'Financial', title: 'Trial Balance',
        description: 'Summary of all ledger balances (Debit vs Credit).',
        icon: Calculator, color: '#10B981', bg: '#ECFDF5',
        frequency: 'Monthly', lastGenerated: 'Today',
    },
    {
        id: 'R012', category: 'Financial', title: 'Party Outstanding',
        description: 'Client receivables and vendor payables summary.',
        icon: Wallet, color: '#F59E0B', bg: '#FFFBEB',
        frequency: 'Weekly', lastGenerated: 'Today',
    },
    {
        id: 'R013', category: 'Financial', title: 'Project Financial Summary',
        description: 'Consolidated sales, collections and purchases per project.',
        icon: Briefcase, color: '#3B82F6', bg: '#EFF6FF',
        frequency: 'Monthly', lastGenerated: 'Today',
    },
];

// ─── Preview data per report ─────────────────────────────────────────────────
const BUDGET_DATA = [
    { name: 'Sky Tower', budget: 180, spent: 62 },
    { name: 'Metro Ph-3', budget: 250, spent: 67 },
    { name: 'Grand Mall', budget: 120, spent: 89 },
    { name: 'Wedding Hall', budget: 300, spent: 5 },
    { name: 'Riverside', budget: 90, spent: 55 },
];

const MATERIAL_PIE = [
    { name: 'Cement', value: 35 },
    { name: 'Steel', value: 28 },
    { name: 'Bricks', value: 15 },
    { name: 'Sand', value: 12 },
    { name: 'Others', value: 10 },
];
const PIE_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

const PROGRESS_DATA = [
    { project: 'Sky Tower', progress: 34.4, tasks: 12, dpr: 45 },
    { project: 'Metro Ph-3', progress: 26.8, tasks: 14, dpr: 32 },
    { project: 'Grand Mall', progress: 74.2, tasks: 8, dpr: 61 },
    { project: 'Wedding Hall', progress: 8.0, tasks: 5, dpr: 7 },
    { project: 'Riverside', progress: 61.5, tasks: 9, dpr: 38 },
];

const CATEGORIES = ['All', 'Financial', 'Project', 'HRMS', 'Inventory', 'Plant'];

// ─── Report Preview Modal ────────────────────────────────────────────────────
const ReportPreview = ({
    report, onClose, budgetData = [], progressData = [], inventoryData = [],
    materialStockReport = [], expenseData = [], attendanceData = [], bills = [], payables = []
}) => {
    const [companyInfo, setCompanyInfo] = useState({ companyName: 'CIVIL ERP' });

    useEffect(() => {
        if (report) {
            const fetchInfo = () => {
                settingsAPI.getCompany().then(res => {
                    if (res.data) setCompanyInfo(res.data);
                }).catch(err => console.error("Failed to fetch company info", err));
            };
            fetchInfo();
            window.addEventListener('companyInfoUpdated', fetchInfo);
            return () => window.removeEventListener('companyInfoUpdated', fetchInfo);
        }
    }, [report]);

    if (!report) return null;

    const handlePrint = () => window.print();

    // Preparation logic shared between UI and CSV
    const totalBilled = bills.reduce((s, b) => s + (b.total_amount || 0), 0);
    const totalCollected = bills.reduce((s, b) => s + (b.collection_amount || 0), 0);
    const totalPurchases = payables.reduce((s, p) => s + (p.total_amount || 0), 0);
    const totalPayableAmt = payables.reduce((s, p) => s + (p.amount || 0), 0);
    const totalExp = expenseData.reduce((s, e) => s + (e.amount || 0), 0);
    const cashBalance = totalCollected - totalExp;
    const totalReceivable = totalBilled - totalCollected;

    const trialBalanceRows = [
        { account: 'Sales (Revenue)', debit: 0, credit: totalBilled },
        { account: 'Accounts Receivable (Asset)', debit: totalReceivable, credit: 0 },
        { account: 'Purchases (Expenses)', debit: totalPurchases, credit: 0 },
        { account: 'Accounts Payable (Liability)', debit: 0, credit: totalPayableAmt },
        { account: 'Operating Expenses', debit: totalExp, credit: 0 },
        { account: 'Cash & Bank Balance', debit: cashBalance > 0 ? cashBalance : 0, credit: cashBalance < 0 ? Math.abs(cashBalance) : 0 }
    ];

    const preparePartyOutstanding = () => {
        const parties = {};
        bills.forEach(b => {
            if (b.project) {
                if (!parties[b.project]) parties[b.project] = { receivable: 0, payable: 0 };
                parties[b.project].receivable += ((b.total_amount || 0) - (b.collection_amount || 0));
            }
        });
        payables.forEach(p => {
            if (p.vendor) {
                if (!parties[p.vendor]) parties[p.vendor] = { receivable: 0, payable: 0 };
                parties[p.vendor].payable += (p.amount || 0);
            }
        });
        return Object.entries(parties).map(([party, data]) => ({ party, ...data })).filter(d => d.receivable > 0 || d.payable > 0);
    };

    const prepareProjectSummary = () => {
        const summary = {};
        budgetData.forEach(p => summary[p.name] = { sales: 0, received: 0, purchases: 0, paid: 0 });
        bills.forEach(b => {
            if (b.project && summary[b.project]) {
                summary[b.project].sales += (b.total_amount || 0);
                summary[b.project].received += (b.collection_amount || 0);
            }
        });
        payables.forEach(p => {
            if (p.project && summary[p.project]) {
                summary[p.project].purchases += (p.total_amount || 0);
                summary[p.project].paid += (p.paid_amount || 0);
            }
        });
        return Object.entries(summary).map(([project, data]) => ({ project, ...data })).filter(d => d.sales > 0 || d.purchases > 0);
    };

    const handleCSV = () => {
        let csv = '';
        if (report.category === 'Financial' && report.id === 'R001') {
            csv = 'Project,Budget (L),Spent (L),Variance (L),Utilisation %\n' +
                budgetData.map(r => `${r.name},${r.budget},${r.spent},${r.budget - r.spent},${r.budget > 0 ? Math.round((r.spent / r.budget) * 100) : 0}%`).join('\n');
        } else if (report.category === 'Project') {
            csv = 'Project,Progress %,Tasks,DPRs Filed\n' +
                progressData.map(r => `${r.project},${r.progress}%,${r.tasks},${r.dpr}`).join('\n');
        } else if (report.category === 'Inventory') {
            csv = materialStockReport.length > 0
                ? 'Material,Unit,Warehouse Qty,Total Site Qty,Total Qty,Last Rate,Total Value\n' +
                    materialStockReport.filter(m => m.total_qty > 0).map(m =>
                        `"${m.material_name}",${m.unit},${m.warehouse_qty},${m.total_site_qty},${m.total_qty},${m.last_rate},${m.total_value}`
                    ).join('\n')
                : 'Material,Stock Share %\n' +
                    inventoryData.map(r => `${r.name},${r.value}%`).join('\n');
        } else if (report.id === 'R010') {
            csv = 'Date,Project,Category,Amount (₹),Payee/Paid To,Mode,Description\n' +
                (expenseData || []).map(r => `${r.date},${r.project},${r.category},${r.amount},${r.payee},${r.paymentMode},"${(r.description || '').replace(/"/g, '""')}"`).join('\n');
        } else if (report.id === 'R005') {
            csv = 'Date,Employee ID,Employee Name,Status,Remarks\n' +
                (attendanceData || []).map(r => `${r.date},${r.employeeId},${r.employeeName},${r.status},${r.remarks || ''}`).join('\n');
        } else if (report.id === 'R011') {
            csv = 'Account Type,Debit (Dr),Credit (Cr)\n' +
                trialBalanceRows.map(r => `${r.account},${r.debit},${r.credit}`).join('\n');
        } else if (report.id === 'R012') {
            csv = 'Party,Receivable,Payable,Net Outstanding\n' +
                preparePartyOutstanding().map(r => `${r.party},${r.receivable},${r.payable},${r.receivable - r.payable}`).join('\n');
        } else if (report.id === 'R013') {
            csv = 'Project,Sales,Received,Out. Sales,Purchases,Paid,Out. Purchase\n' +
                prepareProjectSummary().map(r => `${r.project},${r.sales},${r.received},${r.sales - r.received},${r.purchases},${r.paid},${r.purchases - r.paid}`).join('\n');
        } else {
            csv = `Report,${report.title}\nCategory,${report.category}\nGenerated,${new Date().toLocaleDateString()}\n`;
        }
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${report.title.replace(/ /g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 500, display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
            padding: '40px 20px', overflowY: 'auto'
        }}>
            <div style={{
                backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: '860px',
                boxShadow: '0 24px 64px rgba(0,0,0,0.25)', animation: 'fadeIn 0.2s ease'
            }} className="printable-report">
                {/* Modal header */}
                <div style={{
                    padding: '24px 28px', borderBottom: '1px solid var(--border)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ padding: '10px', borderRadius: '10px', backgroundColor: report.bg, color: report.color }}>
                            <report.icon size={22} />
                        </div>
                        <div>
                            <h1 style={{ fontSize: '24px', fontWeight: '900', color: 'var(--text-main)', display: 'none' }} className="print-only">
                                {companyInfo.companyName}
                            </h1>
                            <h2 style={{ fontSize: '18px', fontWeight: '800' }}>{report.title}</h2>
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                Generated: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <button onClick={handleCSV} className="btn btn-outline btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Download size={14} /> CSV
                        </button>
                        <button onClick={handlePrint} className="btn btn-outline btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Printer size={14} /> Print
                        </button>
                        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}>
                            <X size={22} />
                        </button>
                    </div>
                </div>

                {/* Report content */}
                <div style={{ padding: '28px' }}>
                    {budgetData.length === 0 && progressData.length === 0 && inventoryData.length === 0 && expenseData.length === 0 && attendanceData.length === 0 && bills.length === 0 && payables.length === 0 && (
                        <div style={{ padding: '40px', textAlign: 'center', background: '#FEF3C7', borderRadius: '12px', marginBottom: '24px' }}>
                            <AlertTriangle size={32} color="#B45309" style={{ marginBottom: '12px' }} />
                            <p style={{ fontWeight: '700', color: '#B45309' }}>No data available for the selected period. Try changing the date range filter.</p>
                        </div>
                    )}

                    {report.id === 'R002' && (
                        <>
                            <h3 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '20px' }}>Accounts Payable Summary</h3>
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Vendor / Party</th>
                                        <th style={{ textAlign: 'right' }}>Invoice Amount</th>
                                        <th style={{ textAlign: 'right' }}>Paid</th>
                                        <th style={{ textAlign: 'right' }}>Outstanding</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {payables.map((p, i) => (
                                        <tr key={i}>
                                            <td style={{ fontWeight: '700' }}>{p.vendor || p.party || p.vendorName || '—'}</td>
                                            <td style={{ textAlign: 'right' }}>{fmt(p.total_amount || p.amount || 0)}</td>
                                            <td style={{ textAlign: 'right', color: '#10B981' }}>{fmt(p.paid_amount || 0)}</td>
                                            <td style={{ textAlign: 'right', color: '#EF4444', fontWeight: '700' }}>{fmt((p.total_amount || p.amount || 0) - (p.paid_amount || 0))}</td>
                                            <td><span className={`badge ${p.status === 'Paid' ? 'badge-success' : 'badge-warning'}`}>{p.status || 'Pending'}</span></td>
                                        </tr>
                                    ))}
                                    {payables.length === 0 && <tr><td colSpan="5" style={{ textAlign: 'center', padding: '40px' }}>No payable records found.</td></tr>}
                                </tbody>
                            </table>
                        </>
                    )}

                    {(report.category === 'Financial' && !['R002', 'R010', 'R011', 'R012', 'R013'].includes(report.id)) && (
                        <>
                            <h3 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '20px' }}>Budget vs. Actual (₹ Lakhs)</h3>
                            <ResponsiveContainer width="100%" height={260}>
                                <BarChart data={budgetData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                    <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `₹${v}L`} />
                                    <Tooltip formatter={(v) => `₹${v} Lakhs`} />
                                    <Bar dataKey="budget" fill="#64748B" name="Budget" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="spent" fill="#8B5CF6" name="Spent" radius={[4, 4, 0, 0]} />
                                    <Legend />
                                </BarChart>
                            </ResponsiveContainer>
                            <table className="data-table" style={{ marginTop: '28px' }}>
                                <thead>
                                    <tr>
                                        <th>Project</th>
                                        <th style={{ textAlign: 'right' }}>Budget</th>
                                        <th style={{ textAlign: 'right' }}>Spent</th>
                                        <th style={{ textAlign: 'right' }}>Variance</th>
                                        <th style={{ textAlign: 'center' }}>Utilisation</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {budgetData.map(r => {
                                        const pct = r.budget > 0 ? Math.round((r.spent / r.budget) * 100) : 0;
                                        return (
                                            <tr key={r.name}>
                                                <td style={{ fontWeight: '700' }}>{r.name}</td>
                                                <td style={{ textAlign: 'right' }}>₹{r.budget.toFixed(1)}L</td>
                                                <td style={{ textAlign: 'right' }}>₹{r.spent.toFixed(1)}L</td>
                                                <td style={{ textAlign: 'right', color: '#059669', fontWeight: '700' }}>₹{(r.budget - r.spent).toFixed(1)}L</td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                                                        <div style={{ width: '80px', height: '6px', backgroundColor: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                                                            <div style={{ width: `${pct}%`, height: '100%', backgroundColor: pct > 80 ? '#EF4444' : '#3B82F6' }} />
                                                        </div>
                                                        <span style={{ fontSize: '12px', fontWeight: '700' }}>{pct}%</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </>
                    )}

                    {report.category === 'Project' && (
                        <>
                            <h3 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '20px' }}>Project Progress Overview</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {progressData.map(r => (
                                    <div key={r.project} style={{ padding: '16px', border: '1px solid var(--border)', borderRadius: '10px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                            <div>
                                                <h4 style={{ fontWeight: '700', fontSize: '15px' }}>{r.project}</h4>
                                                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Tasks: {r.tasks} | DPRs Filed: {r.dpr}</span>
                                            </div>
                                            <span style={{ fontWeight: '800', fontSize: '18px', color: r.progress > 60 ? '#10B981' : r.progress > 30 ? '#3B82F6' : '#F59E0B' }}>
                                                {r.progress}%
                                            </span>
                                        </div>
                                        <div style={{ width: '100%', height: '8px', backgroundColor: '#E2E8F0', borderRadius: '4px', overflow: 'hidden' }}>
                                            <div style={{
                                                width: `${r.progress}%`, height: '100%', borderRadius: '4px',
                                                backgroundColor: r.progress > 60 ? '#10B981' : r.progress > 30 ? '#3B82F6' : '#F59E0B'
                                            }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {report.category === 'Inventory' && (
                        <>
                            <h3 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '20px' }}>Material Stock Report</h3>

                            {/* Detailed material table */}
                            {materialStockReport.length > 0 && (
                                <div style={{ overflowX: 'auto', marginBottom: 24, border: '1px solid #E2E8F0', borderRadius: 10 }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                        <thead>
                                            <tr style={{ backgroundColor: '#F8FAFC' }}>
                                                <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, fontSize: 11, color: '#64748B' }}>Material</th>
                                                <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, fontSize: 11, color: '#64748B' }}>Unit</th>
                                                <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, fontSize: 11, color: '#64748B' }}>Warehouse</th>
                                                <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, fontSize: 11, color: '#64748B' }}>Site Stock</th>
                                                <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, fontSize: 11, color: '#64748B' }}>Total Qty</th>
                                                <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, fontSize: 11, color: '#64748B' }}>Last Rate</th>
                                                <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, fontSize: 11, color: '#64748B' }}>Total Value</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {materialStockReport.filter(m => m.total_qty > 0).map((m, i) => (
                                                <tr key={i} style={{ borderTop: '1px solid #F1F5F9' }}>
                                                    <td style={{ padding: '10px 14px', fontWeight: 700 }}>{m.material_name}</td>
                                                    <td style={{ padding: '10px 14px', textAlign: 'center', color: '#64748B' }}>{m.unit}</td>
                                                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                                        <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700, backgroundColor: m.warehouse_qty > 0 ? '#DCFCE7' : '#F1F5F9', color: m.warehouse_qty > 0 ? '#15803D' : '#94A3B8' }}>
                                                            {m.warehouse_qty}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                                        {Object.entries(m.site_stocks || {}).length > 0 ? (
                                                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
                                                                {Object.entries(m.site_stocks).map(([site, qty]) => (
                                                                    <span key={site} style={{ padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600, backgroundColor: '#EFF6FF', color: '#1D4ED8' }} title={site}>
                                                                        {site.substring(0, 15)}: {qty}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        ) : <span style={{ color: '#94A3B8' }}>0</span>}
                                                    </td>
                                                    <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 800 }}>{m.total_qty}</td>
                                                    <td style={{ padding: '10px 14px', textAlign: 'right' }}>₹{(m.last_rate || 0).toLocaleString('en-IN')}</td>
                                                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#0F172A' }}>₹{(m.total_value || 0).toLocaleString('en-IN')}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr style={{ backgroundColor: '#F1F5F9' }}>
                                                <td colSpan={4} style={{ padding: '10px 14px', fontWeight: 800, textAlign: 'right' }}>Total</td>
                                                <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 800 }}>{materialStockReport.reduce((s, m) => s + m.total_qty, 0)}</td>
                                                <td></td>
                                                <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: '#1D4ED8' }}>₹{materialStockReport.reduce((s, m) => s + (m.total_value || 0), 0).toLocaleString('en-IN')}</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            )}

                            {/* Pie chart */}
                            <h4 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '12px', color: '#475569' }}>Stock Distribution</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '28px' }}>
                                <div>
                                    <ResponsiveContainer width="100%" height={240}>
                                        <PieChart>
                                            <Pie data={inventoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, value }) => `${name} ${value}%`}>
                                                {inventoryData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                                            </Pie>
                                            <Tooltip />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '12px' }}>
                                    {inventoryData.map((item, i) => (
                                        <div key={item.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                                                <span style={{ fontWeight: '600', fontSize: '14px' }}>{item.name}</span>
                                            </div>
                                            <span style={{ fontWeight: '800', color: PIE_COLORS[i % PIE_COLORS.length] }}>{item.value}%</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}

                    {report.id === 'R010' && (
                        <>
                            <h3 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '20px' }}>Expense Breakdown by Category</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '28px', marginBottom: '32px' }}>
                                <div>
                                    <ResponsiveContainer width="100%" height={240}>
                                        <PieChart>
                                            <Pie
                                                data={(() => {
                                                    const cats = {};
                                                    expenseData.forEach(e => {
                                                        cats[e.category] = (cats[e.category] || 0) + e.amount;
                                                    });
                                                    return Object.entries(cats).map(([name, value]) => ({ name, value }));
                                                })()}
                                                dataKey="value"
                                                nameKey="name"
                                                cx="50%"
                                                cy="50%"
                                                outerRadius={80}
                                            >
                                                {Object.keys(expenseData.reduce((acc, e) => ({ ...acc, [e.category]: 1 }), {})).map((_, i) => (
                                                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip formatter={(v) => `₹${Number(v).toLocaleString()}`} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '8px' }}>
                                    {(() => {
                                        const cats = {};
                                        let total = 0;
                                        expenseData.forEach(e => {
                                            cats[e.category] = (cats[e.category] || 0) + e.amount;
                                            total += e.amount;
                                        });
                                        return Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([name, value], i) => (
                                            <div key={name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <div style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                                                    <span style={{ fontWeight: '600', fontSize: '13px' }}>{name}</span>
                                                </div>
                                                <span style={{ fontWeight: '800', fontSize: '13px' }}>₹{Number(value).toLocaleString()}</span>
                                            </div>
                                        ));
                                    })()}
                                </div>
                            </div>
                            <h3 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '16px' }}>Recent Expenditures</h3>
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Project</th>
                                        <th>Category</th>
                                        <th style={{ textAlign: 'right' }}>Amount</th>
                                        <th>Paid To</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {expenseData.slice(0, 10).map((exp, i) => (
                                        <tr key={i}>
                                            <td style={{ fontSize: '12px' }}>{exp.date}</td>
                                            <td style={{ fontWeight: '700' }}>{exp.project}</td>
                                            <td><span style={{ fontSize: '11px', padding: '2px 8px', background: '#F1F5F9', borderRadius: '4px' }}>{exp.category}</span></td>
                                            <td style={{ textAlign: 'right', fontWeight: '800' }}>₹{exp.amount?.toLocaleString()}</td>
                                            <td style={{ fontSize: '12px' }}>{exp.payee}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </>
                    )}

                    {report.id === 'R005' && (
                        <>
                            <h3 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '20px' }}>Daily Attendance Summary</h3>
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Employee Name</th>
                                        <th>Status</th>
                                        <th>Remarks</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(attendanceData || []).map((att, i) => (
                                        <tr key={i}>
                                            <td style={{ fontSize: '13px' }}>{att.date}</td>
                                            <td style={{ fontWeight: '700' }}>{att.employeeName}</td>
                                            <td>
                                                <span className={`badge ${att.status === 'Present' ? 'badge-success' : att.status === 'Leave' ? 'badge-info' : 'badge-danger'}`}>
                                                    {att.status}
                                                </span>
                                            </td>
                                            <td style={{ fontSize: '13px' }}>
                                                {att.remarks?.includes('Leave Approved ID:') ? 'Leave Approved' : (att.remarks || '—')}
                                            </td>
                                        </tr>
                                    ))}
                                    {attendanceData.length === 0 && <tr><td colSpan="4" style={{ textAlign: 'center', padding: '40px' }}>No attendance records found for this period.</td></tr>}
                                </tbody>
                            </table>
                        </>
                    )}

                    {report.id === 'R011' && (
                        <>
                            <h3 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '20px' }}>Trial Balance Summary</h3>
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Account Type / Ledger Group</th>
                                        <th style={{ textAlign: 'right' }}>Debit (Dr)</th>
                                        <th style={{ textAlign: 'right' }}>Credit (Cr)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(() => {
                                        const totalDr = trialBalanceRows.reduce((a, b) => a + b.debit, 0);
                                        const totalCr = trialBalanceRows.reduce((a, b) => a + b.credit, 0);

                                        return (
                                            <>
                                                {trialBalanceRows.map((row, i) => (
                                                    <tr key={i}>
                                                        <td style={{ fontWeight: '600' }}>{row.account}</td>
                                                        <td style={{ textAlign: 'right', color: '#EF4444', fontWeight: '700' }}>{row.debit > 0 ? fmt(row.debit) : '—'}</td>
                                                        <td style={{ textAlign: 'right', color: '#10B981', fontWeight: '700' }}>{row.credit > 0 ? fmt(row.credit) : '—'}</td>
                                                    </tr>
                                                ))}
                                                <tr style={{ backgroundColor: '#F8FAFC', fontWeight: '900' }}>
                                                    <td>TOTAL</td>
                                                    <td style={{ textAlign: 'right', color: '#EF4444' }}>{fmt(totalDr)}</td>
                                                    <td style={{ textAlign: 'right', color: '#10B981' }}>{fmt(totalCr)}</td>
                                                </tr>
                                            </>
                                        );
                                    })()}
                                </tbody>
                            </table>
                        </>
                    )}

                    {report.id === 'R012' && (
                        <>
                            <h3 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '20px' }}>Party Outstanding Master</h3>
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Party / Project</th>
                                        <th style={{ textAlign: 'right' }}>Receivable (Asset)</th>
                                        <th style={{ textAlign: 'right' }}>Payable (Liability)</th>
                                        <th style={{ textAlign: 'right' }}>Net Position</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(() => {
                                        const rows = preparePartyOutstanding();
                                        const totalRec = rows.reduce((s, r) => s + r.receivable, 0);
                                        const totalPay = rows.reduce((s, r) => s + r.payable, 0);

                                        return (
                                            <>
                                                {rows.map((row, i) => (
                                                    <tr key={i}>
                                                        <td style={{ fontWeight: '700' }}>{row.party}</td>
                                                        <td style={{ textAlign: 'right', color: '#10B981' }}>{row.receivable > 0 ? fmt(row.receivable) : '—'}</td>
                                                        <td style={{ textAlign: 'right', color: '#EF4444' }}>{row.payable > 0 ? fmt(row.payable) : '—'}</td>
                                                        <td style={{ textAlign: 'right', fontWeight: '800' }}>
                                                            {row.receivable > row.payable ? `${fmt(row.receivable - row.payable)} Dr` :
                                                                row.payable > row.receivable ? `${fmt(row.payable - row.receivable)} Cr` : 'Nil'}
                                                        </td>
                                                    </tr>
                                                ))}
                                                <tr style={{ backgroundColor: '#F8FAFC', fontWeight: '900' }}>
                                                    <td>TOTAL</td>
                                                    <td style={{ textAlign: 'right' }}>{fmt(totalRec)}</td>
                                                    <td style={{ textAlign: 'right' }}>{fmt(totalPay)}</td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        {totalRec > totalPay ? `${fmt(totalRec - totalPay)} Dr` : `${fmt(totalPay - totalRec)} Cr`}
                                                    </td>
                                                </tr>
                                            </>
                                        );
                                    })()}
                                </tbody>
                            </table>
                        </>
                    )}

                    {report.id === 'R013' && (
                        <>
                            <h3 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '20px' }}>Project Financial Performance</h3>
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Project</th>
                                        <th style={{ textAlign: 'right' }}>Sales</th>
                                        <th style={{ textAlign: 'right' }}>Coll.</th>
                                        <th style={{ textAlign: 'right' }}>Purch.</th>
                                        <th style={{ textAlign: 'right' }}>Paid</th>
                                        <th style={{ textAlign: 'right' }}>Net Cashflow</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(() => {
                                        const rows = prepareProjectSummary();
                                        return (
                                            <>
                                                {rows.map((row, i) => (
                                                    <tr key={i}>
                                                        <td style={{ fontWeight: '700' }}>{row.project}</td>
                                                        <td style={{ textAlign: 'right' }}>{fmt(row.sales)}</td>
                                                        <td style={{ textAlign: 'right', color: '#10B981' }}>{fmt(row.received)}</td>
                                                        <td style={{ textAlign: 'right' }}>{fmt(row.purchases)}</td>
                                                        <td style={{ textAlign: 'right', color: '#EF4444' }}>{fmt(row.paid)}</td>
                                                        <td style={{ textAlign: 'right', fontWeight: '800' }}>{fmt(row.received - row.paid)}</td>
                                                    </tr>
                                                ))}
                                                <tr style={{ backgroundColor: '#F8FAFC', fontWeight: '900' }}>
                                                    <td>TOTAL</td>
                                                    <td style={{ textAlign: 'right' }}>{fmt(rows.reduce((s, r) => s + r.sales, 0))}</td>
                                                    <td style={{ textAlign: 'right' }}>{fmt(rows.reduce((s, r) => s + r.received, 0))}</td>
                                                    <td style={{ textAlign: 'right' }}>{fmt(rows.reduce((s, r) => s + r.purchases, 0))}</td>
                                                    <td style={{ textAlign: 'right' }}>{fmt(rows.reduce((s, r) => s + r.paid, 0))}</td>
                                                    <td style={{ textAlign: 'right' }}>{fmt(rows.reduce((s, r) => s + (r.received - r.paid), 0))}</td>
                                                </tr>
                                            </>
                                        );
                                    })()}
                                </tbody>
                            </table>
                        </>
                    )}

                    {(report.category === 'HRMS' || report.category === 'Plant') && report.id !== 'R005' && (
                        <div style={{ padding: '40px', textAlign: 'center', background: '#F8FAFC', borderRadius: '12px', border: '2px dashed var(--border)' }}>
                            <report.icon size={48} style={{ color: report.color, margin: '0 auto 16px' }} />
                            <h4 style={{ fontWeight: '700', marginBottom: '8px' }}>{report.title} Preview</h4>
                            <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
                                This report will fetch live data from the database. Connect the backend to see real-time figures.
                            </p>
                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                                {['Period: Feb 2026', 'Format: PDF & Excel', 'Status: Ready'].map(tag => (
                                    <span key={tag} style={{ padding: '6px 14px', backgroundColor: report.bg, color: report.color, borderRadius: '20px', fontSize: '12px', fontWeight: '700' }}>{tag}</span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <style>{`
                    @media print {
                        body * { visibility: hidden; }
                        .printable-report, .printable-report * { visibility: visible; }
                        .printable-report { 
                            position: absolute; 
                            left: 0; 
                            top: 0; 
                            width: 100%; 
                            box-shadow: none !important;
                            border: none !important;
                        }
                        .modal-overlay { background: none !important; }
                        button, .modal-header button { display: none !important; }
                        .print-only { display: block !important; margin-bottom: 20px; text-align: center; }
                    }
                `}</style>
            </div>
        </div>
    );
};

const Reports = () => {
    const { user } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const urlTab = searchParams.get('tab');
    const [activeCategory, setActiveCategory] = useState('All');

    // Bug 7.4 - Filter reports based on user role permissions
    const userRole = user?.role || '';
    const isCoordinator = userRole.toLowerCase().includes('coordinator');
    const canViewFinancial = hasPermission(user, 'Accounts', 'view') || hasPermission(user, 'Finance', 'view');

    useEffect(() => {
        if (urlTab) {
            if (CATEGORIES.includes(urlTab)) {
                setActiveCategory(urlTab);
            }
        }
    }, [urlTab]);

    const handleCategoryChange = (cat) => {
        setActiveCategory(cat);
        setSearchParams({ tab: cat });
    };
    const [searchTerm, setSearchTerm] = useState('');
    const [previewReport, setPreviewReport] = useState(null);
    const [dateRange, setDateRange] = useState('This Month');
    const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [attendanceData, setAttendanceData] = useState([]);

    const [loading, setLoading] = useState(true);
    const [rawProjects, setRawProjects] = useState([]);
    const [rawExpenses, setRawExpenses] = useState([]);
    const [budgetData, setBudgetData] = useState([]);
    const [progressData, setProgressData] = useState([]);
    const [inventoryData, setInventoryData] = useState([]);
    const [materialStockReport, setMaterialStockReport] = useState([]);
    const [expenseData, setExpenseData] = useState([]);
    const [bills, setBills] = useState([]);
    const [payables, setPayables] = useState([]);
    const [stats, setStats] = useState({ totalReports: REPORT_TEMPLATES.length, thisMonth: 0, scheduled: 0, pending: 0 });

    const isDateInRange = (dateInput) => {
        if (!dateInput) return false;
        if (dateRange === 'All' || dateRange === 'All Time') return true;

        let date;
        try {
            // Standard parse
            date = new Date(dateInput);

            // Manual parse for common non-standard formats
            if (isNaN(date.getTime()) && typeof dateInput === 'string') {
                const parts = dateInput.split(/[\s-/]/); // Split by space, dash, or slash
                if (parts.length === 3) {
                    const months = { 'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5, 'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11 };

                    // Case 1: "27 Feb 2026"
                    if (months[parts[1]] !== undefined) {
                        date = new Date(parts[2], months[parts[1]], parts[0]);
                    }
                    // Case 2: "27-02-2026" or "27/02/2026"
                    else if (!isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
                        if (parts[2].length === 4) {
                            date = new Date(parts[2], parseInt(parts[1]) - 1, parts[0]);
                        } else if (parts[0].length === 4) {
                            date = new Date(parts[0], parseInt(parts[1]) - 1, parts[2]);
                        }
                    }
                }
            }
        } catch (e) {
            return false;
        }

        if (isNaN(date.getTime())) return false;

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const startOfThisWeek = new Date(now);
        startOfThisWeek.setDate(now.getDate() - now.getDay());
        startOfThisWeek.setHours(0, 0, 0, 0);

        const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

        if (dateRange === 'Today') return date >= startOfToday;
        if (dateRange === 'This Week') return date >= startOfThisWeek;
        if (dateRange === 'This Month') return date >= startOfThisMonth;
        if (dateRange === 'Last Month') return date >= startOfLastMonth && date <= endOfLastMonth;

        if (dateRange === 'Custom Range') {
            const s = new Date(startDate);
            const e = new Date(endDate);
            const d = new Date(date);
            e.setHours(23, 59, 59, 999);
            s.setHours(0, 0, 0, 0);
            return d >= s && d <= e;
        }

        return false;
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            // Bug 48: Compute date range for attendance API
            const getAttendanceRange = () => {
                const today = new Date().toISOString().split('T')[0];
                if (dateRange === 'All Time') return ['2020-01-01', today];
                if (dateRange === 'Custom Range') return [startDate, endDate];
                if (dateRange === 'Today') return [today, today];
                if (dateRange === 'This Week') {
                    const d = new Date(); d.setDate(d.getDate() - d.getDay());
                    return [d.toISOString().split('T')[0], today];
                }
                if (dateRange === 'Last Month') {
                    const s = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
                    const e = new Date(new Date().getFullYear(), new Date().getMonth(), 0);
                    return [s.toISOString().split('T')[0], e.toISOString().split('T')[0]];
                }
                // This Month (default)
                const s = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
                return [s.toISOString().split('T')[0], today];
            };
            const [attFrom, attTo] = getAttendanceRange();

            const [projRes, invRes, expRes, attRes, billRes, payRes] = await Promise.allSettled([
                projectAPI.getAll(),
                materialAPI.getInventoryByProject('all'),
                financeAPI.getExpenses(),
                hrmsAPI.getAttendanceRange(attFrom, attTo),
                billingAPI.getAll(),
                financeAPI.getPayables()
            ]);

            let projects = [];
            if (projRes.status === 'fulfilled') {
                projects = projRes.value.data || [];
                setRawProjects(projects);

                const bData = projects.map(p => {
                    // Filter project expenses in range for Budget Summary
                    const periodSpent = (expRes.status === 'fulfilled' ? (expRes.value.data || []) : [])
                        .filter(e => e.project === p.name && isDateInRange(e.date))
                        .reduce((sum, e) => sum + (e.amount || 0), 0);

                    return {
                        name: p.name,
                        budget: (p.budget / 100000) || 0,
                        spent: (periodSpent / 100000) || 0, // Show spent in PERIOD
                        totalSpent: (p.spent / 100000) || 0 // Keep total spent
                    };
                });
                setBudgetData(bData);

                const pData = projects.map(p => {
                    const rangeDprs = (p.dprs || []).filter(d => isDateInRange(d.date || d.created_at));
                    return {
                        project: p.name,
                        progress: p.progress || 0,
                        tasks: (p.tasks || []).length,
                        dpr: rangeDprs.length
                    };
                });
                setProgressData(pData);
            }

            if (invRes.status === 'fulfilled') {
                const inv = invRes.value.data || [];
                const summary = {};
                let totalStock = 0;
                inv.forEach(item => {
                    const stock = Number(item.stock) || 0;
                    summary[item.material_name] = (summary[item.material_name] || 0) + stock;
                    totalStock += stock;
                });
                const iData = Object.entries(summary).map(([name, value]) => ({
                    name,
                    value: totalStock > 0 ? Math.round((value / totalStock) * 100) : 0
                })).sort((a, b) => b.value - a.value).slice(0, 5);
                setInventoryData(iData);
            }

            // Fetch detailed material-wise report
            try {
                const mwRes = await inventoryAPI.getMaterialWiseReport();
                setMaterialStockReport(mwRes.data || []);
            } catch (e) { console.warn('Material report fetch failed', e); }

            if (expRes.status === 'fulfilled') {
                const allExp = expRes.value.data || [];
                setRawExpenses(allExp);
                const filteredExp = allExp.filter(e => isDateInRange(e.date));
                setExpenseData(filteredExp);
            }

            if (attRes.status === 'fulfilled') {
                setAttendanceData(attRes.value.data || []);
            }

            if (billRes.status === 'fulfilled') {
                const bils = billRes.value.data || [];
                // Bug 48: Include bills even if date field is missing (filter only when date exists)
                setBills(bils.filter(b => dateRange === 'All Time' || !b.date || isDateInRange(b.date || b.created_at || b.createdAt)));
            }

            if (payRes.status === 'fulfilled') {
                const pays = payRes.value.data || [];
                // Bug 48: Include payables even if date field is missing
                setPayables(pays.filter(p => dateRange === 'All Time' || !p.date || isDateInRange(p.date || p.created_at || p.createdAt)));
            }

            // Calculate range-aware KPIs
            const filteredProjectsInRange = projects.filter(p => {
                const hasDpr = (p.dprs || []).some(d => isDateInRange(d.date || d.created_at));
                const hasExp = (expRes.status === 'fulfilled' ? (expRes.value.data || []) : [])
                    .some(e => e.project === p.name && isDateInRange(e.date));
                return hasDpr || hasExp;
            });

            const rangeSiteLogs = projects.reduce((acc, p) => acc + (p.dprs?.filter(d => isDateInRange(d.date || d.created_at)).length || 0), 0);
            const rangePendingDPRs = projects.reduce((acc, p) => acc + (p.dprs?.filter(d => d.status === 'Pending' && isDateInRange(d.date || d.created_at)).length || 0), 0);

            setStats({
                totalReports: REPORT_TEMPLATES.length,
                thisMonth: filteredProjectsInRange.length,
                scheduled: rangeSiteLogs, // Actual site logs in range
                pending: rangePendingDPRs
            });

        } catch (err) {
            console.error('Reports fetch failed:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dateRange, startDate, endDate]);

    const filtered = REPORT_TEMPLATES.filter(r => {
        const matchCat = activeCategory === 'All' || r.category === activeCategory;
        const matchSearch = r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.description.toLowerCase().includes(searchTerm.toLowerCase());
        // Bug 7.4 - Coordinators cannot see Financial reports directly
        if (isCoordinator && !canViewFinancial && r.category === 'Financial') return false;
        return matchCat && matchSearch;
    });

    const kpis = [
        { label: 'TOTAL REPORTS', value: stats.totalReports, color: '#3B82F6', bg: '#EFF6FF', icon: FileText },
        { label: 'ACTIVE PROJECTS', value: stats.thisMonth, color: '#10B981', bg: '#ECFDF5', icon: Building2 },
        { label: 'SITE LOGS', value: stats.scheduled, color: '#F59E0B', bg: '#FFFBEB', icon: Clock },
        { label: 'PENDING DPRS', value: stats.pending, color: '#EF4444', bg: '#FEF2F2', icon: AlertTriangle },
    ];

    return (
        <>
            <div className="animate-fade-in" style={{ padding: '0 10px 60px 10px' }}>
                {loading && (
                    <div style={{ position: 'fixed', top: '100px', right: '40px', zIndex: 100, display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'white', padding: '8px 16px', borderRadius: '30px', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}>
                        <Loader2 size={16} className="animate-spin" />
                        <span style={{ fontSize: '12px', fontWeight: '700' }}>Syncing Live Data...</span>
                    </div>
                )}
                {/* ── Header ───────────────────────────────────────── */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
                    <div>
                        <h1 style={{ fontSize: '32px', fontWeight: '800', color: 'var(--text-main)', marginBottom: '4px' }}>Reports & Analytics</h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '15px' }}>Generate, preview, and export project reports</p>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <CustomSelect
                            options={['All Time', 'Today', 'This Week', 'This Month', 'Last Month', 'Custom Range'].map(r => ({ value: r, label: r }))}
                            value={dateRange}
                            onChange={setDateRange}
                            icon={Calendar}
                            placeholder="Select Period"
                            width="180px"
                        />
                        {dateRange === 'Custom Range' && (
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', backgroundColor: 'white', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={e => setStartDate(e.target.value)}
                                    className="form-input"
                                    style={{ border: 'none', fontSize: '13px', fontWeight: '600' }}
                                />
                                <span style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: '700' }}>TO</span>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={e => setEndDate(e.target.value)}
                                    className="form-input"
                                    style={{ border: 'none', fontSize: '13px', fontWeight: '600' }}
                                />
                            </div>
                        )}
                        <button className="btn btn-primary" style={{ fontWeight: '800', height: '52px' }} onClick={fetchData}>
                            <BarChart2 size={18} /> GENERATE REPORT
                        </button>
                    </div>
                </div>

                {/* ── KPIs ─────────────────────────────────────────── */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '32px' }}>
                    {kpis.map((kpi, i) => (
                        <div key={i} className="card" style={{ padding: '22px', display: 'flex', gap: '16px', alignItems: 'center', borderLeft: `4px solid ${kpi.color}` }}>
                            <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: kpi.bg, color: kpi.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <kpi.icon size={20} />
                            </div>
                            <div>
                                <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '2px' }}>{kpi.label}</p>
                                <h4 style={{ fontSize: '24px', fontWeight: '800', lineHeight: 1 }}>{kpi.value}</h4>
                            </div>
                        </div>
                    ))}
                </div>

                {/* ── Filter Bar ───────────────────────────────────── */}
                <div style={{ display: 'flex', gap: '16px', marginBottom: '28px', alignItems: 'center' }}>
                    <div style={{ flex: 1, position: 'relative' }}>
                        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            type="text"
                            placeholder="Search reports..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            style={{ width: '100%', padding: '11px 12px 11px 38px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '14px', backgroundColor: '#f8fafc' }}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                        {CATEGORIES.map(cat => (
                            <button
                                key={cat}
                                onClick={() => handleCategoryChange(cat)}
                                style={{
                                    padding: '9px 16px', borderRadius: '8px', border: '1px solid',
                                    borderColor: activeCategory === cat ? 'var(--primary)' : 'var(--border)',
                                    backgroundColor: activeCategory === cat ? 'var(--primary)' : 'white',
                                    color: activeCategory === cat ? 'white' : 'var(--text-muted)',
                                    fontWeight: '700', fontSize: '13px', cursor: 'pointer', transition: 'all 0.15s'
                                }}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── Report Cards ─────────────────────────────────── */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
                    {filtered.map((rpt) => (
                        <div
                            key={rpt.id}
                            className="card"
                            style={{ padding: '24px', cursor: 'default', transition: 'transform 0.2s, box-shadow 0.2s', position: 'relative', overflow: 'hidden' }}
                            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = 'var(--shadow-lg)'; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
                        >
                            {/* Top accent line */}
                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', backgroundColor: rpt.color }} />

                            <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', marginBottom: '16px' }}>
                                <div style={{ padding: '12px', borderRadius: '12px', backgroundColor: rpt.bg, color: rpt.color, flexShrink: 0 }}>
                                    <rpt.icon size={22} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <h3 style={{ fontSize: '15px', fontWeight: '800', lineHeight: '1.3', marginBottom: '4px' }}>{rpt.title}</h3>
                                        <span style={{
                                            padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '700',
                                            backgroundColor: rpt.bg, color: rpt.color, flexShrink: 0, marginLeft: '8px'
                                        }}>{rpt.category}</span>
                                    </div>
                                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5' }}>{rpt.description}</p>
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0 0', borderTop: '1px solid #F1F5F9' }}>
                                <div>
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>Last: {rpt.lastGenerated}</span>
                                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: '8px' }}>• {rpt.frequency}</span>
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                        onClick={() => setPreviewReport(rpt)}
                                        style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'white', cursor: 'pointer', fontSize: '12px', fontWeight: '700', color: 'var(--text-main)' }}
                                    >
                                        <Eye size={13} /> Preview
                                    </button>
                                    <button
                                        onClick={() => {
                                            // Direct CSV export without opening modal
                                            let csv = '';
                                            if (rpt.category === 'Financial') {
                                                csv = 'Project,Budget (L),Spent (L),Variance (L),Utilisation %\n' +
                                                    budgetData.map(r => `${r.name},${r.budget},${r.spent},${r.budget - r.spent},${r.budget > 0 ? Math.round((r.spent / r.budget) * 100) : 0}%`).join('\n');
                                            } else if (rpt.category === 'Project') {
                                                csv = 'Project,Progress %,Tasks,DPRs Filed\n' +
                                                    progressData.map(r => `${r.project},${r.progress}%,${r.tasks},${r.dpr}`).join('\n');
                                            } else if (rpt.category === 'Inventory') {
                                                csv = 'Material,Stock Share %\n' +
                                                    inventoryData.map(r => `${r.name},${r.value}%`).join('\n');
                                            } else if (rpt.id === 'R010') {
                                                csv = 'Date,Project,Category,Amount (₹),Payee/Paid To,Mode,Description\n' +
                                                    (expenseData || []).map(r => `${r.date},${r.project},${r.category},${r.amount},${r.payee},${r.paymentMode},"${(r.description || '').replace(/"/g, '""')}"`).join('\n');
                                            } else if (rpt.id === 'R005') {
                                                csv = 'Date,Employee ID,Employee Name,Status,Remarks\n' +
                                                    (attendanceData || []).map(r => `${r.date},${r.employeeId},${r.employeeName},${r.status},${r.remarks || ''}`).join('\n');
                                            } else {
                                                csv = `Report,${rpt.title}\nCategory,${rpt.category}\nGenerated,${new Date().toLocaleDateString()}\n`;
                                            }
                                            const blob = new Blob([csv], { type: 'text/csv' });
                                            const url = URL.createObjectURL(blob);
                                            const a = document.createElement('a');
                                            a.href = url;
                                            a.download = `${rpt.title.replace(/ /g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
                                            a.click();
                                            URL.revokeObjectURL(url);
                                        }}
                                        style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', borderRadius: '6px', border: 'none', backgroundColor: rpt.color, cursor: 'pointer', fontSize: '12px', fontWeight: '700', color: 'white' }}
                                    >
                                        <Download size={13} /> Export
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

            </div>

            {/* ── Report Preview Modal ──────────────────────────── */}
            <ReportPreview
                report={previewReport}
                onClose={() => setPreviewReport(null)}
                budgetData={budgetData}
                progressData={progressData}
                inventoryData={inventoryData}
                materialStockReport={materialStockReport}
                expenseData={expenseData}
                attendanceData={attendanceData}
                bills={bills}
                payables={payables}
            />
        </>
    );
};

export default Reports;

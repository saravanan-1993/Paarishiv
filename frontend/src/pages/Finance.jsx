import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    Wallet, DollarSign, Download, Plus, FileText,
    CheckCircle, Clock, RotateCw,
    Calculator, ShieldCheck, Filter, Loader2, RefreshCw, Eye, Trash2, Briefcase, ClipboardCheck,
    Search, Calendar, Building2, User, ChevronDown, AlertCircle, TrendingUp, ArrowDownRight, ArrowUpRight, Edit3, CreditCard, Receipt, Building,
    IndianRupee
} from 'lucide-react';
import ProcessPaymentModal from '../components/ProcessPaymentModal';
import RecordExpenseModal from '../components/RecordExpenseModal';
import PaymentHistoryModal from '../components/PaymentHistoryModal';
import CreateBillModal from '../components/CreateBillModal';
import BillDetailsModal from '../components/BillDetailsModal';
import CustomSelect from '../components/CustomSelect';
import { projectAPI, financeAPI, billingAPI, grnAPI } from '../utils/api';
import { hasSubTabAccess } from '../utils/rbac';
import { useAuth } from '../context/AuthContext';
import PurchaseBillModal from '../components/PurchaseBillModal';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const fmt = (n) => {
    if (!n && n !== 0) return '₹0';
    if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
    if (n >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
    return `₹${Number(n).toLocaleString('en-IN')}`;
};

const Finance = () => {
    const { user } = useAuth();
    const handleMarkBillPaid = async (bill) => {
        if (!window.confirm(`Mark Bill ${bill.bill_no} as fully PAID?`)) return;
        try {
            await billingAPI.markPaid(bill.id, { collection_amount: bill.total_amount - (bill.collection_amount || 0) });
            loadData();
        } catch (err) {
            console.error('Failed to update status:', err);
            alert('Failed to update status. Please try again.');
        }
    };

    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [isBillModalOpen, setIsBillModalOpen] = useState(false);
    const [isBillDetailsOpen, setIsBillDetailsOpen] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [selectedBill, setSelectedBill] = useState(null);
    const [purchaseBills, setPurchaseBills] = useState([]);
    const [isPurchaseBillModalOpen, setIsPurchaseBillModalOpen] = useState(false);
    const [searchParams, setSearchParams] = useSearchParams();
    const urlTab = searchParams.get('tab');

    const [activeTab, setActiveTab] = useState('Overview');
    const [projects, setProjects] = useState([]);
    const [payables, setPayables] = useState([]);
    const [bills, setBills] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [receipts, setReceipts] = useState([]);
    const [grns, setGrns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [billTypeFilter, setBillTypeFilter] = useState('All Types');
    const [billSearch, setBillSearch] = useState('');
    const [ledgerParty, setLedgerParty] = useState('All Parties');

    const [purchaseSearch, setPurchaseSearch] = useState('');
    const [purchaseDateFrom, setPurchaseDateFrom] = useState('');
    const [purchaseDateTo, setPurchaseDateTo] = useState('');

    const availableTabs = useMemo(() => [
        { id: 'Overview', label: 'Overview', icon: FileText },
        { id: 'Sales', label: `Sales / Billing (${bills.length})`, icon: FileText },
        { id: 'PurchaseBills', label: `Purchase Bills (${purchaseBills.length})`, icon: ClipboardCheck },
        { id: 'Purchase', label: `Purchases (${payables.length})`, icon: Wallet },
        { id: 'Payments', label: `Payments (${expenses.length})`, icon: DollarSign },
        { id: 'Ledger', label: `Ledger`, icon: FileText },
    ].filter(tab => hasSubTabAccess(user, 'Accounts', tab.id)), [user, bills.length, purchaseBills.length, payables.length, expenses.length]);

    useEffect(() => {
        if (urlTab && availableTabs.some(t => t.id === urlTab)) {
            setActiveTab(urlTab);
        }
    }, [urlTab, availableTabs]);

    const handleTabChange = (tabId) => {
        setActiveTab(tabId);
        setSearchParams({ tab: tabId });
    };

    const [selectedProject, setSelectedProject] = useState('All Projects');

    const [paymentSearch, setPaymentSearch] = useState('');
    const [paymentDateFrom, setPaymentDateFrom] = useState('');
    const [paymentDateTo, setPaymentDateTo] = useState('');

    const [ledgerType, setLedgerType] = useState('All'); // 'All', 'Client', 'Vendor'
    const [isDownloadDropdownOpen, setIsDownloadDropdownOpen] = useState(false);

    const loadData = async () => {
        setLoading(true);
        try {
            const results = await Promise.allSettled([
                projectAPI.getAll(),
                financeAPI.getPayables(),
                billingAPI.getAll(),
                financeAPI.getExpenses(),
                financeAPI.getReceipts(),
                billingAPI.getPurchaseBills()
            ]);

            setProjects(results[0].status === 'fulfilled' ? (results[0].value.data || []) : []);
            setPayables(results[1].status === 'fulfilled' ? (results[1].value.data || []) : []);
            setBills(results[2].status === 'fulfilled' ? (results[2].value.data || []) : []);
            setExpenses(results[3].status === 'fulfilled' ? (results[3].value.data || []) : []);
            setReceipts(results[4].status === 'fulfilled' ? (results[4].value.data || []) : []);
            setPurchaseBills(results[5].status === 'fulfilled' ? (results[5].value.data || []) : []);

            // Fetch GRNs to show pending billing
            const grnRes = await grnAPI.getAll();
            setGrns(grnRes.data || []);

            results.forEach((res, i) => {
                if (res.status === 'rejected') console.warn(`Finance fetch failed for promise index ${i}:`, res.reason);
            });
        } catch (err) {
            console.error('Finance fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleProcessPayment = (invoice) => {
        setSelectedInvoice(invoice);
        setIsPaymentModalOpen(true);
    };

    const handleViewHistory = (invoice) => {
        setSelectedInvoice({
            id: invoice.id,
            voucher_no: invoice.voucher_no,
            vendor: invoice.vendor
        });
        setIsHistoryModalOpen(true);
    };

    const handleExpenseRecorded = async (expenseData) => {
        try {
            await financeAPI.createExpense(expenseData);
            loadData(); // Refresh data
        } catch (err) {
            console.error('Error recording expense:', err);
            alert('Failed to record expense. Please try again.');
        }
    };

    const filteredPayables = (selectedProject === 'All Projects'
        ? payables
        : payables.filter(p => p.project === selectedProject)
    ).filter(p => {
        if (!p.vendor || p.vendor.toLowerCase() === 'internal') return false;

        const searchRegex = new RegExp(purchaseSearch, 'i');
        const matchesSearch = !purchaseSearch ||
            searchRegex.test(p.voucher_no) ||
            searchRegex.test(p.vendor) ||
            searchRegex.test(p.project);

        let pDateStr = p.date || p.created_at;
        let pDate = pDateStr ? new Date(pDateStr) : new Date('2000-01-01');

        const matchesFrom = !purchaseDateFrom || pDate >= new Date(purchaseDateFrom);
        const matchesTo = !purchaseDateTo || pDate <= new Date(purchaseDateTo + 'T23:59:59');

        return matchesSearch && matchesFrom && matchesTo;
    });

    const filteredPurchaseBills = purchaseBills.filter(pb => {
        const matchesProject = selectedProject === 'All Projects' || pb.project_name === selectedProject;
        const searchRegex = new RegExp(purchaseSearch, 'i');
        const matchesSearch = !purchaseSearch ||
            searchRegex.test(pb.bill_no) ||
            searchRegex.test(pb.vendor_name) ||
            searchRegex.test(pb.project_name);

        let pbDateStr = pb.bill_date || pb.created_at;
        let pbDate = pbDateStr ? new Date(pbDateStr) : new Date('2000-01-01');

        const matchesFrom = !purchaseDateFrom || pbDate >= new Date(purchaseDateFrom);
        const matchesTo = !purchaseDateTo || pbDate <= new Date(purchaseDateTo + 'T23:59:59');

        return matchesProject && matchesSearch && matchesFrom && matchesTo;
    });

    const filteredBills = bills.filter(b => {
        const matchesProject = selectedProject === 'All Projects' || b.project === selectedProject;
        const matchesType = billTypeFilter === 'All Types' || b.bill_type === billTypeFilter;
        const matchesSearch = b.bill_no?.toLowerCase().includes(billSearch.toLowerCase()) ||
            b.project?.toLowerCase().includes(billSearch.toLowerCase()) ||
            b.description?.toLowerCase().includes(billSearch.toLowerCase());
        return matchesProject && matchesType && matchesSearch;
    });

    const filteredExpenses = (selectedProject === 'All Projects'
        ? expenses
        : expenses.filter(e => e.project === selectedProject)
    ).filter(e => {
        const searchRegex = new RegExp(paymentSearch, 'i');
        const matchesSearch = !paymentSearch ||
            searchRegex.test(e.project) ||
            searchRegex.test(e.category) ||
            searchRegex.test(e.description);

        let eDateStr = e.date || e.created_at;
        let eDate = eDateStr ? new Date(eDateStr) : new Date('2000-01-01');

        const matchesFrom = !paymentDateFrom || eDate >= new Date(paymentDateFrom);
        const matchesTo = !paymentDateTo || eDate <= new Date(paymentDateTo + 'T23:59:59');

        return matchesSearch && matchesFrom && matchesTo;
    });

    const filteredReceipts = selectedProject === 'All Projects'
        ? receipts
        : receipts.filter(r => r.project === selectedProject);

    const billTypes = ['All Types', ...new Set(bills.map(b => b.bill_type).filter(Boolean))];

    const handleDownloadCSV = () => {
        const entries = getLedgerEntries();
        if (entries.length === 0) {
            alert('No data to download');
            return;
        }

        const headers = ['Date', 'Particulars', 'Party', 'Debit (Dr)', 'Credit (Cr)', 'Balance'];
        const csvContent = [
            headers.join(','),
            ...entries.map(e => [
                new Date(e.date).toLocaleDateString('en-IN'),
                `"${e.particulars.replace(/"/g, '""')}"`,
                `"${e.party.replace(/"/g, '""')}"`,
                e.debit || 0,
                e.credit || 0,
                `${e.balance} ${e.balance >= 0 ? 'Dr' : 'Cr'}`
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `Ledger_${ledgerParty}_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setIsDownloadDropdownOpen(false);
    };

    const handleDownloadPDF = () => {
        try {
            const entries = getLedgerEntries();
            if (entries.length === 0) {
                alert('No data to download');
                return;
            }

            // Fallback for Rupee symbol in PDF (to avoid crashes)
            const pdfFmt = (v) => {
                if (!v && v !== 0) return 'Rs. 0';
                if (v >= 10000000) return `Rs. ${(v / 10000000).toFixed(2)} Cr`;
                if (v >= 100000) return `Rs. ${(v / 100000).toFixed(2)} L`;
                return `Rs. ${Number(v).toLocaleString('en-IN')}`;
            };

            const doc = new jsPDF();
            const partyName = ledgerParty === 'All Parties' ? 'ALL PARTIES STATEMENT' : `PARTY LEDGER: ${ledgerParty.toUpperCase()}`;
            const reportDate = `Generated on: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}`;

            // Header Style
            doc.setFillColor(59, 130, 246);
            doc.rect(0, 0, 210, 40, 'F');

            doc.setFontSize(22);
            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.text("CIVIL ERP", 14, 20);

            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text("Professional Construction Site Management Statement", 14, 28);

            doc.text(reportDate, 150, 20);

            // Body Content
            doc.setTextColor(31, 41, 55);
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            // Body Content
            doc.setTextColor(31, 41, 55);
            doc.setFontSize(13);
            doc.setFont('helvetica', 'bold');
            doc.text(partyName, 14, 52);

            // Summary Cards
            const totalDebit = entries.reduce((s, e) => s + (e.debit || 0), 0);
            const totalCredit = entries.reduce((s, e) => s + (e.credit || 0), 0);
            const balance = totalDebit - totalCredit;

            doc.setFillColor(248, 250, 252);
            doc.setDrawColor(226, 232, 240);
            doc.rect(14, 58, 182, 20, 'FD');

            doc.setFontSize(9);
            doc.setTextColor(107, 114, 128);
            doc.text("TOTAL DEBIT (Dr)", 25, 65);
            doc.text("TOTAL CREDIT (Cr)", 85, 65);
            doc.text("NET BALANCE", 145, 65);

            doc.setFontSize(11);
            doc.setTextColor(239, 68, 68);
            doc.text(pdfFmt(totalDebit), 25, 73);
            doc.setTextColor(16, 185, 129);
            doc.text(pdfFmt(totalCredit), 85, 73);
            doc.setTextColor(59, 130, 246);
            doc.text(`${pdfFmt(Math.abs(balance))} ${balance >= 0 ? 'Dr' : 'Cr'}`, 145, 73);

            const tableData = entries.map(e => [
                new Date(e.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
                e.particulars,
                e.party,
                e.debit ? e.debit.toLocaleString('en-IN') : '-',
                e.credit ? e.credit.toLocaleString('en-IN') : '-',
                `${Math.abs(e.balance).toLocaleString('en-IN')} ${e.balance >= 0 ? 'Dr' : 'Cr'}`
            ]);

            autoTable(doc, {
                startY: 85,
                head: [['Date', 'Particulars', 'Party', 'Debit (Dr)', 'Credit (Cr)', 'Balance']],
                body: tableData,
                headStyles: {
                    fillColor: [59, 130, 246],
                    textColor: [255, 255, 255],
                    fontSize: 10,
                    fontStyle: 'bold',
                    halign: 'center'
                },
                bodyStyles: { fontSize: 9, cellPadding: 4 },
                columnStyles: {
                    0: { cellWidth: 25 },
                    1: { cellWidth: 'auto' },
                    3: { halign: 'right', textColor: [220, 38, 38] },
                    4: { halign: 'right', textColor: [5, 150, 105] },
                    5: { halign: 'right', fontStyle: 'bold' }
                },
                alternateRowStyles: { fillColor: [249, 250, 251] },
                margin: { top: 20 }
            });

            // Footer
            const finalY = (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY + 15 : 250;
            doc.setFontSize(9);
            doc.setTextColor(156, 163, 175);
            doc.text("This is an electronically generated statement and does not require a physical signature.", 14, Math.min(finalY, 285));

            doc.save(`Statement_${ledgerParty}_${new Date().toISOString().split('T')[0]}.pdf`);
            setIsDownloadDropdownOpen(false);
        } catch (err) {
            console.error('PDF Generation failed:', err);
            alert(`PDF error: ${err.message}. Please use CSV download.`);
        }
    };

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const collectionThisMonth = filteredBills.reduce((s, b) => {
        const billDate = new Date(b.date);
        if (billDate.getMonth() === currentMonth && billDate.getFullYear() === currentYear) {
            return s + (b.collection_amount || 0);
        }
        return s;
    }, 0);

    const paymentsThisMonth = filteredExpenses.reduce((s, e) => {
        const expDate = new Date(e.date);
        if (expDate.getMonth() === currentMonth && expDate.getFullYear() === currentYear) {
            return s + (e.amount || 0);
        }
        return s;
    }, 0);

    const currentDate = now.getDate();
    const paymentsToday = filteredExpenses.reduce((s, e) => {
        const expDate = new Date(e.date);
        if (expDate.getDate() === currentDate && expDate.getMonth() === currentMonth && expDate.getFullYear() === currentYear) {
            return s + (e.amount || 0);
        }
        return s;
    }, 0);

    const collectionToday = filteredBills.reduce((s, b) => {
        const billDate = new Date(b.date);
        if (billDate.getDate() === currentDate && billDate.getMonth() === currentMonth && billDate.getFullYear() === currentYear) {
            return s + (b.collection_amount || 0);
        }
        return s;
    }, 0);

    const totalBilled = filteredBills.reduce((s, b) => s + (b.total_amount || 0), 0);
    const totalCollected = filteredBills.reduce((s, b) => s + (b.collection_amount || 0), 0);
    const totalPayableAmt = filteredPayables.reduce((s, p) => s + (p.amount || 0), 0);
    const totalPurchases = filteredPayables.reduce((s, p) => s + (p.total_amount || 0), 0);

    // Calculate 5% retention on total billed if not specifically tracked
    const totalRetention = filteredBills.reduce((s, b) => s + (b.retention_amount || (b.total_amount * 0.05)), 0);

    const kpiCards = [
        { label: 'TOTAL SALES', value: fmt(totalBilled), icon: FileText, color: '#3B82F6', bgColor: '#EFF6FF' },
        { label: 'OUTSTANDING', value: fmt(totalBilled - totalCollected), icon: AlertCircle, color: '#EF4444', bgColor: '#FEF2F2' },
        { label: 'COLLECTION (MTD)', value: fmt(collectionThisMonth), icon: Calendar, color: '#0EA5E9', bgColor: '#F0F9FF' },
        { label: 'COLLECTION (TODAY)', value: fmt(collectionToday), icon: TrendingUp, color: '#10B981', bgColor: '#F0FDF4' },
        { label: 'PAYMENTS (MTD)', value: fmt(paymentsThisMonth), icon: ArrowDownRight, color: '#F43F5E', bgColor: '#FFF1F2' },
        { label: 'PAYMENTS (TODAY)', value: fmt(paymentsToday), icon: Clock, color: '#F59E0B', bgColor: '#FEF3C7' },
        { label: 'RETENTION MONEY', value: fmt(totalRetention), icon: ShieldCheck, color: '#8B5CF6', bgColor: '#F5F3FF' },
        { label: 'TOTAL RECEIVED', value: fmt(totalCollected), icon: IndianRupee, color: '#065F46', bgColor: '#D1FAE5' },
    ];

    const projectDropdown = ['All Projects', ...projects.map(p => p.name).filter(Boolean)];

    // Derived Ledger Data
    const baseBillsForLedger = selectedProject === 'All Projects' ? bills : bills.filter(b => b.project === selectedProject);
    const basePayablesForLedger = selectedProject === 'All Projects' ? payables : payables.filter(p => p.project === selectedProject);

    const clientParties = [...new Set([
        ...baseBillsForLedger.map(b => b.project),
        ...projects.map(p => p.name)
    ].filter(Boolean))];
    const vendorParties = [...new Set([
        ...basePayablesForLedger.filter(p => p.vendor && p.vendor.toLowerCase() !== 'internal').map(p => p.vendor),
        ...purchaseBills.map(pb => pb.vendor_name),
        ...expenses.filter(e => e.payee).map(e => e.payee)
    ].filter(Boolean))];

    let ledgerParties = ['All Parties'];
    if (ledgerType === 'Client') {
        ledgerParties = ['All Parties', ...clientParties];
    } else if (ledgerType === 'Vendor') {
        ledgerParties = ['All Parties', ...vendorParties];
    } else {
        ledgerParties = ['All Parties', ...clientParties, ...vendorParties];
    }
    // Remove duplicates
    ledgerParties = [...new Set(ledgerParties)];

    const getLedgerEntries = () => {
        let entries = [];
        const matchesProject = (pName) => selectedProject === 'All Projects' || pName === selectedProject;

        // Sales entries (Debit)
        baseBillsForLedger.forEach(b => {
            if (ledgerParty !== 'All Parties' && b.project !== ledgerParty) return;
            entries.push({
                date: b.date || b.created_at || new Date().toISOString(),
                particulars: `Sales Invoice - ${b.bill_no}`,
                debit: b.total_amount || 0,
                credit: 0,
                party: b.project,
                project: b.project
            });
            if (b.collection_amount > 0) {
                entries.push({
                    date: b.date || b.created_at || new Date().toISOString(),
                    particulars: `Payment Received - ${b.bill_no}`,
                    debit: 0,
                    credit: b.collection_amount,
                    party: b.project,
                    project: b.project
                });
            }
        });

        // Purchase entries from Payables (Credit)
        basePayablesForLedger.filter(p => p.vendor && p.vendor.toLowerCase() !== 'internal').forEach(p => {
            if (ledgerParty !== 'All Parties' && p.vendor !== ledgerParty) return;
            entries.push({
                date: p.date || p.created_at || new Date().toISOString(),
                particulars: `Purchase - ${p.voucher_no}`,
                debit: 0,
                credit: p.total_amount || 0,
                party: p.vendor,
                project: p.project
            });
        });

        // Purchase entries from Purchase Bills (Credit)
        const basePurchaseBillsForLedger = selectedProject === 'All Projects' ? purchaseBills : purchaseBills.filter(pb => pb.project_name === selectedProject);
        basePurchaseBillsForLedger.forEach(pb => {
            if (ledgerParty !== 'All Parties' && pb.vendor_name !== ledgerParty) return;
            entries.push({
                date: pb.bill_date || pb.created_at || new Date().toISOString(),
                particulars: `Purchase Bill - ${pb.bill_no}`,
                debit: 0,
                credit: pb.total_amount || parseFloat(pb.amount) || 0,
                party: pb.vendor_name,
                project: pb.project_name
            });
        });

        // Combined Payments & General Expenses
        expenses.forEach(e => {
            if (!matchesProject(e.project)) return;

            let entryParty = 'General Expense';
            let voucher = null;
            if (e.grn_id) {
                voucher = payables.find(p => p.id === e.grn_id);
                entryParty = e.payee || voucher?.vendor || 'Vendor';
            } else {
                entryParty = e.payee || 'General Expense';
            }

            // Logic for party filtering: strictly matches the payee/vendor
            const isRelevantParty = ledgerParty === 'All Parties' || entryParty === ledgerParty;

            if (!isRelevantParty) return;

            if (e.grn_id) {
                entries.push({
                    date: e.date || e.created_at || new Date().toISOString(),
                    particulars: `Payment Made - ${voucher?.voucher_no || 'Purchase'}`,
                    debit: e.amount || 0,
                    credit: 0,
                    party: entryParty,
                    project: e.project
                });
            } else {
                // General expense (Labor, Fuel, etc.)
                entries.push({
                    date: e.date || e.created_at || new Date().toISOString(),
                    particulars: `Expense: ${e.category} - ${e.description || 'Direct Payment'}`,
                    debit: e.amount || 0,
                    credit: 0,
                    party: entryParty,
                    project: e.project
                });
            }
        });

        entries.sort((a, b) => new Date(a.date) - new Date(b.date));

        let runningBalance = 0;
        return entries.map(e => {
            runningBalance += (e.debit - e.credit);
            return { ...e, balance: runningBalance };
        });
    };


    return (
        <div className="finance-container" style={{ position: 'relative' }}>
            <div className="animate-fade-in">
                {/* ── Header ───────────────────────────────────────────────────── */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <div>
                        <h2 style={{ fontSize: '28px', fontWeight: '800', marginBottom: '4px' }}>Accounts</h2>
                        <p style={{ color: 'var(--text-muted)', fontSize: '15px' }}>
                            Manage Sales Invoices, Vendor Purchases, Receipts and Payments.
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button className="btn btn-outline" onClick={() => setIsExpenseModalOpen(true)}>
                            <Plus size={18} /> New Payment
                        </button>
                        <button className="btn btn-outline" onClick={() => setIsPurchaseBillModalOpen(true)}>
                            <Plus size={18} /> Record Purchase Bill
                        </button>
                        <button className="btn btn-primary" onClick={() => setIsBillModalOpen(true)}>
                            <Plus size={18} /> New Sales Bill
                        </button>
                    </div>
                </div>

                {/* ── KPI Cards ─────────────────────────────────────────────────── */}
                <div className="kpi-grid" style={{ marginBottom: '32px' }}>
                    {kpiCards.map((kpi, i) => (
                        <div key={i} className="card kpi-card" style={{ borderTop: `4px solid ${kpi.color}` }}>
                            <div className="kpi-icon" style={{ backgroundColor: kpi.bgColor, color: kpi.color }}>
                                <kpi.icon size={20} />
                            </div>
                            <div className="kpi-info">
                                <h4 style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '800' }}>{kpi.label}</h4>
                                <div className="value" style={{ fontSize: '18px' }}>
                                    {loading ? '—' : kpi.value}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* ── Filter & Tabs ─────────────────────────────────────────── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
                    <div style={{ width: '100%', maxWidth: '400px' }}>
                        <CustomSelect
                            options={[
                                { value: 'All Projects', label: 'All Projects' },
                                ...projects.map(p => ({ value: p.name, label: p.name }))
                            ]}
                            value={selectedProject}
                            onChange={setSelectedProject}
                            icon={Briefcase} // Changed from Building2 to Briefcase to match original icon
                            placeholder="Filter by Project"
                            width="full"
                        />
                    </div>

                    <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', paddingBottom: '4px' }}>
                        {availableTabs.map(tab => {
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => handleTabChange(tab.id)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px',
                                        borderRadius: '8px',
                                        border: isActive ? '1px solid var(--border)' : '1px solid transparent',
                                        background: isActive ? 'white' : 'transparent',
                                        color: isActive ? 'var(--text-main)' : 'var(--text-muted)',
                                        fontWeight: isActive ? '700' : '600', fontSize: '14px', cursor: 'pointer',
                                        boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    <tab.icon size={18} /> {tab.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* ── Loading ───────────────────────────────────────────────────── */}
                {loading && (
                    <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
                        <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
                        <p style={{ fontWeight: '600' }}>Loading financial data…</p>
                        <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
                    </div>
                )}

                {/* ── Overview Tab ──────────────────────────────────────────────── */}
                {!loading && activeTab === 'Overview' && (
                    <div className="card animate-fade-in" style={{ padding: '32px' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '24px' }}>Overview</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                            {kpiCards.map((kpi, i) => (
                                <div key={i} style={{ padding: '20px', borderRadius: '12px', backgroundColor: kpi.bgColor, border: `1px solid ${kpi.color}33` }}>
                                    <div style={{ color: kpi.color, marginBottom: '8px' }}>
                                        <kpi.icon size={24} />
                                    </div>
                                    <h4 style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '700', marginBottom: '4px' }}>{kpi.label}</h4>
                                    <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-main)' }}>{kpi.value}</div>
                                </div>
                            ))}
                        </div>

                        {/* Pending GRN Action Alert */}
                        {grns.filter(g => g.status !== 'Billed').length > 0 && (
                            <div style={{
                                marginTop: '32px', padding: '24px', backgroundColor: '#FFFBEB',
                                borderRadius: '16px', border: '1px solid #FEF3C7',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                            }}>
                                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                                    <div style={{ padding: '12px', backgroundColor: '#FEF3C7', borderRadius: '12px', color: '#D97706' }}>
                                        <ClipboardCheck size={28} />
                                    </div>
                                    <div>
                                        <h4 style={{ fontSize: '18px', fontWeight: '800', color: '#92400E', marginBottom: '4px' }}>
                                            {grns.filter(g => g.status !== 'Billed').length} GRNs Pending for Invoicing
                                        </h4>
                                        <p style={{ fontSize: '14px', color: '#B45309' }}>
                                            Materials have been received at site. Please record vendor bills to update ledgers.
                                        </p>
                                    </div>
                                </div>
                                <button className="btn btn-primary" onClick={() => setIsPurchaseBillModalOpen(true)} style={{ backgroundColor: '#D97706', border: 'none' }}>
                                    RECORD BILLS NOW
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* ── Sales Tab ───────────────────────────────────────────────── */}
                {!loading && activeTab === 'Sales' && (
                    <div className="card animate-fade-in">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h3 style={{ fontSize: '18px', fontWeight: '800' }}>Sales Invoices (Client RA Bills)</h3>
                        </div>

                        {/* Filter Bar */}
                        <div style={{
                            display: 'flex', gap: '12px', marginBottom: '20px',
                            padding: '16px', backgroundColor: '#F8FAFC', borderRadius: '12px',
                            border: '1px solid var(--border)', flexWrap: 'wrap'
                        }}>
                            <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
                                <Filter size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input
                                    type="text"
                                    placeholder="Search bills, projects or description..."
                                    value={billSearch}
                                    onChange={(e) => setBillSearch(e.target.value)}
                                    style={{
                                        width: '100%', padding: '10px 12px 10px 36px', borderRadius: '8px',
                                        border: '1.5px solid #E2E8F0', fontSize: '14px', background: 'white'
                                    }}
                                />
                            </div>
                            <div style={{ width: '200px' }}>
                                <CustomSelect
                                    options={billTypes.map(t => ({ value: t, label: t }))}
                                    value={billTypeFilter}
                                    onChange={setBillTypeFilter}
                                    placeholder="Filter by Type"
                                    width="full"
                                    searchable={false}
                                />
                            </div>
                        </div>

                        {filteredBills.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '80px 40px', color: 'var(--text-muted)' }}>
                                <FileText size={56} style={{ margin: '0 auto 16px', opacity: 0.2 }} />
                                <h4 style={{ fontWeight: '700', marginBottom: '8px' }}>No Bills Raised Yet</h4>
                                <p style={{ marginBottom: '24px' }}>Raise a client RA bill to start tracking receivables.</p>
                                <button className="btn btn-primary" onClick={() => setIsBillModalOpen(true)}>
                                    <Plus size={16} /> Raise First Bill
                                </button>
                            </div>
                        ) : (
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Bill No</th>
                                        <th>Date</th>
                                        <th>Due Date</th>
                                        <th>Project</th>
                                        <th>Type</th>
                                        <th style={{ textAlign: 'right' }}>Taxable Amt</th>
                                        <th style={{ textAlign: 'right' }}>GST</th>
                                        <th style={{ textAlign: 'right' }}>Gross Total</th>
                                        <th style={{ textAlign: 'right' }}>Collected</th>
                                        <th style={{ textAlign: 'right' }}>Balance</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredBills.map((bill, i) => {
                                        const totalAmt = bill.total_amount || 0;
                                        const collected = bill.collection_amount || 0;
                                        const balance = totalAmt - collected;

                                        let paymentStatus = 'Pending';
                                        if (collected >= totalAmt && totalAmt > 0) paymentStatus = 'Paid';
                                        else if (collected > 0) paymentStatus = 'Partial';

                                        // Overdue logic if Due Date exists and is past
                                        if (bill.due_date && new Date(bill.due_date) < new Date() && paymentStatus !== 'Paid') {
                                            paymentStatus = 'Overdue';
                                        }

                                        return (
                                            <tr key={bill.id || i}>
                                                <td style={{ fontWeight: '800', color: 'var(--primary)' }}>{bill.bill_no}</td>
                                                <td style={{ fontSize: '13px' }}>
                                                    {bill.date ? new Date(bill.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                                </td>
                                                <td style={{ fontSize: '13px' }}>
                                                    {bill.due_date ? new Date(bill.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                                </td>
                                                <td style={{ fontWeight: '600' }}>{bill.project}</td>
                                                <td style={{ fontSize: '13px' }}>
                                                    <span style={{ background: '#F3F4F6', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700' }}>{bill.bill_type}</span>
                                                </td>
                                                <td style={{ textAlign: 'right', fontWeight: '600' }}>{fmt(bill.amount || 0)}</td>
                                                <td style={{ textAlign: 'right', color: '#059669', fontWeight: '600' }}>{fmt(bill.gst_amount || 0)}</td>
                                                <td style={{ textAlign: 'right', fontWeight: '800' }}>{fmt(totalAmt)}</td>
                                                <td style={{ textAlign: 'right', color: '#059669', fontWeight: '700' }}>{fmt(collected)}</td>
                                                <td style={{ textAlign: 'right', color: '#EF4444', fontWeight: '700' }}>{fmt(balance)}</td>
                                                <td>
                                                    <span className={`badge ${paymentStatus === 'Paid' ? 'badge-success' :
                                                        paymentStatus === 'Partial' ? 'badge-info' :
                                                            paymentStatus === 'Pending' ? 'badge-warning' : 'badge-danger'
                                                        }`}>{paymentStatus}</span>
                                                </td>
                                                <td style={{ width: '150px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <button
                                                            className="btn btn-outline btn-sm"
                                                            onClick={() => {
                                                                setSelectedBill(bill);
                                                                setIsBillDetailsOpen(true);
                                                            }}
                                                            style={{ border: 'none', padding: '6px', background: 'transparent' }}
                                                        >
                                                            <Eye size={18} color="#3B82F6" />
                                                        </button>
                                                        {bill.status !== 'Paid' && (
                                                            <button
                                                                className="btn btn-primary"
                                                                style={{ fontSize: '10px', padding: '4px 8px', borderRadius: '4px' }}
                                                                onClick={() => handleMarkBillPaid(bill)}
                                                            >
                                                                Paid
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => {
                                                                if (window.confirm('Delete this bill?')) {
                                                                    billingAPI.delete(bill.id).then(() => loadData());
                                                                }
                                                            }}
                                                            style={{ border: 'none', padding: '6px', background: 'transparent' }}
                                                        >
                                                            <Trash2 size={18} color="#EF4444" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}

                {/* ── Purchase Bills Tab ──────────────────────────────────────────────── */}
                {!loading && activeTab === 'PurchaseBills' && (
                    <div className="card animate-fade-in">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h3 style={{ fontSize: '18px', fontWeight: '800' }}>Purchase Bills (Vendor Invoices)</h3>
                            <button className="btn btn-outline btn-sm" onClick={() => setIsPurchaseBillModalOpen(true)}>
                                <Plus size={16} /> Record Purchase Bill
                            </button>
                        </div>

                        {/* Filter Bar */}
                        <div style={{
                            display: 'flex', gap: '12px', marginBottom: '20px',
                            padding: '16px', backgroundColor: '#F8FAFC', borderRadius: '12px',
                            border: '1px solid var(--border)', flexWrap: 'wrap'
                        }}>
                            <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
                                <Filter size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input
                                    type="text"
                                    placeholder="Search bill no, vendor or project..."
                                    value={purchaseSearch}
                                    onChange={(e) => setPurchaseSearch(e.target.value)}
                                    style={{
                                        width: '100%', padding: '10px 12px 10px 36px', borderRadius: '8px',
                                        border: '1.5px solid #E2E8F0', fontSize: '14px', background: 'white'
                                    }}
                                />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)' }}>From</label>
                                <input
                                    type="date"
                                    value={purchaseDateFrom}
                                    onChange={(e) => setPurchaseDateFrom(e.target.value)}
                                    style={{ padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #E2E8F0', fontSize: '13px', background: 'white' }}
                                />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)' }}>To</label>
                                <input
                                    type="date"
                                    value={purchaseDateTo}
                                    onChange={(e) => setPurchaseDateTo(e.target.value)}
                                    style={{ padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #E2E8F0', fontSize: '13px', background: 'white' }}
                                />
                            </div>
                        </div>

                        {filteredPurchaseBills.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '80px 40px', color: 'var(--text-muted)' }}>
                                <ClipboardCheck size={56} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
                                <h4 style={{ fontWeight: '700', marginBottom: '8px' }}>No Purchase Bills</h4>
                                <p>Record a purchase bill or adjust filters to see data.</p>
                                <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={() => setIsPurchaseBillModalOpen(true)}>
                                    <Plus size={16} /> Record Purchase Bill
                                </button>
                            </div>
                        ) : (
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Bill No</th>
                                        <th>Date</th>
                                        <th>Vendor</th>
                                        <th>Project</th>
                                        <th style={{ textAlign: 'right' }}>Tax Amt</th>
                                        <th style={{ textAlign: 'right' }}>Total (Inc. Tax)</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredPurchaseBills.map((pb, i) => (
                                        <tr key={pb.id || i}>
                                            <td style={{ fontWeight: '800', color: 'var(--primary)' }}>{pb.bill_no}</td>
                                            <td style={{ fontSize: '13px' }}>
                                                {pb.bill_date ? new Date(pb.bill_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                            </td>
                                            <td style={{ fontWeight: '600' }}>{pb.vendor_name}</td>
                                            <td>{pb.project_name}</td>
                                            <td style={{ textAlign: 'right', color: '#059669', fontWeight: '600' }}>{fmt(pb.tax_amount || 0)}</td>
                                            <td style={{ textAlign: 'right', fontWeight: '800' }}>{fmt(pb.total_amount || 0)}</td>
                                            <td>
                                                <span className={`badge ${pb.status === 'Paid' ? 'badge-success' : pb.status === 'Partially Paid' ? 'badge-info' : 'badge-warning'}`}>
                                                    {pb.status || 'Pending'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}

                {/* ── Purchases Tab ───────────────────────────────────────────────── */}
                {!loading && activeTab === 'Purchase' && (
                    <div className="card animate-fade-in">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h3 style={{ fontSize: '18px', fontWeight: '800' }}>Vendor Purchases (Based on GRN)</h3>
                        </div>

                        {/* Filter Bar */}
                        <div style={{
                            display: 'flex', gap: '12px', marginBottom: '20px',
                            padding: '16px', backgroundColor: '#F8FAFC', borderRadius: '12px',
                            border: '1px solid var(--border)', flexWrap: 'wrap'
                        }}>
                            <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
                                <Filter size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input
                                    type="text"
                                    placeholder="Search vendor or project..."
                                    value={purchaseSearch}
                                    onChange={(e) => setPurchaseSearch(e.target.value)}
                                    style={{
                                        width: '100%', padding: '10px 12px 10px 36px', borderRadius: '8px',
                                        border: '1.5px solid #E2E8F0', fontSize: '14px', background: 'white'
                                    }}
                                />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)' }}>From</label>
                                <input
                                    type="date"
                                    value={purchaseDateFrom}
                                    onChange={(e) => setPurchaseDateFrom(e.target.value)}
                                    style={{ padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #E2E8F0', fontSize: '13px', background: 'white' }}
                                />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)' }}>To</label>
                                <input
                                    type="date"
                                    value={purchaseDateTo}
                                    onChange={(e) => setPurchaseDateTo(e.target.value)}
                                    style={{ padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #E2E8F0', fontSize: '13px', background: 'white' }}
                                />
                            </div>
                        </div>

                        {filteredPayables.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '80px 40px', color: 'var(--text-muted)' }}>
                                <Wallet size={56} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
                                <h4 style={{ fontWeight: '700', marginBottom: '8px' }}>No Pending Payables</h4>
                                <p>Vendor payables will appear here once GRNs are processed in Procurement, or adjust filters to find existing records.</p>
                            </div>
                        ) : (
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Voucher No</th>
                                        <th>Vendor</th>
                                        <th>Project</th>
                                        <th style={{ textAlign: 'right' }}>Total Amt</th>
                                        <th style={{ textAlign: 'right' }}>Paid</th>
                                        <th style={{ textAlign: 'right' }}>Balance</th>
                                        <th>Status</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredPayables.map((item) => {
                                        const totAmt = item.total_amount || 0;
                                        const pdAmt = item.paid_amount || 0;

                                        let pStatus = 'Pending';
                                        if (pdAmt >= totAmt && totAmt > 0) pStatus = 'Paid';
                                        else if (pdAmt > 0) pStatus = 'Partial';

                                        return (
                                            <tr key={item.id}>
                                                <td style={{ fontWeight: '700' }}>
                                                    <div>{item.voucher_no}</div>
                                                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 'normal' }}>
                                                        {item.items?.map(i => `${i.name}`).slice(0, 2).join(', ')}...
                                                    </div>
                                                </td>
                                                <td>{item.vendor}</td>
                                                <td>{item.project}</td>
                                                <td style={{ textAlign: 'right', fontWeight: '600' }}>{fmt(totAmt)}</td>
                                                <td style={{ textAlign: 'right', color: '#10B981', fontWeight: '600' }}>{fmt(pdAmt)}</td>
                                                <td style={{ textAlign: 'right', color: '#EF4444', fontWeight: '800' }}>{fmt(totAmt - pdAmt)}</td>
                                                <td>
                                                    <span className={`badge ${pStatus === 'Paid' ? 'badge-success' :
                                                        pStatus === 'Partial' ? 'badge-info' : 'badge-warning'}`}>
                                                        {pStatus}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: '8px' }}>
                                                        <button className="btn btn-outline btn-sm" onClick={() => handleViewHistory(item)} style={{ border: 'none' }}>
                                                            <Eye size={18} color="var(--primary)" />
                                                        </button>
                                                        {pStatus !== 'Paid' && (
                                                            <button className="btn btn-primary btn-sm" onClick={() => handleProcessPayment(item)} style={{ fontSize: '11px' }}>
                                                                Pay
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}


                {/* ── Payments Tab ───────────────────────────────────────────────── */}
                {!loading && activeTab === 'Payments' && (
                    <div className="card animate-fade-in">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h3 style={{ fontSize: '18px', fontWeight: '800' }}>Payments Made (Vendor & Expenses)</h3>
                        </div>

                        {/* Filter Bar */}
                        <div style={{
                            display: 'flex', gap: '12px', marginBottom: '20px',
                            padding: '16px', backgroundColor: '#F8FAFC', borderRadius: '12px',
                            border: '1px solid var(--border)', flexWrap: 'wrap'
                        }}>
                            <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
                                <Filter size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input
                                    type="text"
                                    placeholder="Search project, description, or category..."
                                    value={paymentSearch}
                                    onChange={(e) => setPaymentSearch(e.target.value)}
                                    style={{
                                        width: '100%', padding: '10px 12px 10px 36px', borderRadius: '8px',
                                        border: '1.5px solid #E2E8F0', fontSize: '14px', background: 'white'
                                    }}
                                />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)' }}>From</label>
                                <input
                                    type="date"
                                    value={paymentDateFrom}
                                    onChange={(e) => setPaymentDateFrom(e.target.value)}
                                    style={{ padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #E2E8F0', fontSize: '13px', background: 'white' }}
                                />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)' }}>To</label>
                                <input
                                    type="date"
                                    value={paymentDateTo}
                                    onChange={(e) => setPaymentDateTo(e.target.value)}
                                    style={{ padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #E2E8F0', fontSize: '13px', background: 'white' }}
                                />
                            </div>
                        </div>

                        {filteredExpenses.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '80px 40px', color: 'var(--text-muted)' }}>
                                <DollarSign size={56} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
                                <h4 style={{ fontWeight: '700', marginBottom: '8px' }}>No Payments found</h4>
                                <p>Record vendor payments/expenses or adjust filters to view records.</p>
                                <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={() => setIsExpenseModalOpen(true)}>
                                    <Plus size={16} /> Record Payment
                                </button>
                            </div>
                        ) : (
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Project</th>
                                        <th>Category</th>
                                        <th>Description</th>
                                        <th>Paid To</th>
                                        <th style={{ textAlign: 'right' }}>Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredExpenses.map((exp, i) => (
                                        <tr key={exp.id || i}>
                                            <td style={{ fontSize: '13px' }}>
                                                {exp.date ? new Date(exp.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                            </td>
                                            <td style={{ fontWeight: '600' }}>{exp.project}</td>
                                            <td>
                                                <span style={{ background: '#F3F4F6', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700' }}>
                                                    {exp.category}
                                                </span>
                                            </td>
                                            <td style={{ fontSize: '13px', maxWidth: '300px' }}>{exp.description}</td>
                                            <td style={{ fontWeight: '600', color: 'var(--primary)' }}>{exp.payee || '—'}</td>
                                            <td style={{ textAlign: 'right', fontWeight: '800', color: '#EF4444' }}>
                                                {fmt(exp.amount || 0)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}

                {/* ── Ledger Tab ─────────────────────────────────────────────────── */}
                {!loading && activeTab === 'Ledger' && (
                    <div className="card animate-fade-in">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <h3 style={{ fontSize: '18px', fontWeight: '800' }}>Party Ledger</h3>
                                <div style={{ position: 'relative' }}>
                                    <button
                                        onClick={() => setIsDownloadDropdownOpen(!isDownloadDropdownOpen)}
                                        className="btn btn-outline btn-sm"
                                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 16px', fontSize: '13px', fontWeight: '700' }}
                                    >
                                        <Download size={16} /> Download <ChevronDown size={14} style={{ transform: isDownloadDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                                    </button>

                                    {isDownloadDropdownOpen && (
                                        <>
                                            <div
                                                style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 998 }}
                                                onClick={() => setIsDownloadDropdownOpen(false)}
                                            />
                                            <div style={{
                                                position: 'absolute', top: '100%', right: 0, marginTop: '8px',
                                                backgroundColor: 'white', border: '1px solid var(--border)', borderRadius: '12px',
                                                boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 999,
                                                minWidth: '160px', overflow: 'hidden', padding: '6px'
                                            }}>
                                                <button
                                                    onClick={handleDownloadCSV}
                                                    style={{
                                                        width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                                                        padding: '10px 12px', background: 'none', border: 'none',
                                                        borderRadius: '8px', color: 'var(--text-main)', fontSize: '14px',
                                                        fontWeight: '600', cursor: 'pointer', textAlign: 'left'
                                                    }}
                                                    className="dropdown-item"
                                                >
                                                    <FileText size={16} color="#3B82F6" /> Excel / CSV
                                                </button>
                                                <button
                                                    onClick={handleDownloadPDF}
                                                    style={{
                                                        width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                                                        padding: '10px 12px', background: 'none', border: 'none',
                                                        borderRadius: '8px', color: 'var(--text-main)', fontSize: '14px',
                                                        fontWeight: '600', cursor: 'pointer', textAlign: 'left'
                                                    }}
                                                    className="dropdown-item"
                                                >
                                                    <CreditCard size={16} color="#EF4444" /> Statement (PDF)
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                <div style={{ display: 'flex', background: '#F8FAFC', padding: '4px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                    {['All', 'Client', 'Vendor'].map(type => (
                                        <button
                                            key={type}
                                            onClick={() => {
                                                setLedgerType(type);
                                                setLedgerParty('All Parties'); // Reset party filter on type change
                                            }}
                                            style={{
                                                padding: '6px 16px', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', border: 'none',
                                                background: ledgerType === type ? 'white' : 'transparent',
                                                color: ledgerType === type ? 'var(--primary)' : 'var(--text-muted)',
                                                fontWeight: ledgerType === type ? '700' : '500',
                                                boxShadow: ledgerType === type ? 'var(--shadow-sm)' : 'none'
                                            }}
                                        >
                                            {type}
                                        </button>
                                    ))}
                                </div>
                                <div style={{ width: '250px' }}>
                                    <CustomSelect
                                        options={ledgerParties.map(t => ({ value: t, label: t }))}
                                        value={ledgerParty}
                                        onChange={setLedgerParty}
                                        placeholder={`Select ${ledgerType === 'All' ? 'Party' : ledgerType}`}
                                        width="full"
                                        searchable={true}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Ledger Summary Stats */}
                        {(() => {
                            const entries = getLedgerEntries();
                            const totalDebit = entries.reduce((s, e) => s + (e.debit || 0), 0);
                            const totalCredit = entries.reduce((s, e) => s + (e.credit || 0), 0);
                            const netBalance = totalDebit - totalCredit;

                            return (
                                <>
                                    <div style={{
                                        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px',
                                        marginBottom: '24px', backgroundColor: '#F8FAFC', padding: '20px',
                                        borderRadius: '12px', border: '1px solid var(--border)'
                                    }}>
                                        <div style={{ textAlign: 'center' }}>
                                            <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Total Debit (Dr)</p>
                                            <h4 style={{ fontSize: '20px', fontWeight: '900', color: '#EF4444' }}>{fmt(totalDebit)}</h4>
                                        </div>
                                        <div style={{ textAlign: 'center', borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}>
                                            <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Total Credit (Cr)</p>
                                            <h4 style={{ fontSize: '20px', fontWeight: '900', color: '#10B981' }}>{fmt(totalCredit)}</h4>
                                        </div>
                                        <div style={{ textAlign: 'center' }}>
                                            <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Net Balance</p>
                                            <h4 style={{ fontSize: '20px', fontWeight: '900', color: 'var(--primary)' }}>
                                                {fmt(Math.abs(netBalance))} {netBalance >= 0 ? 'Dr' : 'Cr'}
                                            </h4>
                                        </div>
                                    </div>

                                    <div style={{ overflowX: 'auto' }}>
                                        <table className="data-table">
                                            <thead>
                                                <tr>
                                                    <th>Date</th>
                                                    <th>Project</th>
                                                    <th>Particulars</th>
                                                    <th>Party</th>
                                                    <th style={{ textAlign: 'right' }}>Debit (Dr)</th>
                                                    <th style={{ textAlign: 'right' }}>Credit (Cr)</th>
                                                    <th style={{ textAlign: 'right' }}>Balance</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {entries.map((entry, i) => (
                                                    <tr key={i}>
                                                        <td style={{ fontSize: '13px' }}>{new Date(entry.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                                                        <td style={{ fontWeight: '700', color: 'var(--primary)', fontSize: '11px' }}>{entry.project || 'General'}</td>
                                                        <td style={{ fontWeight: '600' }}>{entry.particulars}</td>
                                                        <td>{entry.party}</td>
                                                        <td style={{ textAlign: 'right', color: '#EF4444', fontWeight: '600' }}>{entry.debit > 0 ? fmt(entry.debit) : '—'}</td>
                                                        <td style={{ textAlign: 'right', color: '#10B981', fontWeight: '600' }}>{entry.credit > 0 ? fmt(entry.credit) : '—'}</td>
                                                        <td style={{ textAlign: 'right', fontWeight: '800' }}>{fmt(entry.balance)} {entry.balance >= 0 ? 'Dr' : 'Cr'}</td>
                                                    </tr>
                                                ))}
                                                {entries.length === 0 && (
                                                    <tr>
                                                        <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No ledger entries found.</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                )}
            </div>

            {/* ── Modals ────────────────────────────────────────────────────── */}
            <ProcessPaymentModal
                isOpen={isPaymentModalOpen}
                onClose={() => setIsPaymentModalOpen(false)}
                invoice={selectedInvoice}
                onPaymentProcessed={loadData}
            />
            <RecordExpenseModal
                isOpen={isExpenseModalOpen}
                onClose={() => setIsExpenseModalOpen(false)}
                onExpenseRecorded={handleExpenseRecorded}
            />
            <PaymentHistoryModal
                isOpen={isHistoryModalOpen}
                onClose={() => setIsHistoryModalOpen(false)}
                invoice={selectedInvoice}
            />
            <CreateBillModal
                isOpen={isBillModalOpen}
                onClose={() => setIsBillModalOpen(false)}
                onBillCreated={loadData}
            />
            <BillDetailsModal
                isOpen={isBillDetailsOpen}
                onClose={() => setIsBillDetailsOpen(false)}
                bill={selectedBill}
            />
            <PurchaseBillModal
                isOpen={isPurchaseBillModalOpen}
                onClose={() => setIsPurchaseBillModalOpen(false)}
                onSuccess={loadData}
            />
        </div>
    );
};


export default Finance;

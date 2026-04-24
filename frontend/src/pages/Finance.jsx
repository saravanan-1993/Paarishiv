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
import { projectAPI, financeAPI, billingAPI, grnAPI, fleetAPI, settingsAPI } from '../utils/api';
import { hasSubTabAccess } from '../utils/rbac';
import { useAuth } from '../context/AuthContext';
import PurchaseBillModal from '../components/PurchaseBillModal';
import Pagination from '../components/Pagination';
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
    const [trips, setTrips] = useState([]);
    const [loading, setLoading] = useState(true);
    const [billTypeFilter, setBillTypeFilter] = useState('All Types');
    const [billSearch, setBillSearch] = useState('');
    const [ledgerParty, setLedgerParty] = useState('All Parties');
    const [companyInfo, setCompanyInfo] = useState({
        companyName: 'CIVIL ERP',
        logo: ''
    });

    const [purchaseSearch, setPurchaseSearch] = useState('');
    const [purchaseDateFrom, setPurchaseDateFrom] = useState('');
    const [purchaseDateTo, setPurchaseDateTo] = useState('');
    const FIN_PAGE_SIZE = 20;
    const [billPage, setBillPage] = useState(1);
    const [purchaseBillPage, setPurchaseBillPage] = useState(1);
    const [payablePage, setPayablePage] = useState(1);
    const [expensePage, setExpensePage] = useState(1);
    const [ledgerPage, setLedgerPage] = useState(1);

    const availableTabs = useMemo(() => [
        { id: 'Overview', label: 'Overview', icon: FileText },
        { id: 'Sales', label: `Sales / Billing (${bills.length})`, icon: FileText },
        { id: 'PurchaseBills', label: `Purchase Bills (${purchaseBills.length})`, icon: ClipboardCheck },
        { id: 'Purchase', label: `Purchases (${payables.length})`, icon: Wallet },
        { id: 'Payments', label: `Payments (${expenses.length})`, icon: DollarSign },
        { id: 'Ledger', label: `Ledger`, icon: FileText },
    ].filter(tab => hasSubTabAccess(user, 'Accounts', tab.id)), [user, bills.length, purchaseBills.length, payables.length, expenses.length, trips.length]);

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
                billingAPI.getPurchaseBills(),
                fleetAPI.getTrips()
            ]);

            setProjects(results[0].status === 'fulfilled' ? (results[0].value.data || []) : []);
            setPayables(results[1].status === 'fulfilled' ? (results[1].value.data || []) : []);
            setBills(results[2].status === 'fulfilled' ? (results[2].value.data || []) : []);
            setExpenses(results[3].status === 'fulfilled' ? (results[3].value.data || []) : []);
            setReceipts(results[4].status === 'fulfilled' ? (results[4].value.data || []) : []);
            setPurchaseBills(results[5].status === 'fulfilled' ? (results[5].value.data || []) : []);
            setTrips(results[6].status === 'fulfilled' ? (results[6].value.data || []) : []);

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

    const fetchCompanyInfo = async () => {
        try {
            const compRes = await settingsAPI.getCompany();
            if (compRes.data) setCompanyInfo(compRes.data);
        } catch (err) {
            console.error("Failed to fetch company info", err);
        }
    };

    useEffect(() => {
        loadData();
        fetchCompanyInfo();
        window.addEventListener('companyInfoUpdated', fetchCompanyInfo);
        return () => window.removeEventListener('companyInfoUpdated', fetchCompanyInfo);
    }, []);

    const handleDownloadVoucher = (type, data) => {
        try {
            const doc = new jsPDF();
            const compName = companyInfo.companyName || 'CIVIL ERP';

            // Header
            doc.setFontSize(20);
            doc.setTextColor(59, 130, 246);
            doc.setFont("helvetica", "bold");
            doc.text(compName, 14, 22);

            doc.setFontSize(16);
            doc.setTextColor(30, 41, 59);
            doc.text(type.toUpperCase(), 196, 22, { align: "right" });

            doc.setDrawColor(226, 232, 240);
            doc.line(14, 28, 196, 28);

            // Details
            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(100, 116, 139);
            let y = 38;
            const addRow = (label, value) => {
                doc.text(label, 14, y);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(30, 41, 59);
                doc.text(String(value || '—'), 70, y);
                doc.setFont("helvetica", "normal");
                doc.setTextColor(100, 116, 139);
                y += 7;
            };

            if (data.no) addRow('Voucher No:', data.no);
            if (data.date) addRow('Date:', data.date ? new Date(data.date).toLocaleDateString('en-IN') : '—');
            if (data.party) addRow('Party:', data.party);
            if (data.project) addRow('Project:', data.project);
            if (data.category) addRow('Category:', data.category);
            if (data.description) addRow('Description:', data.description);
            if (data.mode) addRow('Payment Mode:', data.mode);

            y += 5;
            doc.setDrawColor(226, 232, 240);
            doc.line(14, y, 196, y);
            y += 10;

            doc.setFontSize(14);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(30, 41, 59);
            doc.text('Amount:', 14, y);
            doc.setTextColor(16, 185, 129);
            doc.text(`Rs. ${(data.amount || 0).toLocaleString('en-IN')}`, 70, y);

            if (data.status) {
                y += 10;
                doc.setFontSize(10);
                doc.setTextColor(100, 116, 139);
                doc.text('Status:', 14, y);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(30, 41, 59);
                doc.text(data.status, 70, y);
            }

            const fileName = `${type.replace(/\s+/g, '_')}_${(data.no || data.party || 'voucher').replace(/\s+/g, '_')}.pdf`;
            doc.save(fileName);
        } catch (err) {
            console.error('PDF generation error:', err);
            alert('Failed to generate PDF.');
        }
    };

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

        // Calculate summary values for CSV header
        const salesTotal = entries.filter(e => e.type === 'Sales').reduce((s, e) => s + e.debit, 0);
        const receiptsTotal = entries.filter(e => e.type === 'Receipt' || e.type === 'Fleet Receipt').reduce((s, e) => s + e.credit, 0);
        const purchaseTotal = entries.filter(e => e.type === 'Purchase').reduce((s, e) => s + e.credit, 0);
        const paymentsTotal = entries.filter(e => e.type === 'Payment').reduce((s, e) => s + e.debit, 0);
        const expTotal = entries.filter(e => e.type === 'Expense' || e.type === 'Labour').reduce((s, e) => s + e.debit, 0);
        const labourT = entries.filter(e => e.type === 'Labour').reduce((s, e) => s + e.debit, 0);
        const filtProj = selectedProject === 'All Projects' ? projects : projects.filter(p => p.name === selectedProject);
        const projVal = filtProj.reduce((s, p) => s + (parseFloat(p.budget || p.projectValue || p.value || 0)), 0);
        const totalDr = entries.reduce((s, e) => s + (e.debit || 0), 0);
        const totalCr = entries.reduce((s, e) => s + (e.credit || 0), 0);

        const headers = ['Date', 'Type', 'Project', 'Particulars', 'Party', 'Debit (Dr)', 'Credit (Cr)', 'Balance'];
        const csvContent = [
            `"Ledger Statement - ${selectedProject} - ${ledgerParty}"`,
            '',
            `"Project Value",${projVal},"Total Received",${receiptsTotal},"Total Expenses",${paymentsTotal + expTotal},"Cash Balance",${receiptsTotal - paymentsTotal - expTotal}`,
            `"Sales (Billed)",${salesTotal},"Purchase",${purchaseTotal},"Project Balance",${Math.max(0, projVal - receiptsTotal)}`,
            `"Total Debit",${totalDr},"Total Credit",${totalCr},"Net Balance",${totalDr - totalCr}`,
            '',
            headers.join(','),
            ...entries.map(e => [
                new Date(e.date).toLocaleDateString('en-IN'),
                e.type || '',
                `"${(e.project || 'General').replace(/"/g, '""')}"`,
                `"${e.particulars.replace(/"/g, '""')}"`,
                `"${(e.party || '').replace(/"/g, '""')}"`,
                e.debit || 0,
                e.credit || 0,
                `${Math.abs(e.balance)} ${e.balance >= 0 ? 'Dr' : 'Cr'}`
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

            const pdfFmt = (v) => {
                if (!v && v !== 0) return 'Rs. 0';
                const abs = Math.abs(v);
                if (abs >= 10000000) return `Rs. ${(v / 10000000).toFixed(2)} Cr`;
                if (abs >= 100000) return `Rs. ${(v / 100000).toFixed(2)} L`;
                return `Rs. ${Number(v).toLocaleString('en-IN')}`;
            };

            // Calculate all summary values (same as UI)
            const totalDebit = entries.reduce((s, e) => s + (e.debit || 0), 0);
            const totalCredit = entries.reduce((s, e) => s + (e.credit || 0), 0);
            const netBalance = totalDebit - totalCredit;
            const salesTotal = entries.filter(e => e.type === 'Sales').reduce((s, e) => s + e.debit, 0);
            const receiptsTotal = entries.filter(e => e.type === 'Receipt' || e.type === 'Fleet Receipt').reduce((s, e) => s + e.credit, 0);
            const purchaseTotal = entries.filter(e => e.type === 'Purchase').reduce((s, e) => s + e.credit, 0);
            const paymentsTotal = entries.filter(e => e.type === 'Payment').reduce((s, e) => s + e.debit, 0);
            const expensesTotal = entries.filter(e => e.type === 'Expense' || e.type === 'Labour').reduce((s, e) => s + e.debit, 0);
            const labourTotal = entries.filter(e => e.type === 'Labour').reduce((s, e) => s + e.debit, 0);
            const filteredProjects = selectedProject === 'All Projects' ? projects : projects.filter(p => p.name === selectedProject);
            const projectValue = filteredProjects.reduce((s, p) => s + (parseFloat(p.budget || p.projectValue || p.value || 0)), 0);
            const projectBalance = projectValue - receiptsTotal;
            const cashBalance = receiptsTotal - (paymentsTotal + expensesTotal);

            const doc = new jsPDF('l', 'mm', 'a4'); // Landscape for more columns
            const pageW = doc.internal.pageSize.getWidth();
            const partyName = ledgerParty === 'All Parties' ? 'ALL PARTIES STATEMENT' : `PARTY LEDGER: ${ledgerParty.toUpperCase()}`;
            const reportDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
            const projectLabel = selectedProject === 'All Projects' ? 'All Projects' : selectedProject;

            // ── Header ──
            doc.setFillColor(30, 58, 138);
            doc.rect(0, 0, pageW, 28, 'F');
            doc.setFontSize(18);
            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.text(companyInfo.companyName || 'CIVIL ERP', 14, 14);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.text('Financial Ledger Statement', 14, 22);
            doc.text(`Generated: ${reportDate}`, pageW - 14, 14, { align: 'right' });
            doc.text(`Project: ${projectLabel}`, pageW - 14, 22, { align: 'right' });

            // ── Title ──
            doc.setTextColor(30, 41, 55);
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text(partyName, 14, 38);

            // ── Summary Table ──
            autoTable(doc, {
                startY: 42,
                head: [['Project Value', 'Total Received', 'Total Expenses', 'Sales (Billed)', 'Purchase', 'Project Balance', 'Cash Balance']],
                body: [[
                    pdfFmt(projectValue),
                    pdfFmt(receiptsTotal),
                    pdfFmt(paymentsTotal + expensesTotal),
                    pdfFmt(salesTotal),
                    pdfFmt(purchaseTotal),
                    pdfFmt(Math.max(0, projectBalance)),
                    pdfFmt(cashBalance),
                ]],
                theme: 'grid',
                headStyles: { fillColor: [59, 130, 246], textColor: 255, fontSize: 7, fontStyle: 'bold', halign: 'center' },
                bodyStyles: { fontSize: 8, fontStyle: 'bold', halign: 'center' },
                margin: { left: 14, right: 14 },
            });

            // ── Debit / Credit / Net ──
            const sumY = (doc.lastAutoTable?.finalY || 60) + 4;
            autoTable(doc, {
                startY: sumY,
                head: [['Total Debit (Dr)', 'Total Credit (Cr)', 'Net Balance']],
                body: [[pdfFmt(totalDebit), pdfFmt(totalCredit), `${pdfFmt(Math.abs(netBalance))} ${netBalance >= 0 ? 'Dr' : 'Cr'}`]],
                theme: 'grid',
                headStyles: { fillColor: [241, 245, 249], textColor: [100, 116, 139], fontSize: 8, fontStyle: 'bold', halign: 'center' },
                bodyStyles: { fontSize: 9, fontStyle: 'bold', halign: 'center' },
                columnStyles: { 0: { textColor: [239, 68, 68] }, 1: { textColor: [16, 185, 129] }, 2: { textColor: [59, 130, 246] } },
                margin: { left: 14, right: 14 },
            });

            // ── Ledger Table ──
            const tableY = (doc.lastAutoTable?.finalY || 80) + 6;
            autoTable(doc, {
                startY: tableY,
                head: [['Date', 'Type', 'Project', 'Particulars', 'Party', 'Debit (Dr)', 'Credit (Cr)', 'Balance']],
                body: entries.map(e => [
                    new Date(e.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
                    e.type || '',
                    (e.project || 'General').substring(0, 25),
                    e.particulars,
                    e.party || '',
                    e.debit ? `Rs. ${e.debit.toLocaleString('en-IN')}` : '-',
                    e.credit ? `Rs. ${e.credit.toLocaleString('en-IN')}` : '-',
                    `Rs. ${Math.abs(e.balance).toLocaleString('en-IN')} ${e.balance >= 0 ? 'Dr' : 'Cr'}`
                ]),
                headStyles: { fillColor: [59, 130, 246], textColor: 255, fontSize: 7, fontStyle: 'bold' },
                bodyStyles: { fontSize: 7, cellPadding: 3 },
                columnStyles: {
                    0: { cellWidth: 22 },
                    1: { cellWidth: 18 },
                    2: { cellWidth: 30 },
                    5: { halign: 'right', textColor: [220, 38, 38] },
                    6: { halign: 'right', textColor: [5, 150, 105] },
                    7: { halign: 'right', fontStyle: 'bold' },
                },
                alternateRowStyles: { fillColor: [249, 250, 251] },
                margin: { left: 14, right: 14 },
            });

            // ── Footer ──
            const finalY = Math.min((doc.lastAutoTable?.finalY || 180) + 12, 195);
            doc.setFontSize(8);
            doc.setTextColor(156, 163, 175);
            doc.text('This is an electronically generated statement and does not require a physical signature.', 14, finalY);

            doc.save(`Ledger_${projectLabel.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
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

    const totalProjectValue = (selectedProject === 'All Projects' ? projects : projects.filter(p => p.name === selectedProject))
        .reduce((s, p) => s + parseFloat(p.budget || 0), 0);
    const totalBilled = filteredBills.reduce((s, b) => s + (b.total_amount || 0), 0);
    const totalCollected = filteredBills.reduce((s, b) => s + (b.collection_amount || 0), 0);
    const totalPayableAmt = filteredPayables.reduce((s, p) => s + (p.amount || 0), 0);
    const totalPurchases = filteredPayables.reduce((s, p) => s + (p.total_amount || 0), 0);

    // Calculate 5% retention on total billed if not specifically tracked
    const totalRetention = filteredBills.reduce((s, b) => s + (b.retention_amount || (b.total_amount * 0.05)), 0);

    const kpiCards = [
        { label: 'PROJECT VALUE', value: fmt(totalProjectValue), icon: FileText, color: '#3B82F6', bgColor: '#EFF6FF' },
        { label: 'TOTAL BILLED', value: fmt(totalBilled), icon: Receipt, color: '#6366F1', bgColor: '#EEF2FF' },
        { label: 'OUTSTANDING', value: fmt(totalBilled - totalCollected), icon: AlertCircle, color: '#EF4444', bgColor: '#FEF2F2' },
        { label: 'COLLECTION (MTD)', value: fmt(collectionThisMonth), icon: Calendar, color: '#0EA5E9', bgColor: '#F0F9FF' },
        { label: 'COLLECTION (TODAY)', value: fmt(collectionToday), icon: TrendingUp, color: '#10B981', bgColor: '#F0FDF4' },
        { label: 'PAYMENTS (MTD)', value: fmt(paymentsThisMonth), icon: ArrowDownRight, color: '#F43F5E', bgColor: '#FFF1F2' },
        { label: 'PAYMENTS (TODAY)', value: fmt(paymentsToday), icon: Clock, color: '#F59E0B', bgColor: '#FEF3C7' },
        { label: 'RETENTION MONEY', value: fmt(totalRetention), icon: ShieldCheck, color: '#8B5CF6', bgColor: '#F5F3FF' },
        { label: 'TOTAL RECEIVED', value: fmt(totalCollected), icon: IndianRupee, color: '#065F46', bgColor: '#D1FAE5' },
    ];

    const projectDropdown = ['All Projects', 'Warehouse', ...projects.map(p => p.name).filter(n => n && n !== 'Warehouse')];

    // Derived Ledger Data
    const clientParties = useMemo(() => {
        const set = new Set();
        bills.forEach(b => b.project && set.add(b.project));
        projects.forEach(p => p.name && set.add(p.name));
        trips.forEach(t => {
            if (t.tripType === 'Project Trip' && t.projectName) set.add(t.projectName);
            if (t.tripType === 'Private Trip' && t.customerName) set.add(t.customerName);
        });
        return [...set].sort();
    }, [bills, projects, trips]);

    const vendorParties = useMemo(() => {
        const set = new Set();
        payables.forEach(p => p.vendor && p.vendor.toLowerCase() !== 'internal' && set.add(p.vendor.trim()));
        purchaseBills.forEach(pb => pb.vendor_name && set.add(pb.vendor_name.trim()));
        // Only add expense payees that match a known vendor from payables/purchase bills
        const knownVendors = new Set([...set]);
        expenses.forEach(e => {
            if (e.payee && knownVendors.has(e.payee.trim())) set.add(e.payee.trim());
        });
        return [...set].sort();
    }, [payables, purchaseBills, expenses]);

    const ledgerParties = useMemo(() => {
        if (ledgerType === 'Client') return ['All Parties', ...clientParties];
        if (ledgerType === 'Vendor') return ['All Parties', ...vendorParties];
        return ['All Parties', ...[...new Set([...clientParties, ...vendorParties])].sort()];
    }, [ledgerType, clientParties, vendorParties]);

    const getLedgerEntries = () => {
        let entries = [];
        const matchesProject = (pName) => selectedProject === 'All Projects' || (pName || '').trim() === selectedProject.trim();
        const matchesParty = (party) => ledgerParty === 'All Parties' || (party || '').trim() === ledgerParty.trim();
        const showClient = ledgerType === 'All' || ledgerType === 'Client';
        const showVendor = ledgerType === 'All' || ledgerType === 'Vendor' || ledgerType === 'Expenses';

        // Track GRN IDs that have purchase bills to avoid duplicates
        const billedGrnIds = new Set(purchaseBills.map(pb => pb.grn_id).filter(Boolean));

        // ── 1. SALES INVOICES (Client Bills) — Debit: amount billed to client ──
        if (showClient) bills.filter(b => matchesProject(b.project)).forEach(b => {
            const party = b.project || 'Client';
            if (!matchesParty(party)) return;
            entries.push({
                date: b.date || b.created_at || new Date().toISOString(),
                type: 'Sales',
                particulars: `Sales Invoice - ${b.bill_no}`,
                debit: parseFloat(b.total_amount) || 0,
                credit: 0,
                party,
                project: b.project
            });
        });

        // ── 2. RECEIPTS (Money received from clients) — Credit: cash in ──
        // Source A: receipts collection
        if (showClient) receipts.filter(r => matchesProject(r.project)).forEach(r => {
            const party = r.received_from || r.project || 'Client';
            if (!matchesParty(party) && !matchesParty(r.project)) return;
            entries.push({
                date: r.date || r.created_at || new Date().toISOString(),
                type: 'Receipt',
                particulars: `Receipt${r.bill_no ? ` (Bill: ${r.bill_no})` : ''} - ${r.payment_mode || 'Bank'}`,
                debit: 0,
                credit: parseFloat(r.amount) || 0,
                party: r.project || party,
                project: r.project
            });
        });
        // Source B: bill collection_amount (most systems store received money here)
        if (showClient) bills.filter(b => matchesProject(b.project) && parseFloat(b.collection_amount || 0) > 0).forEach(b => {
            const party = b.project || 'Client';
            if (!matchesParty(party)) return;
            entries.push({
                date: b.date || b.created_at || new Date().toISOString(),
                type: 'Receipt',
                particulars: `Payment Received - Bill ${b.bill_no}`,
                debit: 0,
                credit: parseFloat(b.collection_amount) || 0,
                party,
                project: b.project
            });
        });

        // ── 3. PURCHASE BILLS (Vendor invoices) — Credit: amount owed to vendor ──
        if (showVendor) purchaseBills.filter(pb => matchesProject((pb.project_name || '').trim())).forEach(pb => {
            if (!matchesParty((pb.vendor_name || '').trim())) return;
            entries.push({
                date: pb.bill_date || pb.created_at || new Date().toISOString(),
                type: 'Purchase',
                particulars: `Purchase Bill - ${pb.bill_no} (${pb.vendor_name})`,
                debit: 0,
                credit: parseFloat(pb.total_amount) || 0,
                party: pb.vendor_name,
                project: pb.project_name
            });
        });

        // ── 4. VENDOR PAYABLES (GRN-based, only if NOT already in purchase bills) ──
        if (showVendor) payables.filter(p => matchesProject(p.project) && !billedGrnIds.has(p.id)).forEach(p => {
            if (!p.vendor || p.vendor.toLowerCase() === 'internal') return;
            if (!matchesParty(p.vendor)) return;
            entries.push({
                date: p.date || p.created_at || new Date().toISOString(),
                type: 'Purchase',
                particulars: `Purchase (GRN) - ${p.voucher_no}`,
                debit: 0,
                credit: parseFloat(p.total_amount) || 0,
                party: p.vendor,
                project: p.project
            });
        });

        // ── 5. EXPENSES / PAYMENTS (Money paid out) — Debit: cash out ──
        if (showVendor) expenses.filter(e => matchesProject(e.project)).forEach(e => {
            const entryParty = e.payee || (e.grn_id ? (payables.find(p => p.id === e.grn_id)?.vendor || 'Vendor') : 'General Expense');
            if (!matchesParty(entryParty)) return;
            const amount = parseFloat(e.amount) || 0;
            if (amount <= 0) return; // Skip ₹0 pending entries

            const desc = e.grn_id
                ? `Payment to ${entryParty} - ${payables.find(p => p.id === e.grn_id)?.voucher_no || 'Purchase'}`
                : `${e.category || 'Expense'}: ${e.description || 'Payment'}`;

            entries.push({
                date: e.date || e.created_at || new Date().toISOString(),
                type: e.source === 'labour_salary' ? 'Labour' : (e.grn_id ? 'Payment' : 'Expense'),
                particulars: desc,
                debit: amount,
                credit: 0,
                party: entryParty,
                project: e.project
            });
        });

        // ── 6. FLEET TRIPS (Income) — Debit: revenue earned ──
        if (showClient) trips.forEach(t => {
            const partyName = t.tripType === 'Project Trip' ? t.projectName : t.customerName;
            if (!partyName) return;
            if (!matchesProject(t.projectName)) return;
            if (!matchesParty(partyName)) return;
            const revenue = parseFloat(t.totalRevenue || 0);
            if (revenue === 0) return;

            entries.push({
                date: t.date || t.created_at || new Date().toISOString(),
                type: 'Fleet',
                particulars: `Trip Revenue - ${t.vehicleNumber} (${t.tripId})`,
                debit: revenue,
                credit: 0,
                party: partyName,
                project: t.projectName
            });
            if (t.paymentStatus === 'Paid') {
                entries.push({
                    date: t.date || t.created_at || new Date().toISOString(),
                    type: 'Fleet Receipt',
                    particulars: `Trip Payment Received - ${t.tripId}`,
                    debit: 0,
                    credit: revenue,
                    party: partyName,
                    project: t.projectName
                });
            }
        });

        // Sort by date (latest first)
        entries.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Running balance (oldest first for correct accumulation, then reverse)
        entries.reverse();
        let runningBalance = 0;
        entries.forEach(e => {
            runningBalance += (e.debit - e.credit);
            e.balance = runningBalance;
        });
        entries.reverse();

        return entries;
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
                                { value: 'Warehouse', label: 'Warehouse' }, ...projects.filter(p => p.name !== 'Warehouse').map(p => ({ value: p.name, label: p.name }))
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
                                    options={[
                                        { value: 'All Projects', label: 'All Projects' },
                                        { value: 'Warehouse', label: 'Warehouse' }, ...projects.filter(p => p.name !== 'Warehouse').map(p => ({ value: p.name, label: p.name }))
                                    ]}
                                    value={selectedProject}
                                    onChange={setSelectedProject}
                                    placeholder="Filter Project"
                                    width="full"
                                    icon={Briefcase}
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
                        ) : (<>
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
                                    {filteredBills.slice((billPage - 1) * FIN_PAGE_SIZE, billPage * FIN_PAGE_SIZE).map((bill, i) => {
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
                                                <td style={{ width: '180px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <button
                                                            className="btn btn-outline btn-sm"
                                                            onClick={() => {
                                                                setSelectedBill(bill);
                                                                setIsBillDetailsOpen(true);
                                                            }}
                                                            style={{ border: 'none', padding: '6px', background: 'transparent' }}
                                                            title="View"
                                                        >
                                                            <Eye size={18} color="#3B82F6" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDownloadVoucher('Sales Invoice', { no: bill.bill_no, date: bill.date, party: bill.project, project: bill.project, amount: totalAmt, status: paymentStatus })}
                                                            style={{ border: 'none', padding: '6px', background: 'transparent', cursor: 'pointer' }}
                                                            title="Download"
                                                        >
                                                            <Download size={18} color="#10B981" />
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
                            <Pagination currentPage={billPage} totalItems={filteredBills.length} pageSize={FIN_PAGE_SIZE} onPageChange={setBillPage} />
                        </>)}
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
                            <div style={{ width: '200px' }}>
                                <CustomSelect
                                    options={[
                                        { value: 'All Projects', label: 'All Projects' },
                                        { value: 'Warehouse', label: 'Warehouse' }, ...projects.filter(p => p.name !== 'Warehouse').map(p => ({ value: p.name, label: p.name }))
                                    ]}
                                    value={selectedProject}
                                    onChange={setSelectedProject}
                                    placeholder="Filter Project"
                                    width="full"
                                    icon={Briefcase}
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
                        ) : (<>
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Bill No</th>
                                        <th>Date</th>
                                        <th>Vendor</th>
                                        <th>Project</th>
                                        <th style={{ textAlign: 'right' }}>Total Amount</th>
                                        <th>Status</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredPurchaseBills.slice((purchaseBillPage - 1) * FIN_PAGE_SIZE, purchaseBillPage * FIN_PAGE_SIZE).map((pb, i) => (
                                        <tr key={pb.id || i}>
                                            <td style={{ fontWeight: '800', color: 'var(--primary)' }}>{pb.bill_no}</td>
                                            <td style={{ fontSize: '13px' }}>
                                                {pb.bill_date ? new Date(pb.bill_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                            </td>
                                            <td style={{ fontWeight: '600' }}>{pb.vendor_name}</td>
                                            <td>{pb.project_name}</td>
                                            <td style={{ textAlign: 'right', fontWeight: '800' }}>{fmt(pb.total_amount || 0)}</td>
                                            <td>
                                                <span className={`badge ${pb.status === 'Paid' ? 'badge-success' : pb.status === 'Partially Paid' ? 'badge-info' : 'badge-warning'}`}>
                                                    {pb.status || 'Pending'}
                                                </span>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '4px' }}>
                                                    <button onClick={() => handleDownloadVoucher('Purchase Bill', { no: pb.bill_no, date: pb.bill_date, party: pb.vendor_name, project: pb.project_name, amount: pb.total_amount, status: pb.status })} style={{ border: 'none', padding: '6px', background: 'transparent', cursor: 'pointer' }} title="Download">
                                                        <Download size={18} color="var(--primary)" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <Pagination currentPage={purchaseBillPage} totalItems={filteredPurchaseBills.length} pageSize={FIN_PAGE_SIZE} onPageChange={setPurchaseBillPage} />
                        </>)}
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
                            <div style={{ width: '200px' }}>
                                <CustomSelect
                                    options={[
                                        { value: 'All Projects', label: 'All Projects' },
                                        { value: 'Warehouse', label: 'Warehouse' }, ...projects.filter(p => p.name !== 'Warehouse').map(p => ({ value: p.name, label: p.name }))
                                    ]}
                                    value={selectedProject}
                                    onChange={setSelectedProject}
                                    placeholder="Filter Project"
                                    width="full"
                                    icon={Briefcase}
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
                        ) : (<>
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
                                    {filteredPayables.slice((payablePage - 1) * FIN_PAGE_SIZE, payablePage * FIN_PAGE_SIZE).map((item) => {
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
                                                        <button className="btn btn-outline btn-sm" onClick={() => handleViewHistory(item)} style={{ border: 'none' }} title="View">
                                                            <Eye size={18} color="var(--primary)" />
                                                        </button>
                                                        <button onClick={() => handleDownloadVoucher('Purchase Voucher', { no: item.voucher_no, date: item.date, party: item.vendor, project: item.project, amount: totAmt, status: pStatus })} style={{ border: 'none', padding: '6px', background: 'transparent', cursor: 'pointer' }} title="Download">
                                                            <Download size={18} color="#10B981" />
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
                            <Pagination currentPage={payablePage} totalItems={filteredPayables.length} pageSize={FIN_PAGE_SIZE} onPageChange={setPayablePage} />
                        </>)}
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
                            <div style={{ width: '200px' }}>
                                <CustomSelect
                                    options={[
                                        { value: 'All Projects', label: 'All Projects' },
                                        { value: 'Warehouse', label: 'Warehouse' }, ...projects.filter(p => p.name !== 'Warehouse').map(p => ({ value: p.name, label: p.name }))
                                    ]}
                                    value={selectedProject}
                                    onChange={setSelectedProject}
                                    placeholder="Filter Project"
                                    width="full"
                                    icon={Briefcase}
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
                        ) : (<>
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Project</th>
                                        <th>Category</th>
                                        <th>Description</th>
                                        <th>Paid To</th>
                                        <th style={{ textAlign: 'right' }}>Amount</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredExpenses.slice((expensePage - 1) * FIN_PAGE_SIZE, expensePage * FIN_PAGE_SIZE).map((exp, i) => (
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
                                            <td>
                                                <button onClick={() => handleDownloadVoucher('Payment Voucher', { date: exp.date, party: exp.payee, project: exp.project, category: exp.category, description: exp.description, mode: exp.paymentMode, amount: exp.amount })} style={{ border: 'none', padding: '6px', background: 'transparent', cursor: 'pointer' }} title="Download">
                                                    <Download size={18} color="var(--primary)" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <Pagination currentPage={expensePage} totalItems={filteredExpenses.length} pageSize={FIN_PAGE_SIZE} onPageChange={setExpensePage} />
                        </>)}
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
                                    {['All', 'Client', 'Vendor', 'Expenses'].map(type => (
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
                                <div style={{ width: '220px' }}>
                                    <CustomSelect
                                        options={[
                                            { value: 'All Projects', label: 'All Projects' },
                                            { value: 'Warehouse', label: 'Warehouse' }, ...projects.filter(p => p.name !== 'Warehouse').map(p => ({ value: p.name, label: p.name }))
                                        ]}
                                        value={selectedProject}
                                        onChange={setSelectedProject}
                                        placeholder="Project"
                                        width="full"
                                        icon={Briefcase}
                                    />
                                </div>
                                {(ledgerType === 'Vendor') && (
                                    <div style={{ width: '220px' }}>
                                        <CustomSelect
                                            options={[{ value: 'All Parties', label: 'All Vendors' }, ...vendorParties.map(t => ({ value: t, label: t }))]}
                                            value={ledgerParty}
                                            onChange={setLedgerParty}
                                            placeholder="Select Vendor"
                                            width="full"
                                            searchable={true}
                                        />
                                    </div>
                                )}
                                {ledgerType !== 'Vendor' && ledgerType !== 'Expenses' && (
                                    <div style={{ width: '220px' }}>
                                        <CustomSelect
                                            options={ledgerParties.map(t => ({ value: t, label: t }))}
                                            value={ledgerParty}
                                            onChange={setLedgerParty}
                                            placeholder={`Select ${ledgerType === 'All' ? 'Party' : ledgerType}`}
                                            width="full"
                                            searchable={true}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Ledger Summary Stats */}
                        {(() => {
                            const entries = getLedgerEntries();
                            const totalDebit = entries.reduce((s, e) => s + (e.debit || 0), 0);
                            const totalCredit = entries.reduce((s, e) => s + (e.credit || 0), 0);
                            const netBalance = totalDebit - totalCredit;

                            // Project value from project data
                            const filteredProjects = selectedProject === 'All Projects' ? projects : projects.filter(p => p.name === selectedProject);
                            const projectValue = filteredProjects.reduce((s, p) => s + (parseFloat(p.budget || p.projectValue || p.value || 0)), 0);
                            const projectSpent = filteredProjects.reduce((s, p) => s + (parseFloat(p.spent || 0)), 0);

                            // Category-wise breakdown
                            const salesTotal = entries.filter(e => e.type === 'Sales').reduce((s, e) => s + e.debit, 0);
                            const receiptsTotal = entries.filter(e => e.type === 'Receipt' || e.type === 'Fleet Receipt').reduce((s, e) => s + e.credit, 0);
                            const purchaseTotal = entries.filter(e => e.type === 'Purchase').reduce((s, e) => s + e.credit, 0);
                            const paymentsTotal = entries.filter(e => e.type === 'Payment').reduce((s, e) => s + e.debit, 0);
                            const expensesTotal = entries.filter(e => e.type === 'Expense' || e.type === 'Labour').reduce((s, e) => s + e.debit, 0);
                            const labourTotal = entries.filter(e => e.type === 'Labour').reduce((s, e) => s + e.debit, 0);
                            const pendingReceivable = salesTotal - receiptsTotal;
                            const pendingPayable = purchaseTotal - paymentsTotal;

                            return (
                                <>
                                    {(() => {
                                        const totalExpAll = paymentsTotal + expensesTotal;
                                        const projBal = projectValue - receiptsTotal;
                                        const cashBal = receiptsTotal - totalExpAll;

                                        // Build cards based on tab
                                        // Expense category breakdown for Expenses tab
                                        const expByCategory = {};
                                        entries.filter(e => e.type === 'Payment' || e.type === 'Expense' || e.type === 'Labour').forEach(e => {
                                            const cat = (e.particulars || '').includes('Labour') || e.type === 'Labour' ? 'Labour Wages'
                                                : (e.particulars || '').includes('Payment to') ? 'Material Purchase'
                                                : (e.particulars || '').match(/Expense:\s*([^-]+)/)?.[1]?.trim() || 'Other';
                                            if (!expByCategory[cat]) expByCategory[cat] = 0;
                                            expByCategory[cat] += e.debit;
                                        });

                                        const allCards = [
                                            { label: 'Project Value', value: projectValue, border: '#DBEAFE', bg: '#EFF6FF', color: '#1E3A8A', lc: '#1D4ED8', show: ['All', 'Client'] },
                                            { label: 'Total Received', value: receiptsTotal, border: '#DCFCE7', bg: '#F0FDF4', color: '#166534', lc: '#15803D', show: ['All', 'Client'] },
                                            { label: 'Total Expenses', value: totalExpAll, border: '#FEE2E2', bg: '#FEF2F2', color: '#991B1B', lc: '#B91C1C', show: ['All', 'Vendor', 'Expenses'] },
                                            { label: 'Pending Receivable', value: Math.max(0, pendingReceivable), border: '#FEF3C7', bg: '#FFFBEB', color: '#78350F', lc: '#92400E', show: ['All', 'Client'] },
                                            { label: 'Pending Payable', value: Math.max(0, pendingPayable), border: '#E0E7FF', bg: '#EEF2FF', color: '#3730A3', lc: '#4338CA', show: ['All', 'Vendor'] },
                                            { label: 'Project Balance (Due)', value: Math.max(0, projBal), border: projBal > 0 ? '#FEF3C7' : '#DCFCE7', bg: projBal > 0 ? '#FFFBEB' : '#F0FDF4', color: projBal > 0 ? '#78350F' : '#166534', lc: projBal > 0 ? '#92400E' : '#15803D', show: ['All', 'Client'] },
                                            { label: 'Cash Balance', value: cashBal, border: cashBal >= 0 ? '#DCFCE7' : '#FEE2E2', bg: cashBal >= 0 ? '#F0FDF4' : '#FEF2F2', color: cashBal >= 0 ? '#166534' : '#991B1B', lc: cashBal >= 0 ? '#15803D' : '#B91C1C', show: ['All'] },
                                            { label: 'Total Purchased', value: purchaseTotal, border: '#E0E7FF', bg: '#EEF2FF', color: '#3730A3', lc: '#4338CA', show: ['Vendor'] },
                                            { label: 'Paid to Vendors', value: paymentsTotal, border: '#DCFCE7', bg: '#F0FDF4', color: '#166534', lc: '#15803D', show: ['Vendor'] },
                                            { label: 'Material Purchase', value: expByCategory['Material Purchase'] || 0, border: '#E0E7FF', bg: '#EEF2FF', color: '#3730A3', lc: '#4338CA', show: ['Expenses'] },
                                            { label: 'Labour Wages', value: expByCategory['Labour Wages'] || 0, border: '#FCE7F3', bg: '#FDF2F8', color: '#9D174D', lc: '#EC4899', show: ['Expenses'] },
                                            ...Object.entries(expByCategory).filter(([k]) => k !== 'Material Purchase' && k !== 'Labour Wages' && k !== 'Other').map(([k, v]) => (
                                                { label: k, value: v, border: '#FEF3C7', bg: '#FFFBEB', color: '#78350F', lc: '#92400E', show: ['Expenses'] }
                                            )),
                                            { label: 'Other Expenses', value: expByCategory['Other'] || 0, border: '#F1F5F9', bg: '#F8FAFC', color: '#475569', lc: '#64748B', show: ['Expenses'] },
                                        ].filter(c => !(c.show.includes('Expenses') && !c.show.includes('All') && c.value === 0));
                                        const visibleCards = allCards.filter(c => c.show.includes(ledgerType));

                                        return (
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
                                                {visibleCards.map((c, i) => (
                                                    <div key={i} style={{ padding: '14px 16px', borderRadius: 10, border: `1px solid ${c.border}`, backgroundColor: c.bg }}>
                                                        <div style={{ fontSize: 11, color: c.lc, fontWeight: 600, marginBottom: 2 }}>{c.label}</div>
                                                        <div style={{ fontSize: 20, fontWeight: 900, color: c.color }}>{fmt(c.value)}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })()}

                                    {/* Debit / Credit / Net — show on All and Client */}
                                    {(ledgerType === 'All' || ledgerType === 'Client') && (
                                        <div style={{
                                            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16,
                                            marginBottom: 16, backgroundColor: '#F8FAFC', padding: 20,
                                            borderRadius: 12, border: '1px solid var(--border)'
                                        }}>
                                            <div style={{ textAlign: 'center' }}>
                                                <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Total Debit (Dr)</p>
                                                <h4 style={{ fontSize: 20, fontWeight: 900, color: '#EF4444' }}>{fmt(totalDebit)}</h4>
                                            </div>
                                            <div style={{ textAlign: 'center', borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}>
                                                <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Total Credit (Cr)</p>
                                                <h4 style={{ fontSize: 20, fontWeight: 900, color: '#10B981' }}>{fmt(totalCredit)}</h4>
                                            </div>
                                            <div style={{ textAlign: 'center' }}>
                                                <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Net Balance</p>
                                                <h4 style={{ fontSize: 20, fontWeight: 900, color: 'var(--primary)' }}>{fmt(Math.abs(netBalance))} {netBalance >= 0 ? 'Dr' : 'Cr'}</h4>
                                            </div>
                                        </div>
                                    )}

                                    {/* Expenses Tab: grouped by category */}
                                    {ledgerType === 'Expenses' ? (
                                        <div>
                                            {(() => {
                                                const expEntries = entries.filter(e => e.type === 'Payment' || e.type === 'Expense' || e.type === 'Labour');
                                                if (expEntries.length === 0) return <div style={{ textAlign: 'center', padding: 40, color: '#64748B' }}>No expense entries found.</div>;

                                                // Group by category
                                                const catMap = {};
                                                expEntries.forEach(e => {
                                                    const cat = (e.particulars || '').includes('Labour') || e.type === 'Labour' ? 'Labour Wages'
                                                        : (e.particulars || '').includes('Payment to') ? 'Material Purchase'
                                                        : (e.particulars || '').match(/Expense:\s*([^-]+)/)?.[1]?.trim() || 'Other';
                                                    if (!catMap[cat]) catMap[cat] = { entries: [], total: 0 };
                                                    catMap[cat].entries.push(e);
                                                    catMap[cat].total += e.debit;
                                                });

                                                return Object.entries(catMap).sort((a, b) => b[1].total - a[1].total).map(([catName, data]) => {
                                                    const catColors = { 'Material Purchase': '#3B82F6', 'Labour Wages': '#EC4899', 'Site Office': '#F59E0B', 'Fuel/Diesel': '#EF4444', 'Other': '#64748B' };
                                                    const accent = catColors[catName] || '#8B5CF6';
                                                    return (
                                                        <div key={catName} style={{ marginBottom: 16, border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden' }}>
                                                            <div style={{ padding: '14px 20px', backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                                    <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: accent }} />
                                                                    <span style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>{catName}</span>
                                                                    <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>({data.entries.length} entries)</span>
                                                                </div>
                                                                <span style={{ fontSize: 18, fontWeight: 900, color: accent }}>{fmt(data.total)}</span>
                                                            </div>
                                                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                                                <thead>
                                                                    <tr style={{ backgroundColor: '#F1F5F9' }}>
                                                                        <th style={{ padding: '8px 16px', fontSize: 11, fontWeight: 700, color: '#64748B', textAlign: 'left' }}>Date</th>
                                                                        <th style={{ padding: '8px 16px', fontSize: 11, fontWeight: 700, color: '#64748B', textAlign: 'left' }}>Project</th>
                                                                        <th style={{ padding: '8px 16px', fontSize: 11, fontWeight: 700, color: '#64748B', textAlign: 'left' }}>Description</th>
                                                                        <th style={{ padding: '8px 16px', fontSize: 11, fontWeight: 700, color: '#64748B', textAlign: 'left' }}>Party</th>
                                                                        <th style={{ padding: '8px 16px', fontSize: 11, fontWeight: 700, color: '#64748B', textAlign: 'right' }}>Amount</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {data.entries.map((e, i) => (
                                                                        <tr key={i} style={{ borderTop: '1px solid #F1F5F9' }}>
                                                                            <td style={{ padding: '10px 16px', fontSize: 13, whiteSpace: 'nowrap' }}>{new Date(e.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                                                                            <td style={{ padding: '10px 16px', fontSize: 12, fontWeight: 700, color: 'var(--primary)' }}>{e.project || 'General'}</td>
                                                                            <td style={{ padding: '10px 16px', fontSize: 12 }}>{e.particulars}</td>
                                                                            <td style={{ padding: '10px 16px', fontSize: 12, color: '#64748B' }}>{e.party}</td>
                                                                            <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 700, textAlign: 'right', color: '#EF4444' }}>{fmt(e.debit)}</td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    );
                                                });
                                            })()}
                                        </div>
                                    ) :

                                    /* Vendor Tab: grouped by vendor */
                                    ledgerType === 'Vendor' ? (
                                        <div>
                                            {(() => {
                                                // Known vendor names from payables + purchase bills
                                                const knownVendors = new Set();
                                                payables.forEach(p => { if (p.vendor) knownVendors.add(p.vendor.trim()); });
                                                purchaseBills.forEach(pb => { if (pb.vendor_name) knownVendors.add(pb.vendor_name.trim()); });

                                                // Group entries by vendor — only actual vendors
                                                const vendorMap = {};
                                                entries.forEach(e => {
                                                    const rawParty = (e.party || '').trim();
                                                    // Only group under vendor if party is a known vendor
                                                    const isVendor = knownVendors.has(rawParty);
                                                    if (!isVendor && e.type !== 'Purchase') return; // Skip non-vendor expenses
                                                    const v = isVendor ? rawParty : (rawParty || 'Unknown Vendor');
                                                    if (!vendorMap[v]) vendorMap[v] = { entries: [], purchased: 0, paid: 0 };
                                                    vendorMap[v].entries.push(e);
                                                    if (e.type === 'Purchase') vendorMap[v].purchased += e.credit;
                                                    if (e.type === 'Payment' || e.type === 'Expense' || e.type === 'Labour') vendorMap[v].paid += e.debit;
                                                });
                                                const vendorList = Object.entries(vendorMap)
                                                    .filter(([name]) => ledgerParty === 'All Parties' || name === ledgerParty)
                                                    .sort((a, b) => b[1].purchased - a[1].purchased);
                                                if (vendorList.length === 0) return <div style={{ textAlign: 'center', padding: 40, color: '#64748B' }}>No vendor entries found.</div>;
                                                return vendorList.map(([vendorName, data]) => {
                                                    const balance = data.purchased - data.paid;
                                                    return (
                                                        <div key={vendorName} style={{ marginBottom: 20, border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden' }}>
                                                            {/* Vendor Header */}
                                                            <div style={{ padding: '16px 20px', backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                                                                <div style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', marginBottom: 8 }}>{vendorName}</div>
                                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                                                                    <div style={{ padding: '8px 12px', borderRadius: 8, backgroundColor: 'white', border: '1px solid #E2E8F0' }}>
                                                                        <div style={{ fontSize: 10, color: '#64748B', fontWeight: 600 }}>TOTAL PURCHASED</div>
                                                                        <div style={{ fontSize: 16, fontWeight: 900, color: '#8B5CF6' }}>{fmt(data.purchased)}</div>
                                                                    </div>
                                                                    <div style={{ padding: '8px 12px', borderRadius: 8, backgroundColor: 'white', border: '1px solid #E2E8F0' }}>
                                                                        <div style={{ fontSize: 10, color: '#64748B', fontWeight: 600 }}>TOTAL PAID</div>
                                                                        <div style={{ fontSize: 16, fontWeight: 900, color: '#10B981' }}>{fmt(data.paid)}</div>
                                                                    </div>
                                                                    <div style={{ padding: '8px 12px', borderRadius: 8, backgroundColor: 'white', border: '1px solid #E2E8F0' }}>
                                                                        <div style={{ fontSize: 10, color: '#64748B', fontWeight: 600 }}>BALANCE</div>
                                                                        <div style={{ fontSize: 16, fontWeight: 900, color: balance > 0 ? '#EF4444' : '#10B981' }}>{fmt(Math.abs(balance))}</div>
                                                                    </div>
                                                                    <div style={{ padding: '8px 12px', borderRadius: 8, backgroundColor: 'white', border: '1px solid #E2E8F0' }}>
                                                                        <div style={{ fontSize: 10, color: '#64748B', fontWeight: 600 }}>STATUS</div>
                                                                        <div style={{ fontSize: 13, fontWeight: 700, color: balance <= 0 ? '#10B981' : '#F59E0B' }}>{balance <= 0 ? 'Settled' : 'Outstanding'}</div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            {/* Transaction Table */}
                                                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                                                <thead>
                                                                    <tr style={{ backgroundColor: '#F1F5F9' }}>
                                                                        <th style={{ padding: '10px 16px', fontSize: 11, fontWeight: 700, color: '#64748B', textAlign: 'left' }}>Date</th>
                                                                        <th style={{ padding: '10px 16px', fontSize: 11, fontWeight: 700, color: '#64748B', textAlign: 'left' }}>Activity Type</th>
                                                                        <th style={{ padding: '10px 16px', fontSize: 11, fontWeight: 700, color: '#64748B', textAlign: 'left' }}>Reference</th>
                                                                        <th style={{ padding: '10px 16px', fontSize: 11, fontWeight: 700, color: '#64748B', textAlign: 'left' }}>Project</th>
                                                                        <th style={{ padding: '10px 16px', fontSize: 11, fontWeight: 700, color: '#64748B', textAlign: 'right' }}>Amount</th>
                                                                        <th style={{ padding: '10px 16px', fontSize: 11, fontWeight: 700, color: '#64748B', textAlign: 'center' }}>Status</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {data.entries.map((e, i) => {
                                                                        const statusColors = { Purchase: { bg: '#FEF3C7', color: '#92400E', label: 'INVOICED' }, Payment: { bg: '#DCFCE7', color: '#15803D', label: 'PAID' }, Expense: { bg: '#DCFCE7', color: '#15803D', label: 'PAID' }, Labour: { bg: '#DCFCE7', color: '#15803D', label: 'PAID' } };
                                                                        const st = statusColors[e.type] || { bg: '#F1F5F9', color: '#475569', label: e.type };
                                                                        return (
                                                                            <tr key={i} style={{ borderTop: '1px solid #F1F5F9' }}>
                                                                                <td style={{ padding: '10px 16px', fontSize: 13 }}>{new Date(e.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                                                                                <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 600 }}>{e.type}</td>
                                                                                <td style={{ padding: '10px 16px', fontSize: 12, color: '#3B82F6', fontWeight: 600 }}>{e.particulars}</td>
                                                                                <td style={{ padding: '10px 16px', fontSize: 12 }}>{e.project || 'General'}</td>
                                                                                <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 700, textAlign: 'right', color: e.debit > 0 ? '#EF4444' : '#10B981' }}>{fmt(e.debit || e.credit)}</td>
                                                                                <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                                                                                    <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700, backgroundColor: st.bg, color: st.color }}>{st.label}</span>
                                                                                </td>
                                                                            </tr>
                                                                        );
                                                                    })}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    );
                                                });
                                            })()}
                                        </div>
                                    ) : (
                                    /* All / Client Tab: standard ledger table */
                                    <div style={{ overflowX: 'auto' }}>
                                        <table className="data-table">
                                            <thead>
                                                <tr>
                                                    <th>Date</th>
                                                    <th>Type</th>
                                                    <th>Project</th>
                                                    <th>Particulars</th>
                                                    <th>Party</th>
                                                    <th style={{ textAlign: 'right' }}>Debit (Dr)</th>
                                                    <th style={{ textAlign: 'right' }}>Credit (Cr)</th>
                                                    <th style={{ textAlign: 'right' }}>Balance</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {entries.slice((ledgerPage - 1) * FIN_PAGE_SIZE, ledgerPage * FIN_PAGE_SIZE).map((entry, i) => {
                                                    const typeColors = { Sales: '#3B82F6', Receipt: '#10B981', Purchase: '#8B5CF6', Payment: '#EF4444', Expense: '#64748B', Labour: '#EC4899', Fleet: '#F59E0B', 'Fleet Receipt': '#10B981' };
                                                    return (
                                                    <tr key={i}>
                                                        <td style={{ fontSize: '13px', whiteSpace: 'nowrap' }}>{new Date(entry.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                                                        <td><span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, backgroundColor: `${typeColors[entry.type] || '#64748B'}15`, color: typeColors[entry.type] || '#64748B' }}>{entry.type}</span></td>
                                                        <td style={{ fontWeight: '700', color: 'var(--primary)', fontSize: '11px' }}>{entry.project || 'General'}</td>
                                                        <td style={{ fontWeight: '600', fontSize: '12px' }}>{entry.particulars}</td>
                                                        <td style={{ fontSize: '12px' }}>{entry.party}</td>
                                                        <td style={{ textAlign: 'right', color: '#EF4444', fontWeight: '600' }}>{entry.debit > 0 ? fmt(entry.debit) : '—'}</td>
                                                        <td style={{ textAlign: 'right', color: '#10B981', fontWeight: '600' }}>{entry.credit > 0 ? fmt(entry.credit) : '—'}</td>
                                                        <td style={{ textAlign: 'right', fontWeight: '800' }}>{fmt(Math.abs(entry.balance))} {entry.balance >= 0 ? 'Dr' : 'Cr'}</td>
                                                    </tr>
                                                    );
                                                })}
                                                {entries.length === 0 && (
                                                    <tr>
                                                        <td colSpan="8" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No ledger entries found.</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                        <Pagination currentPage={ledgerPage} totalItems={entries.length} pageSize={FIN_PAGE_SIZE} onPageChange={setLedgerPage} />
                                    </div>
                                    )}
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

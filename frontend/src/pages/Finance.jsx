import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    Wallet, DollarSign, Download, Plus, FileText,
    CheckCircle, Clock, RotateCw,
    Calculator, ShieldCheck, Filter, Loader2, RefreshCw, Eye, Trash2, Briefcase, ClipboardCheck,
    Search, Calendar, Building2, User, ChevronDown, AlertCircle, TrendingUp, ArrowDownRight, ArrowUpRight, Edit3, CreditCard, Receipt, Building,
    IndianRupee, Share2, MessageCircle, Mail
} from 'lucide-react';
import ProcessPaymentModal from '../components/ProcessPaymentModal';
import RecordExpenseModal from '../components/RecordExpenseModal';
import PaymentHistoryModal from '../components/PaymentHistoryModal';
import CreateBillModal from '../components/CreateBillModal';
import BillDetailsModal from '../components/BillDetailsModal';
import CustomSelect from '../components/CustomSelect';
import { projectAPI, financeAPI, billingAPI, grnAPI, fleetAPI, settingsAPI, subcontractorBillingAPI } from '../utils/api';
import { hasSubTabAccess, hasPermission } from '../utils/rbac';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import PurchaseBillModal from '../components/PurchaseBillModal';
import Pagination from '../components/Pagination';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { fmt } from '../utils/format';

const generateSalesInvoicePDF = (data, companyInfo) => {
    const doc = new jsPDF();
    const compName = companyInfo?.companyName || 'CIVIL ERP';
    const compAddr = companyInfo?.address || '';
    const compPhone = companyInfo?.phone || '';
    const compEmail = companyInfo?.email || '';
    const compGst = companyInfo?.gst || companyInfo?.gstin || '';
    const M = 14;

    // ── Header Band ──
    doc.setFillColor(26, 54, 107);
    doc.rect(0, 0, 210, 36, 'F');
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text(compName, M, 14);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 215, 240);
    if (compAddr) doc.text(compAddr, M, 21);
    const contactLine = [compPhone, compEmail].filter(Boolean).join('  |  ');
    if (contactLine) doc.text(contactLine, M, 27);

    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('SALES INVOICE', 196, 12, { align: 'right' });
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 215, 240);
    doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`, 196, 20, { align: 'right' });
    if (compGst) doc.text(`GSTIN: ${compGst}`, 196, 27, { align: 'right' });

    let y = 44;

    // ── Two-column Info Boxes ──
    // Left: Bill To
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(220, 228, 240);
    doc.roundedRect(M, y, 87, 36, 2, 2, 'FD');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'bold');
    doc.text('BILL TO / PROJECT', M + 4, y + 7);
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    const projLines = doc.splitTextToSize(data.project || '-', 78);
    doc.text(projLines.slice(0, 2), M + 4, y + 16);

    // Right: Invoice Details
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(109, y, 87, 36, 2, 2, 'FD');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'bold');
    doc.text('INVOICE DETAILS', 113, y + 7);

    const detailPair = (label, value, dy) => {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        doc.text(label, 113, y + dy);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text(String(value || '-'), 147, y + dy);
    };
    detailPair('Invoice No :', data.no, 15);
    detailPair('Date       :', data.date ? new Date(data.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-', 22);
    if (data.due_date) {
        detailPair('Due Date   :', new Date(data.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }), 29);
    } else {
        detailPair('Bill Type  :', data.bill_type || '-', 29);
    }
    y += 42;

    // ── Bill Type & Description Band ──
    if (data.bill_type || data.description) {
        const bandH = data.description ? 20 : 12;
        doc.setFillColor(239, 246, 255);
        doc.setDrawColor(191, 219, 254);
        doc.rect(M, y, 182, bandH, 'FD');
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.setFont('helvetica', 'bold');
        doc.text('BILL TYPE:', M + 4, y + 6);
        doc.setTextColor(37, 99, 235);
        doc.setFontSize(8.5);
        doc.text(data.bill_type || '-', M + 30, y + 6);
        if (data.description) {
            doc.setFontSize(7.5);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(60, 80, 120);
            const descLine = doc.splitTextToSize(data.description, 170);
            doc.text(descLine[0], M + 4, y + 14);
        }
        y += bandH + 6;
    }

    // ── Divider ──
    doc.setDrawColor(226, 232, 240);
    doc.line(M, y, 196, y);
    y += 10;

    // ── Financial Summary ──
    doc.setFontSize(10);
    doc.setTextColor(26, 54, 107);
    doc.setFont('helvetica', 'bold');
    doc.text('FINANCIAL SUMMARY', M, y);
    y += 5;

    const gstRate = parseFloat(data.gst_rate || 0);
    const baseAmt = parseFloat(data.base_amount || 0);
    const gstAmt = parseFloat(data.gst_amount || 0);
    const totalAmt = parseFloat(data.amount || 0);
    const halfRate = gstRate / 2;

    const sumRows = [[
        { content: 'Taxable Amount (Base)', styles: { fontStyle: 'normal', textColor: [60, 80, 120] } },
        { content: `Rs. ${baseAmt.toLocaleString('en-IN')}`, styles: { halign: 'right', fontStyle: 'bold', textColor: [30, 41, 59] } }
    ]];
    if (gstRate > 0 && gstAmt > 0) {
        sumRows.push([
            { content: `CGST @ ${halfRate}%`, styles: { fontStyle: 'normal', textColor: [80, 100, 130] } },
            { content: `Rs. ${(gstAmt / 2).toLocaleString('en-IN')}`, styles: { halign: 'right', textColor: [80, 100, 130] } }
        ]);
        sumRows.push([
            { content: `SGST @ ${halfRate}%`, styles: { fontStyle: 'normal', textColor: [80, 100, 130] } },
            { content: `Rs. ${(gstAmt / 2).toLocaleString('en-IN')}`, styles: { halign: 'right', textColor: [80, 100, 130] } }
        ]);
    } else if (gstAmt > 0) {
        sumRows.push([
            { content: 'GST', styles: { fontStyle: 'normal', textColor: [80, 100, 130] } },
            { content: `Rs. ${gstAmt.toLocaleString('en-IN')}`, styles: { halign: 'right', textColor: [80, 100, 130] } }
        ]);
    }

    autoTable(doc, {
        startY: y,
        body: sumRows,
        theme: 'plain',
        styles: { fontSize: 9.5, cellPadding: { top: 4, bottom: 4, left: 4, right: 4 } },
        columnStyles: { 0: { cellWidth: 130 }, 1: { cellWidth: 52 } },
        margin: { left: M, right: M },
    });
    y = (doc.lastAutoTable?.finalY || y) + 2;

    // Total band
    doc.setFillColor(26, 54, 107);
    doc.rect(M, y, 182, 13, 'F');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL AMOUNT', M + 4, y + 9);
    doc.text(`Rs. ${totalAmt.toLocaleString('en-IN')}`, 196, y + 9, { align: 'right' });
    y += 18;

    // Status row
    const isPaid = data.status === 'Paid';
    const isPartial = data.status === 'Partial' || data.status === 'Partially Paid';
    const statusColor = isPaid ? [16, 185, 129] : isPartial ? [59, 130, 246] : [245, 158, 11];
    const statusBg = isPaid ? [240, 253, 244] : isPartial ? [239, 246, 255] : [255, 251, 235];
    doc.setFillColor(...statusBg);
    doc.rect(M, y, 182, 11, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Payment Status:', M + 4, y + 7.5);
    if (data.collection_amount !== undefined && data.collection_amount > 0) {
        doc.text(`Collected: Rs. ${parseFloat(data.collection_amount).toLocaleString('en-IN')}`, M + 45, y + 7.5);
    }
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...statusColor);
    doc.text((data.status || 'Pending').toUpperCase(), 196, y + 7.5, { align: 'right' });
    y += 16;

    // PAID watermark (light background text)
    if (isPaid) {
        doc.setFontSize(68);
        doc.setTextColor(220, 252, 231);
        doc.setFont('helvetica', 'bold');
        doc.text('PAID', 105, 200, { align: 'center', angle: 35 });
    }

    // ── Signatory ──
    const sigY = Math.max(y + 20, 248);
    doc.setDrawColor(160, 174, 192);
    doc.line(136, sigY, 196, sigY);
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.text('Authorized Signatory', 196, sigY + 5, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(compName, 196, sigY + 11, { align: 'right' });

    // ── Footer ──
    doc.setFontSize(7);
    doc.setTextColor(180, 180, 180);
    doc.text('This is a computer-generated document and does not require a physical signature.', 105, 290, { align: 'center' });

    return doc;
};

const Finance = () => {
    const { user } = useAuth();
    const toast = useToast();
    const confirm = useConfirm();
    const canEditAccounts = hasPermission(user, 'Accounts', 'edit');
    const canDeleteAccounts = hasPermission(user, 'Accounts', 'delete');
    const handleMarkBillPaid = async (bill) => {
        if (!(await confirm({ title: 'Mark as Paid', message: `Mark Bill ${bill.bill_no} as fully PAID?`, confirmText: 'Mark Paid' }))) return;
        try {
            await billingAPI.markPaid(bill.id, { collection_amount: bill.total_amount - (bill.collection_amount || 0) });
            loadData();
        } catch (err) {
            console.error('Failed to update status:', err);
            toast.error('Failed to update status. Please try again.');
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
    const [viewingPurchaseBill, setViewingPurchaseBill] = useState(null);
    const [viewingPayment, setViewingPayment] = useState(null);
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
    const [scBills, setScBills] = useState([]);
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
        } else if (!availableTabs.some(t => t.id === activeTab) && availableTabs.length > 0) {
            // If current active tab isn't in availableTabs (permission filtered), fall back to first available
            setActiveTab(availableTabs[0].id);
        }
    }, [urlTab, availableTabs, activeTab]);

    const handleTabChange = (tabId) => {
        setActiveTab(tabId);
        setSearchParams({ tab: tabId });
    };

    const [selectedProject, setSelectedProject] = useState('All Projects');

    const [paymentSearch, setPaymentSearch] = useState('');
    const [paymentPayee, setPaymentPayee] = useState('');
    const [paymentDateFrom, setPaymentDateFrom] = useState('');
    const [paymentDateTo, setPaymentDateTo] = useState('');

    const [ledgerType, setLedgerType] = useState('All'); // 'All', 'Client', 'Vendor'
    const [isDownloadDropdownOpen, setIsDownloadDropdownOpen] = useState(false);
    const [shareDropdownId, setShareDropdownId] = useState(null);
    const shareDropdownRef = useRef(null);

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
                fleetAPI.getTrips(),
                subcontractorBillingAPI.getAll()
            ]);

            setProjects(results[0].status === 'fulfilled' ? (results[0].value.data || []) : []);
            setPayables(results[1].status === 'fulfilled' ? (results[1].value.data || []) : []);
            setBills(results[2].status === 'fulfilled' ? (results[2].value.data || []) : []);
            setExpenses(results[3].status === 'fulfilled' ? (results[3].value.data || []) : []);
            setReceipts(results[4].status === 'fulfilled' ? (results[4].value.data || []) : []);
            setPurchaseBills(results[5].status === 'fulfilled' ? (results[5].value.data || []) : []);
            setTrips(results[6].status === 'fulfilled' ? (results[6].value.data || []) : []);
            setScBills(results[7].status === 'fulfilled' ? (results[7].value.data || []) : []);

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

    useEffect(() => {
        if (shareDropdownId === null) return;
        const handler = (e) => {
            if (shareDropdownRef.current && !shareDropdownRef.current.contains(e.target)) {
                setShareDropdownId(null);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [shareDropdownId]);

    const handleShareInvoice = async (bill, paymentStatus, collected, platform) => {
        const totalAmt = bill.total_amount || 0;
        const data = {
            no: bill.bill_no,
            date: bill.date,
            party: bill.project,
            project: bill.project,
            amount: totalAmt,
            base_amount: parseFloat(bill.amount || 0),
            gst_amount: parseFloat(bill.gst_amount || 0),
            gst_rate: bill.gst_rate || 0,
            status: paymentStatus,
            description: bill.description,
            due_date: bill.due_date,
            bill_type: bill.bill_type,
            collection_amount: collected
        };
        const doc = generateSalesInvoicePDF(data, companyInfo);
        const pdfBlob = doc.output('blob');
        const fileName = `Sales_Invoice_${bill.bill_no}.pdf`;
        const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });
        const summaryText = `Sales Invoice - ${bill.bill_no}\nProject: ${bill.project}\nBill Type: ${bill.bill_type || '-'}\nDate: ${bill.date ? new Date(bill.date).toLocaleDateString('en-IN') : '-'}\nTotal Amount: Rs. ${totalAmt.toLocaleString('en-IN')}\nStatus: ${paymentStatus}\n\n${companyInfo?.companyName || 'Civil ERP'}`;

        if (platform === 'whatsapp') {
            if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
                try { await navigator.share({ files: [pdfFile], title: `Sales Invoice ${bill.bill_no}`, text: summaryText }); }
                catch (e) { if (e.name !== 'AbortError') { doc.save(fileName); window.open(`https://wa.me/?text=${encodeURIComponent(summaryText)}`, '_blank'); } }
            } else {
                doc.save(fileName);
                window.open(`https://wa.me/?text=${encodeURIComponent(summaryText)}`, '_blank');
            }
        } else if (platform === 'email') {
            const subject = encodeURIComponent(`Sales Invoice - ${bill.bill_no} | ${bill.project}`);
            const body = encodeURIComponent(`Dear Sir/Madam,\n\nPlease find the sales invoice details below:\n\n${summaryText}\n\nKindly find the attached PDF for the complete invoice.\n\nRegards,\n${companyInfo?.companyName || 'Civil ERP'}`);
            if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
                try { await navigator.share({ files: [pdfFile], title: `Sales Invoice ${bill.bill_no}` }); }
                catch (e) { if (e.name !== 'AbortError') window.open(`mailto:?subject=${subject}&body=${body}`, '_blank'); }
            } else {
                window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
            }
        }
        setShareDropdownId(null);
    };

    const handleDownloadVoucher = (type, data) => {
        if (type === 'Sales Invoice') {
            const doc = generateSalesInvoicePDF(data, companyInfo);
            doc.save(`Sales_Invoice_${(data.no || 'invoice').replace(/\s+/g, '_')}.pdf`);
            return;
        }
        try {
            const doc = new jsPDF();
            const compName = companyInfo.companyName || 'CIVIL ERP';
            const compAddr = companyInfo.address || '';
            const compPhone = companyInfo.phone || '';
            const compEmail = companyInfo.email || '';
            const compGst = companyInfo.gst || companyInfo.gstin || '';

            // ── Header ──
            doc.setFillColor(30, 58, 138);
            doc.rect(0, 0, 210, 32, 'F');
            doc.setFontSize(18);
            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.text(compName, 14, 16);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            if (compAddr) doc.text(compAddr, 14, 23);
            if (compPhone || compEmail) doc.text([compPhone, compEmail].filter(Boolean).join(' | '), 14, 28);

            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text(type.toUpperCase(), 196, 16, { align: 'right' });
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`, 196, 23, { align: 'right' });
            if (compGst) doc.text(`GSTIN: ${compGst}`, 196, 28, { align: 'right' });

            // ── Details Section ──
            let y = 42;
            doc.setFontSize(10);
            const addRow = (label, value) => {
                if (!value) return;
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(100, 116, 139);
                doc.text(label, 14, y);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(30, 41, 59);
                doc.text(String(value), 60, y);
                y += 7;
            };

            addRow('Voucher No:', data.no);
            addRow('Date:', data.date ? new Date(data.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : null);
            addRow('Party/Vendor:', data.party);
            addRow('Project:', data.project);
            if (data.category) addRow('Category:', data.category);
            if (data.description) addRow('Description:', data.description);
            if (data.mode) addRow('Payment Mode:', data.mode);
            if (data.invoice_no) addRow('Invoice No:', data.invoice_no);

            y += 3;
            doc.setDrawColor(226, 232, 240);
            doc.line(14, y, 196, y);
            y += 8;

            // ── Items Table (if available) ──
            const items = data.items || [];
            if (items.length > 0) {
                doc.setFontSize(11);
                doc.setTextColor(30, 58, 138);
                doc.setFont('helvetica', 'bold');
                doc.text('Item Details', 14, y);
                y += 3;

                const hasRate = items.some(it => it.rate || it.price);
                const tableHead = hasRate
                    ? [['#', 'Material', 'Qty', 'Unit', 'Rate', 'Amount']]
                    : [['#', 'Material', 'Qty', 'Unit']];
                const tableBody = items.map((it, i) => {
                    const qty = parseFloat(it.qty || it.quantity || it.received_qty || it.po_qty || 0);
                    const rate = parseFloat(it.rate || it.price || 0);
                    const amt = qty * rate;
                    return hasRate
                        ? [i + 1, it.name || it.material_name || '', qty, it.unit || 'Nos', `Rs. ${rate.toLocaleString('en-IN')}`, `Rs. ${amt.toLocaleString('en-IN')}`]
                        : [i + 1, it.name || it.material_name || '', qty, it.unit || 'Nos'];
                });

                autoTable(doc, {
                    startY: y,
                    head: tableHead,
                    body: tableBody,
                    theme: 'grid',
                    headStyles: { fillColor: [59, 130, 246], textColor: 255, fontSize: 9, fontStyle: 'bold' },
                    bodyStyles: { fontSize: 9 },
                    columnStyles: hasRate ? {
                        0: { cellWidth: 10, halign: 'center' },
                        2: { cellWidth: 18, halign: 'center' },
                        3: { cellWidth: 18, halign: 'center' },
                        4: { cellWidth: 28, halign: 'right' },
                        5: { cellWidth: 30, halign: 'right' },
                    } : {
                        0: { cellWidth: 10, halign: 'center' },
                        2: { cellWidth: 20, halign: 'center' },
                        3: { cellWidth: 20, halign: 'center' },
                    },
                    margin: { left: 14, right: 14 },
                });
                y = (doc.lastAutoTable?.finalY || y) + 8;
            }

            // ── Amount Section ──
            if (y > 250) { doc.addPage(); y = 20; }
            doc.setDrawColor(226, 232, 240);
            doc.line(14, y, 196, y);
            y += 8;

            // Tax breakdown if available
            if (data.base_amount && data.base_amount !== data.amount) {
                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(100, 116, 139);
                doc.text('Base Amount:', 120, y);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(30, 41, 59);
                doc.text(`Rs. ${parseFloat(data.base_amount || 0).toLocaleString('en-IN')}`, 196, y, { align: 'right' });
                y += 6;
                if (data.gst_amount) {
                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(100, 116, 139);
                    doc.text('GST:', 120, y);
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(30, 41, 59);
                    doc.text(`Rs. ${parseFloat(data.gst_amount || 0).toLocaleString('en-IN')}`, 196, y, { align: 'right' });
                    y += 6;
                }
            }

            doc.setFontSize(13);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(30, 41, 59);
            doc.text('Total Amount:', 120, y);
            doc.setTextColor(16, 185, 129);
            doc.text(`Rs. ${parseFloat(data.amount || 0).toLocaleString('en-IN')}`, 196, y, { align: 'right' });

            y += 8;
            if (data.status) {
                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(100, 116, 139);
                doc.text('Status:', 120, y);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(data.status === 'Paid' ? 16 : 239, data.status === 'Paid' ? 185 : 68, data.status === 'Paid' ? 129 : 68);
                doc.text(data.status, 196, y, { align: 'right' });
            }

            // ── Signatory ──
            y = Math.min((doc.lastAutoTable?.finalY || y) + 30, 270);
            doc.setDrawColor(148, 163, 184);
            doc.line(140, y, 196, y);
            y += 5;
            doc.setFontSize(9);
            doc.setTextColor(30, 41, 59);
            doc.setFont('helvetica', 'bold');
            doc.text('Authorized Signatory', 196, y, { align: 'right' });
            y += 4;
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 116, 139);
            doc.text(compName, 196, y, { align: 'right' });

            // ── Footer ──
            doc.setFontSize(7);
            doc.setTextColor(180, 180, 180);
            doc.text('This is a computer-generated document and does not require a physical signature.', 105, 290, { align: 'center' });

            const fileName = `${type.replace(/\s+/g, '_')}_${(data.no || data.party || 'voucher').replace(/\s+/g, '_')}.pdf`;
            doc.save(fileName);
        } catch (err) {
            console.error('PDF generation error:', err);
            toast.error('Failed to generate PDF.');
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
            vendor: invoice.vendor,
            items: invoice.items,
            total_amount: invoice.total_amount,
            paid_amount: invoice.paid_amount,
            project: invoice.project
        });
        setIsHistoryModalOpen(true);
    };

    const handleExpenseRecorded = async (expenseData) => {
        try {
            await financeAPI.createExpense(expenseData);
            loadData(); // Refresh data
        } catch (err) {
            console.error('Error recording expense:', err);
            toast.error('Failed to record expense. Please try again.');
        }
    };

    const selectedProjectTrimmed = (selectedProject || 'All Projects').trim();
    const filteredPayables = (selectedProjectTrimmed === 'All Projects'
        ? payables
        : payables.filter(p => (p.project || '').trim() === selectedProjectTrimmed)
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
        const matchesProject = selectedProjectTrimmed === 'All Projects' || (pb.project_name || '').trim() === selectedProjectTrimmed;
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
        const matchesProject = selectedProjectTrimmed === 'All Projects' || (b.project || '').trim() === selectedProjectTrimmed;
        const matchesType = billTypeFilter === 'All Types' || b.bill_type === billTypeFilter;
        const matchesSearch = b.bill_no?.toLowerCase().includes(billSearch.toLowerCase()) ||
            b.project?.toLowerCase().includes(billSearch.toLowerCase()) ||
            b.description?.toLowerCase().includes(billSearch.toLowerCase());
        return matchesProject && matchesType && matchesSearch;
    });

    const filteredExpenses = (selectedProjectTrimmed === 'All Projects'
        ? expenses
        : expenses.filter(e => (e.project || '').trim() === selectedProjectTrimmed)
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
        const matchesPayee = !paymentPayee || (e.payee || '').toLowerCase() === paymentPayee.toLowerCase();

        return matchesSearch && matchesFrom && matchesTo && matchesPayee;
    });

    const filteredReceipts = selectedProjectTrimmed === 'All Projects'
        ? receipts
        : receipts.filter(r => (r.project || '').trim() === selectedProjectTrimmed);

    const billTypes = ['All Types', ...new Set(bills.map(b => b.bill_type).filter(Boolean))];

    const handleDownloadCSV = () => {
        const entries = getLedgerEntries();
        if (entries.length === 0) {
            toast.warning('No data to download');
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
                toast.warning('No data to download');
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
            toast.error(`PDF error: ${err.message}. Please use CSV download.`);
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

    const totalProjectValue = (selectedProjectTrimmed === 'All Projects' ? projects : projects.filter(p => (p.name || '').trim() === selectedProjectTrimmed))
        .reduce((s, p) => s + parseFloat(p.budget || 0), 0);
    const totalBilled = filteredBills.reduce((s, b) => s + (b.total_amount || 0), 0);
    const totalCollected = filteredBills.reduce((s, b) => s + (b.collection_amount || 0), 0);
    const totalPayableAmt = filteredPayables.reduce((s, p) => s + (p.amount || 0), 0);
    const scOutstanding = scBills.filter(sb => ['Approved', 'Partially Paid'].includes(sb.status))
        .filter(sb => selectedProjectTrimmed === 'All Projects' || (sb.project_name || '').trim() === selectedProjectTrimmed)
        .reduce((s, sb) => s + (sb.balance || 0), 0);
    const totalPurchases = filteredPayables.reduce((s, p) => s + (p.total_amount || 0), 0);

    // Outstanding from purchase bills (Pending/Partially Paid bills = vendor payables)
    const purchaseBillOutstanding = filteredPurchaseBills
        .filter(pb => ['Pending', 'Unpaid', 'Partially Paid'].includes(pb.status))
        .reduce((s, pb) => s + (pb.total_amount || 0), 0);

    // Purchase outstanding = total balance unpaid across all GRN-based vendor payables
    const purchaseOutstanding = filteredPayables
        .filter(p => (p.balance || 0) > 0)
        .reduce((s, p) => s + (p.balance || 0), 0);

    // Calculate 5% retention on total billed if not specifically tracked
    const totalRetention = filteredBills.reduce((s, b) => s + (b.retention_amount || (b.total_amount * 0.05)), 0);

    // Total expenses = all payments + purchase bills + SC bills
    const totalExpensesPaid = filteredExpenses.reduce((s, e) => s + (e.amount || 0), 0);
    const totalPurchaseBillAmt = filteredPurchaseBills.reduce((s, pb) => s + (pb.total_amount || 0), 0);
    const totalScBillAmt = scBills
        .filter(sb => selectedProjectTrimmed === 'All Projects' || (sb.project_name || '').trim() === selectedProjectTrimmed)
        .reduce((s, sb) => s + (sb.total_amount || sb.amount || 0), 0);

    // Fleet P&L from trips
    const filteredTrips = selectedProjectTrimmed === 'All Projects' ? trips : trips.filter(t => (t.projectName || '').trim() === selectedProjectTrimmed);
    const fleetRevenue = filteredTrips.reduce((s, t) => s + (t.totalRevenue || 0), 0);
    const fleetExpense = filteredTrips.reduce((s, t) => s + (t.totalExpense || 0), 0);
    const fleetProfit = fleetRevenue - fleetExpense;

    const totalAllExpenses = totalExpensesPaid + totalPurchaseBillAmt + totalScBillAmt;
    const totalIncome = totalBilled + fleetRevenue;
    const totalCosts = totalAllExpenses + fleetExpense;
    const profitLoss = totalIncome - totalCosts;

    const totalReceivables = Math.max(0, totalBilled - totalCollected);
    const totalPayables = purchaseBillOutstanding + purchaseOutstanding;

    const kpiCards = [
        { label: 'PROJECT VALUE', value: fmt(totalProjectValue), icon: FileText, color: '#3B82F6', bgColor: '#EFF6FF' },
        { label: 'TOTAL BILLED', value: fmt(totalBilled), icon: Receipt, color: '#6366F1', bgColor: '#EEF2FF' },
        { label: 'RECEIVABLES (AR)', value: fmt(totalReceivables), icon: AlertCircle, color: '#EF4444', bgColor: '#FEF2F2' },
        { label: 'PAYABLES (AP)', value: fmt(totalPayables), icon: AlertCircle, color: '#F59E0B', bgColor: '#FFFBEB' },
        { label: 'COLLECTION (MTD)', value: fmt(collectionThisMonth), icon: Calendar, color: '#0EA5E9', bgColor: '#F0F9FF' },
        { label: 'COLLECTION (TODAY)', value: fmt(collectionToday), icon: TrendingUp, color: '#10B981', bgColor: '#F0FDF4' },
        { label: 'PAYMENTS (MTD)', value: fmt(paymentsThisMonth), icon: ArrowDownRight, color: '#F43F5E', bgColor: '#FFF1F2' },
        { label: 'PAYMENTS (TODAY)', value: fmt(paymentsToday), icon: Clock, color: '#F59E0B', bgColor: '#FEF3C7' },
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
        // Add subcontractor names from SC bills
        scBills.forEach(sb => sb.contractor_name && set.add(sb.contractor_name.trim()));
        // Add expense payees from known vendors + subcontractor payments
        expenses.forEach(e => {
            if (e.payee && e.payee.trim()) {
                if (set.has(e.payee.trim()) || e.category === 'Subcontractor Payment' || e.sc_bill_id) {
                    set.add(e.payee.trim());
                }
            }
        });
        return [...set].sort();
    }, [payables, purchaseBills, expenses, scBills]);

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

        // ── 5. SUBCONTRACTOR BILLS (Approved SC bills) — Credit: amount owed to subcontractor ──
        if (showVendor) scBills.filter(sb => ['Approved', 'Partially Paid', 'Paid'].includes(sb.status) && matchesProject(sb.project_name)).forEach(sb => {
            const party = (sb.contractor_name || '').trim();
            if (!matchesParty(party)) return;
            entries.push({
                date: sb.bill_date || sb.created_at || new Date().toISOString(),
                type: 'SC Bill',
                particulars: `Subcontractor Bill - ${sb.bill_no} (${sb.bill_type === 'work_based' ? 'Work Based' : 'Day Based'})`,
                debit: 0,
                credit: parseFloat(sb.payable_amount) || 0,
                party,
                project: sb.project_name
            });
        });

        // ── 6. EXPENSES / PAYMENTS (Money paid out) — Debit: cash out ──
        if (showVendor) expenses.filter(e => matchesProject(e.project)).forEach(e => {
            const entryParty = e.payee || (e.grn_id ? (payables.find(p => p.id === e.grn_id)?.vendor || 'Vendor') : 'General Expense');
            if (!matchesParty(entryParty)) return;
            const amount = parseFloat(e.amount) || 0;
            if (amount === 0) return; // Skip ₹0 pending entries

            const desc = e.grn_id
                ? `Payment to ${entryParty} - ${payables.find(p => p.id === e.grn_id)?.voucher_no || 'Purchase'}`
                : `${e.category || 'Expense'}: ${e.description || 'Payment'}`;

            // Negative amount = credit (e.g., Material Transfer Out)
            entries.push({
                date: e.date || e.created_at || new Date().toISOString(),
                type: e.source === 'labour_salary' ? 'Labour' : (e.category?.includes('Transfer') ? 'Transfer' : (e.grn_id ? 'Payment' : 'Expense')),
                particulars: desc,
                debit: amount > 0 ? amount : 0,
                credit: amount < 0 ? Math.abs(amount) : 0,
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
                    </div>
                )}

                {/* ── Overview Tab ──────────────────────────────────────────────── */}
                {!loading && activeTab === 'Overview' && (
                    <div className="card animate-fade-in" style={{ padding: '32px' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '8px' }}>Project-wise Financial Summary</h3>
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>Breakdown of receivables and payables per project.</p>
                        <div style={{ overflowX: 'auto' }}>
                            <table className="data-table" style={{ width: '100%', minWidth: '700px' }}>
                                <thead>
                                    <tr>
                                        <th>Project</th>
                                        <th style={{ textAlign: 'right' }}>Total Billed</th>
                                        <th style={{ textAlign: 'right' }}>Collected</th>
                                        <th style={{ textAlign: 'right' }}>Outstanding</th>
                                        <th style={{ textAlign: 'right' }}>Expenses</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {projects.map(p => {
                                        const pName = p.name;
                                        const pBills = bills.filter(b => b.project === pName);
                                        const pExpenses = expenses.filter(e => e.project === pName);
                                        const billed = pBills.reduce((s, b) => s + (parseFloat(b.total_amount) || 0), 0);
                                        const collected = pBills.reduce((s, b) => s + (parseFloat(b.collection_amount) || 0), 0);
                                        const outstanding = Math.max(0, billed - collected);
                                        const exp = pExpenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
                                        return (
                                            <tr key={p.id || p._id}>
                                                <td style={{ fontWeight: 600 }}>{pName}</td>
                                                <td style={{ textAlign: 'right' }}>{fmt(billed)}</td>
                                                <td style={{ textAlign: 'right', color: '#10B981' }}>{fmt(collected)}</td>
                                                <td style={{ textAlign: 'right', color: outstanding > 0 ? '#EF4444' : 'var(--text-muted)' }}>{fmt(outstanding)}</td>
                                                <td style={{ textAlign: 'right' }}>{fmt(exp)}</td>
                                            </tr>
                                        );
                                    })}
                                    {projects.length === 0 && (
                                        <tr><td colSpan="5" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>No projects to display.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Profit & Loss Summary */}
                        <div style={{
                            marginTop: '24px', padding: '24px', borderRadius: '16px',
                            background: profitLoss >= 0
                                ? 'linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)'
                                : 'linear-gradient(135deg, #FEF2F2 0%, #FEE2E2 100%)',
                            border: `1.5px solid ${profitLoss >= 0 ? '#86EFAC' : '#FECACA'}`
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                                <div style={{
                                    width: '44px', height: '44px', borderRadius: '12px',
                                    backgroundColor: profitLoss >= 0 ? '#10B981' : '#EF4444',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white'
                                }}>
                                    {profitLoss >= 0 ? <TrendingUp size={22} /> : <ArrowDownRight size={22} />}
                                </div>
                                <div>
                                    <h4 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px' }}>
                                        Profit & Loss {selectedProject !== 'All Projects' ? `- ${selectedProject}` : '(All Projects)'}
                                    </h4>
                                    <div style={{ fontSize: '28px', fontWeight: '900', color: profitLoss >= 0 ? '#059669' : '#DC2626' }}>
                                        {profitLoss >= 0 ? '+' : ''}{fmt(profitLoss)}
                                    </div>
                                </div>
                            </div>
                            {/* Income Section */}
                            <div style={{ marginBottom: '16px' }}>
                                <p style={{ fontSize: '11px', fontWeight: '800', color: '#059669', textTransform: 'uppercase', marginBottom: '10px', letterSpacing: '0.5px' }}>Income</p>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                                    <div style={{ padding: '14px 16px', backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: '10px' }}>
                                        <p style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Project Billing</p>
                                        <p style={{ fontSize: '18px', fontWeight: '800', color: '#059669' }}>{fmt(totalBilled)}</p>
                                    </div>
                                    <div style={{ padding: '14px 16px', backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: '10px' }}>
                                        <p style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Fleet Revenue</p>
                                        <p style={{ fontSize: '18px', fontWeight: '800', color: '#059669' }}>{fmt(fleetRevenue)}</p>
                                    </div>
                                    <div style={{ padding: '14px 16px', backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
                                        <p style={{ fontSize: '11px', fontWeight: '700', color: '#059669', textTransform: 'uppercase', marginBottom: '4px' }}>Total Income</p>
                                        <p style={{ fontSize: '18px', fontWeight: '900', color: '#059669' }}>{fmt(totalIncome)}</p>
                                    </div>
                                </div>
                            </div>
                            {/* Expenses Section */}
                            <div>
                                <p style={{ fontSize: '11px', fontWeight: '800', color: '#DC2626', textTransform: 'uppercase', marginBottom: '10px', letterSpacing: '0.5px' }}>Expenses</p>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                                    <div style={{ padding: '14px 16px', backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: '10px' }}>
                                        <p style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Material / Purchase</p>
                                        <p style={{ fontSize: '18px', fontWeight: '800', color: '#DC2626' }}>{fmt(totalPurchaseBillAmt)}</p>
                                    </div>
                                    <div style={{ padding: '14px 16px', backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: '10px' }}>
                                        <p style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Payments / Expenses</p>
                                        <p style={{ fontSize: '18px', fontWeight: '800', color: '#DC2626' }}>{fmt(totalExpensesPaid)}</p>
                                    </div>
                                    <div style={{ padding: '14px 16px', backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: '10px' }}>
                                        <p style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Subcontractor Cost</p>
                                        <p style={{ fontSize: '18px', fontWeight: '800', color: '#DC2626' }}>{fmt(totalScBillAmt)}</p>
                                    </div>
                                    <div style={{ padding: '14px 16px', backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: '10px' }}>
                                        <p style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Fleet Expense</p>
                                        <p style={{ fontSize: '18px', fontWeight: '800', color: '#DC2626' }}>{fmt(fleetExpense)}</p>
                                    </div>
                                    <div style={{ padding: '14px 16px', backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: '10px', border: '1px solid #fecaca' }}>
                                        <p style={{ fontSize: '11px', fontWeight: '700', color: '#DC2626', textTransform: 'uppercase', marginBottom: '4px' }}>Total Expenses</p>
                                        <p style={{ fontSize: '18px', fontWeight: '900', color: '#DC2626' }}>{fmt(totalCosts)}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
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

                                        // Overdue logic + aging bucket
                                        let agingDays = null;
                                        let agingBucket = null;
                                        if (bill.due_date && paymentStatus !== 'Paid') {
                                            const due = new Date(bill.due_date);
                                            const today = new Date();
                                            const diffDays = Math.floor((today - due) / (1000 * 60 * 60 * 24));
                                            if (diffDays > 0) {
                                                paymentStatus = 'Overdue';
                                                agingDays = diffDays;
                                                if (diffDays <= 30) agingBucket = { label: '1-30d', color: '#F59E0B', bg: '#FFFBEB' };
                                                else if (diffDays <= 60) agingBucket = { label: '31-60d', color: '#EA580C', bg: '#FFF7ED' };
                                                else if (diffDays <= 90) agingBucket = { label: '61-90d', color: '#DC2626', bg: '#FEF2F2' };
                                                else agingBucket = { label: '90+d', color: '#991B1B', bg: '#FECACA' };
                                            }
                                        }

                                        return (
                                            <tr key={bill.id || i}>
                                                <td style={{ fontWeight: '800', color: 'var(--primary)' }}>{bill.bill_no}</td>
                                                <td style={{ fontSize: '13px' }}>
                                                    {bill.date ? new Date(bill.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                                </td>
                                                <td style={{ fontSize: '13px' }}>
                                                    {bill.due_date ? new Date(bill.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                                    {agingBucket && (
                                                        <span title={`${agingDays} days overdue`} style={{ marginLeft: '6px', display: 'inline-block', padding: '2px 6px', borderRadius: '8px', fontSize: '10px', fontWeight: '800', backgroundColor: agingBucket.bg, color: agingBucket.color }}>
                                                            {agingBucket.label}
                                                        </span>
                                                    )}
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
                                                <td style={{ width: '200px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }} ref={shareDropdownId === (bill.id || i) ? shareDropdownRef : null}>
                                                        <button
                                                            className="btn btn-outline btn-sm"
                                                            onClick={() => { setSelectedBill(bill); setIsBillDetailsOpen(true); }}
                                                            style={{ border: 'none', padding: '6px', background: 'transparent' }}
                                                            title="View"
                                                        >
                                                            <Eye size={18} color="#3B82F6" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDownloadVoucher('Sales Invoice', { no: bill.bill_no, date: bill.date, party: bill.project, project: bill.project, amount: totalAmt, base_amount: parseFloat(bill.amount || 0), gst_amount: parseFloat(bill.gst_amount || 0), gst_rate: bill.gst_rate || 0, status: paymentStatus, description: bill.description, due_date: bill.due_date, bill_type: bill.bill_type, collection_amount: collected })}
                                                            style={{ border: 'none', padding: '6px', background: 'transparent', cursor: 'pointer' }}
                                                            title="Download PDF"
                                                        >
                                                            <Download size={18} color="#10B981" />
                                                        </button>
                                                        {/* Share dropdown */}
                                                        <div style={{ position: 'relative' }}>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); setShareDropdownId(shareDropdownId === (bill.id || i) ? null : (bill.id || i)); }}
                                                                style={{ border: 'none', padding: '6px', background: 'transparent', cursor: 'pointer', borderRadius: '6px' }}
                                                                title="Share Invoice"
                                                            >
                                                                <Share2 size={18} color="#8B5CF6" />
                                                            </button>
                                                            {shareDropdownId === (bill.id || i) && (
                                                                <div style={{ position: 'absolute', top: '110%', right: 0, background: 'white', border: '1px solid #E2E8F0', borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 200, minWidth: '148px', padding: '6px', overflow: 'hidden' }}>
                                                                    <button
                                                                        onClick={() => handleShareInvoice(bill, paymentStatus, collected, 'whatsapp')}
                                                                        style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 10px', border: 'none', background: 'none', cursor: 'pointer', borderRadius: '6px', fontSize: '13px', fontWeight: '600', color: '#16A34A' }}
                                                                        onMouseEnter={e => e.currentTarget.style.background = '#F0FDF4'}
                                                                        onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                                                    >
                                                                        <MessageCircle size={14} /> WhatsApp
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleShareInvoice(bill, paymentStatus, collected, 'email')}
                                                                        style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 10px', border: 'none', background: 'none', cursor: 'pointer', borderRadius: '6px', fontSize: '13px', fontWeight: '600', color: '#2563EB' }}
                                                                        onMouseEnter={e => e.currentTarget.style.background = '#EFF6FF'}
                                                                        onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                                                    >
                                                                        <Mail size={14} /> Email
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                        {canEditAccounts && bill.status !== 'Paid' && (
                                                            <button
                                                                className="btn btn-primary"
                                                                style={{ fontSize: '10px', padding: '4px 8px', borderRadius: '4px' }}
                                                                onClick={() => handleMarkBillPaid(bill)}
                                                            >
                                                                Paid
                                                            </button>
                                                        )}
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
                                                <span className={`badge ${pb.status === 'Paid' ? 'badge-success' : pb.status === 'Partially Paid' ? 'badge-info' : pb.status === 'Draft' ? 'badge-secondary' : 'badge-warning'}`}>
                                                    {pb.status || 'Pending'}
                                                </span>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '4px' }}>
                                                    <button onClick={() => setViewingPurchaseBill(pb)} style={{ border: 'none', padding: '6px', background: 'transparent', cursor: 'pointer' }} title="View">
                                                        <Eye size={18} color="var(--primary)" />
                                                    </button>
                                                    <button onClick={() => handleDownloadVoucher('Purchase Bill', { no: pb.bill_no, date: pb.bill_date, party: pb.vendor_name, project: pb.project_name, amount: pb.total_amount, base_amount: pb.total_amount - (pb.tax_amount || 0), gst_amount: pb.tax_amount, items: pb.items, status: pb.status })} style={{ border: 'none', padding: '6px', background: 'transparent', cursor: 'pointer' }} title="Download">
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
                                                        <button onClick={() => handleDownloadVoucher('Purchase Voucher', { no: item.voucher_no, date: item.date, party: item.vendor, project: item.project, amount: totAmt, base_amount: item.base_amount, gst_amount: item.gst_amount, invoice_no: item.invoice_no, items: item.items, status: pStatus })} style={{ border: 'none', padding: '6px', background: 'transparent', cursor: 'pointer' }} title="Download">
                                                            <Download size={18} color="#10B981" />
                                                        </button>
                                                        {canEditAccounts && pStatus !== 'Paid' && (
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
                            <select
                                value={paymentPayee}
                                onChange={(e) => setPaymentPayee(e.target.value)}
                                style={{ padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #E2E8F0', fontSize: '13px', background: 'white', minWidth: '160px' }}
                            >
                                <option value="">All Parties</option>
                                {[...new Set(expenses.map(e => e.payee).filter(Boolean))].sort().map(p => (
                                    <option key={p} value={p}>{p}</option>
                                ))}
                            </select>
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
                                                <div style={{ display: 'flex', gap: '4px' }}>
                                                    <button onClick={() => setViewingPayment(exp)} style={{ border: 'none', padding: '6px', background: 'transparent', cursor: 'pointer' }} title="View">
                                                        <Eye size={18} color="var(--primary)" />
                                                    </button>
                                                    <button onClick={() => handleDownloadVoucher('Payment Voucher', { no: exp.voucher_no || exp.invoice_no, date: exp.date, party: exp.payee, project: exp.project, category: exp.category, description: exp.description, mode: exp.paymentMode, amount: exp.amount, base_amount: exp.base_amount, gst_amount: exp.gst_amount, invoice_no: exp.invoice_no, items: exp.items, status: 'Paid' })} style={{ border: 'none', padding: '6px', background: 'transparent', cursor: 'pointer' }} title="Download">
                                                        <Download size={18} color="var(--primary)" />
                                                    </button>
                                                </div>
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
                                            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16,
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
                                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
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
                onDownload={() => {
                    if (!selectedBill) return;
                    const totalAmt = selectedBill.total_amount || 0;
                    const collected = selectedBill.collection_amount || 0;
                    let paymentStatus = 'Pending';
                    if (collected >= totalAmt && totalAmt > 0) paymentStatus = 'Paid';
                    else if (collected > 0) paymentStatus = 'Partial';
                    if (selectedBill.due_date && new Date(selectedBill.due_date) < new Date() && paymentStatus !== 'Paid') paymentStatus = 'Overdue';
                    handleDownloadVoucher('Sales Invoice', { no: selectedBill.bill_no, date: selectedBill.date, party: selectedBill.project, project: selectedBill.project, amount: totalAmt, base_amount: parseFloat(selectedBill.amount || 0), gst_amount: parseFloat(selectedBill.gst_amount || 0), gst_rate: selectedBill.gst_rate || 0, status: paymentStatus, description: selectedBill.description, due_date: selectedBill.due_date, bill_type: selectedBill.bill_type, collection_amount: collected });
                }}
                onShare={(platform) => {
                    if (!selectedBill) return;
                    const totalAmt = selectedBill.total_amount || 0;
                    const collected = selectedBill.collection_amount || 0;
                    let paymentStatus = 'Pending';
                    if (collected >= totalAmt && totalAmt > 0) paymentStatus = 'Paid';
                    else if (collected > 0) paymentStatus = 'Partial';
                    if (selectedBill.due_date && new Date(selectedBill.due_date) < new Date() && paymentStatus !== 'Paid') paymentStatus = 'Overdue';
                    handleShareInvoice(selectedBill, paymentStatus, collected, platform);
                }}
            />
            <PurchaseBillModal
                isOpen={isPurchaseBillModalOpen}
                onClose={() => setIsPurchaseBillModalOpen(false)}
                onSuccess={loadData}
            />

            {/* Payment View Modal */}
            {viewingPayment && (
                <div className="modal-overlay" onClick={() => setViewingPayment(null)}>
                    <div className="card animate-fade-in" style={{ width: '600px', maxWidth: '95vw', maxHeight: '88vh', overflowY: 'auto', padding: '32px', position: 'relative' }} onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                            <div>
                                <h3 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-main)', marginBottom: '4px' }}>Payment Details</h3>
                                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Vendor & Expense Record</p>
                            </div>
                            <button onClick={() => setViewingPayment(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', color: 'var(--text-muted)', lineHeight: 1 }}>&times;</button>
                        </div>

                        {/* Info Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px', padding: '20px', backgroundColor: '#f8fafc', borderRadius: '12px' }}>
                            <div>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Date</span>
                                <p style={{ fontWeight: '700', fontSize: '14px' }}>
                                    {viewingPayment.date ? new Date(viewingPayment.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                </p>
                            </div>
                            <div>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Category</span>
                                <span style={{ background: '#F3F4F6', padding: '3px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '700' }}>{viewingPayment.category || '—'}</span>
                            </div>
                            <div>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Paid To</span>
                                <p style={{ fontWeight: '700', fontSize: '14px', color: 'var(--primary)' }}>{viewingPayment.payee || '—'}</p>
                            </div>
                            <div>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Project</span>
                                <p style={{ fontWeight: '700', fontSize: '14px' }}>{viewingPayment.project || '—'}</p>
                            </div>
                            {viewingPayment.paymentMode && (
                                <div>
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Payment Mode</span>
                                    <p style={{ fontWeight: '600', fontSize: '13px' }}>{viewingPayment.paymentMode}</p>
                                </div>
                            )}
                            {(viewingPayment.voucher_no || viewingPayment.invoice_no) && (
                                <div>
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Reference No</span>
                                    <p style={{ fontWeight: '600', fontSize: '13px' }}>{viewingPayment.voucher_no || viewingPayment.invoice_no}</p>
                                </div>
                            )}
                        </div>

                        {/* Description */}
                        {viewingPayment.description && (
                            <div style={{ marginBottom: '20px' }}>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Description</span>
                                <p style={{ fontSize: '14px', color: 'var(--text-main)', padding: '12px 16px', backgroundColor: '#f8fafc', borderRadius: '8px', lineHeight: '1.5' }}>{viewingPayment.description}</p>
                            </div>
                        )}

                        {/* Items table if available */}
                        {viewingPayment.items && viewingPayment.items.length > 0 && (
                            <div style={{ marginBottom: '20px' }}>
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', display: 'block', marginBottom: '10px' }}>Items</span>
                                <table className="data-table" style={{ fontSize: '13px' }}>
                                    <thead>
                                        <tr>
                                            <th style={{ padding: '10px 12px' }}>#</th>
                                            <th style={{ padding: '10px 12px' }}>Item</th>
                                            <th style={{ padding: '10px 12px', textAlign: 'center' }}>Qty</th>
                                            <th style={{ padding: '10px 12px', textAlign: 'right' }}>Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {viewingPayment.items.map((item, idx) => (
                                            <tr key={idx}>
                                                <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{idx + 1}</td>
                                                <td style={{ padding: '10px 12px', fontWeight: '600' }}>{item.name || item.description}</td>
                                                <td style={{ padding: '10px 12px', textAlign: 'center' }}>{item.qty || item.quantity || '—'}</td>
                                                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700' }}>{fmt(item.amount || 0)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Amount Summary */}
                        <div style={{ borderTop: '2px solid var(--border)', paddingTop: '16px', marginBottom: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <div style={{ minWidth: '260px' }}>
                                    {viewingPayment.base_amount > 0 && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '14px' }}>
                                            <span style={{ color: 'var(--text-muted)' }}>Base Amount</span>
                                            <span style={{ fontWeight: '600' }}>{fmt(viewingPayment.base_amount)}</span>
                                        </div>
                                    )}
                                    {viewingPayment.gst_amount > 0 && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '14px' }}>
                                            <span style={{ color: 'var(--text-muted)' }}>GST / Tax</span>
                                            <span style={{ fontWeight: '600' }}>{fmt(viewingPayment.gst_amount)}</span>
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontSize: '18px', borderTop: '1px solid var(--border)', marginTop: '4px' }}>
                                        <span style={{ fontWeight: '800' }}>Total Paid</span>
                                        <span style={{ fontWeight: '800', color: '#EF4444' }}>{fmt(viewingPayment.amount || 0)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer actions */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                            <button className="btn btn-outline" onClick={() => { handleDownloadVoucher('Payment Voucher', { no: viewingPayment.voucher_no || viewingPayment.invoice_no, date: viewingPayment.date, party: viewingPayment.payee, project: viewingPayment.project, category: viewingPayment.category, description: viewingPayment.description, mode: viewingPayment.paymentMode, amount: viewingPayment.amount, base_amount: viewingPayment.base_amount, gst_amount: viewingPayment.gst_amount, invoice_no: viewingPayment.invoice_no, items: viewingPayment.items, status: 'Paid' }); }} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 20px' }}>
                                <Download size={16} /> Download
                            </button>
                            <button className="btn btn-outline" onClick={() => setViewingPayment(null)} style={{ padding: '10px 24px' }}>Close</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Purchase Bill View Modal */}
            {viewingPurchaseBill && (
                <div className="modal-overlay" onClick={() => setViewingPurchaseBill(null)}>
                    <div className="card animate-fade-in" style={{ width: '680px', maxWidth: '95vw', maxHeight: '88vh', overflowY: 'auto', padding: '32px', position: 'relative' }} onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                            <div>
                                <h3 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-main)', marginBottom: '4px' }}>Purchase Bill</h3>
                                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Vendor Invoice Details</p>
                            </div>
                            <button onClick={() => setViewingPurchaseBill(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', color: 'var(--text-muted)', lineHeight: 1 }}>&times;</button>
                        </div>

                        {/* Bill Info Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px', padding: '20px', backgroundColor: '#f8fafc', borderRadius: '12px' }}>
                            <div>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Bill No</span>
                                <p style={{ fontWeight: '800', fontSize: '16px', color: 'var(--primary)' }}>{viewingPurchaseBill.bill_no}</p>
                            </div>
                            <div>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Bill Date</span>
                                <p style={{ fontWeight: '700', fontSize: '14px' }}>{viewingPurchaseBill.bill_date ? new Date(viewingPurchaseBill.bill_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</p>
                            </div>
                            <div>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Vendor</span>
                                <p style={{ fontWeight: '700', fontSize: '14px' }}>{viewingPurchaseBill.vendor_name}</p>
                            </div>
                            <div>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Project</span>
                                <p style={{ fontWeight: '700', fontSize: '14px' }}>{viewingPurchaseBill.project_name}</p>
                            </div>
                            <div>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Status</span>
                                <span className={`badge ${viewingPurchaseBill.status === 'Paid' ? 'badge-success' : viewingPurchaseBill.status === 'Partially Paid' ? 'badge-info' : viewingPurchaseBill.status === 'Draft' ? 'badge-secondary' : 'badge-warning'}`}>
                                    {viewingPurchaseBill.status || 'Pending'}
                                </span>
                            </div>
                            {viewingPurchaseBill.grn_id && (
                                <div>
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>GRN Reference</span>
                                    <p style={{ fontWeight: '600', fontSize: '13px' }}>{viewingPurchaseBill.grn_id}</p>
                                </div>
                            )}
                        </div>

                        {/* Items Table */}
                        {viewingPurchaseBill.items && viewingPurchaseBill.items.length > 0 && (
                            <div style={{ marginBottom: '24px' }}>
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', display: 'block', marginBottom: '10px' }}>Items ({viewingPurchaseBill.items.length})</span>
                                <table className="data-table" style={{ fontSize: '13px' }}>
                                    <thead>
                                        <tr>
                                            <th style={{ padding: '10px 12px' }}>#</th>
                                            <th style={{ padding: '10px 12px' }}>Item</th>
                                            <th style={{ padding: '10px 12px', textAlign: 'center' }}>Qty</th>
                                            <th style={{ padding: '10px 12px', textAlign: 'right' }}>Rate</th>
                                            <th style={{ padding: '10px 12px', textAlign: 'right' }}>GST %</th>
                                            <th style={{ padding: '10px 12px', textAlign: 'right' }}>Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {viewingPurchaseBill.items.map((item, idx) => (
                                            <tr key={idx}>
                                                <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{idx + 1}</td>
                                                <td style={{ padding: '10px 12px', fontWeight: '600' }}>{item.name}</td>
                                                <td style={{ padding: '10px 12px', textAlign: 'center' }}>{item.qty}</td>
                                                <td style={{ padding: '10px 12px', textAlign: 'right' }}>{fmt(item.rate || 0)}</td>
                                                <td style={{ padding: '10px 12px', textAlign: 'right' }}>{item.gst || 0}%</td>
                                                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700' }}>{fmt(item.amount || 0)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Totals */}
                        <div style={{ borderTop: '2px solid var(--border)', paddingTop: '16px', marginBottom: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <div style={{ minWidth: '260px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '14px' }}>
                                        <span style={{ color: 'var(--text-muted)' }}>Subtotal</span>
                                        <span style={{ fontWeight: '600' }}>{fmt((viewingPurchaseBill.total_amount || 0) - (viewingPurchaseBill.tax_amount || 0))}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '14px' }}>
                                        <span style={{ color: 'var(--text-muted)' }}>GST / Tax</span>
                                        <span style={{ fontWeight: '600' }}>{fmt(viewingPurchaseBill.tax_amount || 0)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontSize: '16px', borderTop: '1px solid var(--border)', marginTop: '4px' }}>
                                        <span style={{ fontWeight: '800' }}>Total Amount</span>
                                        <span style={{ fontWeight: '800', color: 'var(--primary)' }}>{fmt(viewingPurchaseBill.total_amount || 0)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Notes */}
                        {viewingPurchaseBill.notes && (
                            <div style={{ padding: '12px 16px', backgroundColor: '#eff6ff', borderRadius: '10px', borderLeft: '4px solid #3b82f6', marginBottom: '20px', fontSize: '13px', color: '#1e40af' }}>
                                <strong>Notes:</strong> {viewingPurchaseBill.notes}
                            </div>
                        )}

                        {/* Footer actions */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                            <button className="btn btn-outline" onClick={() => { handleDownloadVoucher('Purchase Bill', { no: viewingPurchaseBill.bill_no, date: viewingPurchaseBill.bill_date, party: viewingPurchaseBill.vendor_name, project: viewingPurchaseBill.project_name, amount: viewingPurchaseBill.total_amount, base_amount: viewingPurchaseBill.total_amount - (viewingPurchaseBill.tax_amount || 0), gst_amount: viewingPurchaseBill.tax_amount, items: viewingPurchaseBill.items, status: viewingPurchaseBill.status }); }} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 20px' }}>
                                <Download size={16} /> Download
                            </button>
                            <button className="btn btn-outline" onClick={() => setViewingPurchaseBill(null)} style={{ padding: '10px 24px' }}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};


export default Finance;

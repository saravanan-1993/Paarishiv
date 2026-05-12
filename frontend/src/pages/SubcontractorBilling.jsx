import React, { useState, useEffect, useMemo } from 'react';
import {
    FileText, Plus, Search, Eye, Trash2, BookOpen, IndianRupee,
    Clock, CheckCircle, XCircle, AlertCircle, CreditCard,
    Loader2, Send, Filter, Wallet, Edit2
} from 'lucide-react';
import { subcontractorBillingAPI, vendorAPI, projectAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { hasPermission } from '../utils/rbac';
import SubcontractorBillModal from '../components/SubcontractorBillModal';
import MBookViewModal from '../components/MBookViewModal';
import SubcontractorPaymentModal from '../components/SubcontractorPaymentModal';
import SubcontractorAdvanceModal from '../components/SubcontractorAdvanceModal';
import Pagination from '../components/Pagination';
import { fmt } from '../utils/format';

const PAGE_SIZE = 20;

const statusConfig = {
    'Draft': { bg: '#F3F4F6', color: '#374151', label: 'Draft' },
    'Pending Approval': { bg: '#FEF3C7', color: '#92400E', label: 'Pending Approval' },
    'Approved': { bg: '#D1FAE5', color: '#065F46', label: 'Approved' },
    'Rejected': { bg: '#FEE2E2', color: '#991B1B', label: 'Rejected' },
    'Partially Paid': { bg: '#DBEAFE', color: '#1E40AF', label: 'Partially Paid' },
    'Paid': { bg: '#D1FAE5', color: '#047857', label: 'Paid' },
};

const typeConfig = {
    'work_based': { bg: '#EDE9FE', color: '#5B21B6', label: 'Work Based' },
    'day_based': { bg: '#FEF3C7', color: '#92400E', label: 'Day Based' },
};

const advanceStatusConfig = {
    'Active': { bg: '#DBEAFE', color: '#1E40AF', label: 'Active' },
    'Partially Adjusted': { bg: '#FEF3C7', color: '#92400E', label: 'Partially Adjusted' },
    'Closed': { bg: '#D1FAE5', color: '#065F46', label: 'Closed' },
    'Refunded': { bg: '#F3F4F6', color: '#374151', label: 'Refunded' },
};


const SubcontractorBilling = () => {
    const { user } = useAuth();
    const toast = useToast();
    const confirm = useConfirm();
    const canEdit = hasPermission(user, 'Subcontractor Billing', 'edit');
    const canDelete = hasPermission(user, 'Subcontractor Billing', 'delete');

    const [bills, setBills] = useState([]);
    const [advances, setAdvances] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('Bills');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterProject, setFilterProject] = useState('');
    const [filterContractor, setFilterContractor] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [projects, setProjects] = useState([]);

    // Modals
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showMBookModal, setShowMBookModal] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showAdvanceModal, setShowAdvanceModal] = useState(false);
    const [selectedBill, setSelectedBill] = useState(null);
    const [editBill, setEditBill] = useState(null);
    const [editAdvance, setEditAdvance] = useState(null);

    // Pagination
    const [billsPage, setBillsPage] = useState(1);
    const [advancesPage, setAdvancesPage] = useState(1);
    useEffect(() => { setBillsPage(1); setAdvancesPage(1); }, [searchTerm, filterProject, filterContractor, filterStatus, activeTab]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [billsRes, projectsRes, advancesRes] = await Promise.all([
                subcontractorBillingAPI.getAll(),
                projectAPI.getAll(),
                subcontractorBillingAPI.getAdvances(),
            ]);
            setBills(billsRes.data || []);
            setProjects(projectsRes.data || []);
            setAdvances(advancesRes.data || []);
        } catch (err) {
            console.error('Failed to load subcontractor billing data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const filteredBills = useMemo(() => {
        return bills.filter(b => {
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                if (
                    !(b.bill_no || '').toLowerCase().includes(term) &&
                    !(b.contractor_name || '').toLowerCase().includes(term)
                ) return false;
            }
            if (filterProject && b.project_name !== filterProject) return false;
            if (filterContractor && b.contractor_name !== filterContractor) return false;
            if (filterStatus && b.status !== filterStatus) return false;
            return true;
        });
    }, [bills, searchTerm, filterProject, filterContractor, filterStatus]);

    const summary = useMemo(() => {
        const filtered = filterContractor ? bills.filter(b => b.contractor_name === filterContractor) : bills;
        const advFiltered = filterContractor ? advances.filter(a => a.contractor_name === filterContractor) : advances;
        return {
            total: filtered.length,
            pending: filtered.filter(b => b.status === 'Pending Approval').length,
            totalPayable: filtered.reduce((s, b) => s + (b.payable_amount || 0), 0),
            totalPaid: filtered.reduce((s, b) => s + (b.paid_amount || 0), 0),
            outstanding: filtered.reduce((s, b) => s + (b.balance || 0), 0),
            advanceOutstanding: advFiltered.reduce((s, a) => s + (a.outstanding_balance || 0), 0),
        };
    }, [bills, advances, filterContractor]);

    const filteredAdvances = useMemo(() => {
        return advances.filter(a => {
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                if (
                    !(a.advance_no || '').toLowerCase().includes(term) &&
                    !(a.contractor_name || '').toLowerCase().includes(term)
                ) return false;
            }
            if (filterProject && a.project_name !== filterProject) return false;
            if (filterContractor && a.contractor_name !== filterContractor) return false;
            if (filterStatus && a.status !== filterStatus) return false;
            return true;
        });
    }, [advances, searchTerm, filterProject, filterContractor, filterStatus]);

    const handleSubmitForApproval = async (bill) => {
        if (!(await confirm({ title: 'Submit for Approval', message: `Submit Bill ${bill.bill_no} for approval?`, confirmText: 'Submit' }))) return;
        try {
            await subcontractorBillingAPI.submit(bill.id);
            loadData();
        } catch (err) {
            console.error('Failed to submit bill:', err);
            toast.error('Failed to submit bill for approval. Please try again.');
        }
    };

    const handleDeleteBill = async (bill) => {
        if (!(await confirm({ title: 'Delete Bill', message: `Are you sure you want to delete Bill ${bill.bill_no}? This action cannot be undone.`, confirmText: 'Delete', danger: true }))) return;
        try {
            await subcontractorBillingAPI.delete(bill.id);
            loadData();
            toast.success(`Bill ${bill.bill_no} deleted`);
        } catch (err) {
            console.error('Failed to delete bill:', err);
            toast.error('Failed to delete bill. Please try again.');
        }
    };

    const handleEditBill = (bill) => {
        setEditBill(bill);
        setShowCreateModal(true);
    };

    const handleEditAdvance = (adv) => {
        setEditAdvance(adv);
        setShowAdvanceModal(true);
    };

    const handleDeleteAdvance = async (adv) => {
        if (!(await confirm({ title: 'Delete Advance', message: `Delete advance ${adv.advance_no} (Rs.${(adv.amount || 0).toLocaleString('en-IN')})? Only unused advances can be deleted.`, confirmText: 'Delete', danger: true }))) return;
        try {
            await subcontractorBillingAPI.deleteAdvance(adv.id);
            toast.success(`Advance ${adv.advance_no} deleted`);
            loadData();
        } catch (err) {
            toast.error(err?.response?.data?.detail || 'Failed to delete advance');
        }
    };

    const handleAdvanceModalClose = () => {
        setShowAdvanceModal(false);
        setEditAdvance(null);
    };

    const handleAdvanceModalSuccess = () => {
        handleAdvanceModalClose();
        loadData();
    };

    const handleOpenMBook = (bill) => {
        setSelectedBill(bill);
        setShowMBookModal(true);
    };

    const handleOpenPayment = (bill) => {
        setSelectedBill(bill);
        setShowPaymentModal(true);
    };

    const handleModalClose = () => {
        setShowCreateModal(false);
        setEditBill(null);
    };

    const handleModalSuccess = () => {
        handleModalClose();
        loadData();
    };

    const renderStatusBadge = (status) => {
        const config = statusConfig[status] || { bg: '#F3F4F6', color: '#374151', label: status };
        return (
            <span style={{
                padding: '4px 10px',
                borderRadius: '20px',
                fontSize: '11px',
                fontWeight: '700',
                backgroundColor: config.bg,
                color: config.color,
                whiteSpace: 'nowrap',
            }}>
                {config.label}
            </span>
        );
    };

    const renderTypeBadge = (type) => {
        const config = typeConfig[type] || { bg: '#F3F4F6', color: '#374151', label: type };
        return (
            <span style={{
                padding: '4px 10px',
                borderRadius: '20px',
                fontSize: '11px',
                fontWeight: '700',
                backgroundColor: config.bg,
                color: config.color,
                whiteSpace: 'nowrap',
            }}>
                {config.label}
            </span>
        );
    };

    const uniqueProjects = useMemo(() => {
        const names = [...new Set(bills.map(b => b.project_name).filter(Boolean))];
        return names.sort();
    }, [bills]);

    const uniqueContractors = useMemo(() => {
        const names = [...new Set(bills.map(b => b.contractor_name).filter(Boolean))];
        return names.sort();
    }, [bills]);

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
                <Loader2 size={36} className="spin" style={{ color: 'var(--primary)' }} />
            </div>
        );
    }

    return (
        <div className="animate-fade-in">
            {/* Header */}
            <div style={{ marginBottom: '24px' }}>
                <h1 style={{ fontSize: '24px', fontWeight: '900', color: 'var(--text-main)', marginBottom: '4px' }}>
                    Subcontractor Billing
                </h1>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                    Manage subcontractor bills, M-Book entries & payments
                </p>
            </div>

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                {[
                    { label: 'Total Bills', value: summary.total, icon: FileText, color: '#3B82F6' },
                    { label: 'Pending Approval', value: summary.pending, icon: Clock, color: '#F59E0B' },
                    { label: 'Total Payable', value: fmt(summary.totalPayable), icon: IndianRupee, color: '#6366F1' },
                    { label: 'Advance Outstanding', value: fmt(summary.advanceOutstanding), icon: Wallet, color: '#0EA5E9' },
                    { label: 'Bill Outstanding', value: fmt(summary.outstanding), icon: AlertCircle, color: '#F97316' },
                ].map((card, i) => (
                    <div key={i} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px', justifyContent: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{
                                width: '36px', height: '36px', borderRadius: '10px',
                                backgroundColor: `${card.color}15`, color: card.color,
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <card.icon size={18} />
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                {card.label}
                            </div>
                        </div>
                        <div style={{ fontSize: '20px', fontWeight: '900', color: 'var(--text-main)', marginTop: '4px' }}>
                            {card.value}
                        </div>
                    </div>
                ))}
            </div>

            {/* Tab Buttons */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                {['Bills', 'Advances'].map(tab => (
                    <button
                        key={tab}
                        className={`btn ${activeTab === tab ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => setActiveTab(tab)}
                        style={{ fontWeight: '700' }}
                    >
                        {tab === 'Bills' ? <FileText size={16} /> : <Wallet size={16} />}
                        {tab}
                    </button>
                ))}
            </div>

            {/* Filters Row */}
            <div className="card" style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: '12px', flex: '1 1 auto', minWidth: '280px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ position: 'relative', flex: '2 1 260px', minWidth: '240px', maxWidth: '360px' }}>
                            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                            <input
                                type="text"
                                placeholder="Search by Bill No or Contractor..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{ width: '100%', padding: '10px 40px 10px 40px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px', boxSizing: 'border-box' }}
                            />
                            {searchTerm && (
                                <button type="button" onClick={() => setSearchTerm('')} aria-label="Clear search" style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', display: 'flex', alignItems: 'center' }}>
                                    <XCircle size={15} />
                                </button>
                            )}
                        </div>
                        <select
                            value={filterProject}
                            onChange={(e) => setFilterProject(e.target.value)}
                            style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px', flex: '0 1 180px', minWidth: '150px', maxWidth: '200px' }}
                        >
                            <option value="">All Projects</option>
                            {uniqueProjects.map(p => (
                                <option key={p} value={p}>{p}</option>
                            ))}
                        </select>
                        <select
                            value={filterContractor}
                            onChange={(e) => setFilterContractor(e.target.value)}
                            style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px', flex: '0 1 180px', minWidth: '150px', maxWidth: '200px' }}
                        >
                            <option value="">All Contractors</option>
                            {uniqueContractors.map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px', flex: '0 1 180px', minWidth: '150px', maxWidth: '200px' }}
                        >
                            <option value="">All Statuses</option>
                            {Object.keys(activeTab === 'Advances' ? advanceStatusConfig : statusConfig).map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                        {(searchTerm || filterProject || filterContractor || filterStatus) && (
                            <button
                                className="btn btn-outline btn-sm"
                                onClick={() => { setSearchTerm(''); setFilterProject(''); setFilterContractor(''); setFilterStatus(''); }}
                            >
                                Clear
                            </button>
                        )}
                    </div>
                    {activeTab === 'Bills' && canEdit && (
                        <button
                            className="btn btn-primary"
                            onClick={() => { setEditBill(null); setShowCreateModal(true); }}
                        >
                            <Plus size={18} /> Create Bill
                        </button>
                    )}
                    {activeTab === 'Advances' && canEdit && (
                        <button
                            className="btn btn-primary"
                            onClick={() => { setEditAdvance(null); setShowAdvanceModal(true); }}
                        >
                            <Plus size={18} /> Give Advance
                        </button>
                    )}
                </div>
            </div>

            {/* Bills Tab */}
            {activeTab === 'Bills' && (
                <div className="card" style={{ padding: 0 }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Bill No</th>
                                <th>Contractor</th>
                                <th>Project</th>
                                <th>Type</th>
                                <th>Amount</th>
                                <th>Status</th>
                                <th>Date</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredBills.length === 0 ? (
                                <tr>
                                    <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                            <FileText size={32} style={{ opacity: 0.3 }} />
                                            <div>No bills found</div>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredBills.slice((billsPage - 1) * PAGE_SIZE, billsPage * PAGE_SIZE).map((bill) => (
                                    <tr key={bill.id || bill._id}>
                                        <td style={{ fontWeight: '700', color: 'var(--primary)' }}>{bill.bill_no}</td>
                                        <td>
                                            <div style={{ fontWeight: '600' }}>{bill.contractor_name}</div>
                                        </td>
                                        <td>
                                            <div style={{ fontSize: '13px' }}>{bill.project_name}</div>
                                        </td>
                                        <td>{renderTypeBadge(bill.bill_type)}</td>
                                        <td style={{ fontWeight: '700' }}>{fmt(bill.payable_amount || bill.amount || 0)}</td>
                                        <td>{renderStatusBadge(bill.status)}</td>
                                        <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                            {(bill.bill_date || bill.created_at) ? new Date(bill.bill_date || bill.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                                <button
                                                    className="btn btn-outline btn-sm"
                                                    style={{ padding: '4px 8px' }}
                                                    title="View / Edit"
                                                    onClick={() => handleEditBill(bill)}
                                                >
                                                    <Eye size={14} />
                                                </button>
                                                <button
                                                    className="btn btn-outline btn-sm"
                                                    style={{ padding: '4px 8px' }}
                                                    title="M-Book"
                                                    onClick={() => handleOpenMBook(bill)}
                                                >
                                                    <BookOpen size={14} />
                                                </button>
                                                {canEdit && bill.status === 'Draft' && (
                                                    <button
                                                        className="btn btn-primary btn-sm"
                                                        style={{ padding: '4px 8px', fontSize: '11px' }}
                                                        title="Submit for Approval"
                                                        onClick={() => handleSubmitForApproval(bill)}
                                                    >
                                                        <Send size={14} />
                                                    </button>
                                                )}
                                                {canEdit && (bill.status === 'Approved' || bill.status === 'Partially Paid') && (
                                                    <button
                                                        className="btn btn-primary btn-sm"
                                                        style={{ padding: '4px 8px', fontSize: '11px', backgroundColor: '#10B981', borderColor: '#10B981' }}
                                                        title="Record Payment"
                                                        onClick={() => handleOpenPayment(bill)}
                                                    >
                                                        <CreditCard size={14} />
                                                    </button>
                                                )}
                                                {canDelete && bill.status === 'Draft' && (
                                                    <button
                                                        className="btn btn-outline btn-sm"
                                                        style={{ padding: '4px 8px', color: '#EF4444', borderColor: '#EF4444' }}
                                                        title="Delete"
                                                        onClick={() => handleDeleteBill(bill)}
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                    <div style={{ padding: '0 16px' }}>
                        <Pagination
                            currentPage={billsPage}
                            totalItems={filteredBills.length}
                            pageSize={PAGE_SIZE}
                            onPageChange={setBillsPage}
                        />
                    </div>
                </div>
            )}

            {/* Advances Tab */}
            {activeTab === 'Advances' && (
                <div className="card" style={{ padding: 0 }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Advance No</th>
                                <th>Contractor</th>
                                <th>Project</th>
                                <th>Date</th>
                                <th style={{ textAlign: 'right' }}>Given</th>
                                <th style={{ textAlign: 'right' }}>Adjusted</th>
                                <th style={{ textAlign: 'right' }}>Outstanding</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredAdvances.length === 0 ? (
                                <tr>
                                    <td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                            <Wallet size={32} style={{ opacity: 0.3 }} />
                                            <div>No advances recorded yet</div>
                                            {canEdit && (
                                                <button className="btn btn-outline btn-sm" style={{ marginTop: '8px' }} onClick={() => { setEditAdvance(null); setShowAdvanceModal(true); }}>
                                                    <Plus size={14} /> Give First Advance
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredAdvances.slice((advancesPage - 1) * PAGE_SIZE, advancesPage * PAGE_SIZE).map((adv) => {
                                    const cfg = advanceStatusConfig[adv.status] || { bg: '#F3F4F6', color: '#374151', label: adv.status };
                                    const canEditAdv = (adv.adjusted_amount || 0) === 0 && adv.status === 'Active';
                                    return (
                                        <tr key={adv.id || adv._id}>
                                            <td style={{ fontWeight: '700', color: 'var(--primary)' }}>{adv.advance_no}</td>
                                            <td style={{ fontWeight: '600' }}>{adv.contractor_name}</td>
                                            <td style={{ fontSize: '13px' }}>{adv.project_name}</td>
                                            <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                                {adv.payment_date ? new Date(adv.payment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                                            </td>
                                            <td style={{ textAlign: 'right', fontWeight: '700' }}>{fmt(adv.amount)}</td>
                                            <td style={{ textAlign: 'right', color: '#10B981', fontWeight: '600' }}>{fmt(adv.adjusted_amount)}</td>
                                            <td style={{ textAlign: 'right', color: (adv.outstanding_balance || 0) > 0 ? '#F97316' : '#94A3B8', fontWeight: '700' }}>{fmt(adv.outstanding_balance)}</td>
                                            <td>
                                                <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', backgroundColor: cfg.bg, color: cfg.color, whiteSpace: 'nowrap' }}>
                                                    {cfg.label}
                                                </span>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '6px' }}>
                                                    {canEdit && canEditAdv && (
                                                        <button
                                                            className="btn btn-outline btn-sm"
                                                            style={{ padding: '4px 8px' }}
                                                            title="Edit Advance"
                                                            onClick={() => handleEditAdvance(adv)}
                                                        >
                                                            <Edit2 size={14} />
                                                        </button>
                                                    )}
                                                    {canDelete && canEditAdv && (
                                                        <button
                                                            className="btn btn-outline btn-sm"
                                                            style={{ padding: '4px 8px', color: '#EF4444', borderColor: '#EF4444' }}
                                                            title="Delete Advance"
                                                            onClick={() => handleDeleteAdvance(adv)}
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                    <div style={{ padding: '0 16px' }}>
                        <Pagination
                            currentPage={advancesPage}
                            totalItems={filteredAdvances.length}
                            pageSize={PAGE_SIZE}
                            onPageChange={setAdvancesPage}
                        />
                    </div>
                </div>
            )}

            {/* Modals */}
            {showCreateModal && (
                <SubcontractorBillModal
                    isOpen={showCreateModal}
                    onClose={handleModalClose}
                    onSuccess={handleModalSuccess}
                    editData={editBill}
                    projects={projects}
                />
            )}

            {showMBookModal && selectedBill && (
                <MBookViewModal
                    isOpen={showMBookModal}
                    onClose={() => { setShowMBookModal(false); setSelectedBill(null); }}
                    bill={selectedBill}
                />
            )}

            {showPaymentModal && selectedBill && (
                <SubcontractorPaymentModal
                    isOpen={showPaymentModal}
                    onClose={() => { setShowPaymentModal(false); setSelectedBill(null); }}
                    onSuccess={() => { setShowPaymentModal(false); setSelectedBill(null); loadData(); }}
                    bill={selectedBill}
                />
            )}

            {showAdvanceModal && (
                <SubcontractorAdvanceModal
                    isOpen={showAdvanceModal}
                    onClose={handleAdvanceModalClose}
                    onSuccess={handleAdvanceModalSuccess}
                    projects={projects}
                    contractors={uniqueContractors}
                    editData={editAdvance}
                />
            )}
        </div>
    );
};

export default SubcontractorBilling;

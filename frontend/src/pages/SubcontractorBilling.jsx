import React, { useState, useEffect, useMemo } from 'react';
import {
    FileText, Plus, Search, Eye, Trash2, BookOpen, IndianRupee,
    Clock, CheckCircle, XCircle, AlertCircle, CreditCard,
    Loader2, Send, Filter
} from 'lucide-react';
import { subcontractorBillingAPI, vendorAPI, projectAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { hasPermission } from '../utils/rbac';
import SubcontractorBillModal from '../components/SubcontractorBillModal';
import MBookViewModal from '../components/MBookViewModal';
import SubcontractorPaymentModal from '../components/SubcontractorPaymentModal';

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

const fmt = (n) => {
    if (!n && n !== 0) return '\u20B90';
    if (n >= 10000000) return `\u20B9${(n / 10000000).toFixed(2)} Cr`;
    if (n >= 100000) return `\u20B9${(n / 100000).toFixed(2)} L`;
    return `\u20B9${Number(n).toLocaleString('en-IN')}`;
};

const SubcontractorBilling = () => {
    const { user } = useAuth();
    const canEdit = hasPermission(user, 'Subcontractor Billing', 'edit');
    const canDelete = hasPermission(user, 'Subcontractor Billing', 'delete');

    const [bills, setBills] = useState([]);
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
    const [selectedBill, setSelectedBill] = useState(null);
    const [editBill, setEditBill] = useState(null);

    const loadData = async () => {
        setLoading(true);
        try {
            const [billsRes, projectsRes] = await Promise.all([
                subcontractorBillingAPI.getAll(),
                projectAPI.getAll()
            ]);
            setBills(billsRes.data || []);
            setProjects(projectsRes.data || []);
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
        return {
            total: filtered.length,
            pending: filtered.filter(b => b.status === 'Pending Approval').length,
            totalPayable: filtered.reduce((s, b) => s + (b.payable_amount || 0), 0),
            totalPaid: filtered.reduce((s, b) => s + (b.paid_amount || 0), 0),
            outstanding: filtered.reduce((s, b) => s + (b.balance || 0), 0),
        };
    }, [bills, filterContractor]);

    const allPayments = useMemo(() => {
        const payments = [];
        bills.forEach(bill => {
            if (bill.payments && Array.isArray(bill.payments)) {
                bill.payments.forEach(p => {
                    payments.push({
                        ...p,
                        bill_no: bill.bill_no,
                        contractor_name: bill.contractor_name,
                        project_name: bill.project_name,
                    });
                });
            }
        });
        payments.sort((a, b) => new Date(b.date || b.created_at) - new Date(a.date || a.created_at));
        return payments;
    }, [bills]);

    const filteredPayments = useMemo(() => {
        return allPayments.filter(p => {
            if (filterProject && p.project_name !== filterProject) return false;
            if (filterContractor && p.contractor_name !== filterContractor) return false;
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                if (!(p.bill_no || '').toLowerCase().includes(term) &&
                    !(p.contractor_name || '').toLowerCase().includes(term)) return false;
            }
            return true;
        });
    }, [allPayments, filterProject, filterContractor, searchTerm]);

    const handleSubmitForApproval = async (bill) => {
        if (!window.confirm(`Submit Bill ${bill.bill_no} for approval?`)) return;
        try {
            await subcontractorBillingAPI.submit(bill.id);
            loadData();
        } catch (err) {
            console.error('Failed to submit bill:', err);
            alert('Failed to submit bill for approval. Please try again.');
        }
    };

    const handleDeleteBill = async (bill) => {
        if (!window.confirm(`Are you sure you want to delete Bill ${bill.bill_no}? This action cannot be undone.`)) return;
        try {
            await subcontractorBillingAPI.delete(bill.id);
            loadData();
        } catch (err) {
            console.error('Failed to delete bill:', err);
            alert('Failed to delete bill. Please try again.');
        }
    };

    const handleEditBill = (bill) => {
        setEditBill(bill);
        setShowCreateModal(true);
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '24px' }}>
                {[
                    { label: 'Total Bills', value: summary.total, icon: FileText, color: '#3B82F6' },
                    { label: 'Pending Approval', value: summary.pending, icon: Clock, color: '#F59E0B' },
                    { label: 'Total Payable', value: fmt(summary.totalPayable), icon: IndianRupee, color: '#6366F1' },
                    { label: 'Total Paid', value: fmt(summary.totalPaid), icon: CheckCircle, color: '#10B981' },
                    { label: 'Outstanding', value: fmt(summary.outstanding), icon: AlertCircle, color: '#F97316' },
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
                {['Bills', 'Payments'].map(tab => (
                    <button
                        key={tab}
                        className={`btn ${activeTab === tab ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => setActiveTab(tab)}
                        style={{ fontWeight: '700' }}
                    >
                        {tab === 'Bills' ? <FileText size={16} /> : <CreditCard size={16} />}
                        {tab}
                    </button>
                ))}
            </div>

            {/* Filters Row */}
            <div className="card" style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: '12px', flex: 1, minWidth: '200px', alignItems: 'center' }}>
                        <div style={{ position: 'relative', flex: 1, maxWidth: '320px' }}>
                            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input
                                type="text"
                                placeholder="Search by Bill No or Contractor..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{ width: '100%', padding: '10px 12px 10px 40px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px' }}
                            />
                        </div>
                        <select
                            value={filterProject}
                            onChange={(e) => setFilterProject(e.target.value)}
                            style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px', minWidth: '160px' }}
                        >
                            <option value="">All Projects</option>
                            {uniqueProjects.map(p => (
                                <option key={p} value={p}>{p}</option>
                            ))}
                        </select>
                        <select
                            value={filterContractor}
                            onChange={(e) => setFilterContractor(e.target.value)}
                            style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px', minWidth: '160px' }}
                        >
                            <option value="">All Contractors</option>
                            {uniqueContractors.map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px', minWidth: '160px' }}
                        >
                            <option value="">All Statuses</option>
                            {Object.keys(statusConfig).map(s => (
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
                                filteredBills.map((bill) => (
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
                </div>
            )}

            {/* Payments Tab */}
            {activeTab === 'Payments' && (
                <div className="card" style={{ padding: 0 }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Bill No</th>
                                <th>Contractor</th>
                                <th>Project</th>
                                <th>Amount</th>
                                <th>Mode</th>
                                <th>Reference</th>
                                <th>Recorded By</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredPayments.length === 0 ? (
                                <tr>
                                    <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                            <CreditCard size={32} style={{ opacity: 0.3 }} />
                                            <div>No payments recorded yet</div>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredPayments.map((payment, idx) => (
                                    <tr key={idx}>
                                        <td style={{ fontSize: '12px' }}>
                                            {payment.date ? new Date(payment.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                                        </td>
                                        <td style={{ fontWeight: '700', color: 'var(--primary)' }}>{payment.bill_no}</td>
                                        <td style={{ fontWeight: '600' }}>{payment.contractor_name}</td>
                                        <td>{payment.project_name}</td>
                                        <td style={{ fontWeight: '700', color: '#10B981' }}>{fmt(payment.amount)}</td>
                                        <td>
                                            <span style={{
                                                padding: '3px 8px',
                                                borderRadius: '20px',
                                                fontSize: '11px',
                                                fontWeight: '600',
                                                backgroundColor: '#F3F4F6',
                                                color: '#374151',
                                            }}>
                                                {payment.mode || payment.payment_mode || '-'}
                                            </span>
                                        </td>
                                        <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{payment.reference || payment.reference_no || '-'}</td>
                                        <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{payment.recorded_by || payment.created_by || '-'}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
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
        </div>
    );
};

export default SubcontractorBilling;

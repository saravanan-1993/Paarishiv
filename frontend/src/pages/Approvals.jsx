import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    CheckCircle, XCircle, Clock, Package,
    ShoppingCart, User, FileText, Loader2, RefreshCw, Eye, CreditCard,
    Search, Filter, ChevronDown, Download
} from 'lucide-react';
import { approvalsAPI } from '../utils/api';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuth } from '../context/AuthContext';
import PODetailModal from '../components/PODetailModal';
import MaterialRequestDetailModal from '../components/MaterialRequestDetailModal';

const Approvals = () => {
    const { user } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const urlTab = searchParams.get('tab');
    const [activeTab, setActiveTab] = useState('leaves');
    const userRole = (user?.role || '').toLowerCase();
    const canApprovePO = ['super admin', 'administrator', 'general manager', 'manager'].includes(userRole);

    const tabMapping = useMemo(() => ({
        'Leaves': 'leaves',
        'Purchase Orders': 'purchase_orders',
        'Materials': 'materials',
        'Expenses': 'expenses',
        'Manpower': 'manpower',
        'DPR': 'dprs'
    }), []);

    useEffect(() => {
        if (urlTab) {
            const internalTab = tabMapping[urlTab] || urlTab.toLowerCase();
            if (Object.values(tabMapping).includes(internalTab)) {
                setActiveTab(internalTab);
            }
        }
    }, [urlTab, tabMapping]);

    const handleTabChange = (tabId) => {
        // Find the label for the URL or just use the ID if already normalized
        const label = Object.keys(tabMapping).find(key => tabMapping[key] === tabId) || tabId;
        setActiveTab(tabId);
        setSearchParams({ tab: label });
    };
    const [activeStatusTab, setActiveStatusTab] = useState('Pending'); // "Pending" or "All"
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState('All'); // the dropdown filter for History
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const filterRef = React.useRef(null);

    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(null);
    const [bulkLoading, setBulkLoading] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);
    const [selectedPO, setSelectedPO] = useState(null);
    const [selectedMaterial, setSelectedMaterial] = useState(null);
    const [data, setData] = useState({
        leaves: [],
        purchase_orders: [],
        materials: [],
        expenses: [],
        manpower: [],
        dprs: [],
        subcontractor_bills: [],
        labour_payments: []
    });

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await approvalsAPI.getAll(activeStatusTab);
            setData({
                leaves: res.data.leaves || [],
                purchase_orders: res.data.purchase_orders || [],
                materials: res.data.materials || [],
                expenses: res.data.expenses || [],
                manpower: res.data.manpower || [],
                dprs: res.data.dprs || [],
                subcontractor_bills: res.data.subcontractor_bills || [],
                labour_payments: res.data.labour_payments || []
            });
        } catch (error) {
            console.error('Error fetching pending approvals:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        setFilterStatus('All');
        setSearchQuery('');
        setIsFilterOpen(false);
    }, [activeStatusTab]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (filterRef.current && !filterRef.current.contains(event.target)) {
                setIsFilterOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleExportPDF = () => {
        if (filteredData.length === 0) return;
        const doc = new jsPDF();
        doc.setFontSize(18); doc.text(`Approvals - ${activeTab.replace('_', ' ')}`, 14, 20);
        doc.setFontSize(10); doc.text(`Status: ${activeStatusTab} | Generated: ${new Date().toLocaleString()}`, 14, 28);

        let headers = [['#', 'Name/Project', 'Type', 'Status', 'Date']];
        let body = filteredData.map((item, i) => [
            i + 1,
            item.employee_name || item.employeeName || item.project_name || item.projectName || item.vendor_name || item.category || 'N/A',
            activeTab.replace('_', ' '),
            item.status || 'Pending',
            item.created_at || item.fromDate || item.date || ''
        ]);
        autoTable(doc, { startY: 34, head: headers, body, theme: 'grid', headStyles: { fillColor: [59, 130, 246] }, styles: { fontSize: 9 } });
        doc.save(`Approvals_${activeTab}_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    const handleBulkApprove = async () => {
        if (selectedIds.length === 0) return;
        if (!window.confirm(`Approve ${selectedIds.length} selected items?`)) return;
        setBulkLoading(true);
        try {
            for (const id of selectedIds) {
                await approvalsAPI.action(activeTab, id, 'approve', {});
            }
            setSelectedIds([]);
            await fetchData();
        } catch (err) {
            console.error('Bulk approve error:', err);
            alert('Some items failed to approve');
        }
        setBulkLoading(false);
    };

    const toggleSelect = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const toggleSelectAll = () => {
        const pendingItems = filteredData.filter(i => i.status === 'Pending' || !i.status);
        const pendingIds = pendingItems.map(i => i._id || i.id);
        if (selectedIds.length === pendingIds.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(pendingIds);
        }
    };

    const handleAction = async (type, id, action) => {
        let payload = {};
        if (action === 'reject') {
            const reason = window.prompt("Optional: Enter a reason for rejection:");
            if (reason === null) return;
            if (reason.trim()) payload.reason = reason.trim();
        }

        setActionLoading(`${id}-${action}`);
        try {
            await approvalsAPI.action(type, id, action, payload);
            setData(prev => ({
                ...prev,
                [type]: prev[type].filter(item => item._id !== id && item.id !== id)
            }));
            const label = type === 'labour_payments' ? 'Labour Payment' : type === 'subcontractor_bills' ? 'SC Bill' : type.replace('_', ' ');
            alert(`${label} ${action === 'approve' ? 'approved' : 'rejected'} successfully. Notification sent.`);
        } catch (error) {
            console.error('Error performing action:', error);
            const detail = error.response?.data?.detail;
            alert(typeof detail === 'string' ? detail : 'Failed to process approval.');
        } finally {
            setActionLoading(null);
        }
    };

    const tabs = [
        { id: 'leaves', label: 'Leaves', count: data.leaves?.length || 0, icon: User, color: '#3b82f6' },
        { id: 'purchase_orders', label: 'Purchase Orders', count: data.purchase_orders?.length || 0, icon: ShoppingCart, color: '#8b5cf6' },
        { id: 'materials', label: 'Materials', count: data.materials?.length || 0, icon: Package, color: '#f59e0b' },
        { id: 'expenses', label: 'Expenses', count: data.expenses?.length || 0, icon: CreditCard, color: '#ec4899' },
        { id: 'manpower', label: 'Manpower', count: data.manpower?.length || 0, icon: User, color: '#10b981' },
        { id: 'dprs', label: 'DPR', count: data.dprs?.length || 0, icon: FileText, color: '#6366f1' },
        { id: 'subcontractor_bills', label: 'SC Bills', count: data.subcontractor_bills?.length || 0, icon: FileText, color: '#0891b2' },
        { id: 'labour_payments', label: 'Labour Pay', count: data.labour_payments?.length || 0, icon: FileText, color: '#7C3AED' },
    ];

    const handleDprAction = async (dpr, action) => {
        // Bug 4.7 - DPR uses project_id:dpr_id format
        const compositeId = `${dpr.project_id}:${dpr.id}`;
        let payload = {};
        if (action === 'reject') {
            const reason = window.prompt("Optional: Enter a reason for rejection:");
            if (reason === null) return;
            if (reason.trim()) payload.reason = reason.trim();
        }
        setActionLoading(`${dpr.id}-${action}`);
        try {
            await approvalsAPI.action('dprs', compositeId, action, payload);
            await fetchData();
        } catch (error) {
            console.error('Error performing DPR action:', error);
            alert(error?.response?.data?.detail || 'Failed to process DPR approval.');
        } finally {
            setActionLoading(null);
        }
    };

    const filteredData = (data[activeTab] || []).filter(item => {
        // Bug 7.1 - Apply status filter regardless of active tab
        if (filterStatus !== 'All') {
            const currentStatus = item.status || 'Pending';
            if (currentStatus !== filterStatus) return false;
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            const textToSearch = [
                item.employee_name, item.employeeName, item.leave_type, item.reason,
                item.po_number, item.vendorName, item.vendor_name,
                item.projectName, item.project_name, item.category,
                item.description, item.payee, item.remarks,
                item.submitted_by, item.date, item.progress
            ].filter(Boolean).join(' ').toLowerCase();

            if (!textToSearch.includes(q)) return false;
        }

        return true;
    });

    const renderLeaveCard = (item) => (
        <div key={item._id} style={{
            background: 'white', borderRadius: '16px', padding: '24px',
            border: selectedIds.includes(item._id) ? '2px solid #10b981' : '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
            marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '16px'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    {item.status === 'Pending' && activeStatusTab === 'Pending' && (
                        <input type="checkbox" checked={selectedIds.includes(item._id)} onChange={() => toggleSelect(item._id)}
                            style={{ width: '18px', height: '18px', accentColor: '#10b981', cursor: 'pointer' }} />
                    )}
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>
                        <User size={24} />
                    </div>
                    <div>
                        <h4 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: 0 }}>{item.employee_name || item.employeeName || 'Employee Leave'}</h4>
                        <p style={{ color: '#64748b', fontSize: '13px', margin: '4px 0 0 0', fontWeight: '600' }}>Type: {item.leave_type || item.leaveType}</p>
                    </div>
                </div>
                <div style={{ padding: '6px 12px', borderRadius: '8px', background: item.status === 'Pending' ? '#fef3c7' : (item.status === 'Approved' ? '#dcfce7' : '#fee2e2'), color: item.status === 'Pending' ? '#b45309' : (item.status === 'Approved' ? '#166534' : '#991b1b'), fontSize: '12px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Clock size={14} /> {item.status}
                </div>
            </div>
            <div style={{ marginTop: '8px', display: 'flex', gap: '16px' }}>
                <p style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>Requested By: {item.employee_name || item.employeeName || 'Employee'}</p>
                {item.status !== 'Pending' && item.approvedBy && (
                    <p style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>Approved By: {item.approvedBy}</p>
                )}
            </div>

            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px' }}>
                <div style={{ display: 'flex', gap: '24px', marginBottom: '12px' }}>
                    <div>
                        <p style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700', marginBottom: '4px' }}>From Date</p>
                        <p style={{ fontSize: '14px', fontWeight: '700', color: '#334155' }}>{item.start_date || item.fromDate}</p>
                    </div>
                    <div>
                        <p style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700', marginBottom: '4px' }}>To Date</p>
                        <p style={{ fontSize: '14px', fontWeight: '700', color: '#334155' }}>{item.end_date || item.toDate}</p>
                    </div>
                    <div>
                        <p style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700', marginBottom: '4px' }}>Duration</p>
                        <p style={{ fontSize: '14px', fontWeight: '800', color: '#3b82f6' }}>{item.total_days || item.duration || (item.fromDate && item.toDate ? Math.ceil((new Date(item.toDate) - new Date(item.fromDate)) / (1000 * 60 * 60 * 24)) + 1 : 'N/A')} Day(s)</p>
                    </div>
                </div>
                <div>
                    <p style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700', marginBottom: '4px' }}>Reason</p>
                    <p style={{ fontSize: '14px', color: '#334155', lineHeight: '1.5' }}>{item.reason || 'No reason provided.'}</p>
                </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                {item.status === 'Pending' && (
                    <>
                        <button
                            onClick={() => handleAction('leaves', item._id, 'reject')}
                            disabled={actionLoading}
                            style={{ padding: '10px 20px', borderRadius: '12px', border: '1px solid #fca5a5', background: '#fef2f2', color: '#ef4444', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                            {actionLoading === `${item._id}-reject` ? <Loader2 size={18} className="animate-spin" /> : <XCircle size={18} />} Reject
                        </button>
                        <button
                            onClick={() => handleAction('leaves', item._id, 'approve')}
                            disabled={actionLoading}
                            style={{ padding: '10px 24px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)' }}
                        >
                            {actionLoading === `${item._id}-approve` ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />} Approve Leave
                        </button>
                    </>
                )}
            </div>
        </div>
    );

    const renderPOCard = (item) => (
        <div key={item._id} style={{
            background: 'white', borderRadius: '16px', padding: '24px',
            border: selectedIds.includes(item._id) ? '2px solid #10b981' : '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
            marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '16px'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    {item.status === 'Pending' && activeStatusTab === 'Pending' && (
                        <input type="checkbox" checked={selectedIds.includes(item._id)} onChange={() => toggleSelect(item._id)}
                            style={{ width: '18px', height: '18px', accentColor: '#10b981', cursor: 'pointer' }} />
                    )}
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#f3e8ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b5cf6' }}>
                        <ShoppingCart size={24} />
                    </div>
                    <div>
                        <h4 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: 0 }}>PO #{item.po_number || item._id.slice(-6).toUpperCase()}</h4>
                        <p style={{ color: '#64748b', fontSize: '13px', margin: '4px 0 0 0', fontWeight: '600' }}>Vendor: {item.vendorName || item.vendor_name || 'N/A'}</p>
                    </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                    <div style={{ padding: '6px 12px', borderRadius: '8px', background: item.status === 'Pending' ? '#fef3c7' : (item.status === 'Approved' ? '#dcfce7' : '#fee2e2'), color: item.status === 'Pending' ? '#b45309' : (item.status === 'Approved' ? '#166534' : '#991b1b'), fontSize: '12px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Clock size={14} /> {item.status}
                    </div>
                    <span style={{ fontSize: '20px', fontWeight: '900', color: '#0f172a' }}>
                        ₹{(item.totalAmount || item.total_amount || (item.items || []).reduce((acc, curr) => acc + ((curr.qty || curr.quantity || 0) * (curr.rate || curr.price || 0)), 0)).toLocaleString()}
                    </span>
                </div>
            </div>

            <div style={{ marginTop: '-4px', display: 'flex', gap: '16px' }}>
                <p style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>Requested By: Procurement Admin</p>
                {item.status !== 'Pending' && item.approvedBy && (
                    <p style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>Approved By: {item.approvedBy}</p>
                )}
            </div>

            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px' }}>
                <p style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700', marginBottom: '8px' }}>Line Items ({item.items?.length || 0})</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {(item.items || []).slice(0, 3).map((li, idx) => {
                        const rate = li.rate || li.price || 0;
                        const qty = li.qty || li.quantity || 0;
                        const total = li.total || (qty * rate);
                        return (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px' }}>
                                <span style={{ fontWeight: '600', color: '#334155' }}>{li.name || li.itemName || li.item_name || 'Item'} (x{qty})</span>
                                <span style={{ fontWeight: '700', color: '#64748b' }}>₹{total.toLocaleString()}</span>
                            </div>
                        )
                    })}
                    {item.items?.length > 3 && (
                        <div style={{ fontSize: '12px', color: '#8b5cf6', fontWeight: '700', textAlign: 'center', marginTop: '4px' }}>
                            + {item.items.length - 3} more items
                        </div>
                    )}
                </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                <button
                    onClick={() => setSelectedPO({ ...item, id: item._id })}
                    style={{ padding: '10px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'white', color: '#475569', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                    <Eye size={18} /> View Details
                </button>
                {item.status === 'Pending' && canApprovePO && (
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button
                            onClick={() => handleAction('purchase_orders', item._id, 'reject')}
                            disabled={actionLoading}
                            style={{ padding: '10px 20px', borderRadius: '12px', border: '1px solid #fca5a5', background: '#fef2f2', color: '#ef4444', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                            {actionLoading === `${item._id}-reject` ? <Loader2 size={18} className="animate-spin" /> : <XCircle size={18} />} Reject
                        </button>
                        <button
                            onClick={() => handleAction('purchase_orders', item._id, 'approve')}
                            disabled={actionLoading}
                            style={{ padding: '10px 24px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)' }}
                        >
                            {actionLoading === `${item._id}-approve` ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />} Authorize PO
                        </button>
                    </div>
                )}
            </div>
        </div>
    );

    const renderMaterialCard = (item) => (
        <div key={item._id} style={{
            background: 'white', borderRadius: '16px', padding: '24px',
            border: selectedIds.includes(item._id) ? '2px solid #10b981' : '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
            marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '16px'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    {item.status === 'Pending' && activeStatusTab === 'Pending' && (
                        <input type="checkbox" checked={selectedIds.includes(item._id)} onChange={() => toggleSelect(item._id)}
                            style={{ width: '18px', height: '18px', accentColor: '#10b981', cursor: 'pointer' }} />
                    )}
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b' }}>
                        <Package size={24} />
                    </div>
                    <div>
                        <h4 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: 0 }}>Material Request</h4>
                        <p style={{ color: '#64748b', fontSize: '13px', margin: '4px 0 0 0', fontWeight: '600' }}>Project: {item.projectName || item.project_name || 'N/A'}</p>
                    </div>
                </div>
                <div style={{ padding: '6px 12px', borderRadius: '8px', background: item.status === 'Pending' ? '#fef3c7' : (item.status === 'Approved' ? '#dcfce7' : '#fee2e2'), color: item.status === 'Pending' ? '#b45309' : (item.status === 'Approved' ? '#166534' : '#991b1b'), fontSize: '12px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Clock size={14} /> {item.status}
                </div>
            </div>

            <div style={{ marginTop: '0px', display: 'flex', gap: '16px', marginBottom: '16px' }}>
                <p style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>Requested By: {item.engineer_id || item.requested_by || item.submitted_by || 'Site Engineer'}</p>
                {item.status !== 'Pending' && item.approvedBy && (
                    <p style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>Approved By: {item.approvedBy}</p>
                )}
            </div>

            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px' }}>
                <p style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700', marginBottom: '8px' }}>Requested Items</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {(item.requested_items || item.items || []).slice(0, 3).map((li, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px' }}>
                            <span style={{ fontWeight: '600', color: '#334155' }}>{li.name || li.itemName || li.item_name}</span>
                            <span style={{ fontWeight: '800', color: '#0f172a', background: '#e2e8f0', padding: '2px 8px', borderRadius: '4px' }}>{li.quantity || li.qty} {li.unit}</span>
                        </div>
                    ))}
                    {(item.requested_items || item.items || []).length > 3 && (
                        <div style={{ fontSize: '12px', color: '#8b5cf6', fontWeight: '700', textAlign: 'center', marginTop: '4px' }}>
                            + {(item.requested_items || item.items || []).length - 3} more items
                        </div>
                    )}
                </div>
                {item.remarks && (
                    <div style={{ marginTop: '12px' }}>
                        <p style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700', marginBottom: '4px' }}>Remarks</p>
                        <p style={{ fontSize: '13px', color: '#334155' }}>{item.remarks}</p>
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                <button
                    onClick={() => setSelectedMaterial(item)}
                    style={{ padding: '10px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'white', color: '#475569', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                    <Eye size={18} /> View Details
                </button>
                {item.status === 'Pending' && (
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button
                            onClick={() => handleAction('materials', item._id, 'reject')}
                            disabled={actionLoading}
                            style={{ padding: '10px 20px', borderRadius: '12px', border: '1px solid #fca5a5', background: '#fef2f2', color: '#ef4444', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                            {actionLoading === `${item._id}-reject` ? <Loader2 size={18} className="animate-spin" /> : <XCircle size={18} />} Reject
                        </button>
                        <button
                            onClick={() => handleAction('materials', item._id, 'approve')}
                            disabled={actionLoading}
                            style={{ padding: '10px 24px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)' }}
                        >
                            {actionLoading === `${item._id}-approve` ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />} Approve Request
                        </button>
                    </div>
                )}
            </div>
        </div>
    );

    const renderManpowerCard = (item) => (
        <div key={item._id} style={{
            background: 'white', borderRadius: '16px', padding: '24px',
            border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
            marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '16px'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    {item.status === 'Pending' && activeStatusTab === 'Pending' && (
                        <input type="checkbox" checked={selectedIds.includes(item._id)} onChange={() => toggleSelect(item._id)}
                            style={{ width: '18px', height: '18px', accentColor: '#10b981', cursor: 'pointer' }} />
                    )}
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                        <User size={24} />
                    </div>
                    <div>
                        <h4 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: 0 }}>Workforce Request</h4>
                        <p style={{ color: '#64748b', fontSize: '13px', margin: '4px 0 0 0', fontWeight: '600' }}>Project: {item.projectName || item.project_name || 'N/A'}</p>
                    </div>
                </div>
                <div style={{ padding: '6px 12px', borderRadius: '8px', background: item.status === 'Pending' ? '#fef3c7' : (item.status === 'Approved' ? '#dcfce7' : '#fee2e2'), color: item.status === 'Pending' ? '#b45309' : (item.status === 'Approved' ? '#166534' : '#991b1b'), fontSize: '12px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Clock size={14} /> {item.status}
                </div>
            </div>

            <div style={{ marginTop: '0px', display: 'flex', gap: '16px', marginBottom: '16px' }}>
                <p style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>Requested By: Site Engineer</p>
                {item.status !== 'Pending' && item.approvedBy && (
                    <p style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>Approved By: {item.approvedBy}</p>
                )}
            </div>

            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px' }}>
                <p style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700', marginBottom: '8px' }}>Resource Requirements</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {(item.requested_items || []).map((li, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px' }}>
                            <span style={{ fontWeight: '600', color: '#334155' }}>{li.role || li.category}</span>
                            <span style={{ fontWeight: '800', color: '#0f172a', background: '#e2e8f0', padding: '2px 8px', borderRadius: '4px' }}>{li.count} Labours</span>
                        </div>
                    ))}
                </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                {item.status === 'Pending' && (
                    <>
                        <button
                            onClick={() => handleAction('manpower', item._id, 'reject')}
                            disabled={actionLoading}
                            style={{ padding: '10px 20px', borderRadius: '12px', border: '1px solid #fca5a5', background: '#fef2f2', color: '#ef4444', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                            {actionLoading === `${item._id}-reject` ? <Loader2 size={18} className="animate-spin" /> : <XCircle size={18} />} Reject
                        </button>
                        <button
                            onClick={() => handleAction('manpower', item._id, 'approve')}
                            disabled={actionLoading}
                            style={{ padding: '10px 24px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)' }}
                        >
                            {actionLoading === `${item._id}-approve` ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />} Verify & Forward to HR
                        </button>
                    </>
                )}
            </div>
        </div>
    );

    const renderExpenseCard = (item) => (
        <div key={item._id} style={{
            background: 'white', borderRadius: '16px', padding: '24px',
            border: selectedIds.includes(item._id) ? '2px solid #10b981' : '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
            marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '16px'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    {(!item.status || item.status === 'Pending') && activeStatusTab === 'Pending' && (
                        <input type="checkbox" checked={selectedIds.includes(item._id)} onChange={() => toggleSelect(item._id)}
                            style={{ width: '18px', height: '18px', accentColor: '#10b981', cursor: 'pointer' }} />
                    )}
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#fce7f3', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ec4899' }}>
                        <CreditCard size={24} />
                    </div>
                    <div>
                        <h4 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: 0 }}>Expense: {item.category || item.expense_category || 'Others'}</h4>
                        <p style={{ color: '#64748b', fontSize: '13px', margin: '4px 0 0 0', fontWeight: '600' }}>Project: {item.project || item.project_name || 'General'}</p>
                    </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                    <div style={{ padding: '6px 12px', borderRadius: '8px', background: item.status === 'Pending' ? '#fef3c7' : (item.status === 'Approved' ? '#dcfce7' : '#fee2e2'), color: item.status === 'Pending' ? '#b45309' : (item.status === 'Approved' ? '#166534' : '#991b1b'), fontSize: '12px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Clock size={14} /> {item.status || 'Pending'}
                    </div>
                    <span style={{ fontSize: '20px', fontWeight: '900', color: '#0f172a' }}>
                        ₹{parseFloat(item.amount || 0).toLocaleString()}
                    </span>
                </div>
            </div>

            <div style={{ marginTop: '0px', display: 'flex', gap: '16px', marginBottom: '16px' }}>
                <p style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>Initiated By: {(item.requested_by || item.user || 'Admin').toString()}</p>
                {item.status !== 'Pending' && item.approvedBy && (
                    <p style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>Approved By: {item.approvedBy}</p>
                )}
            </div>

            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px' }}>
                        <span style={{ fontWeight: '600', color: '#334155' }}>Payment Mode</span>
                        <span style={{ fontWeight: '700', color: '#64748b' }}>{item.paymentMode || item.payment_mode || 'N/A'}</span>
                    </div>
                    {item.payee && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px' }}>
                            <span style={{ fontWeight: '600', color: '#334155' }}>Payee</span>
                            <span style={{ fontWeight: '700', color: '#64748b' }}>{item.payee}</span>
                        </div>
                    )}
                </div>
                {item.description && (
                    <div style={{ marginTop: '12px' }}>
                        <p style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700', marginBottom: '4px' }}>Description</p>
                        <p style={{ fontSize: '13px', color: '#334155' }}>{item.description}</p>
                    </div>
                )}
                {item.remarks && (
                    <div style={{ marginTop: '12px' }}>
                        <p style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700', marginBottom: '4px' }}>Remarks</p>
                        <p style={{ fontSize: '13px', color: '#334155' }}>{item.remarks}</p>
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                {(!item.status || item.status === 'Pending') && (
                    <>
                        <button
                            onClick={() => handleAction('expenses', item._id, 'reject')}
                            disabled={actionLoading}
                            style={{ padding: '10px 20px', borderRadius: '12px', border: '1px solid #fca5a5', background: '#fef2f2', color: '#ef4444', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                            {actionLoading === `${item._id}-reject` ? <Loader2 size={18} className="animate-spin" /> : <XCircle size={18} />} Reject
                        </button>
                        <button
                            onClick={() => handleAction('expenses', item._id, 'approve')}
                            disabled={actionLoading}
                            style={{ padding: '10px 24px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)' }}
                        >
                            {actionLoading === `${item._id}-approve` ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />} Approve Expense
                        </button>
                    </>
                )}
            </div>
        </div>
    );

    const getStatusBadge = (status) => {
        const map = {
            'Pending': { bg: '#fef3c7', color: '#b45309' },
            'Coordinator Approved': { bg: '#dbeafe', color: '#1d4ed8' },
            'Dept Approved': { bg: '#e0e7ff', color: '#4338ca' },
            'Approved': { bg: '#dcfce7', color: '#166534' },
            'Rejected': { bg: '#fee2e2', color: '#991b1b' },
            'Reviewed': { bg: '#dbeafe', color: '#1d4ed8' },
        };
        const s = map[status] || map['Pending'];
        return { padding: '6px 12px', borderRadius: '8px', background: s.bg, color: s.color, fontSize: '12px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' };
    };

    // Bug 26 - DPR workflow step labels
    const dprWorkflowSteps = ['Pending', 'Coordinator Approved', 'Dept Approved', 'Approved'];
    const getStepIndex = (status) => {
        if (status === 'Rejected') return -1;
        const idx = dprWorkflowSteps.indexOf(status);
        return idx >= 0 ? idx : 0;
    };

    // Button label based on which stage the DPR is at
    const getDprActionLabel = (status) => {
        if (status === 'Pending') return 'Coordinator Approve';
        if (status === 'Coordinator Approved') return 'Dept Approve';
        if (status === 'Dept Approved') return 'Final Approve';
        return 'Approve';
    };

    const renderSCBillCard = (item) => (
        <div key={item._id} style={{
            background: 'white', borderRadius: '16px', padding: '24px',
            border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                    <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '4px' }}>{item.contractor_name || 'Unknown Contractor'}</h3>
                    <p style={{ fontSize: '12px', color: '#64748b' }}>{item.bill_no || '—'} &bull; {item.project_name || ''}</p>
                </div>
                <span style={{
                    padding: '4px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: '700',
                    backgroundColor: item.status === 'Pending Approval' ? '#FEF3C7' : item.status === 'Approved' ? '#DCFCE7' : '#FEE2E2',
                    color: item.status === 'Pending Approval' ? '#92400E' : item.status === 'Approved' ? '#166534' : '#991B1B'
                }}>{item.status}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                    <p style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>TYPE</p>
                    <p style={{ fontSize: '13px', fontWeight: '600' }}>{item.bill_type === 'work_based' ? 'Work Based' : 'Day Based'}</p>
                </div>
                <div>
                    <p style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>AMOUNT</p>
                    <p style={{ fontSize: '13px', fontWeight: '700', color: 'var(--primary)' }}>{'\u20B9'}{(item.payable_amount || 0).toLocaleString('en-IN')}</p>
                </div>
                <div>
                    <p style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>DATE</p>
                    <p style={{ fontSize: '13px' }}>{item.bill_date || item.created_at?.split('T')[0] || '—'}</p>
                </div>
            </div>
            {item.mbook_entries?.length > 0 && (
                <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>
                    M-Book: {item.mbook_entries.length} measurement entries &bull; Pg {item.mbook_page_no || '—'}
                </p>
            )}
            {item.status === 'Pending Approval' && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                    <button
                        className="btn btn-primary btn-sm"
                        disabled={!!actionLoading}
                        onClick={() => handleAction('subcontractor_bills', item._id, 'approve')}
                        style={{ padding: '6px 16px', fontSize: '12px' }}
                    >
                        {actionLoading === `${item._id}-approve` ? 'Approving...' : 'Approve'}
                    </button>
                    <button
                        className="btn btn-outline btn-sm"
                        disabled={!!actionLoading}
                        onClick={() => handleAction('subcontractor_bills', item._id, 'reject')}
                        style={{ padding: '6px 16px', fontSize: '12px', color: '#EF4444', borderColor: '#EF4444' }}
                    >
                        {actionLoading === `${item._id}-reject` ? 'Rejecting...' : 'Reject'}
                    </button>
                </div>
            )}
        </div>
    );

    const renderLabourPaymentCard = (item) => (
        <div key={item._id || item.id} style={{
            background: 'white', borderRadius: '16px', padding: '24px',
            border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                    <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '4px' }}>Labour Payment</h3>
                    <p style={{ fontSize: '12px', color: '#64748b' }}>{item.project_name} &bull; {item.date}</p>
                </div>
                <span style={{
                    padding: '4px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: '700',
                    backgroundColor: '#FEF3C7', color: '#92400E'
                }}>{item.payment_status || 'Payment Requested'}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                    <p style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>TOTAL LABOUR</p>
                    <p style={{ fontSize: '16px', fontWeight: '800' }}>{item.total_count || 0}</p>
                </div>
                <div>
                    <p style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>DAY COST</p>
                    <p style={{ fontSize: '16px', fontWeight: '800', color: 'var(--primary)' }}>{'\u20B9'}{(item.day_cost || 0).toLocaleString('en-IN')}</p>
                </div>
                <div>
                    <p style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>REQUESTED BY</p>
                    <p style={{ fontSize: '13px', fontWeight: '600' }}>{item.payment_requested_by || item.marked_by || '—'}</p>
                </div>
            </div>
            {(item.categories || []).length > 0 && (
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '12px' }}>
                    {item.categories.map((c, i) => (
                        <span key={i} style={{ padding: '2px 8px', borderRadius: '6px', backgroundColor: '#F1F5F9', fontSize: '11px', fontWeight: '600' }}>
                            {c.party ? `${c.party} \u2014 ` : ''}{c.category}: {c.count}
                        </span>
                    ))}
                </div>
            )}
            {item.payment_status === 'Payment Requested' && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                    <button
                        className="btn btn-primary btn-sm"
                        disabled={!!actionLoading}
                        onClick={() => handleAction('labour_payments', item._id || item.id, 'approve')}
                        style={{ padding: '6px 16px', fontSize: '12px' }}
                    >
                        {actionLoading === `${item._id || item.id}-approve` ? 'Approving...' : 'Approve Payment'}
                    </button>
                    <button
                        className="btn btn-outline btn-sm"
                        disabled={!!actionLoading}
                        onClick={() => handleAction('labour_payments', item._id || item.id, 'reject')}
                        style={{ padding: '6px 16px', fontSize: '12px', color: '#EF4444', borderColor: '#EF4444' }}
                    >
                        {actionLoading === `${item._id || item.id}-reject` ? 'Rejecting...' : 'Reject'}
                    </button>
                </div>
            )}
        </div>
    );

    const renderDPRCard = (item) => {
        const stepIdx = getStepIndex(item.status);
        return (
        <div key={item.id} style={{
            background: 'white', borderRadius: '16px', padding: '24px',
            border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
            marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '16px'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1' }}>
                        <FileText size={24} />
                    </div>
                    <div>
                        <h4 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: 0 }}>{item.project_name}</h4>
                        <p style={{ color: '#64748b', fontSize: '13px', margin: '4px 0 0 0', fontWeight: '600' }}>DPR Date: {item.date}</p>
                    </div>
                </div>
                <div style={getStatusBadge(item.status)}>
                    <Clock size={14} /> {item.status}
                </div>
            </div>

            {/* Workflow progress indicator */}
            {item.status !== 'Rejected' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '8px 0' }}>
                    {dprWorkflowSteps.map((step, i) => {
                        const isCompleted = i <= stepIdx;
                        const isCurrent = i === stepIdx;
                        const stepLabels = ['SE Submitted', 'Coordinator', 'PO / HR', 'Admin'];
                        return (
                            <React.Fragment key={step}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                                    <div style={{
                                        width: '28px', height: '28px', borderRadius: '50%',
                                        background: isCompleted ? (isCurrent ? '#6366f1' : '#10b981') : '#e2e8f0',
                                        color: isCompleted ? 'white' : '#94a3b8',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '12px', fontWeight: '800',
                                        border: isCurrent ? '2px solid #4f46e5' : 'none'
                                    }}>
                                        {isCompleted && !isCurrent ? <CheckCircle size={14} /> : (i + 1)}
                                    </div>
                                    <span style={{ fontSize: '10px', fontWeight: '700', color: isCompleted ? '#334155' : '#94a3b8', marginTop: '4px', textAlign: 'center' }}>
                                        {stepLabels[i]}
                                    </span>
                                </div>
                                {i < dprWorkflowSteps.length - 1 && (
                                    <div style={{ flex: 0.5, height: '2px', background: i < stepIdx ? '#10b981' : '#e2e8f0', marginBottom: '18px' }} />
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>
            )}

            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px' }}>
                <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '12px' }}>
                    <div>
                        <p style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700', marginBottom: '4px' }}>Submitted By</p>
                        <p style={{ fontSize: '14px', fontWeight: '700', color: '#334155' }}>{item.submitted_by || 'Site Engineer'}</p>
                    </div>
                    <div>
                        <p style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700', marginBottom: '4px' }}>Weather</p>
                        <p style={{ fontSize: '14px', fontWeight: '700', color: '#334155' }}>{item.weather || '-'}</p>
                    </div>
                    {item.coordinator_approved_by && (
                        <div>
                            <p style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700', marginBottom: '4px' }}>Coordinator</p>
                            <p style={{ fontSize: '14px', fontWeight: '700', color: '#334155' }}>{item.coordinator_approved_by}</p>
                        </div>
                    )}
                    {item.dept_approved_by && (
                        <div>
                            <p style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700', marginBottom: '4px' }}>Dept Approved By</p>
                            <p style={{ fontSize: '14px', fontWeight: '700', color: '#334155' }}>{item.dept_approved_by}</p>
                        </div>
                    )}
                    {item.status_updated_by && !item.coordinator_approved_by && !item.dept_approved_by && (
                        <div>
                            <p style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700', marginBottom: '4px' }}>Updated By</p>
                            <p style={{ fontSize: '14px', fontWeight: '700', color: '#334155' }}>{item.status_updated_by}</p>
                        </div>
                    )}
                </div>
                {item.progress && (
                    <div>
                        <p style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700', marginBottom: '4px' }}>Progress Summary</p>
                        <p style={{ fontSize: '14px', color: '#334155', lineHeight: '1.5' }}>{item.progress}</p>
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                {(item.status === 'Pending' || item.status === 'Coordinator Approved' || item.status === 'Dept Approved') && (
                    <>
                        <button
                            onClick={() => handleDprAction(item, 'reject')}
                            disabled={actionLoading}
                            style={{ padding: '10px 20px', borderRadius: '12px', border: '1px solid #fca5a5', background: '#fef2f2', color: '#ef4444', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                            {actionLoading === `${item.id}-reject` ? <Loader2 size={18} className="animate-spin" /> : <XCircle size={18} />} Reject
                        </button>
                        <button
                            onClick={() => handleDprAction(item, 'approve')}
                            disabled={actionLoading}
                            style={{
                                padding: '10px 24px', borderRadius: '12px', border: 'none',
                                background: item.status === 'Dept Approved'
                                    ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                                    : 'linear-gradient(135deg, #818cf8 0%, #6366f1 100%)',
                                color: 'white', fontWeight: '800', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: '8px',
                                boxShadow: item.status === 'Dept Approved'
                                    ? '0 4px 12px rgba(16, 185, 129, 0.2)'
                                    : '0 4px 12px rgba(99, 102, 241, 0.2)'
                            }}
                        >
                            {actionLoading === `${item.id}-approve` ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />} {getDprActionLabel(item.status)}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
    };

    return (
        <div className="approvals-container" style={{ position: 'relative' }}>
            <div className="animate-fade-in" style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '0 10px 40px' }}>
                {/* Header */}
                <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h2 style={{ fontSize: '28px', fontWeight: '900', color: '#0f172a', letterSpacing: '-0.5px' }}>
                            Approvals Central
                        </h2>
                        <p style={{ color: '#64748b', fontSize: '15px', fontWeight: '500', marginTop: '4px' }}>
                            Review and authorize pending requests across modules
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {activeStatusTab === 'Pending' && selectedIds.length > 0 && activeTab !== 'dprs' && (
                            <button
                                onClick={handleBulkApprove}
                                disabled={bulkLoading}
                                style={{
                                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', border: 'none', padding: '10px 20px',
                                    borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                                    fontWeight: '700', color: 'white', boxShadow: '0 4px 12px rgba(16,185,129,0.2)'
                                }}
                            >
                                {bulkLoading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                                Approve Selected ({selectedIds.length})
                            </button>
                        )}
                        {activeStatusTab === 'Pending' && activeTab !== 'dprs' && filteredData.filter(i => i.status === 'Pending' || !i.status).length > 0 && (
                            <button
                                onClick={toggleSelectAll}
                                style={{
                                    background: 'white', border: '1px solid #e2e8f0', padding: '10px 16px',
                                    borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                                    fontWeight: '600', color: '#475569', fontSize: '13px'
                                }}
                            >
                                {selectedIds.length === filteredData.filter(i => i.status === 'Pending' || !i.status).length ? 'Deselect All' : 'Select All'}
                            </button>
                        )}
                        <button
                            onClick={handleExportPDF}
                            style={{
                                background: 'white', border: '1px solid #e2e8f0', padding: '10px 16px',
                                borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                                fontWeight: '600', color: '#475569'
                            }}
                        >
                            <Download size={16} /> Export
                        </button>
                        <button
                            onClick={fetchData}
                            style={{
                                background: 'white', border: '1px solid #e2e8f0', padding: '10px 16px',
                                borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                                fontWeight: '600', color: '#475569', boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                            }}
                        >
                            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                            Refresh
                        </button>
                    </div>
                </div>

                {/* Controls */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                        <div style={{ display: 'inline-flex', background: '#e2e8f0', borderRadius: '8px', padding: '4px' }}>
                            {['Pending', 'All'].map(status => (
                                <button
                                    key={status}
                                    onClick={() => setActiveStatusTab(status)}
                                    style={{
                                        padding: '8px 24px', borderRadius: '6px', fontWeight: '600', fontSize: '14px',
                                        border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                                        background: activeStatusTab === status ? 'white' : 'transparent',
                                        color: activeStatusTab === status ? '#0f172a' : '#64748b',
                                        boxShadow: activeStatusTab === status ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                                    }}
                                >
                                    {status === 'Pending' ? 'Action Required' : 'Approval History'}
                                </button>
                            ))}
                        </div>

                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <div style={{ position: 'relative' }}>
                                <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                <input
                                    type="text"
                                    placeholder={`Search ${activeTab.replace('_', ' ')}...`}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    style={{
                                        padding: '10px 16px 10px 40px', borderRadius: '12px',
                                        border: '1px solid #e2e8f0', width: '250px',
                                        fontSize: '14px', outline: 'none'
                                    }}
                                />
                            </div>

                            {activeStatusTab === 'All' && (
                                <div style={{ position: 'relative' }} ref={filterRef}>
                                    <div
                                        onClick={() => setIsFilterOpen(!isFilterOpen)}
                                        style={{
                                            padding: '10px 16px', borderRadius: '12px',
                                            border: '1px solid #e2e8f0', background: 'white',
                                            fontSize: '14px', cursor: 'pointer', width: '160px',
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            color: '#334155', fontWeight: '600', boxShadow: '0 1px 2px rgba(0,0,0,0.01)',
                                            userSelect: 'none'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Filter size={16} style={{ color: filterStatus !== 'All' ? '#2563EB' : '#94a3b8' }} />
                                            <span style={{ color: filterStatus !== 'All' ? '#0f172a' : '#64748b' }}>
                                                {filterStatus === 'All' ? 'All Statuses' : filterStatus}
                                            </span>
                                        </div>
                                        <ChevronDown size={16} style={{ color: '#94a3b8', transform: isFilterOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                                    </div>

                                    {isFilterOpen && (
                                        <div style={{
                                            position: 'absolute', top: '100%', left: 0, marginTop: '8px',
                                            background: 'white', border: '1px solid #e2e8f0',
                                            borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                                            width: '100%', zIndex: 50, overflow: 'hidden'
                                        }}>
                                            {['All', 'Pending', 'Approved', 'Rejected'].map((statusOption) => (
                                                <div
                                                    key={statusOption}
                                                    onClick={() => {
                                                        setFilterStatus(statusOption);
                                                        setIsFilterOpen(false);
                                                    }}
                                                    style={{
                                                        padding: '10px 16px', cursor: 'pointer', fontSize: '14px',
                                                        fontWeight: '600', color: filterStatus === statusOption ? '#2563EB' : '#475569',
                                                        background: filterStatus === statusOption ? '#eff6ff' : 'transparent',
                                                        transition: 'background 0.2s',
                                                        borderBottom: statusOption !== 'Rejected' ? '1px solid #f1f5f9' : 'none',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                                                    }}
                                                >
                                                    <span>{statusOption === 'All' ? 'All Statuses' : statusOption}</span>
                                                    {filterStatus === statusOption && <CheckCircle size={14} style={{ color: '#2563EB' }} />}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '32px', borderBottom: '1px solid #e2e8f0', overflowX: 'auto' }}>
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => handleTabChange(tab.id)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    padding: '12px 4px',
                                    background: 'transparent',
                                    color: activeTab === tab.id ? '#2563EB' : '#64748b',
                                    border: 'none',
                                    borderBottom: activeTab === tab.id ? '2px solid #2563EB' : '2px solid transparent',
                                    fontWeight: activeTab === tab.id ? '700' : '600', fontSize: '15px',
                                    cursor: 'pointer', transition: 'all 0.2s',
                                }}
                            >
                                <tab.icon size={18} style={{ color: activeTab === tab.id ? '#2563EB' : '#94a3b8' }} />
                                {tab.label}
                                {tab.count > 0 && (
                                    <span style={{
                                        background: activeTab === tab.id ? '#eff6ff' : '#f1f5f9',
                                        color: activeTab === tab.id ? '#2563EB' : '#64748b',
                                        padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: '800'
                                    }}>
                                        {tab.count}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                <div style={{ minHeight: '400px' }}>
                    {loading ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', color: '#94a3b8' }}>
                            <Loader2 size={40} className="animate-spin" style={{ color: '#3b82f6', marginBottom: '16px' }} />
                            <p style={{ fontWeight: '600', fontSize: '16px' }}>Fetching pending approvals...</p>
                        </div>
                    ) : (filteredData.length > 0 ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(450px, 1fr))', gap: '24px' }}>
                            {filteredData.map(item => {
                                if (activeTab === 'leaves') return renderLeaveCard(item);
                                if (activeTab === 'purchase_orders') return renderPOCard(item);
                                if (activeTab === 'materials') return renderMaterialCard(item);
                                if (activeTab === 'expenses') return renderExpenseCard(item);
                                if (activeTab === 'manpower') return renderManpowerCard(item);
                                if (activeTab === 'dprs') return renderDPRCard(item);
                                if (activeTab === 'subcontractor_bills') return renderSCBillCard(item);
                                if (activeTab === 'labour_payments') return renderLabourPaymentCard(item);
                                return null;
                            })}
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', background: '#f8fafc', borderRadius: '16px', border: '2px dashed #e2e8f0', color: '#94a3b8' }}>
                            <FileText size={48} style={{ opacity: 0.5, marginBottom: '16px' }} />
                            <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#475569', marginBottom: '8px' }}>Nothing to show</h3>
                            <p style={{ fontWeight: '500' }}>There are no {activeStatusTab === 'Pending' ? 'pending' : ''} {tabs.find(t => t.id === activeTab)?.label.toLowerCase()} matching your search.</p>
                        </div>
                    ))}
                </div>
            </div>

            <style>{`
                .animate-spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>

            <PODetailModal
                isOpen={!!selectedPO}
                onClose={() => setSelectedPO(null)}
                po={selectedPO}
                onSuccess={() => { setSelectedPO(null); fetchData(); }}
                user={user}
            />

            <MaterialRequestDetailModal
                isOpen={!!selectedMaterial}
                onClose={() => setSelectedMaterial(null)}
                request={selectedMaterial}
            />
        </div>
    );
};

export default Approvals;

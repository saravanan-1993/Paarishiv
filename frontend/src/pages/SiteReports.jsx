import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { FileText, Search, Filter, Loader2, Eye, CheckCircle, XCircle, Clock, MapPin, User, LayoutDashboard, Calendar, Package, Download, ArrowRight, PlayCircle } from 'lucide-react';
import { projectAPI, inventoryAPI, settingsAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { hasPermission } from '../utils/rbac';
import DPRViewModal from '../components/DPRViewModal';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import PremiumSelect from '../components/PremiumSelect';
import CustomSelect from '../components/CustomSelect';
import Pagination from '../components/Pagination';

const PAGE_SIZE = 15;

const SiteReports = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const urlTab = searchParams.get('tab');
    const [activeTab, setActiveTab] = useState('DPR'); // 'DPR', 'Requests' or 'Transfers'
    const [dprPage, setDprPage] = useState(1);
    const [reqPage, setReqPage] = useState(1);
    const [xfPage, setXfPage] = useState(1);
    const [viewingRequest, setViewingRequest] = useState(null);
    const [viewingTransfer, setViewingTransfer] = useState(null);

    const tabMapping = useMemo(() => ({
        'Site Reports (DPR)': 'DPR',
        'Material Requests': 'Requests',
        'Transfer Requests': 'Transfers'
    }), []);

    useEffect(() => {
        if (urlTab) {
            const internalTab = tabMapping[urlTab] || urlTab;
            if (Object.values(tabMapping).includes(internalTab)) {
                setActiveTab(internalTab);
            }
        }
    }, [urlTab, tabMapping]);

    const handleTabChange = (tabId) => {
        const label = Object.keys(tabMapping).find(key => tabMapping[key] === tabId) || tabId;
        setActiveTab(tabId);
        setSearchParams({ tab: label });
    };
    const [dprs, setDprs] = useState([]);
    const [requests, setRequests] = useState([]);
    const [transfers, setTransfers] = useState([]);
    const [projects, setProjects] = useState([]);
    const [selectedProject, setSelectedProject] = useState('all');
    const [dateFilter, setDateFilter] = useState('all');
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDPR, setSelectedDPR] = useState(null);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [processingId, setProcessingId] = useState(null);
    const [companyInfo, setCompanyInfo] = useState({
        companyName: 'CIVIL ERP',
        logo: ''
    });
    const [toast, setToast] = useState(null);

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch projects for filter
            const projRes = await projectAPI.getAll();
            setProjects(projRes.data || []);

            if (activeTab === 'DPR') {
                const res = await projectAPI.getAllDPRs();
                setDprs(res.data || []);
            } else if (activeTab === 'Requests') {
                const res = await inventoryAPI.getRequests();
                setRequests(res.data || []);
            } else {
                const res = await inventoryAPI.getPendingTransfers();
                setTransfers(res.data || []);
            }
        } catch (err) {
            console.error('Failed to fetch data:', err);
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
        fetchData();
        fetchCompanyInfo();
        window.addEventListener('companyInfoUpdated', fetchCompanyInfo);
        return () => window.removeEventListener('companyInfoUpdated', fetchCompanyInfo);
    }, [activeTab]);

    const handleUpdateDPRStatus = async (dpr, newStatus) => {
        setProcessingId(dpr.id);
        try {
            await projectAPI.updateDprStatus(dpr.project_id, dpr.id, newStatus);
            await fetchData();
            showToast(`DPR ${newStatus} successfully!`);
        } catch (err) {
            console.error("DPR update failed:", err);
            showToast(`Failed: ${err?.response?.data?.detail || err.message}`, 'error');
        } finally {
            setProcessingId(null);
        }
    };

    const handleUpdateReqStatus = async (req, newStatus) => {
        const reqId = req.id || req._id;
        setProcessingId(reqId);
        try {
            await inventoryAPI.updateRequestStatus(reqId, {
                status: newStatus,
                remarks: `${newStatus} by Coordinator`
            });
            await fetchData();
            showToast(`Request ${newStatus} successfully!`);
        } catch (err) {
            console.error("Request update failed:", err);
            showToast(`Failed: ${err?.response?.data?.detail || err.message}`, 'error');
        } finally {
            setProcessingId(null);
        }
    };

    const handleApproveTransfer = async (transferId) => {
        setProcessingId(transferId);
        try {
            await inventoryAPI.approveTransfer(transferId);
            await fetchData();
            showToast('Transfer Approved & Stock Updated!');
        } catch (err) {
            showToast('Failed to approve transfer', 'error');
        } finally {
            setProcessingId(null);
        }
    };

    const handleRejectTransfer = async (transferId) => {
        setProcessingId(transferId);
        try {
            await inventoryAPI.rejectTransfer(transferId);
            await fetchData();
            showToast('Transfer rejected.');
        } catch (err) {
            showToast('Failed to reject transfer', 'error');
        } finally {
            setProcessingId(null);
        }
    };

    const handleDownloadPDF = () => {
        const dataToExport = activeTab === 'DPR' ? filteredDPRs : (activeTab === 'Requests' ? filteredRequests : filteredTransfers);
        if (dataToExport.length === 0) return;

        const doc = new jsPDF();
        const title = activeTab === 'DPR' ? 'Site Daily Progress Report (DPR) Summary' :
            activeTab === 'Requests' ? 'Material Requests Summary' : 'Material Transfers Summary';

        doc.setFontSize(22);
        doc.setTextColor(30, 58, 95);
        doc.text(companyInfo.companyName || 'CIVIL ERP', 14, 20);

        doc.setFontSize(16);
        doc.setTextColor(59, 130, 246);
        doc.text(title, 14, 30);

        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139);
        doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 38);
        doc.text(`Project Filter: ${selectedProject === 'all' ? 'All Projects' : selectedProject}`, 14, 43);

        let headers = [];
        let body = [];

        if (activeTab === 'DPR') {
            headers = [['Date', 'Project', 'Engineer', 'Status']];
            body = dataToExport.map(d => [d.date, d.project_name, d.submitted_by, d.status]);
        } else if (activeTab === 'Requests') {
            headers = [['Date', 'Project', 'Engineer', 'Items', 'Priority', 'Status']];
            body = dataToExport.map(r => [
                new Date(r.created_at).toLocaleDateString(),
                r.project_name,
                r.engineer_id,
                r.requested_items?.map(it => `${it.name} (${it.quantity} ${it.unit})`).join(', '),
                r.priority,
                r.status
            ]);
        } else {
            headers = [['Date', 'From', 'To', 'Items', 'Requested By', 'Status']];
            body = dataToExport.map(xf => [
                new Date(xf.created_at).toLocaleDateString(),
                xf.from_project,
                xf.to_project,
                xf.items?.map(it => `${it.name} (${it.quantity})`).join(', '),
                xf.engineer_id,
                xf.status
            ]);
        }

        autoTable(doc, {
            startY: 50,
            head: headers,
            body: body,
            theme: 'grid',
            headStyles: { fillColor: [59, 130, 246], fontStyle: 'bold' },
            styles: { fontSize: 9 }
        });

        doc.save(`${activeTab}_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    const isDateInRange = (dateValue, filterType) => {
        if (filterType === 'all') return true;
        if (!dateValue) return false;

        const date = new Date(dateValue);
        const today = new Date();
        const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

        if (filterType === 'today') {
            return date >= startOfToday;
        } else if (filterType === 'this_week') {
            const startOfWeek = new Date(startOfToday);
            startOfWeek.setDate(today.getDate() - today.getDay());
            return date >= startOfWeek;
        } else if (filterType === 'this_month') {
            const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            return date >= startOfMonth;
        }
        return true;
    };

    // Reset pages when filters change
    useEffect(() => { setDprPage(1); setReqPage(1); setXfPage(1); }, [searchTerm, selectedProject, dateFilter]);

    const filteredDPRs = dprs.filter(d => {
        const matchesSearch = searchTerm === '' ||
            d.project_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            d.submitted_by?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            d.progress?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesProject = selectedProject === 'all' || d.project_name === selectedProject;
        const matchesDate = isDateInRange(d.date, dateFilter);
        return matchesSearch && matchesProject && matchesDate;
    });

    const filteredRequests = requests.filter(r => {
        const matchesSearch = searchTerm === '' ||
            r.project_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.engineer_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.requested_items?.some(it => it.name.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesProject = selectedProject === 'all' || r.project_name === selectedProject;
        const matchesDate = isDateInRange(r.created_at, dateFilter);
        return matchesSearch && matchesProject && matchesDate;
    });

    const filteredTransfers = transfers.filter(xf => {
        const matchesSearch = searchTerm === '' ||
            xf.from_project?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            xf.to_project?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            xf.engineer_id?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesProject = selectedProject === 'all' || xf.from_project === selectedProject || xf.to_project === selectedProject;
        const matchesDate = isDateInRange(xf.created_at, dateFilter);
        return matchesSearch && matchesProject && matchesDate;
    });

    const paginatedDPRs = filteredDPRs.slice((dprPage - 1) * PAGE_SIZE, dprPage * PAGE_SIZE);
    const paginatedRequests = filteredRequests.slice((reqPage - 1) * PAGE_SIZE, reqPage * PAGE_SIZE);
    const paginatedTransfers = filteredTransfers.slice((xfPage - 1) * PAGE_SIZE, xfPage * PAGE_SIZE);

    return (
        <div className="site-reports-container" style={{ position: 'relative' }}>
            {/* Toast Notification */}
            {toast && (
                <div style={{
                    position: 'fixed', top: '24px', right: '24px', zIndex: 9999,
                    padding: '14px 22px', borderRadius: '14px', fontWeight: '700', fontSize: '14px',
                    backgroundColor: toast.type === 'error' ? '#FEF2F2' : '#F0FDF4',
                    color: toast.type === 'error' ? '#DC2626' : '#16A34A',
                    border: `1px solid ${toast.type === 'error' ? '#FECACA' : '#BBF7D0'}`,
                    boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
                    display: 'flex', alignItems: 'center', gap: '10px',
                    animation: 'slideIn 0.3s ease'
                }}>
                    <span style={{ fontSize: '18px' }}>{toast.type === 'error' ? '❌' : '✅'}</span>
                    {toast.msg}
                </div>
            )}
            <div className="animate-fade-in" style={{ padding: '24px' }}>

                {/* Header section */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: '20px' }}>
                    <div>
                        <h1 style={{ fontSize: '28px', fontWeight: '800', color: 'var(--text-main)', marginBottom: '8px' }}>Coordinator Control Hub</h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '15px' }}>Review site operations, approve DPRs and process material requests from site engineers.</p>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', flex: '1 1 auto' }}>
                        <div style={{ flex: '1 1 150px' }}>
                            <CustomSelect
                                label="Time Period"
                                options={[
                                    { value: 'all', label: 'All Time' },
                                    { value: 'today', label: 'Today' },
                                    { value: 'this_week', label: 'This Week' },
                                    { value: 'this_month', label: 'This Month' }
                                ]}
                                value={dateFilter} onChange={setDateFilter} icon={Calendar}
                            />
                        </div>
                        <div style={{ flex: '1 1 150px' }}>
                            <CustomSelect
                                label="Project Filter"
                                options={[{ value: 'all', label: 'All Projects' }, ...projects.map(p => ({ value: p.name, label: p.name }))]}
                                value={selectedProject} onChange={setSelectedProject} icon={MapPin}
                            />
                        </div>
                        <div style={{ position: 'relative', flex: '1 1 200px' }}>
                            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input type="text" placeholder={`Search in ${activeTab}...`} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                                style={{ padding: '10px 16px 10px 40px', borderRadius: '10px', border: '1px solid var(--border)', fontSize: '14px', width: '100%', backgroundColor: 'white' }}
                            />
                        </div>
                        <button className="btn btn-primary" onClick={handleDownloadPDF} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', flex: '1 1 auto', justifyContent: 'center' }}>
                            <Download size={18} /> EXPORT PDF
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: '20px', borderBottom: '2px solid var(--border)', marginBottom: '32px', flexWrap: 'wrap' }}>
                    {[
                        { id: 'DPR', label: 'Site Reports (DPR)', icon: FileText },
                        { id: 'Requests', label: 'Material Requests', icon: Package },
                        { id: 'Transfers', label: 'Transfer Requests', icon: ArrowRight }
                    ].map(t => (
                        <button key={t.id} onClick={() => handleTabChange(t.id)}
                            style={{
                                padding: '12px 8px', fontSize: '15px', fontWeight: '800',
                                color: activeTab === t.id ? 'var(--primary)' : 'var(--text-muted)',
                                borderBottom: activeTab === t.id ? '3px solid var(--primary)' : '3px solid transparent',
                                background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '-2px',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            <t.icon size={18} /> {t.label}
                        </button>
                    ))}
                </div>

                <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '100px' }}>
                            <Loader2 size={40} className="animate-spin" color="var(--primary)" style={{ margin: '0 auto 16px' }} />
                            <p style={{ fontWeight: '600', color: 'var(--text-muted)' }}>Fetching data...</p>
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            {activeTab === 'DPR' && (
                                <>
                                <table className="data-table">
                                    <thead>
                                        <tr><th>Date</th><th>Project</th><th>Engineer</th><th>Status</th><th style={{ textAlign: 'right' }}>Actions</th></tr>
                                    </thead>
                                    <tbody>
                                        {filteredDPRs.length === 0 ? <tr><td colSpan="5" style={{ textAlign: 'center', padding: '60px' }}>No site reports found.</td></tr> :
                                            paginatedDPRs.map((dpr, i) => (
                                                <tr key={i}>
                                                    <td>{dpr.date}</td><td style={{ fontWeight: '700', color: 'var(--primary)' }}>{dpr.project_name}</td><td>{dpr.submitted_by}</td>
                                                    <td><span className={`badge ${dpr.status === 'Approved' ? 'badge-success' : dpr.status === 'Reviewed' ? 'badge-info' : dpr.status === 'Rejected' ? 'badge-danger' : 'badge-warning'}`}>{dpr.status}</span></td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                                            <button className="btn btn-outline btn-sm" onClick={() => { setSelectedDPR(dpr); setIsViewModalOpen(true); }}><Eye size={16} /></button>
                                                            {/* Bug 4.7 - Coordinator: Pending -> Reviewed, Admin: Reviewed -> Approved */}
                                                            {dpr.status === 'Pending' && hasPermission(user, 'Site Reports', 'edit') && (
                                                                <>
                                                                    <button
                                                                        className="btn btn-success btn-sm"
                                                                        onClick={() => handleUpdateDPRStatus(dpr, !hasPermission(user, 'Approvals', 'edit') ? 'Reviewed' : 'Approved')}
                                                                        disabled={processingId === dpr.id}
                                                                        title={!hasPermission(user, 'Approvals', 'edit') ? 'Review DPR' : 'Approve DPR'}
                                                                    >
                                                                        {processingId === dpr.id ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                                                                    </button>
                                                                    <button
                                                                        className="btn btn-outline btn-sm"
                                                                        style={{ color: '#ef4444' }}
                                                                        onClick={() => handleUpdateDPRStatus(dpr, 'Rejected')}
                                                                        disabled={processingId === dpr.id}
                                                                        title="Reject DPR"
                                                                    >
                                                                        {processingId === dpr.id ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
                                                                    </button>
                                                                </>
                                                            )}
                                                            {dpr.status === 'Reviewed' && hasPermission(user, 'Site Reports', 'edit') && (
                                                                <>
                                                                    <button
                                                                        className="btn btn-success btn-sm"
                                                                        onClick={() => handleUpdateDPRStatus(dpr, 'Approved')}
                                                                        disabled={processingId === dpr.id}
                                                                        title="Approve DPR"
                                                                    >
                                                                        {processingId === dpr.id ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                                                                    </button>
                                                                    <button
                                                                        className="btn btn-outline btn-sm"
                                                                        style={{ color: '#ef4444' }}
                                                                        onClick={() => handleUpdateDPRStatus(dpr, 'Rejected')}
                                                                        disabled={processingId === dpr.id}
                                                                        title="Reject DPR"
                                                                    >
                                                                        {processingId === dpr.id ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        }
                                    </tbody>
                                </table>
                                <Pagination currentPage={dprPage} totalItems={filteredDPRs.length} pageSize={PAGE_SIZE} onPageChange={setDprPage} />
                                </>
                            )}
                            {activeTab === 'Requests' && (
                                <>
                                <table className="data-table">
                                    <thead>
                                        <tr><th>Date</th><th>Project</th><th>Site Engineer</th><th>Items Requested</th><th>Priority</th><th>Status</th><th style={{ textAlign: 'right' }}>Actions</th></tr>
                                    </thead>
                                    <tbody>
                                        {filteredRequests.length === 0 ? <tr><td colSpan="7" style={{ textAlign: 'center', padding: '60px' }}>No pending material requests.</td></tr> :
                                            paginatedRequests.map((req, i) => (
                                                <tr key={i}>
                                                    <td>{new Date(req.created_at).toLocaleDateString()}</td><td style={{ fontWeight: '700' }}>{req.project_name}</td><td>{req.engineer_id}</td>
                                                    <td><div style={{ fontSize: '12px' }}>{req.requested_items?.map((it, idx) => (<div key={idx}>• {it.name} ({it.quantity} {it.unit})</div>))}</div></td>
                                                    <td><span className={`badge ${req.priority === 'High' ? 'badge-danger' : 'badge-info'}`}>{req.priority || 'Normal'}</span></td>
                                                    <td><span className={`badge ${req.status === 'Approved' ? 'badge-success' : req.status === 'Issued' ? 'badge-info' : req.status === 'Rejected' ? 'badge-danger' : 'badge-warning'}`}>{req.status}</span></td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                            <button
                                                                className="btn btn-outline btn-sm"
                                                                title="View Details"
                                                                onClick={() => setViewingRequest(viewingRequest === (req.id || req._id) ? null : (req.id || req._id))}
                                                                style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                                                            >
                                                                <Eye size={14} /> View
                                                            </button>
                                                            {req.status === 'Pending' && hasPermission(user, 'Site Reports', 'edit') && (
                                                                <>
                                                                    <button
                                                                        className="btn btn-success btn-sm"
                                                                        onClick={() => handleUpdateReqStatus(req, 'Approved')}
                                                                        disabled={processingId === (req.id || req._id)}
                                                                        style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                                                                    >
                                                                        {processingId === (req.id || req._id) ? <Loader2 size={14} className="animate-spin" /> : <><CheckCircle size={14} /> Approve</>}
                                                                    </button>
                                                                    <button
                                                                        className="btn btn-outline btn-sm"
                                                                        style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                                        onClick={() => handleUpdateReqStatus(req, 'Rejected')}
                                                                        disabled={processingId === (req.id || req._id)}
                                                                    >
                                                                        {processingId === (req.id || req._id) ? <Loader2 size={14} className="animate-spin" /> : <><XCircle size={14} /> Reject</>}
                                                                    </button>
                                                                </>
                                                            )}
                                                            {req.status === 'Approved' && (
                                                                <button
                                                                    className="btn btn-primary btn-sm"
                                                                    onClick={() => navigate(`/workflow?tab=POs&request_id=${req.id || req._id}`)}
                                                                    style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                                                                    title="Proceed to create PO"
                                                                >
                                                                    <PlayCircle size={14} /> Proceed
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        }
                                    </tbody>
                                </table>
                                <Pagination currentPage={reqPage} totalItems={filteredRequests.length} pageSize={PAGE_SIZE} onPageChange={setReqPage} />
                                </>
                            )}
                            {activeTab === 'Transfers' && (
                                <>
                                <table className="data-table">
                                    <thead>
                                        <tr><th>Date</th><th>From Project</th><th>To Project</th><th>Items</th><th>Requested By</th><th style={{ textAlign: 'right' }}>Actions</th></tr>
                                    </thead>
                                    <tbody>
                                        {filteredTransfers.length === 0 ? <tr><td colSpan="6" style={{ textAlign: 'center', padding: '60px' }}>No pending transfer requests.</td></tr> :
                                            paginatedTransfers.map((xf, i) => (
                                                <tr key={i}>
                                                    <td>{new Date(xf.created_at).toLocaleDateString()}</td><td style={{ fontWeight: '600', color: '#ef4444' }}>{xf.from_project}</td><td style={{ fontWeight: '600', color: '#22c55e' }}>{xf.to_project}</td>
                                                    <td><div style={{ fontSize: '12px' }}>{xf.items?.map((it, idx) => (<div key={idx}>• {it.name} ({it.quantity})</div>))}</div></td>
                                                    <td>{xf.engineer_id}</td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                            <button className="btn btn-outline btn-sm" onClick={() => setViewingTransfer(xf.id)} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Eye size={14} /> View</button>
                                                            {xf.status === 'Pending' && hasPermission(user, 'Site Reports', 'edit') && (
                                                                <>
                                                                    <button className="btn btn-success btn-sm" onClick={() => handleApproveTransfer(xf.id)} disabled={processingId === xf.id}>{processingId === xf.id ? <Loader2 size={14} className="animate-spin" /> : 'APPROVE'}</button>
                                                                    <button className="btn btn-outline btn-sm" style={{ color: '#ef4444' }} onClick={() => handleRejectTransfer(xf.id)} disabled={processingId === xf.id}>REJECT</button>
                                                                </>
                                                            )}
                                                            {xf.status !== 'Pending' && <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>{xf.status}</span>}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        }
                                    </tbody>
                                </table>
                                <Pagination currentPage={xfPage} totalItems={filteredTransfers.length} pageSize={PAGE_SIZE} onPageChange={setXfPage} />
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {isViewModalOpen && selectedDPR && (
                <DPRViewModal isOpen={isViewModalOpen} onClose={() => setIsViewModalOpen(false)} dpr={selectedDPR} projectName={selectedDPR.project_name} />
            )}

            {/* Material Request Detail Modal */}
            {viewingRequest && (() => {
                const req = filteredRequests.find(r => (r.id || r._id) === viewingRequest);
                if (!req) return null;
                return (
                    <div className="modal-overlay" onClick={() => setViewingRequest(null)}>
                        <div className="card animate-fade-in" style={{
                            width: '600px', maxWidth: '95vw', maxHeight: '85vh', overflowY: 'auto',
                            padding: '28px', position: 'relative'
                        }} onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                                <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-main)' }}>Material Request Details</h3>
                                <button onClick={() => setViewingRequest(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', color: 'var(--text-muted)', lineHeight: 1 }}>&times;</button>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                                <div>
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Project</span>
                                    <p style={{ fontWeight: '700', fontSize: '14px', color: 'var(--primary)' }}>{req.project_name}</p>
                                </div>
                                <div>
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Requested By</span>
                                    <p style={{ fontWeight: '700', fontSize: '14px' }}>{req.engineer_id}</p>
                                </div>
                                <div>
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Date</span>
                                    <p style={{ fontWeight: '700', fontSize: '14px' }}>{new Date(req.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                                </div>
                                <div>
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Priority</span>
                                    <span className={`badge ${req.priority === 'High' ? 'badge-danger' : req.priority === 'Low' ? 'badge-info' : 'badge-warning'}`}>{req.priority || 'Normal'}</span>
                                </div>
                                <div>
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Status</span>
                                    <span className={`badge ${req.status === 'Approved' ? 'badge-success' : req.status === 'Issued' ? 'badge-info' : req.status === 'Rejected' ? 'badge-danger' : req.status === 'Consolidated' ? 'badge-info' : 'badge-warning'}`}>{req.status}</span>
                                </div>
                                {req.source && (
                                    <div>
                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Source</span>
                                        <p style={{ fontWeight: '600', fontSize: '13px' }}>{req.source}</p>
                                    </div>
                                )}
                            </div>

                            <div>
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', display: 'block', marginBottom: '10px' }}>Items Requested ({req.requested_items?.length || 0})</span>
                                <table className="data-table" style={{ fontSize: '13px' }}>
                                    <thead>
                                        <tr>
                                            <th style={{ padding: '10px 12px' }}>#</th>
                                            <th style={{ padding: '10px 12px' }}>Material</th>
                                            <th style={{ padding: '10px 12px', textAlign: 'center' }}>Quantity</th>
                                            <th style={{ padding: '10px 12px' }}>Unit</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(req.requested_items || []).map((it, idx) => (
                                            <tr key={idx}>
                                                <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{idx + 1}</td>
                                                <td style={{ padding: '10px 12px', fontWeight: '600' }}>{it.name}</td>
                                                <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '700' }}>{it.quantity}</td>
                                                <td style={{ padding: '10px 12px' }}>{it.unit}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {req.coordinator_remarks && (
                                <div style={{ marginTop: '16px', padding: '12px 14px', backgroundColor: '#eff6ff', borderRadius: '10px', fontSize: '13px', color: '#1e40af', borderLeft: '4px solid #3b82f6' }}>
                                    <strong>Coordinator Remarks:</strong> {req.coordinator_remarks}
                                </div>
                            )}
                            {req.remarks && (
                                <div style={{ marginTop: '10px', padding: '12px 14px', backgroundColor: '#f0fdf4', borderRadius: '10px', fontSize: '13px', color: '#15803d', borderLeft: '4px solid #22c55e' }}>
                                    <strong>Remarks:</strong> {req.remarks}
                                </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
                                {req.status === 'Pending' && (
                                    <>
                                        <button className="btn btn-success" onClick={() => { handleUpdateReqStatus(req, 'Approved'); setViewingRequest(null); }}
                                            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 20px' }}>
                                            <CheckCircle size={16} /> Approve
                                        </button>
                                        <button className="btn btn-outline" onClick={() => { handleUpdateReqStatus(req, 'Rejected'); setViewingRequest(null); }}
                                            style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 20px' }}>
                                            <XCircle size={16} /> Reject
                                        </button>
                                    </>
                                )}
                                <button className="btn btn-outline" onClick={() => setViewingRequest(null)} style={{ padding: '10px 20px' }}>Close</button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Transfer Request Detail Modal */}
            {viewingTransfer && (() => {
                const xf = filteredTransfers.find(t => t.id === viewingTransfer);
                if (!xf) return null;
                return (
                    <div className="modal-overlay" onClick={() => setViewingTransfer(null)}>
                        <div className="card animate-fade-in" style={{ width: '560px', maxWidth: '95vw', maxHeight: '85vh', overflowY: 'auto', padding: '28px' }} onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                                <h3 style={{ fontSize: '18px', fontWeight: '800' }}>Material Transfer Details</h3>
                                <button onClick={() => setViewingTransfer(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', color: 'var(--text-muted)' }}>&times;</button>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                                <div>
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>From Project</span>
                                    <p style={{ fontWeight: '700', fontSize: '14px', color: '#EF4444' }}>{xf.from_project}</p>
                                </div>
                                <div>
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>To Project</span>
                                    <p style={{ fontWeight: '700', fontSize: '14px', color: '#22C55E' }}>{xf.to_project}</p>
                                </div>
                                <div>
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Requested By</span>
                                    <p style={{ fontWeight: '700', fontSize: '14px' }}>{xf.engineer_id || 'N/A'}</p>
                                </div>
                                <div>
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Date</span>
                                    <p style={{ fontWeight: '700', fontSize: '14px' }}>{new Date(xf.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                                </div>
                                <div>
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Status</span>
                                    <span className={`badge ${xf.status === 'Approved' ? 'badge-success' : xf.status === 'Rejected' ? 'badge-danger' : 'badge-warning'}`}>{xf.status}</span>
                                </div>
                            </div>
                            <div>
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', display: 'block', marginBottom: '10px' }}>Items ({xf.items?.length || 0})</span>
                                <table className="data-table" style={{ fontSize: '13px' }}>
                                    <thead><tr><th style={{ padding: '10px 12px' }}>#</th><th style={{ padding: '10px 12px' }}>Material</th><th style={{ padding: '10px 12px', textAlign: 'center' }}>Quantity</th><th style={{ padding: '10px 12px' }}>Unit</th></tr></thead>
                                    <tbody>
                                        {(xf.items || []).map((it, idx) => (
                                            <tr key={idx}><td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{idx + 1}</td><td style={{ padding: '10px 12px', fontWeight: '600' }}>{it.name}</td><td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '700' }}>{it.quantity}</td><td style={{ padding: '10px 12px' }}>{it.unit || 'Nos'}</td></tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {xf.notes && <div style={{ marginTop: '16px', padding: '12px 14px', backgroundColor: '#eff6ff', borderRadius: '10px', fontSize: '13px', color: '#1e40af', borderLeft: '4px solid #3b82f6' }}><strong>Notes:</strong> {xf.notes}</div>}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
                                {xf.status === 'Pending' && (
                                    <>
                                        <button className="btn btn-success" onClick={() => { handleApproveTransfer(xf.id); setViewingTransfer(null); }} style={{ padding: '10px 20px' }}>Approve</button>
                                        <button className="btn btn-outline" onClick={() => { handleRejectTransfer(xf.id); setViewingTransfer(null); }} style={{ color: '#ef4444', padding: '10px 20px' }}>Reject</button>
                                    </>
                                )}
                                <button className="btn btn-outline" onClick={() => setViewingTransfer(null)} style={{ padding: '10px 20px' }}>Close</button>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
};

export default SiteReports;

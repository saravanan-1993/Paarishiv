import React, { useState, useEffect } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import {
    Plus,
    Search,
    MapPin,
    Phone,
    Building2,
    ShoppingCart,
    IndianRupee,
    Clock,
    Package,
    Star,
    CheckCircle2,
    FileText,
    MoreHorizontal,
    Download,
    MessageSquare,
    Mail,
    CheckCircle,
    Eye,
    Pencil,
    Trash2,
    ChevronRight
} from 'lucide-react';
import VendorModal from '../components/VendorModal';
import POModal from '../components/POModal';
import GRNModal from '../components/GRNModal';
import VendorDetailModal from '../components/VendorDetailModal';
import PODetailModal from '../components/PODetailModal';
import GRNDetailModal from '../components/GRNDetailModal';
import { vendorAPI, purchaseOrderAPI, grnAPI, inventoryAPI, settingsAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { hasPermission, hasSubTabAccess } from '../utils/rbac';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const WhatsAppIcon = ({ size = 18 }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        style={{ verticalAlign: 'middle' }}
    >
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
);

const Workflow = () => {
    const { user } = useAuth();
    const location = useLocation();
    const [searchParams, setSearchParams] = useSearchParams();
    const queryTab = searchParams.get('tab');

    // Define tabs and then determine which one should be active based on permissions
    const availableTabs = React.useMemo(() => [
        { id: 'Requests' },
        { id: 'GRN' },
        { id: 'POs' },
        { id: 'Vendors' }
    ].filter(tab => hasSubTabAccess(user, 'Procurement', tab.id)), [user]);

    const [activeSection, setActiveSection] = useState(queryTab || availableTabs[0]?.id || 'Requests');

    // Sync activeSection with URL param
    useEffect(() => {
        if (queryTab && availableTabs.some(t => t.id === queryTab)) {
            setActiveSection(queryTab);
        }
    }, [queryTab, availableTabs]);

    // Also update URL when clicking tabs manually (optional but good for consistency)
    const handleTabChange = (tabId) => {
        setActiveSection(tabId);
        setSearchParams({ tab: tabId });
    };
    const [searchTerm, setSearchTerm] = useState('');
    const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
    const [isPOModalOpen, setIsPOModalOpen] = useState(false);
    const [isGRNModalOpen, setIsGRNModalOpen] = useState(false);
    const [selectedVendor, setSelectedVendor] = useState(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedPO, setSelectedPO] = useState(null);
    const [isPODetailOpen, setIsPODetailOpen] = useState(false);
    const [selectedGRN, setSelectedGRN] = useState(null);
    const [isGRNDetailOpen, setIsGRNDetailOpen] = useState(false);
    const [editVendor, setEditVendor] = useState(null); // vendor being edited

    // ── Live state (empty until user adds data) ─────────────────────────────
    const [vendors, setVendors] = useState([]);
    const [pos, setPOs] = useState([]);
    const [grns, setGRNs] = useState([]);
    const [requests, setRequests] = useState([]);
    const [consolidatedRequests, setConsolidatedRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [companyInfo, setCompanyInfo] = useState({
        name: "—",
        address: "—",
        phone: "—",
        email: "—",
        gst: "—"
    });

    const fetchVendors = async () => {
        try {
            setLoading(true);
            const res = await vendorAPI.getAll();
            setVendors(res.data || []);
        } catch (err) {
            console.error('Failed to fetch vendors:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchPOs = async () => {
        try {
            const res = await purchaseOrderAPI.getAll();
            setPOs(res.data || []);
        } catch (err) {
            console.error('Failed to fetch POs:', err);
        }
    };

    const fetchGRNs = async () => {
        try {
            const res = await grnAPI.getAll();
            setGRNs(res.data || []);
        } catch (err) {
            console.error('Failed to fetch GRNs:', err);
        }
    };

    const fetchRequests = async () => {
        try {
            const res = await inventoryAPI.getRequests(); // Fetch all statuses
            setRequests(res.data || []);

            const conRes = await inventoryAPI.getConsolidated();
            setConsolidatedRequests(conRes.data || []);
        } catch (err) {
            console.error('Failed to fetch requests:', err);
        }
    };

    const fetchCompanyInfo = async () => {
        try {
            const res = await settingsAPI.getCompany();
            if (res.data) {
                setCompanyInfo({
                    name: res.data.companyName || companyInfo.name,
                    address: res.data.address || companyInfo.address,
                    phone: res.data.contactNumber || companyInfo.phone,
                    email: res.data.email || companyInfo.email,
                    gst: res.data.gstin || companyInfo.gst
                });
            }
        } catch (err) {
            console.error('Failed to fetch company info:', err);
        }
    };

    React.useEffect(() => {
        fetchVendors();
        fetchPOs();
        fetchGRNs();
        fetchRequests();
        fetchCompanyInfo();

        window.addEventListener('companyInfoUpdated', fetchCompanyInfo);
        return () => window.removeEventListener('companyInfoUpdated', fetchCompanyInfo);
    }, []);

    // Handle direct action from navigation
    useEffect(() => {
        const queryParams = new URLSearchParams(location.search);
        const action = queryParams.get('action');
        if (action === 'new_po') {
            handleTabChange('POs');
            setIsPOModalOpen(true);
        }
    }, [location]);

    // ── KPIs derived from real data ─────────────────────────────────────────
    const totalPOValue = pos.reduce((s, p) => s + (p.total_amount || 0), 0);
    const pendingPOs = pos.filter(p => p.status === 'Pending').length;

    const formatValue = (val) => {
        if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
        if (val === 0) return '₹0';
        return `₹${val.toLocaleString()}`;
    };

    const kpis = [
        { label: 'VENDORS', id: 'Vendors', value: vendors.length, icon: Building2, color: '#3B82F6', bgColor: '#EFF6FF' },
        { label: 'TOTAL POS', id: 'POs', value: pos.length, icon: ShoppingCart, color: '#8B5CF6', bgColor: '#F5F3FF' },
        { label: 'PO VALUE', id: 'POs', value: formatValue(totalPOValue), icon: IndianRupee, color: '#10B981', bgColor: '#ECFDF5' },
        { label: 'PENDING POS', id: 'POs', value: pendingPOs, icon: Clock, color: '#F59E0B', bgColor: '#FFFBEB' },
        { label: 'GRNS', id: 'GRN', value: grns.length, icon: Package, color: '#4B5563', bgColor: '#F3F4F6' },
    ].filter(kpi => !kpi.id || hasSubTabAccess(user, 'Procurement', kpi.id));

    // ── Filtered lists ──────────────────────────────────────────────────────
    const filteredVendors = vendors.filter(v =>
        v.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    const filteredPOs = pos.filter(po =>
        po.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        po.vendor_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        po.project_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    const filteredGRNs = grns.filter(g =>
        g.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        g.po_id?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    const filteredRequests = requests.filter(r =>
        r.project_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.engineer_id?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // ── Handlers ────────────────────────────────────────────────────────────
    const handleWhatsAppShare = (poId, vendor) => {
        const text = `Hi ${vendor}, This is regarding Purchase Order ${poId} from Civil ERP. Please check your email for the detailed PO.`;
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    };

    const handleEmailShare = async (po) => {
        try {
            const res = await purchaseOrderAPI.sendEmail(po.id);
            alert(`Email sent successfully to vendor for PO-${po.id.slice(-6).toUpperCase()}`);
        } catch (err) {
            console.error('Failed to send email:', err);
            const errorMsg = err.response?.data?.detail || 'Failed to send email. Please check vendor email and SMTP settings.';
            alert(errorMsg);
        }
    };


    const handleDownloadPO = (po) => {
        try {
            const poNum = `PO-${po.id.slice(-6).toUpperCase()}`;
            const doc = new jsPDF();

            // ── Company Header (Left) ─────────────────────────────────────────────
            doc.setFontSize(22);
            doc.setTextColor(59, 130, 246); // Primary Color
            doc.setFont("helvetica", "bold");
            doc.text(companyInfo.name, 14, 22);

            doc.setFontSize(9);
            doc.setTextColor(100, 116, 139); // Muted Text
            doc.setFont("helvetica", "normal");
            doc.text(companyInfo.address, 14, 28);
            doc.text(`Phone: ${companyInfo.phone} | Email: ${companyInfo.email}`, 14, 33);
            doc.setFont("helvetica", "bold");
            doc.text(`GSTIN: ${companyInfo.gst}`, 14, 38);

            // ── PO Header (Right) ─────────────────────────────────────────────
            doc.setFontSize(18);
            doc.setTextColor(30, 41, 59);
            doc.text("PURCHASE ORDER", 196, 22, { align: "right" });

            doc.setFontSize(10);
            doc.setTextColor(100, 116, 139);
            doc.setFont("helvetica", "normal");
            doc.text(`PO # : ${poNum}`, 196, 28, { align: "right" });
            doc.text(`Date : ${new Date().toLocaleDateString()}`, 196, 33, { align: "right" });

            // ── Separator Line ──────────────────────────────────────────────────
            doc.setDrawColor(226, 232, 240);
            doc.line(14, 45, 196, 45);

            // ── Details Section ──────────────────────────────────────────────────
            doc.setFontSize(11);
            doc.setTextColor(100, 116, 139);
            doc.text("VENDOR TO:", 14, 55);
            doc.text("PROJECT SITE:", 110, 55);

            doc.setFontSize(12);
            doc.setTextColor(30, 41, 59);
            doc.setFont("helvetica", "bold");
            doc.text(po.vendor_name || 'N/A', 14, 62);
            doc.text(po.project_name || 'N/A', 110, 62);

            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(100, 116, 139);
            doc.text(`Status: ${po.status || 'N/A'}`, 14, 68);
            doc.text(`Exp. Delivery: ${po.expected_delivery || 'N/A'}`, 110, 68);

            // ── Table ────────────────────────────────────────────────────────────
            const items = po.items || [];
            const tableData = items.map((item, index) => {
                const qty = parseFloat(item.qty || 0);
                const rate = parseFloat(item.rate || 0);
                const rowAmount = item.amount || (qty * rate);

                return [
                    index + 1,
                    item.name || 'Item',
                    `${qty} ${item.unit || 'Nos'}`,
                    `Rs. ${rate.toLocaleString('en-IN')}`,
                    `Rs. ${rowAmount.toLocaleString('en-IN')}`
                ];
            });

            autoTable(doc, {
                startY: 78,
                head: [['S.No', 'Item Name', 'Qty', 'Rate', 'Amount']],
                body: tableData,
                theme: 'striped',
                headStyles: { fillColor: [59, 130, 246] },
                foot: [['', '', '', 'Total Sum', `Rs. ${(po.total_amount || 0).toLocaleString('en-IN')}`]],
                footStyles: { fillColor: [248, 250, 252], textColor: [15, 23, 42], fontStyle: 'bold' }
            });

            // ── PDF Footer ────────────────────────────────────────────────────────
            const finalY = (doc.lastAutoTable?.finalY || 150) + 20;
            doc.setFontSize(10);
            doc.text("Authorized Signature", 14, finalY);
            doc.text("___________________", 14, finalY + 5);

            doc.save(`${poNum}_${(po.vendor_name || 'Vendor').replace(/\s+/g, '_')}.pdf`);
        } catch (error) {
            console.error('PDF Generation Error:', error);
            alert('Failed to generate PDF. Please check console for details.');
        }
    };

    const handleVendorClick = (vendor) => { setSelectedVendor(vendor); setIsDetailModalOpen(true); };
    const handlePOClick = (po) => { setSelectedPO(po); setIsPODetailOpen(true); };
    const handleGRNClick = (grn) => { setSelectedGRN(grn); setIsGRNDetailOpen(true); };

    const handleEditVendor = (e, vendor) => {
        e.stopPropagation();
        setEditVendor(vendor);
        setIsVendorModalOpen(true);
    };

    // Delete vendor functionality has been explicitly removed.

    // ── Empty state component ────────────────────────────────────────────────
    const EmptyState = ({ icon: Icon, label, buttonLabel, onAdd }) => (
        <div style={{
            textAlign: 'center', padding: '80px 40px', color: 'var(--text-muted)',
            border: '2px dashed var(--border)', borderRadius: '12px', backgroundColor: '#f8fafc'
        }}>
            <Icon size={56} style={{ margin: '0 auto 20px', opacity: 0.3 }} />
            <h3 style={{ fontWeight: '800', marginBottom: '8px', color: 'var(--text-main)' }}>No {label} Yet</h3>
            <p style={{ marginBottom: '24px', fontSize: '14px' }}>
                Click "{buttonLabel}" to add your first {label.toLowerCase().replace(/s$/, '')}.
            </p>
            <button className="btn btn-primary" onClick={onAdd}>
                <Plus size={16} /> {buttonLabel}
            </button>
        </div>
    );

    return (
        <div className="procurement-container" style={{ position: 'relative' }}>
            <div className="animate-fade-in" style={{ padding: '0 10px 40px 10px' }}>
                {/* ── Header ─────────────────────────────────────────────────── */}
                <div style={{ marginBottom: '32px' }}>
                    <h1 style={{ fontSize: '32px', fontWeight: '800', color: 'var(--text-main)', marginBottom: '4px' }}>Procurement</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '15px' }}>Vendors, Purchase Orders & Goods Receipt</p>
                </div>

                {/* ── KPI Row ────────────────────────────────────────────────── */}
                <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
                    {kpis.map((kpi, i) => (
                        <div 
                            key={i} 
                            className="card kpi-card-clickable" 
                            onClick={() => kpi.id && handleTabChange(kpi.id)}
                            style={{ 
                                padding: '20px', 
                                display: 'flex', 
                                gap: '16px', 
                                borderTop: `4px solid ${kpi.color}`, 
                                borderRadius: '12px', 
                                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                                cursor: kpi.id ? 'pointer' : 'default',
                                transition: 'transform 0.2s ease'
                            }}
                        >
                            <div style={{
                                width: '44px', height: '44px', borderRadius: '10px',
                                backgroundColor: kpi.bgColor, color: kpi.color,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                            }}>
                                <kpi.icon size={22} />
                            </div>
                            <div>
                                <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '2px' }}>{kpi.label}</p>
                                <h4 style={{ fontSize: '24px', fontWeight: '900', color: 'var(--text-main)', margin: 0 }}>{kpi.value}</h4>
                            </div>
                        </div>
                    ))}
                </div>

                {/* ── Tabs ───────────────────────────────────────────────────── */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
                    {[
                        { name: `Vendors (${vendors.length})`, id: 'Vendors', icon: Building2 },
                        { name: `POs (${pos.length})`, id: 'POs', icon: ShoppingCart },
                        { name: `Requests (${requests.length + consolidatedRequests.length})`, id: 'Requests', icon: FileText },
                        { name: `GRN (${grns.length})`, id: 'GRN', icon: Package },
                    ].filter(tab => hasSubTabAccess(user, 'Procurement', tab.id))
                        .map((tab) => {
                            const isActive = activeSection === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => handleTabChange(tab.id)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px',
                                        borderRadius: '8px', border: 'none',
                                        background: isActive ? '#f1f5f9' : 'transparent',
                                        color: isActive ? 'var(--text-main)' : 'var(--text-muted)',
                                        fontWeight: isActive ? '700' : '600', fontSize: '14px', cursor: 'pointer',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    <tab.icon size={16} /> {tab.name}
                                </button>
                            );
                        })}
                </div>

                {/* ── Search + Add ───────────────────────────────────────────── */}
                <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 300px', position: 'relative' }}>
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            type="text"
                            placeholder={`Search ${activeSection.toLowerCase()}...`}
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            style={{
                                width: '100%', padding: '12px 12px 12px 40px', borderRadius: '8px',
                                border: '1px solid var(--border)', backgroundColor: '#f8fafc', fontSize: '15px'
                            }}
                        />
                    </div>
                    {(hasPermission(user, 'Procurement', 'edit') || user?.role === 'Purchase Officer' || user?.role === 'Super Admin' || user?.role === 'Administrator') && (
                        <button
                            className="btn btn-primary"
                            onClick={() => {
                                if (activeSection === 'Vendors') setIsVendorModalOpen(true);
                                if (activeSection === 'POs') setIsPOModalOpen(true);
                                if (activeSection === 'Requests') setIsPOModalOpen(true);
                                if (activeSection === 'GRN') setIsGRNModalOpen(true);
                            }}
                            style={{
                                padding: '12px 28px',
                                borderRadius: '8px',
                                fontWeight: '800',
                                flex: '0 0 auto',
                                justifyContent: 'center',
                                height: '46px'
                            }}
                        >
                            <Plus size={20} />
                            {activeSection === 'Vendors' ? 'ADD VENDOR' : activeSection === 'POs' || activeSection === 'Requests' ? 'CREATE PO' : 'NEW GRN'}
                        </button>
                    )}
                </div>

                {/* ── Content Area ───────────────────────────────────────────── */}
                <div className="animate-fade-in">

                    {/* Vendors */}
                    {activeSection === 'Vendors' && (
                        filteredVendors.length === 0
                            ? <EmptyState icon={Building2} label="Vendors" buttonLabel="ADD VENDOR" onAdd={() => setIsVendorModalOpen(true)} />
                            : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '24px' }}>
                                {filteredVendors.map((vendor) => (
                                    <div key={vendor.id} className="card vendor-card" onClick={() => handleVendorClick(vendor)}
                                        style={{
                                            padding: '0',
                                            overflow: 'hidden',
                                            cursor: 'pointer',
                                            transition: 'all 0.3s ease',
                                            border: '1px solid var(--border)',
                                            borderRadius: '16px',
                                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
                                            background: '#ffffff',
                                            display: 'flex',
                                            flexDirection: 'column'
                                        }}>

                                        <div style={{ padding: '24px', flex: 1 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                                                <div>
                                                    <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-main)', margin: '0 0 8px 0', lineHeight: '1.2' }}>{vendor.name}</h3>
                                                    <span style={{
                                                        background: vendor.category?.toLowerCase() === 'material' ? '#EFF6FF' : '#F5F3FF',
                                                        color: vendor.category?.toLowerCase() === 'material' ? '#3B82F6' : '#8B5CF6',
                                                        padding: '4px 10px',
                                                        borderRadius: '6px',
                                                        fontSize: '11px',
                                                        fontWeight: '800',
                                                        letterSpacing: '0.5px',
                                                        display: 'inline-block',
                                                        textTransform: 'uppercase'
                                                    }}>
                                                        {vendor.category || 'Vendor'}
                                                    </span>
                                                </div>
                                                <div style={{ background: '#F8FAFC', padding: '10px', borderRadius: '12px', border: '1px solid #F1F5F9' }}>
                                                    <Building2 size={20} color="var(--primary)" />
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-main)', fontSize: '13px', fontWeight: '500' }}>
                                                    <div style={{ background: '#F8FAFC', padding: '6px', borderRadius: '6px', color: '#94A3B8' }}><MapPin size={16} /></div>
                                                    {vendor.location || 'Location Not Provided'}
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-main)', fontSize: '13px', fontWeight: '500' }}>
                                                    <div style={{ background: '#F8FAFC', padding: '6px', borderRadius: '6px', color: '#94A3B8' }}><Phone size={16} /></div>
                                                    {vendor.phone || 'Phone Not Provided'}
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ background: '#F8FAFC', padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                VIEW LEDGER & STOCK <ChevronRight size={14} />
                                            </span>
                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                {hasPermission(user, 'Procurement', 'edit') && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleEditVendor(e, vendor);
                                                        }}
                                                        title="Edit Vendor"
                                                        style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px', cursor: 'pointer', color: '#64748B', display: 'flex', alignItems: 'center', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
                                                        onMouseOver={(e) => { e.currentTarget.style.color = '#3B82F6'; e.currentTarget.style.borderColor = '#3B82F6'; }}
                                                        onMouseOut={(e) => { e.currentTarget.style.color = '#64748B'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                                                    >
                                                        <Pencil size={14} />
                                                    </button>
                                                )}
                                                <div style={{ background: '#ECFDF5', border: '1px solid #D1FAE5', padding: '6px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Active Vendor">
                                                    <CheckCircle size={16} color="#10B981" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                    )}

                    {/* Purchase Orders */}
                    {activeSection === 'POs' && (
                        filteredPOs.length === 0
                            ? <EmptyState icon={ShoppingCart} label="Purchase Orders" buttonLabel="CREATE PO" onAdd={() => setIsPOModalOpen(true)} />
                            : <div className="card" style={{ padding: '0' }}>
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>PO Number</th>
                                            <th>Vendor</th>
                                            <th>Project</th>
                                            <th>Status</th>
                                            <th>Admin Review</th>
                                            <th>Share / Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredPOs.map((po) => (
                                            <tr key={po.id}>
                                                <td style={{ fontWeight: '700', color: 'var(--primary)', cursor: 'pointer' }} onClick={() => handlePOClick(po)}>
                                                    PO-{po.id.slice(-6).toUpperCase()}
                                                </td>
                                                <td style={{ fontWeight: '600' }}>{po.vendor_name}</td>
                                                <td>{po.project_name}</td>
                                                <td>
                                                    <span className={`badge ${po.status === 'Approved' ? 'badge-success' : 'badge-warning'}`}>{po.status}</span>
                                                </td>
                                                <td>
                                                    {po.status === 'Pending' ? (
                                                        <button className="btn btn-primary btn-sm" onClick={() => handlePOClick(po)} style={{ padding: '4px 8px', fontSize: '11px' }}>Approve</button>
                                                    ) : (
                                                        <span style={{ color: '#10B981', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: '700' }}><CheckCircle2 size={14} /> Approved</span>
                                                    )}
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                                        <button onClick={() => handlePOClick(po)} title="View Details" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)' }}><Eye size={18} /></button>
                                                        {po.status !== 'Pending' && (
                                                            <>
                                                                <button onClick={() => handleWhatsAppShare(`PO-${po.id.slice(-6).toUpperCase()}`, po.vendor_name)} title="WhatsApp" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#25D366' }}><WhatsAppIcon size={18} /></button>
                                                                <button onClick={() => handleEmailShare(po)} title="Send Email to Vendor" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3B82F6' }}><Mail size={18} /></button>
                                                                <button onClick={() => handleDownloadPO(po)} title="Download PDF" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-main)' }}><Download size={18} /></button>
                                                            </>
                                                        )}
                                                        {po.status === 'Pending' && (
                                                            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600', fontStyle: 'italic' }}>Awaiting Approval</span>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                    )}

                    {/* Material Requests */}
                    {activeSection === 'Requests' && (
                        requests.length === 0
                            ? <EmptyState icon={FileText} label="Approved Material Requests" buttonLabel="CHECK INVENTORY" onAdd={() => window.location.href = '/materials'} />
                            : <div className="card" style={{ padding: '0' }}>
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Project</th>
                                            <th>Engineer</th>
                                            <th>Items Requested</th>
                                            <th>Status</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredRequests.map((req) => (
                                            <tr key={req.id}>
                                                <td style={{ fontSize: '12px' }}>{new Date(req.created_at).toLocaleDateString()}</td>
                                                <td style={{ fontWeight: '700' }}>{req.project_name}</td>
                                                <td style={{ fontSize: '12px' }}>{req.engineer_id}</td>
                                                <td>
                                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                                        {req.requested_items?.map((it, idx) => (
                                                            <div key={idx}>• {it.name} ({it.quantity})</div>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className={`badge ${req.status === 'Approved' ? 'badge-success' : req.status === 'Sent to PO' ? 'badge-info' : 'badge-warning'}`}>
                                                        {req.status || 'Pending'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: '8px' }}>
                                                        {(req.status === 'Pending' && (user.role === 'Purchase Officer' || user.role === 'Super Admin' || user.role === 'Administrator' || user.role === 'Project Coordinator')) && (
                                                            <button
                                                                className="btn btn-outline btn-sm" style={{ fontSize: '10px', padding: '4px 8px', border: '1px solid #10B981', color: '#10B981' }}
                                                                onClick={async () => {
                                                                    try {
                                                                        await inventoryAPI.updateRequestStatus(req.id, { status: 'Approved' });
                                                                        fetchRequests();
                                                                    } catch (err) {
                                                                        alert('Failed to approve request');
                                                                    }
                                                                }}
                                                            >
                                                                APPROVE
                                                            </button>
                                                        )}
                                                        {req.status === 'Approved' && (
                                                            <button
                                                                className="btn btn-primary btn-sm" style={{ fontSize: '11px', padding: '4px 8px' }}
                                                                onClick={() => setIsPOModalOpen(true)}
                                                            >
                                                                CREATE PO
                                                            </button>
                                                        )}
                                                        {req.status === 'Sent to PO' && (
                                                            <span style={{ fontSize: '11px', color: '#10B981', fontWeight: '700' }}>In Process</span>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {filteredRequests.length === 0 && consolidatedRequests.length === 0 && (
                                            <tr><td colSpan="6" style={{ textAlign: 'center', padding: '60px' }}>No matching material requests found.</td></tr>
                                        )}
                                        {consolidatedRequests.map((con, i) => (
                                            <tr key={'con-' + i} style={{ backgroundColor: '#f5f3ff' }}>
                                                <td style={{ fontSize: '12px' }}>{new Date(con.created_at).toLocaleDateString()}</td>
                                                <td style={{ fontWeight: '700', color: '#5b21b6' }}>#CONSOLIDATED</td>
                                                <td style={{ fontSize: '12px' }}>Coordinator ({con.sites?.length} Sites)</td>
                                                <td>
                                                    <div style={{ fontSize: '11px', color: 'var(--text-main)', fontWeight: '600' }}>
                                                        {con.items?.map((it, idx) => (
                                                            <div key={idx}>• {it.name} ({it.quantity})</div>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className={`badge ${con.status === 'PO Created' ? 'badge-success' : 'badge-info'}`}>
                                                        {con.status}
                                                    </span>
                                                </td>
                                                <td>
                                                    {con.status !== 'PO Created' && (
                                                        <button
                                                            className="btn btn-primary btn-sm" style={{ fontSize: '11px', padding: '4px 8px', backgroundColor: '#7c3aed' }}
                                                            onClick={() => setIsPOModalOpen(true)}
                                                        >
                                                            BULK PO
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                    )}

                    {/* GRNs */}
                    {activeSection === 'GRN' && (
                        filteredGRNs.length === 0
                            ? <EmptyState icon={Package} label="GRN Records" buttonLabel="NEW GRN" onAdd={() => setIsGRNModalOpen(true)} />
                            : <div className="card" style={{ padding: '0' }}>
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>GRN ID</th>
                                            <th>PO Reference</th>
                                            <th>Vendor</th>
                                            <th>Summary</th>
                                            <th>Status</th>
                                            <th>Accounts Update</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredGRNs.map((grn) => (
                                            <tr key={grn.id}>
                                                <td style={{ fontWeight: '700' }}>GRN-{grn.id.slice(-6).toUpperCase()}</td>
                                                <td style={{ color: 'var(--primary)', fontWeight: '600' }}>PO-{grn.po_id.slice(-6).toUpperCase()}</td>
                                                <td style={{ fontWeight: '600' }}>
                                                    {pos.find(p => p.id === grn.po_id)?.vendor_name || 'Vendor'}
                                                </td>
                                                <td>{grn.items?.length || 0} items received</td>
                                                <td><span className="badge badge-info">{grn.status}</span></td>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10B981', fontWeight: '700', fontSize: '12px' }}>
                                                        <CheckCircle2 size={14} /> Verified & Update Payable
                                                    </div>
                                                </td>
                                                <td>
                                                    <button onClick={() => handleGRNClick(grn)} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer' }} title="View GRN Details">
                                                        <Eye size={18} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                    )}
                </div>

                <style>{`
                .vendor-card:hover {
                    border-color: var(--primary);
                    transform: translateY(-4px);
                    box-shadow: var(--shadow-lg);
                }
            `}</style>
            </div>

            {/* ── Modals ─────────────────────────────────────────────────── */}
            <VendorModal
                isOpen={isVendorModalOpen}
                onClose={() => { setIsVendorModalOpen(false); setEditVendor(null); }}
                onSuccess={fetchVendors}
                vendor={editVendor}
            />
            <POModal
                isOpen={isPOModalOpen}
                onClose={() => setIsPOModalOpen(false)}
                onSuccess={fetchPOs}
            />
            <GRNModal
                isOpen={isGRNModalOpen}
                onClose={() => setIsGRNModalOpen(false)}
                onSuccess={fetchGRNs}
            />
            <VendorDetailModal isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} vendor={selectedVendor} />
            <PODetailModal
                isOpen={isPODetailOpen}
                onClose={() => setIsPODetailOpen(false)}
                po={selectedPO}
                onSuccess={fetchPOs}
            />
            <GRNDetailModal isOpen={isGRNDetailOpen} onClose={() => setIsGRNDetailOpen(false)} grn={selectedGRN} />
        </div>
    );
};

export default Workflow;

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Package, ShoppingCart, Plus, Search, Filter, Briefcase, FileText, TrendingUp, ClipboardList, Loader2, AlertTriangle, CheckCircle2, Truck, Construction, ArrowRightLeft, Fuel, MapPin, Clock, Gauge, Warehouse, ClipboardCheck, History as HistoryIcon, ArrowDownLeft, Eye, CheckCircle, XCircle, User, LayoutDashboard, Calendar } from 'lucide-react';
import AssetUsageModal from '../components/AssetUsageModal';
import TransferModal from '../components/TransferModal';
import AddAssetModal from '../components/AddAssetModal';
import FuelInventoryModal from '../components/FuelInventoryModal';
import AssetDetailsModal from '../components/AssetDetailsModal';
import MaterialLedgerModal from '../components/MaterialLedgerModal';
import CustomSelect from '../components/CustomSelect';
import { projectAPI, materialAPI, inventoryAPI, fleetAPI } from '../utils/api';
import CreateMaterialModal from '../components/CreateMaterialModal';
import StockRequestModal from '../components/StockRequestModal';
import StockIssueModal from '../components/StockIssueModal';
import StockReturnModal from '../components/StockReturnModal';
import DirectIssueModal from '../components/DirectIssueModal';
import MaterialTransferModal from '../components/MaterialTransferModal';
import { hasPermission, hasSubTabAccess } from '../utils/rbac';
import { useAuth } from '../context/AuthContext';
import Pagination from '../components/Pagination';

const Materials = () => {
    const { user } = useAuth();
    const isCoordinator = ['Project Coordinator', 'Super Admin', 'Administrator'].includes(user?.role);
    const [searchParams, setSearchParams] = useSearchParams();
    const urlTab = searchParams.get('tab');
    const [mainTab, setMainTab] = useState('Materials');

    const availableTabs = useMemo(() => [
        { id: 'Materials', label: 'Construction Materials', icon: Package },
        { id: 'Warehouse', label: 'Warehouse & Stock Control', icon: Warehouse },
        { id: 'Coordination', label: 'Coordination (Consolidation)', icon: ClipboardCheck },
        { id: 'Machinery', label: 'Plant & Machinery', icon: Truck },
    ].filter(tab => hasSubTabAccess(user, 'Inventory Management', tab.id)), [user]);

    useEffect(() => {
        if (urlTab && availableTabs.some(t => t.id === urlTab)) {
            setMainTab(urlTab);
        } else if (isCoordinator && !urlTab) {
            setMainTab('Coordination');
        }
    }, [urlTab, availableTabs, isCoordinator]);

    const handleTabChange = (tabId) => {
        setMainTab(tabId);
        setSearchParams({ tab: tabId });
    };

    const [searchTerm, setSearchTerm] = useState('');

    const [isLedgerModalOpen, setIsLedgerModalOpen] = useState(false);
    const [selectedMaterial, setSelectedMaterial] = useState(null);
    const [projects, setProjects] = useState([]);
    const [inventory, setInventory] = useState([]);
    const [selectedProject, setSelectedProject] = useState('all');
    const [loading, setLoading] = useState(true);
    const [isInventoryLoading, setIsInventoryLoading] = useState(false);
    const [isMaterialTransferOpen, setIsMaterialTransferOpen] = useState(false);

    // Asset States
    const [assetSubTab, setAssetSubTab] = useState('Fleet');
    const [isUsageModalOpen, setIsUsageModalOpen] = useState(false);
    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
    const [isAddAssetModalOpen, setIsAddAssetModalOpen] = useState(false);
    const [isFuelModalOpen, setIsFuelModalOpen] = useState(false);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [selectedAsset, setSelectedAsset] = useState(null);
    const [fleet, setFleet] = useState([]);
    const [dailyLogs, setDailyLogs] = useState([]);
    const [transfers, setTransfers] = useState([]);

    // Warehouse States
    const [warehouseSubTab, setWarehouseSubTab] = useState('Stock');
    const [warehouseStock, setWarehouseStock] = useState([]);
    const [stockRequests, setStockRequests] = useState([]);
    const [stockLedger, setStockLedger] = useState([]);
    const [isCreateMaterialOpen, setIsCreateMaterialOpen] = useState(false);
    const [isStockRequestOpen, setIsStockRequestOpen] = useState(false);
    const [isStockIssueOpen, setIsStockIssueOpen] = useState(false);
    const [isStockReturnOpen, setIsStockReturnOpen] = useState(false);
    const [isDirectIssueOpen, setIsDirectIssueOpen] = useState(false);
    const MAT_PAGE_SIZE = 20;
    const [invPage, setInvPage] = useState(1);
    const [whPage, setWhPage] = useState(1);
    const [reqPage, setReqPage] = useState(1);
    const [ledgerMPage, setLedgerMPage] = useState(1);
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [isWarehouseLoading, setIsWarehouseLoading] = useState(false);

    // Coordination / Consolidation States
    const [coordinationSubTab, setCoordinationSubTab] = useState('Pending'); // Pending, Consolidated
    const [selectedRequestIds, setSelectedRequestIds] = useState([]);
    const [consolidatedRequests, setConsolidatedRequests] = useState([]);
    const [isConsolidating, setIsConsolidating] = useState(false);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const res = await projectAPI.getAll();
                const list = res.data || [];
                setProjects(list);
                setSelectedProject('all');
            } catch (err) {
                console.error('Materials fetch error:', err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    useEffect(() => {
        if (selectedProject) {
            if (selectedProject === 'all') {
                fetchInventory('all');
            } else {
                const proj = projects.find(p => (p._id || p.id) === selectedProject);
                if (proj) {
                    fetchInventory(proj.name);
                }
            }
        }
    }, [selectedProject, projects]);

    const fetchInventory = async (projectName) => {
        setIsInventoryLoading(true);
        try {
            const res = await materialAPI.getInventoryByProject(projectName);
            setInventory(res.data || []);
        } catch (err) {
            console.error('Failed to fetch inventory:', err);
        } finally {
            setIsInventoryLoading(false);
        }
    };

    const fetchWarehouseStock = async () => {
        setIsWarehouseLoading(true);
        try {
            const res = await inventoryAPI.getWarehouseStock();
            setWarehouseStock(res.data || []);
        } catch (err) {
            console.error('Failed to fetch warehouse stock:', err);
        } finally { setIsWarehouseLoading(false); }
    };

    const fetchStockRequests = async () => {
        setIsWarehouseLoading(true);
        try {
            const res = await inventoryAPI.getRequests();
            setStockRequests(res.data || []);
        } catch (err) {
            console.error('Failed to fetch stock requests:', err);
        } finally { setIsWarehouseLoading(false); }
    };

    const fetchStockLedger = async () => {
        setIsWarehouseLoading(true);
        try {
            const res = await inventoryAPI.getLedger();
            setStockLedger(res.data || []);
        } catch (err) {
            console.error('Failed to fetch stock ledger:', err);
        } finally { setIsWarehouseLoading(false); }
    };

    // Bug 42: Fetch fleet/machinery data from backend when Machinery tab is active
    const fetchFleetData = async () => {
        try {
            const res = await fleetAPI.getEquipment();
            const equipment = res.data || [];
            setFleet(equipment.map(e => ({
                id: e.id || e._id,
                equipmentId: e.equipmentId,
                name: e.name || 'N/A',
                category: e.category || 'General',
                site: e.site || 'Yard',
                hours: e.hours || '0h',
                diesel: e.diesel || '',
                status: e.status || 'Working',
                ...e
            })));
        } catch (err) {
            console.error('Failed to fetch equipment data:', err);
        }
    };

    const fetchDailyLogs = async () => {
        try {
            const res = await fleetAPI.getFuelLogs();
            const logs = res.data || [];
            setDailyLogs(logs.map(l => ({
                id: l.id || l._id,
                date: l.date,
                assetName: l.assetName || l.assetId || '',
                site: l.site || '',
                hoursRun: l.hoursRun ? `${l.hoursRun}h` : '—',
                dieselUsed: l.qty ? `${l.qty}L` : '—',
                engineer: l.engineer || ''
            })));
        } catch (err) {
            console.error('Failed to fetch daily logs:', err);
        }
    };

    useEffect(() => {
        if (mainTab === 'Warehouse') {
            if (warehouseSubTab === 'Stock') fetchWarehouseStock();
            else if (warehouseSubTab === 'Requests') fetchStockRequests();
            else if (warehouseSubTab === 'Ledger') fetchStockLedger();
        }
        if (mainTab === 'Coordination') {
            if (coordinationSubTab === 'Pending') fetchStockRequests();
            else fetchConsolidatedRequests();
        }
        if (mainTab === 'Machinery') {
            fetchFleetData();
            fetchDailyLogs();
        }
    }, [mainTab, warehouseSubTab, coordinationSubTab]);

    const fetchConsolidatedRequests = async () => {
        setIsWarehouseLoading(true);
        try {
            const res = await inventoryAPI.getConsolidated();
            setConsolidatedRequests(res.data || []);
        } catch (err) {
            console.error('Failed to fetch consolidated requests:', err);
        } finally { setIsWarehouseLoading(false); }
    };

    const handleConsolidate = async () => {
        if (selectedRequestIds.length === 0) return;
        setIsConsolidating(true);
        try {
            await inventoryAPI.consolidateRequests({ request_ids: selectedRequestIds });
            alert('Material requests consolidated successfully!');
            setSelectedRequestIds([]);
            fetchStockRequests();
            setCoordinationSubTab('Consolidated');
        } catch (err) {
            console.error('Consolidation failed:', err);
            alert('Failed to consolidate requests');
        } finally { setIsConsolidating(false); }
    };

    useEffect(() => {
        fetchStockRequests();
    }, []);

    const currentProjectName = selectedProject === 'all'
        ? 'All Sites'
        : projects.find(p => (p._id || p.id) === selectedProject)?.name || '—';

    const filteredInventory = inventory.filter(item =>
        item.material_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalItemsAtSite = inventory.length;
    const lowStockCount = inventory.filter(item => item.stock < (item.min_stock || 10)).length;

    const handleUpdateMinStock = async (inventoryId, newMinStock) => {
        try {
            await materialAPI.updateInventory(inventoryId, { min_stock: Number(newMinStock) });
            setInventory(prev => prev.map(item => item.id === inventoryId ? { ...item, min_stock: Number(newMinStock) } : item));
        } catch (error) {
            console.error('Failed to update min stock:', error);
            alert('Failed to save minimum stock level');
        }
    };

    // Asset Handlers - Bug 42: Refresh data from backend after changes
    const handleLogAdded = () => { fetchDailyLogs(); };
    const handleAssetAdded = async (newAsset) => {
        await fleetAPI.createEquipment(newAsset);
        await fetchFleetData();
    };
    const handleTransferAdded = (newTransfer) => setTransfers([newTransfer, ...transfers]);
    const handleViewDetails = (asset) => {
        setSelectedAsset(asset);
        setIsDetailsModalOpen(true);
    };

    return (
        <div className="materials-container" style={{ position: 'relative' }}>
            <div className="animate-fade-in" style={{ padding: '0 10px 40px 10px' }}>
                {/* Main Tabs */}
                <div style={{ display: 'flex', gap: '20px', marginBottom: '32px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
                    {availableTabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => handleTabChange(tab.id)}
                            style={{
                                padding: '12px 4px', fontSize: '15px', fontWeight: '800',
                                color: mainTab === tab.id ? 'var(--primary)' : 'var(--text-muted)',
                                borderTop: 'none', borderLeft: 'none', borderRight: 'none',
                                borderBottom: mainTab === tab.id ? '3px solid var(--primary)' : '3px solid transparent',
                                background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px',
                                transition: 'all 0.2s ease', whiteSpace: 'nowrap'
                            }}
                        >
                            <tab.icon size={18} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {mainTab === 'Materials' ? (
                    <div>
                        {/* ── Materials Header ──────────────────────────────────────────────────── */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                            <div>
                                <h2 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '4px' }}>Inventory Management</h2>
                                <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Project-wise inventory tracking and consumption monitoring.</p>
                            </div>
                            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', flex: '1 1 auto', justifyContent: 'flex-end' }}>
                                <button
                                    className="btn btn-outline"
                                    onClick={() => setIsMaterialTransferOpen(true)}
                                    style={{
                                        padding: '12px 24px',
                                        borderRadius: '10px',
                                        fontWeight: '700',
                                        flex: '0 0 auto',
                                        justifyContent: 'center',
                                        height: '46px'
                                    }}
                                >
                                    <ArrowRightLeft size={18} /> TRANSFER MATERIALS
                                </button>
                                <div style={{ flex: '1 1 200px' }}>
                                    <CustomSelect
                                        options={[
                                            { value: 'all', label: 'Total Inventory (All Sites)' },
                                            ...projects.map(p => ({ value: p._id || p.id, label: p.name }))
                                        ]}
                                        value={selectedProject}
                                        onChange={setSelectedProject}
                                        icon={Briefcase}
                                        width="300px"
                                        placeholder="Select Project"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* ── KPI Cards ─────────────────────────────────────────────────── */}
                        <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                            <div className="card" style={{ padding: '20px', display: 'flex', gap: '16px', borderRadius: '8px' }}>
                                <div style={{ width: '44px', height: '44px', borderRadius: '10px', backgroundColor: '#E0F2FE', color: '#0EA5E9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <Package size={22} />
                                </div>
                                <div>
                                    <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Materials at Site</p>
                                    <h4 style={{ fontSize: '24px', fontWeight: '800' }}>{totalItemsAtSite}</h4>
                                </div>
                            </div>
                            <div className="card" style={{ padding: '20px', display: 'flex', gap: '16px', borderRadius: '8px' }}>
                                <div style={{ width: '44px', height: '44px', borderRadius: '10px', backgroundColor: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <AlertTriangle size={22} />
                                </div>
                                <div>
                                    <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Low Stock Alert</p>
                                    <h4 style={{ fontSize: '24px', fontWeight: '800', color: lowStockCount > 0 ? '#ef4444' : 'inherit' }}>{lowStockCount}</h4>
                                </div>
                            </div>
                            <div className="card" style={{ padding: '20px', display: 'flex', gap: '16px', borderRadius: '8px' }}>
                                <div style={{ width: '44px', height: '44px', borderRadius: '10px', backgroundColor: '#ECFDF5', color: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <TrendingUp size={22} />
                                </div>
                                <div>
                                    <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Total Ledger Items</p>
                                    <h4 style={{ fontSize: '24px', fontWeight: '800' }}>{inventory.length}</h4>
                                </div>
                            </div>
                        </div>

                        {/* ── Search ────────────────────────────────────────────────────── */}
                        <div className="card" style={{ marginBottom: '24px', padding: '16px' }}>
                            <div style={{ display: 'flex', gap: '16px' }}>
                                <div style={{ flex: 1, position: 'relative' }}>
                                    <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                    <input
                                        type="text"
                                        placeholder="Search by material name..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        style={{ width: '100%', padding: '10px 12px 10px 40px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: '14px' }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* ── Main Content ──────────────────────────────────────────────── */}
                        {isInventoryLoading ? (
                            <div style={{ padding: '60px', textAlign: 'center' }}>
                                <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto' }} />
                                <p style={{ marginTop: '12px', color: 'var(--text-muted)' }}>Loading inventory...</p>
                            </div>
                        ) : filteredInventory.length === 0 ? (
                            <div className="card" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                <Package size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
                                <h4 style={{ fontWeight: '700' }}>No materials at this site</h4>
                                <p>Perform a GRN or Request Stock from warehouse to see items here.</p>
                            </div>
                        ) : (
                            <div className="card" style={{ padding: 0 }}>
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Material Description</th>
                                            {selectedProject === 'all' && <th>Project</th>}
                                            <th>Current Stock</th>
                                            <th>Min Level</th>
                                            <th>Unit</th>
                                            <th>Status</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredInventory.slice((invPage - 1) * MAT_PAGE_SIZE, invPage * MAT_PAGE_SIZE).map((item) => (
                                            <tr key={item.id}>
                                                <td style={{ fontWeight: '600' }}>{item.material_name}</td>
                                                {selectedProject === 'all' && <td style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{item.project_name}</td>}
                                                <td style={{ fontWeight: '800', fontSize: '16px', color: item.stock < (item.min_stock || 10) ? '#ef4444' : 'inherit' }}>
                                                    {item.stock}
                                                </td>
                                                <td>
                                                    <input
                                                        type="number"
                                                        defaultValue={item.min_stock || 10}
                                                        onBlur={(e) => handleUpdateMinStock(item.id, e.target.value)}
                                                        style={{ width: '60px', padding: '6px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px', textAlign: 'center' }}
                                                    />
                                                </td>
                                                <td style={{ color: 'var(--text-muted)' }}>{item.unit}</td>
                                                <td>
                                                    <span className={`badge ${item.stock < (item.min_stock || 10) ? 'badge-warning' : 'badge-success'}`}>
                                                        {item.stock < (item.min_stock || 10) ? 'Low Stock' : 'In Stock'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <button className="btn btn-outline btn-sm" onClick={() => { setSelectedMaterial(item.material_name); setIsLedgerModalOpen(true); }}>
                                                        View Ledger
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <Pagination currentPage={invPage} totalItems={filteredInventory.length} pageSize={MAT_PAGE_SIZE} onPageChange={setInvPage} />
                            </div>
                        )}
                    </div>
                ) : mainTab === 'Warehouse' ? (
                    <div className="animate-fade-in">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                            <div>
                                <h2 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '4px' }}>Warehouse Stock & Logistics</h2>
                                <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Manage centralized stock, requests, and returns.</p>
                            </div>
                            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', flex: '0 0 auto', justifyContent: 'flex-end' }}>
                                <button className="btn btn-outline" onClick={() => setIsCreateMaterialOpen(true)} style={{ padding: '10px 20px', borderRadius: '8px', fontWeight: '700', flex: '0 0 auto', height: '42px' }}>
                                    <Plus size={18} /> ADD MASTER MATERIAL
                                </button>
                                <button className="btn btn-outline" onClick={() => setIsDirectIssueOpen(true)} style={{ padding: '10px 20px', borderRadius: '8px', fontWeight: '700', flex: '0 0 auto', height: '42px', backgroundColor: '#EFF6FF', borderColor: '#3B82F6', color: '#1D4ED8' }}>
                                    <Truck size={18} /> SEND TO SITE
                                </button>
                                <button className="btn btn-outline" onClick={() => setIsStockReturnOpen(true)} style={{ padding: '10px 20px', borderRadius: '8px', fontWeight: '700', flex: '0 0 auto', height: '42px' }}>
                                    <ArrowDownLeft size={18} /> RECORD RETURN
                                </button>
                                <button className="btn btn-primary" onClick={() => setIsStockRequestOpen(true)} style={{ padding: '10px 20px', borderRadius: '8px', fontWeight: '700', flex: '0 0 auto', height: '42px' }}>
                                    <Plus size={18} /> NEW STOCK REQUEST
                                </button>
                            </div>
                        </div>

                        {/* Sub Tabs */}
                        <div style={{ display: 'flex', gap: '24px', borderBottom: '1px solid var(--border)', marginBottom: '24px', flexWrap: 'wrap' }}>
                            {[
                                { id: 'Stock', label: 'Central Warehouse Stock', icon: Warehouse },
                                { id: 'Requests', label: 'Stock Requests', icon: ClipboardCheck },
                                { id: 'Ledger', label: 'Stock Movement Ledger', icon: HistoryIcon },
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setWarehouseSubTab(tab.id)}
                                    style={{
                                        padding: '12px 0', fontSize: '14px', fontWeight: '700',
                                        color: warehouseSubTab === tab.id ? 'var(--primary)' : 'var(--text-muted)',
                                        borderTop: 'none', borderLeft: 'none', borderRight: 'none',
                                        borderBottom: warehouseSubTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
                                        background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    <tab.icon size={16} />
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        <div className="card" style={{ padding: 0 }}>
                            {isWarehouseLoading ? (
                                <div style={{ padding: '60px', textAlign: 'center' }}>
                                    <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto' }} />
                                </div>
                            ) : warehouseSubTab === 'Stock' ? (<>
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Material Name</th>
                                            <th>Warehouse Stock</th>
                                            <th>Unit</th>
                                            <th>Auto Reorder</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {warehouseStock.slice((whPage - 1) * MAT_PAGE_SIZE, whPage * MAT_PAGE_SIZE).map((item, i) => (
                                            <tr key={i}>
                                                <td style={{ fontWeight: '700' }}>{item.material_name}</td>
                                                <td style={{ fontSize: '16px', fontWeight: '800' }}>{item.stock}</td>
                                                <td>{item.unit}</td>
                                                <td><span className="badge badge-outline">Enabled</span></td>
                                            </tr>
                                        ))}
                                        {warehouseStock.length === 0 && <tr><td colSpan="4" style={{ textAlign: 'center', padding: '40px' }}>No stock found in warehouse.</td></tr>}
                                    </tbody>
                                </table>
                                <Pagination currentPage={whPage} totalItems={warehouseStock.length} pageSize={MAT_PAGE_SIZE} onPageChange={setWhPage} />
                            </>) : warehouseSubTab === 'Requests' ? (<>
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Project/Site</th>
                                            <th>Requested Items</th>
                                            <th>Status</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {stockRequests.slice((reqPage - 1) * MAT_PAGE_SIZE, reqPage * MAT_PAGE_SIZE).map((req, i) => (
                                            <tr key={i}>
                                                <td style={{ fontSize: '13px' }}>{new Date(req.created_at).toLocaleDateString()}</td>
                                                <td style={{ fontWeight: '700' }}>{req.project_name}</td>
                                                <td>
                                                    <div style={{ fontSize: '12px' }}>
                                                        {req.requested_items?.map((it, idx) => (
                                                            <div key={idx}>{it.name} - {it.quantity} {it.unit}</div>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className={`badge ${req.status === 'Approved' ? 'badge-info' :
                                                        req.status === 'Issued' ? 'badge-success' :
                                                            req.status === 'Rejected' ? 'badge-danger' :
                                                                'badge-warning'
                                                        }`}>
                                                        {req.status}
                                                    </span>
                                                </td>
                                                <td>
                                                    {(req.status === 'Pending' || req.status === 'Approved') && (
                                                        <button className="btn btn-primary btn-sm" onClick={() => { setSelectedRequest(req); setIsStockIssueOpen(true); }}>
                                                            ISSUE STOCK
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <Pagination currentPage={reqPage} totalItems={stockRequests.length} pageSize={MAT_PAGE_SIZE} onPageChange={setReqPage} />
                            </>) : (<>
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Type</th>
                                            <th>Material</th>
                                            <th>Site/Project</th>
                                            <th style={{ textAlign: 'right' }}>In</th>
                                            <th style={{ textAlign: 'right' }}>Out</th>
                                            <th>Ref</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {stockLedger.slice((ledgerMPage - 1) * MAT_PAGE_SIZE, ledgerMPage * MAT_PAGE_SIZE).map((log, i) => (
                                            <tr key={i}>
                                                <td style={{ fontSize: '11px' }}>{new Date(log.date).toLocaleString()}</td>
                                                <td>
                                                    <span style={{ fontSize: '10px', fontWeight: '800', padding: '2px 4px', borderRadius: '4px', backgroundColor: '#f3f4f6' }}>
                                                        {log.type.toUpperCase()}
                                                    </span>
                                                </td>
                                                <td style={{ fontWeight: '700' }}>{log.material_name}</td>
                                                <td style={{ fontSize: '13px' }}>{log.project_name || 'Warehouse'}</td>
                                                <td style={{ textAlign: 'right', color: '#10B981', fontWeight: '700' }}>{log.in > 0 ? `+${log.in}` : '—'}</td>
                                                <td style={{ textAlign: 'right', color: '#EF4444', fontWeight: '700' }}>{log.out > 0 ? `-${log.out}` : '—'}</td>
                                                <td style={{ fontSize: '10px', opacity: 0.6 }}>{log.ref}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <Pagination currentPage={ledgerMPage} totalItems={stockLedger.length} pageSize={MAT_PAGE_SIZE} onPageChange={setLedgerMPage} />
                            </>)}
                        </div>
                    </div>
                ) : mainTab === 'Coordination' ? (
                    <div className="animate-fade-in">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <div>
                                <h2 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '4px' }}>Material Consolidation</h2>
                                <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Select multiple site requests to combine them for the Purchase Officer.</p>
                            </div>
                            {coordinationSubTab === 'Pending' && selectedRequestIds.length > 0 && (
                                <button
                                    className="btn btn-primary"
                                    onClick={handleConsolidate}
                                    disabled={isConsolidating}
                                    style={{ padding: '12px 24px', borderRadius: '10px' }}
                                >
                                    {isConsolidating ? <Loader2 size={18} className="animate-spin" /> : <ClipboardCheck size={18} />}
                                    CONSOLIDATE {selectedRequestIds.length} REQUESTS
                                </button>
                            )}
                        </div>

                        {/* Sub Tabs */}
                        <div style={{ display: 'flex', gap: '24px', borderBottom: '1px solid var(--border)', marginBottom: '24px' }}>
                            {[
                                { id: 'Pending', label: 'Pending Site Requests', icon: Clock },
                                { id: 'Consolidated', label: 'Consolidated for Purchase', icon: FileText },
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setCoordinationSubTab(tab.id)}
                                    style={{
                                        padding: '12px 0', fontSize: '14px', fontWeight: '700',
                                        color: coordinationSubTab === tab.id ? 'var(--primary)' : 'var(--text-muted)',
                                        borderTop: 'none', borderLeft: 'none', borderRight: 'none',
                                        borderBottom: coordinationSubTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
                                        background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
                                    }}
                                >
                                    <tab.icon size={16} />
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        <div className="card" style={{ padding: 0 }}>
                            {isWarehouseLoading ? (
                                <div style={{ padding: '60px', textAlign: 'center' }}>
                                    <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto' }} />
                                </div>
                            ) : coordinationSubTab === 'Pending' ? (
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Select</th>
                                            <th>Date</th>
                                            <th>Project/Site</th>
                                            <th>Requested Items</th>
                                            <th>Priority</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {stockRequests.filter(r => r.status === 'Pending').map((req, i) => (
                                            <tr key={i}>
                                                <td>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedRequestIds.includes(req.id)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) setSelectedRequestIds([...selectedRequestIds, req.id]);
                                                            else setSelectedRequestIds(selectedRequestIds.filter(id => id !== req.id));
                                                        }}
                                                        style={{ width: '18px', height: '18px' }}
                                                    />
                                                </td>
                                                <td style={{ fontSize: '13px' }}>{new Date(req.created_at).toLocaleDateString()}</td>
                                                <td style={{ fontWeight: '700' }}>{req.project_name}</td>
                                                <td>
                                                    <div style={{ fontSize: '12px' }}>
                                                        {req.requested_items?.map((it, idx) => (
                                                            <div key={idx}>{it.name} - {it.quantity} {it.unit}</div>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className={`badge ${req.priority === 'High' ? 'badge-danger' : 'badge-warning'}`}>
                                                        {req.priority}
                                                    </span>
                                                </td>
                                                <td><span className="badge badge-warning">{req.status}</span></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Reference</th>
                                            <th>Sites Combined</th>
                                            <th>Items Summary</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {consolidatedRequests.map((con, i) => (
                                            <tr key={i}>
                                                <td style={{ fontSize: '13px' }}>{new Date(con.created_at).toLocaleDateString()}</td>
                                                <td style={{ fontWeight: '700', color: 'var(--primary)' }}>#CON-{con.id.slice(-6).toUpperCase()}</td>
                                                <td style={{ fontSize: '13px' }}>{con.sites?.join(', ')}</td>
                                                <td>
                                                    <div style={{ fontSize: '12px' }}>
                                                        {con.items?.map((it, idx) => (
                                                            <div key={idx}>{it.name} - {it.quantity} {it.unit}</div>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td><span className="badge badge-success">{con.status}</span></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="animate-fade-in">
                        <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                            <div>
                                <h2 style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-main)', marginBottom: '4px' }}>Plant & Machinery</h2>
                                <p style={{ color: 'var(--text-muted)', fontSize: '15px' }}>Equipment tracking, diesel consumption & site logistics</p>
                            </div>
                            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', flex: '0 0 auto', justifyContent: 'flex-end' }}>
                                <button className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '0 0 auto', padding: '10px 20px', borderRadius: '8px', fontWeight: '700', height: '42px' }} onClick={() => setIsFuelModalOpen(true)}>
                                    <Fuel size={18} /> FUEL INVENTORY
                                </button>
                                <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '0 0 auto', padding: '10px 24px', borderRadius: '8px', fontWeight: '700', height: '42px' }} onClick={() => assetSubTab === 'Fleet' ? setIsAddAssetModalOpen(true) : assetSubTab === 'Logs' ? setIsUsageModalOpen(true) : setIsTransferModalOpen(true)}>
                                    <Plus size={18} /> ADD {assetSubTab.toUpperCase()}
                                </button>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '20px', borderBottom: '1px solid var(--border)', marginBottom: '32px', flexWrap: 'wrap' }}>
                            {[
                                { id: 'Fleet', label: 'Equipment Fleet', icon: Construction },
                                { id: 'Logs', label: 'Daily Usage Logs', icon: ClipboardList },
                                { id: 'Transfers', label: 'Site Transfers', icon: ArrowRightLeft },
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setAssetSubTab(tab.id)}
                                    style={{
                                        padding: '12px 4px', fontSize: '14px', fontWeight: '700',
                                        color: assetSubTab === tab.id ? 'var(--primary)' : 'var(--text-muted)',
                                        borderTop: 'none', borderLeft: 'none', borderRight: 'none',
                                        borderBottom: assetSubTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
                                        background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    <tab.icon size={16} />
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        <div className="card" style={{ padding: 0 }}>
                            {assetSubTab === 'Fleet' ? (
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Equipment ID</th>
                                            <th>Machine Name</th>
                                            <th>Category</th>
                                            <th>Current Site</th>
                                            <th>Total Hours</th>
                                            <th>Status</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {fleet.map((item, i) => (
                                            <tr key={i}>
                                                <td style={{ fontWeight: '700' }}>{item.equipmentId || item.id?.slice(-6).toUpperCase()}</td>
                                                <td>{item.name}</td>
                                                <td>{item.category}</td>
                                                <td>{item.site}</td>
                                                <td>{item.hours}</td>
                                                <td><span className="badge badge-success">{item.status}</span></td>
                                                <td><button onClick={() => handleViewDetails(item)} className="btn btn-outline btn-sm">Details</button></td>
                                            </tr>
                                        ))}
                                        {fleet.length === 0 && <tr><td colSpan="7" style={{ textAlign: 'center', padding: '60px' }}>No equipment found.</td></tr>}
                                    </tbody>
                                </table>
                            ) : assetSubTab === 'Logs' ? (
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Asset ID</th>
                                            <th>Project Site</th>
                                            <th>Hours Run</th>
                                            <th>Diesel Used</th>
                                            <th>Engineer</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {dailyLogs.map((log, i) => (
                                            <tr key={i}>
                                                <td>{log.date}</td>
                                                <td style={{ fontWeight: '600' }}>{log.assetName}</td>
                                                <td>{log.site}</td>
                                                <td>{log.hoursRun}</td>
                                                <td style={{ color: '#B45309', fontWeight: '700' }}>{log.dieselUsed}</td>
                                                <td>{log.engineer}</td>
                                            </tr>
                                        ))}
                                        {dailyLogs.length === 0 && <tr><td colSpan="6" style={{ textAlign: 'center', padding: '60px' }}>No logs found.</td></tr>}
                                    </tbody>
                                </table>
                            ) : (
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Transfer ID</th>
                                            <th>Type</th>
                                            <th>Item</th>
                                            <th>From</th>
                                            <th>To</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {transfers.map((trf, i) => (
                                            <tr key={i}>
                                                <td>{trf.id}</td>
                                                <td>{trf.type}</td>
                                                <td>{trf.item}</td>
                                                <td>{trf.from}</td>
                                                <td>{trf.to}</td>
                                                <td><span className="badge badge-info">{trf.status}</span></td>
                                            </tr>
                                        ))}
                                        {transfers.length === 0 && <tr><td colSpan="6" style={{ textAlign: 'center', padding: '60px' }}>No transfers found.</td></tr>}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <MaterialLedgerModal isOpen={isLedgerModalOpen} onClose={() => setIsLedgerModalOpen(false)} materialName={selectedMaterial} projectName={currentProjectName} />
            <AssetUsageModal isOpen={isUsageModalOpen} onClose={() => setIsUsageModalOpen(false)} onLogAdded={handleLogAdded} fleet={fleet} />
            <TransferModal isOpen={isTransferModalOpen} onClose={() => setIsTransferModalOpen(false)} onTransferAdded={handleTransferAdded} projects={projects} />
            <AddAssetModal isOpen={isAddAssetModalOpen} onClose={() => setIsAddAssetModalOpen(false)} onAssetAdded={handleAssetAdded} />
            <FuelInventoryModal isOpen={isFuelModalOpen} onClose={() => setIsFuelModalOpen(false)} projectName={currentProjectName} />
            <AssetDetailsModal
                isOpen={isDetailsModalOpen}
                onClose={() => setIsDetailsModalOpen(false)}
                asset={selectedAsset}
                onEdit={(asset) => {
                    const assetId = asset?.id || asset?._id;
                    if (!assetId) return;
                    const updateData = window.prompt('Edit status (Working / Idle / Maintenance):', asset?.status || 'Working');
                    if (updateData && updateData.trim()) {
                        fleetAPI.updateEquipment(assetId, { status: updateData.trim() })
                            .then(() => { fetchFleetData(); setIsDetailsModalOpen(false); })
                            .catch(err => alert('Update failed: ' + err.message));
                    }
                }}
                onDownloadLog={(asset) => {
                    const name = asset?.equipmentId || asset?.name || 'Asset';
                    const data = JSON.stringify(asset, null, 2);
                    const blob = new Blob([data], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url; a.download = `${name}_log.json`; a.click();
                    URL.revokeObjectURL(url);
                }}
                onTransferHistory={(asset) => {
                    setSelectedAsset(null);
                    setIsDetailsModalOpen(false);
                    setSearchTerm(asset?.equipmentId || asset?.name || '');
                }}
                onScheduleService={(asset) => {
                    const assetId = asset?.id || asset?._id;
                    if (!assetId) return;
                    fleetAPI.updateEquipment(assetId, { status: 'Maintenance' })
                        .then(() => { fetchFleetData(); setIsDetailsModalOpen(false); alert('Status set to Maintenance'); })
                        .catch(err => alert('Failed: ' + err.message));
                }}
            />

            <CreateMaterialModal isOpen={isCreateMaterialOpen} onClose={() => setIsCreateMaterialOpen(false)} onSuccess={() => { fetchWarehouseStock(); setIsCreateMaterialOpen(false); }} />
            <StockRequestModal isOpen={isStockRequestOpen} onClose={() => setIsStockRequestOpen(false)} onSuccess={() => { fetchStockRequests(); setIsStockRequestOpen(false); }} />
            {selectedRequest && <StockIssueModal isOpen={isStockIssueOpen} onClose={() => setIsStockIssueOpen(false)} request={selectedRequest} onSuccess={() => { fetchStockRequests(); fetchWarehouseStock(); setIsStockIssueOpen(false); }} />}
            <StockReturnModal isOpen={isStockReturnOpen} onClose={() => setIsStockReturnOpen(false)} onSuccess={() => { fetchWarehouseStock(); fetchInventory(currentProjectName); setIsStockReturnOpen(false); }} />
            <DirectIssueModal isOpen={isDirectIssueOpen} onClose={() => setIsDirectIssueOpen(false)} onSuccess={() => { fetchWarehouseStock(); fetchInventory(currentProjectName); setIsDirectIssueOpen(false); }} />
            <MaterialTransferModal isOpen={isMaterialTransferOpen} onClose={() => setIsMaterialTransferOpen(false)} onSuccess={() => { fetchInventory(currentProjectName); setIsMaterialTransferOpen(false); }} />
        </div>
    );
};

export default Materials;

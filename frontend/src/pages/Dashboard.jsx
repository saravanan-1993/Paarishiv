import React, { useState, useEffect } from 'react';
import {
    Briefcase, CheckCircle, Wallet, TrendingUp,
    Package, Users, AlertTriangle, Store, Loader2,
    RefreshCw, ArrowRight, Clock, Activity, PieChart as PieChartIcon, Target, ChevronDown,
    Coffee, Briefcase as BriefcaseIcon, UserCircle, LogOut, Warehouse, IndianRupee, HardHat, FileText
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, PieChart, Pie, Cell, LabelList, Legend
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { projectAPI, hrmsAPI, attendanceAPI, approvalsAPI, workflowAPI, financeAPI, billingAPI, inventoryAPI, labourAttendanceAPI, logsAPI } from '../utils/api';
import { hasPermission, hasDashboardCard } from '../utils/rbac';
import WorkspaceView from '../components/dashboards/WorkspaceView';
import HRView from '../components/dashboards/HRView';
import AccountsView from '../components/dashboards/AccountsView';
import GeneralManagerView from '../components/dashboards/GeneralManagerView';
import PurchaseOfficerView from '../components/dashboards/PurchaseOfficerView';
import InventoryManagerView from '../components/dashboards/InventoryManagerView';
import ProjectCoordinatorView from '../components/dashboards/ProjectCoordinatorView';
import AttendanceWidget from '../components/dashboards/AttendanceWidget';

const STATUS_COLORS = {
    Ongoing: '#3B82F6',   // Blue
    Completed: '#10B981', // Green
    Delayed: '#EF4444',   // Red
    'On Hold': '#F59E0B'  // Orange
};

const STATUS_BADGE = {
    Ongoing: { bg: '#DBEAFE', text: '#1D4ED8' },
    Completed: { bg: '#D1FAE5', text: '#047857' },
    'On Hold': { bg: '#FEF3C7', text: '#B45309' },
    Delayed: { bg: '#FEE2E2', text: '#B91C1C' },
};

const fmt = (n) => {
    if (!n && n !== 0) return '₹0';
    if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
    if (n >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
    return `₹${Number(n).toLocaleString('en-IN')}`;
};

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                padding: '12px 16px',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                minWidth: '150px'
            }}>
                <p style={{ fontWeight: '700', marginBottom: '8px', color: '#1e293b' }}>{label}</p>
                {payload.map((entry, index) => (
                    <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: entry.color }} />
                        <span style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: '500' }}>{entry.name}:</span>
                        <span style={{ fontWeight: '700', color: entry.color }}>₹{entry.value}L</span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

const Dashboard = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    // Role Resolution
    const userRoleStr = (user?.role || '').toLowerCase();

    // Super Admin / MD (Also acts as fallback for "Administrator" default role)
    const isSuperAdmin = userRoleStr.includes('admin') || userRoleStr.includes('md') || userRoleStr.includes('director') || userRoleStr === 'administrator';

    // New Roles
    const isGM = userRoleStr.includes('general manager') || userRoleStr === 'gm';
    const isHR = userRoleStr.includes('hr') || userRoleStr.includes('human');
    const isAccountant = userRoleStr.includes('account') || userRoleStr.includes('finance');
    const isPurchaseOfficer = userRoleStr.includes('purchase') || userRoleStr.includes('procurement');
    const isInventoryManager = userRoleStr.includes('inventory') || userRoleStr.includes('store');
    const isProjectCoordinator = userRoleStr.includes('coordinator') || userRoleStr.includes('pm') || userRoleStr.includes('project manager');

    // Field Engineer fallback view - "Site Engineer"
    const isESS = userRoleStr.includes('engineer') || userRoleStr.includes('site engineer') || (!isSuperAdmin && !isGM && !isHR && !isAccountant && !isPurchaseOfficer && !isInventoryManager && !isProjectCoordinator);

    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [lastSync, setLastSync] = useState(null);
    const [hrmsStats, setHrmsStats] = useState(null);
    const [pendingApprovalsAmount, setPendingApprovalsAmount] = useState(0);
    const [workflowOverview, setWorkflowOverview] = useState([]);

    // New dashboard data
    const [financeSummary, setFinanceSummary] = useState({ totalExpenses: 0, totalReceived: 0, totalBilled: 0 });
    const [warehouseSummary, setWarehouseSummary] = useState({ items: [], totalValue: 0, lowStock: 0 });
    const [labourSummary, setLabourSummary] = useState({ todayCount: 0, monthCost: 0 });
    const [recentActivities, setRecentActivities] = useState([]);

    // Attendance State
    const [attendanceStatus, setAttendanceStatus] = useState(null);
    const [isClocking, setIsClocking] = useState(false);
    const [timer, setTimer] = useState({ work: 0, break: 0, official: 0 });
    const [isAwayMenuOpen, setIsAwayMenuOpen] = useState(false);

    const formatTimer = (seconds) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    useEffect(() => {
        const handleClickOutside = () => setIsAwayMenuOpen(false);
        if (isAwayMenuOpen) {
            window.addEventListener('mousedown', handleClickOutside);
        }
        return () => window.removeEventListener('mousedown', handleClickOutside);
    }, [isAwayMenuOpen]);

    useEffect(() => {
        let interval;
        if (attendanceStatus?.current_session && !attendanceStatus.current_session.check_out) {
            interval = setInterval(() => {
                const now = new Date();
                const checkIn = new Date(attendanceStatus.current_session.check_in);
                let totalSecs = Math.floor((now - checkIn) / 1000);
                let totalBreakSecs = 0;
                let activeOfficialSecs = 0;
                attendanceStatus.current_session.breaks.forEach(b => {
                    const start = new Date(b.start);
                    const end = b.end ? new Date(b.end) : now;
                    let bDuration = Math.floor((end - start) / 1000);
                    if (b.type === "Official Duty") {
                        activeOfficialSecs += bDuration;
                    } else {
                        totalBreakSecs += bDuration;
                    }
                });
                setTimer({
                    work: Math.max(0, totalSecs - totalBreakSecs),
                    break: totalBreakSecs,
                    official: activeOfficialSecs
                });
            }, 1000);
        } else {
            setTimer({ work: 0, break: 0, official: 0 });
        }
        return () => clearInterval(interval);
    }, [attendanceStatus]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await projectAPI.getAll();
            setProjects(res.data || []);
            setLastSync(new Date());

            const attRes = await attendanceAPI.getSummary();
            setAttendanceStatus(attRes.data);

            if (hasPermission(user, 'HRMS', 'view')) {
                const hrStats = await hrmsAPI.getStats();
                setHrmsStats(hrStats.data);
            }

            if (hasDashboardCard(user, 'approvals_card') || isSuperAdmin) {
                try {
                    const appRes = await approvalsAPI.getPending();
                    const tot = (appRes.data.leaves?.length || 0) +
                        (appRes.data.purchase_orders?.length || 0) +
                        (appRes.data.materials?.length || 0);
                    setPendingApprovalsAmount(tot);
                } catch (e) {
                    console.error("Failed to load approvals context data", e);
                }
            }

            if (hasDashboardCard(user, 'recent_activities') || hasDashboardCard(user, 'overview_stats') || isSuperAdmin) {
                try {
                    const wfRes = await workflowAPI.getDashboardOverview();
                    setWorkflowOverview(wfRes.data || []);
                } catch (e) {
                    console.error("Failed to load workflow data", e);
                }
            }

            // Fetch finance summary
            if (isSuperAdmin || isAccountant || isGM) {
                try {
                    const [expRes, billRes] = await Promise.all([
                        financeAPI.getExpenses(),
                        billingAPI.getAll(),
                    ]);
                    const exps = expRes.data || [];
                    const bills = billRes.data || [];
                    setFinanceSummary({
                        totalExpenses: exps.reduce((s, e) => s + parseFloat(e.amount || 0), 0),
                        totalReceived: bills.reduce((s, b) => s + parseFloat(b.collection_amount || 0), 0),
                        totalBilled: bills.reduce((s, b) => s + parseFloat(b.total_amount || 0), 0),
                    });
                } catch (e) { console.warn('Finance summary failed', e); }
            }

            // Fetch warehouse summary
            if (isSuperAdmin || isInventoryManager) {
                try {
                    const whRes = await inventoryAPI.getWarehouse();
                    const whItems = whRes.data || [];
                    const mwRes = await inventoryAPI.getMaterialWiseReport();
                    const mwData = mwRes.data || [];
                    const totalVal = mwData.reduce((s, m) => s + (m.total_value || 0), 0);
                    const lowCount = whItems.filter(w => w.stock > 0 && w.stock < 10).length;
                    setWarehouseSummary({ items: whItems, totalValue: totalVal, lowStock: lowCount, totalItems: whItems.length });
                } catch (e) { console.warn('Warehouse summary failed', e); }
            }

            // Fetch labour summary
            if (isSuperAdmin || isGM || isProjectCoordinator) {
                try {
                    const today = new Date().toISOString().split('T')[0];
                    const laRes = await labourAttendanceAPI.getAll({ date: today });
                    const todayRecs = laRes.data || [];
                    const todayCount = todayRecs.reduce((s, r) => s + (r.total_count || 0), 0);
                    const todayCost = todayRecs.reduce((s, r) => s + (r.day_cost || 0), 0);
                    setLabourSummary({ todayCount, todayCost, records: todayRecs.length });
                } catch (e) { console.warn('Labour summary failed', e); }
            }

            // Fetch recent activities
            if (isSuperAdmin || isGM) {
                try {
                    const logRes = await logsAPI.getLogs(10);
                    setRecentActivities((logRes.data || []).slice(0, 10));
                } catch (e) { console.warn('Activity logs failed', e); }
            }

        } catch (err) {
            console.error('Dashboard fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleClockAction = async (action, metadata = {}) => {
        setIsClocking(true);
        try {
            let position = null;
            if (action === 'in' || action === 'out') {
                try {
                    position = await new Promise((resolve, reject) => {
                        navigator.geolocation.getCurrentPosition(resolve, reject, {
                            enableHighAccuracy: true,
                            timeout: 5000,
                            maximumAge: 0
                        });
                    });
                } catch (posError) {
                    console.warn("Location not provided, proceeding without it:", posError);
                    // Location is now optional, just proceed with position as null
                }
            }

            let res;
            if (action === 'in') {
                res = await attendanceAPI.clockIn({
                    location: 'Site Office',
                    latitude: position?.coords.latitude,
                    longitude: position?.coords.longitude
                });
            }
            else if (action === 'out') {
                res = await attendanceAPI.clockOut({
                    latitude: position?.coords.latitude,
                    longitude: position?.coords.longitude
                });
            }
            else if (action === 'break-start') res = await attendanceAPI.startBreak(metadata);
            else if (action === 'break-end') res = await attendanceAPI.endBreak();

            if (res) fetchData();
        } catch (err) {
            console.error('Clock action error:', err);
            alert('Action failed: ' + (err.response?.data?.detail || 'Please try again.'));
        } finally {
            setIsClocking(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    // ── Derived Global Stats ────────────────────────────────────────────────
    const totalBudget = projects.reduce((s, p) => s + (p.budget || 0), 0);
    const totalSpent = projects.reduce((s, p) => s + (p.spent || 0), 0);
    const totalReceived = financeSummary.totalReceived || projects.reduce((s, p) => s + (p.receivedAmount || 0), 0);
    const totalPending = Math.max(0, totalBudget - totalReceived);
    const totalRemaining = Math.max(0, totalBudget - totalSpent);
    const overallUtilization = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
    const activeProjectsCount = projects.filter(p => p.status === 'Ongoing').length;

    // Project Info KPI Data
    const projectKPIs = [
        {
            label: 'Active Projects',
            value: activeProjectsCount,
            icon: Briefcase,
            color: '#3B82F6',
            bg: '#EFF6FF'
        },
        {
            label: 'Total Contract Value',
            value: fmt(totalBudget),
            icon: Target,
            color: '#8B5CF6',
            bg: '#F5F3FF'
        },
        {
            label: 'Received Amount',
            value: fmt(totalReceived),
            icon: CheckCircle,
            color: '#10B981',
            bg: '#ECFDF5'
        },
        {
            label: 'Pending Amount',
            value: fmt(totalPending),
            icon: Wallet,
            color: '#F59E0B',
            bg: '#FEF3C7'
        },
    ];

    const financialKPIs = [
        {
            label: 'Total Budget',
            value: fmt(totalBudget),
            icon: Target,
            color: '#3B82F6',
            bg: '#EFF6FF'
        },
        {
            label: 'Total Spent',
            value: fmt(totalSpent),
            icon: TrendingUp,
            color: '#EF4444',
            bg: '#FEF2F2'
        },
        {
            label: 'Remaining Budget',
            value: fmt(totalRemaining),
            icon: Wallet,
            color: '#10B981',
            bg: '#ECFDF5'
        },
        {
            label: 'Utilization',
            value: `${overallUtilization.toFixed(1)}%`,
            icon: Activity,
            color: '#8B5CF6',
            bg: '#F5F3FF'
        },
    ];

    // Detailed project data for bar chart
    const budgetChartData = projects.slice(0, 6).map(p => ({
        name: p.name?.length > 10 ? p.name.slice(0, 10) + '…' : p.name,
        Budget: parseFloat((p.budget / 100000).toFixed(2)) || 0,
        Spent: parseFloat((p.spent / 100000).toFixed(2)) || 0,
        utilization: p.budget > 0 ? Math.round((p.spent / p.budget) * 100) : 0
    }));

    // Status donut chart
    const statusCounts = [
        { name: 'Ongoing', value: projects.filter(p => p.status === 'Ongoing').length },
        { name: 'Completed', value: projects.filter(p => p.status === 'Completed').length },
        { name: 'Delayed', value: projects.filter(p => p.status === 'Delayed').length },
    ].filter(d => d.value > 0);

    const recentProjects = [...projects]
        .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
        .slice(0, 5);

    return (
        <div className="dashboard-container" style={{ position: 'relative' }}>
            <div className="dashboard-page animate-fade-in" style={{ padding: '0 10px 40px' }}>
                {/* ── Header ──────────────────────────────────────────────────────── */}
                <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', ...(isESS || isHR || isAccountant || isGM || isPurchaseOfficer || isInventoryManager || isProjectCoordinator ? { display: 'none' } : {}) }}>
                    <div>
                        <h2 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-main)', marginBottom: '4px' }}>
                            Executive Dashboard
                        </h2>
                        <p style={{ color: 'var(--text-muted)', fontSize: '14px', fontWeight: '500' }}>
                            {lastSync ? `Live financial overview · Synced at ${lastSync.toLocaleTimeString('en-IN')}` : 'Loading live data...'}
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button
                            onClick={fetchData}
                            style={{
                                background: 'white',
                                border: '1px solid var(--border)',
                                padding: '10px 16px',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                fontWeight: '600',
                                color: 'var(--text-main)',
                                boxShadow: 'var(--shadow-sm)'
                            }}
                        >
                            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                            Refresh
                        </button>
                    </div>
                    <style>{`.animate-spin { animation: spin 1s linear infinite; } @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
                </div>

                {/* ── Pending Approvals Banner ─────────────────────────────── */}
                {(hasDashboardCard(user, 'approvals_card') || isSuperAdmin) && pendingApprovalsAmount > 0 && (
                    <div
                        onClick={() => navigate('/approvals')}
                        style={{
                            background: '#EFF6FF',
                            border: '1px solid #BFDBFE',
                            padding: '16px 20px',
                            borderRadius: '12px',
                            marginBottom: '32px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            cursor: 'pointer',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{ backgroundColor: '#DBEAFE', color: '#1D4ED8', padding: '10px', borderRadius: '8px', flexShrink: 0 }}>
                                <AlertTriangle size={24} />
                            </div>
                            <div>
                                <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1E3A8A', marginBottom: '2px' }}>Approval Required</h3>
                                <p style={{ fontSize: '14px', color: '#1E40AF', margin: 0 }}>You have {pendingApprovalsAmount} pending requests that need your attention.</p>
                            </div>
                        </div>
                        <div style={{ color: '#1D4ED8', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600', fontSize: '14px' }}>
                            Review Now <ArrowRight size={16} />
                        </div>
                    </div>
                )}

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '100px 0', color: 'var(--text-muted)' }}>
                        <Loader2 size={40} className="animate-spin" style={{ margin: '0 auto 16px', color: 'var(--primary)' }} />
                        <h3 style={{ fontWeight: '600', fontSize: '16px' }}>Aggregating data...</h3>
                    </div>
                ) : (
                    <>
                        {/* ── Attendance Widget for all regular roles ─────────────────── */}
                        {!isSuperAdmin && (
                            <AttendanceWidget
                                attendanceStatus={attendanceStatus}
                                isClocking={isClocking}
                                timer={timer}
                                formatTimer={formatTimer}
                                handleClockAction={handleClockAction}
                                isAwayMenuOpen={isAwayMenuOpen}
                                setIsAwayMenuOpen={setIsAwayMenuOpen}
                            />
                        )}

                        {/* ── KPI Summary Cards (Financials) ─────────────────────────────── */}
                        {(hasDashboardCard(user, 'overview_stats') || isSuperAdmin) && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '32px' }}>
                                {financialKPIs.map((kpi, i) => (
                                    <div key={i} className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '14px', borderLeft: `4px solid ${kpi.color}` }}>
                                        <div style={{ padding: '12px', borderRadius: '10px', backgroundColor: kpi.bg, color: kpi.color, flexShrink: 0 }}>
                                            <kpi.icon size={24} />
                                        </div>
                                        <div>
                                            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '600', textTransform: 'uppercase' }}>{kpi.label}</p>
                                            <h3 style={{ fontSize: '24px', fontWeight: '700', lineHeight: 1 }}>{kpi.value}</h3>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* ── Charts Row ────────────────────────────────────────── */}
                        {(hasDashboardCard(user, 'budget_overview') || hasDashboardCard(user, 'overview_stats') || isSuperAdmin) && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '24px', marginBottom: '32px' }}>

                                {/* Section 1: Budget vs Spent Chart */}
                                <div className="card" style={{ padding: '24px' }}>
                                    <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-main)', marginBottom: '4px' }}>Budget vs Spent Analysis</h3>
                                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px' }}>Values in Lakhs (₹L) · Real-time financial utilization</p>

                                    {budgetChartData.length > 0 ? (
                                        <div>
                                            <div style={{ height: '300px', width: '100%' }}>
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <BarChart data={budgetChartData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }} barSize={30} >
                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-muted)' }} dy={10} />
                                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
                                                        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F8FAFC' }} />
                                                        <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '13px' }} iconType="circle" />
                                                        <Bar dataKey="Budget" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                                                        <Bar dataKey="Spent" fill="#EF4444" radius={[4, 4, 0, 0]} />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', background: '#F8FAFC', borderRadius: '12px', border: '1px dashed var(--border)' }}>
                                            No financial data available.
                                        </div>
                                    )}
                                </div>

                                {/* Section 2: Project Status */}
                                <div className="card" style={{ padding: '24px' }}>
                                    <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-main)', marginBottom: '4px' }}>Project Status</h3>
                                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px' }}>Delivery tracking for {projects.length} project(s)</p>

                                    <div style={{ height: '300px', display: 'flex', flexDirection: 'column' }}>
                                        <div style={{ flex: 1, position: 'relative' }}>
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={statusCounts}
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={60}
                                                        outerRadius={90}
                                                        paddingAngle={4}
                                                        dataKey="value"
                                                        stroke="none"
                                                    >
                                                        {statusCounts.map((entry, i) => (
                                                            <Cell key={i} fill={STATUS_COLORS[entry.name] || '#94a3b8'} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-md)' }} />
                                                </PieChart>
                                            </ResponsiveContainer>
                                            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
                                                <span style={{ fontSize: '28px', fontWeight: '700', color: 'var(--text-main)', display: 'block' }}>{projects.length}</span>
                                                <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total</span>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '16px', marginTop: 'auto', paddingTop: '16px' }}>
                                            {statusCounts.map((s, i) => (
                                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: STATUS_COLORS[s.name] || '#94A3B8' }} />
                                                    <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{s.name} ({s.value})</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ── Financial + Warehouse + Labour Summary ─────────── */}
                        {isSuperAdmin && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
                                {[
                                    { label: 'Total Billed', value: fmt(financeSummary.totalBilled), icon: FileText, color: '#3B82F6', bg: '#EFF6FF' },
                                    { label: 'Total Received', value: fmt(financeSummary.totalReceived), icon: IndianRupee, color: '#10B981', bg: '#ECFDF5' },
                                    { label: 'Total Expenses', value: fmt(financeSummary.totalExpenses), icon: TrendingUp, color: '#EF4444', bg: '#FEF2F2' },
                                    { label: 'Profit/Cash Balance', value: fmt(financeSummary.totalReceived - financeSummary.totalExpenses), icon: Wallet, color: (financeSummary.totalReceived - financeSummary.totalExpenses) >= 0 ? '#10B981' : '#EF4444', bg: (financeSummary.totalReceived - financeSummary.totalExpenses) >= 0 ? '#ECFDF5' : '#FEF2F2' },
                                    { label: 'Warehouse Items', value: warehouseSummary.totalItems || 0, icon: Warehouse, color: '#8B5CF6', bg: '#F5F3FF' },
                                    { label: 'Warehouse Value', value: fmt(warehouseSummary.totalValue), icon: Package, color: '#6366F1', bg: '#EEF2FF' },
                                    { label: 'Low Stock Alerts', value: warehouseSummary.lowStock || 0, icon: AlertTriangle, color: warehouseSummary.lowStock > 0 ? '#EF4444' : '#10B981', bg: warehouseSummary.lowStock > 0 ? '#FEF2F2' : '#ECFDF5' },
                                    { label: "Today's Labour", value: labourSummary.todayCount || 0, icon: HardHat, color: '#F59E0B', bg: '#FEF3C7' },
                                ].map((kpi, i) => (
                                    <div key={i} className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ padding: '10px', borderRadius: '10px', backgroundColor: kpi.bg, color: kpi.color, flexShrink: 0 }}>
                                            <kpi.icon size={20} />
                                        </div>
                                        <div>
                                            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px', fontWeight: '600', textTransform: 'uppercase' }}>{kpi.label}</p>
                                            <h3 style={{ fontSize: '20px', fontWeight: '700', lineHeight: 1, color: kpi.color }}>{kpi.value}</h3>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* ── Recent Activities Feed ─────────────────── */}
                        {isSuperAdmin && recentActivities.length > 0 && (
                            <div className="card" style={{ padding: '24px', marginBottom: '32px' }}>
                                <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Activity size={18} color="var(--primary)" /> Recent Activities
                                </h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {recentActivities.map((log, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '10px', borderRadius: '8px', backgroundColor: i % 2 === 0 ? '#F8FAFC' : 'white' }}>
                                            <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: log.type === 'success' ? '#10B981' : log.type === 'warning' ? '#F59E0B' : '#3B82F6', marginTop: 6, flexShrink: 0 }} />
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-main)' }}>
                                                    {log.action} {log.details && <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>— {log.details.substring(0, 80)}</span>}
                                                </div>
                                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 2 }}>
                                                    {log.username} · {log.timestamp ? new Date(log.timestamp).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ── Project Overview KPI Cards ───────────────────────── */}
                        {(isSuperAdmin || isGM) && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '32px' }}>
                                {projectKPIs.map((kpi, i) => (
                                    <div key={i} className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '14px', borderLeft: `4px solid ${kpi.color}` }}>
                                        <div style={{ padding: '12px', borderRadius: '10px', backgroundColor: kpi.bg, color: kpi.color, flexShrink: 0 }}>
                                            <kpi.icon size={24} />
                                        </div>
                                        <div>
                                            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '600', textTransform: 'uppercase' }}>{kpi.label}</p>
                                            <h3 style={{ fontSize: '24px', fontWeight: '700', lineHeight: 1 }}>{kpi.value}</h3>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* ── Role Based Dashboards ─────────────────────────────────────────────── */}

                        {isESS && (
                            <WorkspaceView
                                user={user}
                                projects={projects}
                            />
                        )}

                        {/* 1. Projects (Coordinator View) */}
                        {(isProjectCoordinator || isSuperAdmin) && (
                            <ProjectCoordinatorView projects={projects} />
                        )}

                        {/* 2. Finance (Accounts View) */}
                        {(isAccountant || isSuperAdmin) && (
                            <AccountsView hrmsStats={hrmsStats} />
                        )}

                        {/* 2b. Finance (Manager View) */}
                        {(isGM || isSuperAdmin) && (
                            <GeneralManagerView projects={projects} pendingApprovalsAmount={pendingApprovalsAmount} />
                        )}

                        {/* 3. Procurement (Purchase & Inventory) */}
                        {(isPurchaseOfficer || isSuperAdmin) && (
                            <PurchaseOfficerView />
                        )}

                        {(isInventoryManager || isSuperAdmin) && (
                            <InventoryManagerView />
                        )}

                        {/* 4. HR (HR View) */}
                        {(isHR || isSuperAdmin) && (
                            <HRView stats={hrmsStats} />
                        )}


                        {/* ── Recent Projects Table ─────────────────────────────── */}
                        {(hasDashboardCard(user, 'active_projects_list') || isSuperAdmin) && (
                            <div className="card" style={{ padding: '24px', overflowX: 'auto', marginBottom: '32px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                    <div>
                                        <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-main)', marginBottom: '4px' }}>Active Projects Overview</h3>
                                        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Latest additions to the portfolio</p>
                                    </div>
                                    <button className="btn btn-outline" onClick={() => navigate('/projects')}>
                                        View All
                                    </button>
                                </div>

                                <table className="data-table" style={{ width: '100%' }}>
                                    <thead>
                                        <tr>
                                            <th>Project</th>
                                            <th>Client & Location</th>
                                            <th>Budget & Spent</th>
                                            <th>Progress</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {recentProjects.map((p, i) => {
                                            const badge = STATUS_BADGE[p.status] || STATUS_BADGE['Ongoing'];
                                            return (
                                                <tr key={i} style={{ cursor: 'pointer' }} onClick={() => navigate(`/projects/${p._id || p.id}`)}>
                                                    <td>
                                                        <span style={{ fontWeight: '600', color: 'var(--text-main)', display: 'block' }}>{p.name}</span>
                                                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>ID: {p._id ? p._id.slice(-6).toUpperCase() : 'N/A'}</span>
                                                    </td>
                                                    <td>
                                                        <span style={{ fontWeight: '500', color: 'var(--text-main)', display: 'block' }}>{p.client || 'Internal'}</span>
                                                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{p.location || 'HQ'}</span>
                                                    </td>
                                                    <td>
                                                        <span style={{ fontWeight: '600', color: 'var(--text-main)', display: 'block' }}>{fmt(p.budget)}</span>
                                                        <span style={{ fontSize: '12px', color: '#EF4444' }}>Spent: {fmt(p.spent)}</span>
                                                    </td>
                                                    <td style={{ minWidth: '150px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <div style={{ flex: 1, height: '6px', backgroundColor: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                                                                <div style={{ width: `${p.progress || 0}%`, height: '100%', backgroundColor: p.progress === 100 ? '#10B981' : '#3B82F6' }} />
                                                            </div>
                                                            <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-main)' }}>{p.progress || 0}%</span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', backgroundColor: badge.bg, color: badge.text }}>
                                                            {p.status || 'Ongoing'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {recentProjects.length === 0 && (
                                            <tr>
                                                <td colSpan="5" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>No projects found.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* ── Workflow Overview Table ─────────────────────────────── */}
                        {(hasDashboardCard(user, 'recent_activities') || hasDashboardCard(user, 'overview_stats') || isSuperAdmin) && (
                            <div className="card" style={{ padding: '24px', overflowX: 'auto', marginBottom: '32px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                    <div>
                                        <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-main)', marginBottom: '4px' }}>Real-Time Project Workflow Tracking</h3>
                                        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Monitor active stages and hold durations across all project pipelines</p>
                                    </div>
                                </div>

                                <table className="data-table" style={{ width: '100%' }}>
                                    <thead>
                                        <tr>
                                            <th>Project</th>
                                            <th>Current Stage</th>
                                            <th>Pending With</th>
                                            <th style={{ textAlign: 'center' }}>Workflow Status</th>
                                            <th style={{ textAlign: 'center' }}>Hold Duration</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {workflowOverview.map((wf, i) => (
                                            <tr key={i} style={{ cursor: 'pointer' }} onClick={() => navigate(`/projects/${wf.project_id}`)}>
                                                <td>
                                                    <span style={{ fontWeight: '600', color: 'var(--text-main)', display: 'block' }}>{wf.project_name}</span>
                                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>ID: {wf.project_id.slice(-6).toUpperCase()}</span>
                                                </td>
                                                <td>
                                                    <span style={{ fontWeight: '600', color: 'var(--text-main)', display: 'block' }}>
                                                        {wf.current_stage || "Initializing..."}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span style={{ fontSize: '13px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <UserCircle size={14} color="var(--text-muted)" /> {wf.pending_with}
                                                    </span>
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    {wf.status === 'Completed' ? (
                                                        <span style={{ color: '#059669', fontSize: '12px', fontWeight: '700', backgroundColor: '#ECFDF5', padding: '4px 10px', borderRadius: '12px' }}>
                                                            Completed
                                                        </span>
                                                    ) : wf.status === 'On Hold' ? (
                                                        <span style={{ color: '#DC2626', fontSize: '12px', fontWeight: '700', backgroundColor: '#FEF2F2', padding: '4px 10px', borderRadius: '12px' }}>
                                                            On Hold
                                                        </span>
                                                    ) : (
                                                        <span style={{ color: '#D97706', fontSize: '12px', fontWeight: '700', backgroundColor: '#FFFBEB', padding: '4px 10px', borderRadius: '12px' }}>
                                                            In Progress
                                                        </span>
                                                    )}
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <span style={{ fontWeight: '600', color: wf.status === 'On Hold' ? '#DC2626' : 'var(--text-muted)', fontSize: '13px' }}>
                                                        {wf.hold_duration}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                        {workflowOverview.length === 0 && (
                                            <tr>
                                                <td colSpan="5" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>No workflow timelines active. Check project pipelines.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );

};

export default Dashboard;

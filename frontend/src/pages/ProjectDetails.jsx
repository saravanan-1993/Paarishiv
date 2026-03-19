import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
    ArrowLeft,
    LayoutDashboard,
    HardHat,
    FileText,
    Wallet,
    Briefcase,
    TrendingUp,
    CheckCircle,
    Calendar,
    AlertTriangle,
    Plus,
    Users,
    Upload,
    BarChart2,
    Clock,
    IndianRupee,
    MapPin,
    Trash2,
    Eye,
    Bell,
    Settings,
    Activity
} from 'lucide-react';
import WorkflowTracking from '../components/WorkflowTracking';
import AddTaskModal from '../components/AddTaskModal';
import TaskDetailsModal from '../components/TaskDetailsModal';
import UploadDocumentModal from '../components/UploadDocumentModal';
import DPRModal from '../components/DPRModal';
import CompleteTaskModal from '../components/CompleteTaskModal';
import EditProjectModal from '../components/EditProjectModal';
import { useAuth } from '../context/AuthContext';
import { projectAPI, chatAPI, employeeAPI, financeAPI } from '../utils/api';
import DPRViewModal from '../components/DPRViewModal';
import { hasPermission, hasSubTabAccess } from '../utils/rbac';
import { Loader2 } from 'lucide-react';

const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const fmtAmt = (n) => {
    if (!n && n !== 0) return '₹0';
    if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
    if (n >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
    return `₹${Number(n).toLocaleString('en-IN')}`;
};


const TaskStatusDropdown = ({ task, onStatusChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const getOptions = (status) => {
        if (status === 'Pending') return ['In Progress', 'Completed'];
        if (status === 'In Progress') return ['Completed'];
        return [];
    };
    const options = getOptions(task.status);

    return (
        <div style={{ position: 'relative', display: 'inline-block' }}>
            <div
                onClick={() => {
                    if (options.length > 0) {
                        setIsOpen(!isOpen);
                    }
                }}
                style={{
                    backgroundColor: task.status === 'Completed' ? '#ECFDF5' : task.status === 'In Progress' ? '#EFF6FF' : '#FFFBEB',
                    color: task.status === 'Completed' ? '#059669' : task.status === 'In Progress' ? '#3B82F6' : '#D97706',
                    border: `1px solid ${task.status === 'Completed' ? '#A7F3D0' : task.status === 'In Progress' ? '#BFDBFE' : '#FDE68A'}`,
                    padding: '4px 10px',
                    borderRadius: '16px',
                    fontSize: '11px',
                    fontWeight: '700',
                    cursor: task.status === 'Completed' ? 'default' : 'pointer',
                    textTransform: 'uppercase',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    minWidth: '110px',
                    opacity: 1
                }}
            >
                {task.status}
                {task.status !== 'Completed' && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '6px' }}>
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                )}
            </div>

            {isOpen && (
                <>
                    <div
                        style={{ position: 'fixed', inset: 0, zIndex: 90 }}
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="animate-fade-in" style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        marginTop: '6px',
                        backgroundColor: 'white',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                        zIndex: 100,
                        overflow: 'hidden',
                        minWidth: '130px'
                    }}>
                        {options.map((opt, idx) => (
                            <div
                                key={opt}
                                onClick={() => {
                                    if (task.status !== opt) {
                                        if (opt === 'Completed') {
                                            if (window.confirm("Are you sure? Once marked as COMPLETED, this task status cannot be modified again.")) {
                                                onStatusChange(task.id, opt);
                                            }
                                        } else {
                                            if (window.confirm(`Are you sure you want to move task to ${opt}?`)) {
                                                onStatusChange(task.id, opt);
                                            }
                                        }
                                    }
                                    setIsOpen(false);
                                }}
                                style={{
                                    padding: '10px 12px',
                                    fontSize: '11px',
                                    fontWeight: '700',
                                    textTransform: 'uppercase',
                                    cursor: 'pointer',
                                    color: task.status === opt ? 'var(--primary)' : 'var(--text-main)',
                                    backgroundColor: task.status === opt ? '#F8FAFC' : 'white',
                                    borderBottom: idx === options.length - 1 ? 'none' : '1px solid #F1F5F9',
                                    transition: 'all 0.2s',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between'
                                }}
                                onMouseEnter={(e) => { if (task.status !== opt) e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
                                onMouseLeave={(e) => { if (task.status !== opt) e.currentTarget.style.backgroundColor = 'white'; }}
                            >
                                {opt}
                                {task.status === opt && (
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12"></polyline>
                                    </svg>
                                )}
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

const DPRStatusDropdown = ({ dpr, onStatusChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const options = ['Pending', 'Reviewed', 'Approved', 'Rejected'];

    const getColors = (status) => {
        if (status === 'Approved') return { bg: '#ECFDF5', text: '#059669', border: '#A7F3D0', dot: '#10B981' };
        if (status === 'Reviewed') return { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE', dot: '#3B82F6' };
        if (status === 'Rejected') return { bg: '#FEF2F2', text: '#EF4444', border: '#FECACA', dot: '#EF4444' };
        return { bg: '#FFFBEB', text: '#D97706', border: '#FDE68A', dot: '#F59E0B' };
    };

    const colors = getColors(dpr.status || 'Pending');

    return (
        <div style={{ position: 'relative', display: 'inline-block' }}>
            <div
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    backgroundColor: colors.bg,
                    color: colors.text,
                    border: `1px solid ${colors.border}`,
                    padding: '6px 14px',
                    borderRadius: '20px',
                    fontSize: '10px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    textTransform: 'uppercase',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.2s',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                    minWidth: '110px',
                    justifyContent: 'space-between'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: colors.dot }}></div>
                    {dpr.status || 'Pending'}
                </div>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
            </div>

            {isOpen && (
                <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setIsOpen(false)} />
                    <div className="animate-fade-in" style={{
                        position: 'absolute', top: '100%', right: 0, marginTop: '8px',
                        backgroundColor: 'white', border: '1px solid var(--border)', borderRadius: '12px',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                        zIndex: 100, overflow: 'hidden', minWidth: '150px', padding: '6px'
                    }}>
                        {options.map((opt) => (
                            <div
                                key={opt}
                                onClick={() => {
                                    if (dpr.status !== opt) onStatusChange(dpr.id, opt);
                                    setIsOpen(false);
                                }}
                                style={{
                                    padding: '10px 14px', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase',
                                    cursor: 'pointer', color: dpr.status === opt ? 'var(--primary)' : 'var(--text-main)',
                                    backgroundColor: dpr.status === opt ? '#F1F5F9' : 'transparent',
                                    borderRadius: '8px', transition: 'all 0.1s', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                                }}
                                onMouseEnter={(e) => { if (dpr.status !== opt) e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
                                onMouseLeave={(e) => { if (dpr.status !== opt) e.currentTarget.style.backgroundColor = 'transparent'; }}
                            >
                                {opt}
                                {dpr.status === opt && (
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12"></polyline>
                                    </svg>
                                )}
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

const ProjectStatusDropdown = ({ project, onStatusChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const options = ['Ongoing', 'On Hold', 'Completed', 'Delayed'];

    const getColors = (status) => {
        if (status === 'Completed') return { bg: '#EFF6FF', text: '#3B82F6', border: '#BFDBFE' };
        if (status === 'On Hold') return { bg: '#F3F4F6', text: '#6B7280', border: '#D1D5DB' };
        if (status === 'Delayed') return { bg: '#FEF2F2', text: '#EF4444', border: '#FECACA' };
        return { bg: '#ECFDF5', text: '#10B981', border: '#A7F3D0' }; // Ongoing
    };

    const colors = getColors(project.status || 'Ongoing');

    return (
        <div style={{ position: 'relative', display: 'inline-block' }}>
            <div
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    backgroundColor: colors.bg,
                    color: colors.text,
                    border: `1px solid ${colors.border}`,
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '11px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    textTransform: 'uppercase',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.2s',
                    minWidth: '100px',
                    justifyContent: 'space-between',
                    boxShadow: 'var(--shadow-sm)'
                }}
            >
                {project.status || 'Ongoing'}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
            </div>

            {isOpen && (
                <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setIsOpen(false)} />
                    <div className="animate-fade-in" style={{
                        position: 'absolute', top: '100%', left: 0, marginTop: '8px',
                        backgroundColor: 'white', border: '1px solid var(--border)', borderRadius: '12px',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                        zIndex: 100, overflow: 'hidden', minWidth: '140px', padding: '6px'
                    }}>
                        {options.map((opt) => (
                            <div
                                key={opt}
                                onClick={() => {
                                    if (project.status !== opt) onStatusChange(opt);
                                    setIsOpen(false);
                                }}
                                style={{
                                    padding: '10px 14px', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase',
                                    cursor: 'pointer', color: project.status === opt ? 'var(--primary)' : 'var(--text-main)',
                                    backgroundColor: project.status === opt ? '#F1F5F9' : 'transparent',
                                    borderRadius: '8px', transition: 'all 0.1s', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                                }}
                                onMouseEnter={(e) => { if (project.status !== opt) e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
                                onMouseLeave={(e) => { if (project.status !== opt) e.currentTarget.style.backgroundColor = 'transparent'; }}
                            >
                                {opt}
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

const ProjectDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const isEngineer = user?.role === 'Site Engineer';
    const [searchParams, setSearchParams] = useSearchParams();
    const urlTab = searchParams.get('tab');
    const [activeTab, setActiveTab] = useState(user?.role === 'Site Engineer' ? 'Tasks' : 'Overview');
    const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
    const [isUploadDocOpen, setIsUploadDocOpen] = useState(false);
    const [isDPRModalOpen, setIsDPRModalOpen] = useState(false);
    const [isCompleteTaskOpen, setIsCompleteTaskOpen] = useState(false);
    const [viewTask, setViewTask] = useState(null);
    const [completingTask, setCompletingTask] = useState(null);
    const [isEditProjectOpen, setIsEditProjectOpen] = useState(false);

    // ── Fetch real project from backend ─────────────────────────────────────
    const [project, setProject] = useState(null);
    const [projLoading, setProjLoading] = useState(true);
    const [projError, setProjError] = useState('');
    const [employeesMap, setEmployeesMap] = useState({});

    // Helper to resolve employee name from ID
    const resolveEmployeeName = (id) => {
        if (!id || id === 'Unassigned') return 'Unassigned';
        // Handle potential object structure/ObjectId
        const targetId = typeof id === 'object' ? (id._id || id.id || id.$oid || '') : String(id).trim();
        const emp = employeesMap[targetId];
        if (emp) return emp.fullName || emp.name || targetId;
        return targetId;
    };

    useEffect(() => {
        const fetchEmps = async () => {
            try {
                const res = await employeeAPI.getAll();
                const emps = res.data || [];
                const map = {};
                emps.forEach(e => {
                    if (e._id) map[e._id] = e;
                    if (e.id) map[e.id] = e;
                    if (e.username) map[e.username] = e;
                    if (e.employeeCode) map[e.employeeCode] = e;
                    if (e.fullName) map[e.fullName] = e;
                });
                setEmployeesMap(map);
            } catch (err) {
                console.error("Failed to fetch employees in project details", err);
            }
        };
        fetchEmps();
    }, []);

    useEffect(() => {
        const load = async () => {
            setProjLoading(true);
            setProjError('');
            try {
                const res = await projectAPI.getOne(id);
                setProject(res.data);
            } catch (err) {
                console.error('ProjectDetails fetch error:', err);
                setProjError('Could not load project details. Please go back and try again.');
            } finally {
                setProjLoading(false);
            }
        };
        if (id) load();
    }, [id]);

    const [isDPRViewOpen, setIsDPRViewOpen] = useState(false);
    const [selectedDPR, setSelectedDPR] = useState(null);
    const [finData, setFinData] = useState(null);
    const [finLoading, setFinLoading] = useState(false);
    const [finTab, setFinTab] = useState('sales');

    const reloadProject = async () => {
        try {
            const res = await projectAPI.getOne(id);
            setProject(res.data);
        } catch (err) {
            console.error('Reload project error:', err);
        }
    };

    const handleUpdateProjectStatus = async (newStatus) => {
        try {
            await projectAPI.updateStatus(id, newStatus);
            reloadProject();
        } catch (err) {
            console.error('Failed to update project status:', err);
            alert('Failed to update project status.');
        }
    };

    const handleTaskStatusChange = async (taskId, newStatus) => {
        if (newStatus === 'Completed') {
            const taskObj = project.tasks.find(t => t.id === taskId);
            setCompletingTask(taskObj);
            setIsCompleteTaskOpen(true);
            return;
        }

        try {
            await projectAPI.updateTask(project._id, taskId, { status: newStatus });
            reloadProject();
        } catch (err) {
            console.error('Failed to update task:', err);
            alert('Failed to update task status');
        }
    };

    const handleNotifyAdmin = async (task) => {
        try {
            await projectAPI.notifyTask(project._id, task.id);
            alert('Admin has been notified successfully! 🚀');
        } catch (err) {
            console.error('Failed to notify admin:', err);
            alert('Failed to notify admin. Please check your connection.');
        }
    };

    const handleTaskDelete = async (taskId) => {
        if (!window.confirm("Are you sure you want to delete this task?")) return;
        try {
            await projectAPI.deleteTask(project._id, taskId);
            reloadProject();
        } catch (err) {
            console.error('Failed to delete task:', err);
            alert('Failed to delete task');
        }
    };

    const handleUpdateDPRStatus = async (dprId, newStatus) => {
        try {
            await projectAPI.updateDprStatus(id, dprId, newStatus);
            reloadProject();
        } catch (err) {
            console.error('Failed to update DPR status:', err);
            alert('Failed to update status.');
        }
    };

    const handleViewDPR = (dpr) => {
        setSelectedDPR(dpr);
        setIsDPRViewOpen(true);
    };

    // Derived values from real project
    const spent = project?.spent || 0;
    const budgetUsedPct = project?.budget > 0 ? Math.round((spent / project.budget) * 100) : 0;

    // Real tasks, DPRs, and Docs from the project document
    const taskList = Array.isArray(project?.tasks) ? project.tasks.filter(t => typeof t === 'object') : [];
    const dprList = Array.isArray(project?.dprs) ? project.dprs : [];
    const docList = Array.isArray(project?.documents) ? project.documents : [];

    const taskCount = taskList.length;
    const dprCount = dprList.length;
    const docCount = docList.length;
    const completedTasks = taskList.filter(t => t.status === 'Completed').length;

    // ── Progress = completed tasks / total tasks (live, not stored field) ──
    const taskProgress = taskCount > 0 ? Math.round((completedTasks / taskCount) * 100) : 0;
    const tabs = useMemo(() => {
        const allTabs = [
            { name: 'Overview', icon: LayoutDashboard },
            { name: `Tasks (${taskCount})`, icon: HardHat },
            { name: `DPR (${dprCount})`, icon: FileText },
            { name: 'Financials', icon: Wallet },
            { name: `Documents (${docCount})`, icon: Briefcase },
            { name: 'Workflow Tracking', icon: Activity },
        ];

        return allTabs.filter(t => {
            const tabName = t.name.split(' (')[0];
            return hasSubTabAccess(user, 'Projects', tabName);
        });
    }, [user, taskCount, dprCount, docCount]);

    // Load finance data when Financials tab is active
    useEffect(() => {
        if (activeTab === 'Financials' && project?.name && !finData) {
            const loadFin = async () => {
                setFinLoading(true);
                try {
                    const res = await financeAPI.getProjectSummary(project.name);
                    setFinData(res.data);
                } catch (err) {
                    console.error('Failed to load project finance data:', err);
                } finally {
                    setFinLoading(false);
                }
            };
            loadFin();
        }
    }, [activeTab, project?.name]);

    useEffect(() => {
        if (urlTab) {
            const matchingTab = tabs.find(t => t.name.split(' (')[0] === urlTab);
            if (matchingTab) {
                setActiveTab(matchingTab.name);
            }
        }
    }, [urlTab, tabs]);

    // ── Loading state ────────────────────────────────────────────────────────
    if (projLoading) return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '16px', color: 'var(--text-muted)' }}>
            <Loader2 size={40} style={{ animation: 'spin 1s linear infinite', color: 'var(--primary)' }} />
            <p style={{ fontWeight: '600', fontSize: '16px' }}>Loading project details...</p>
            <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
        </div>
    );

    // ── Error state ──────────────────────────────────────────────────────────
    if (projError || !project) return (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' }}>
            <AlertTriangle size={48} style={{ color: '#EF4444', margin: '0 auto 16px' }} />
            <h3 style={{ fontWeight: '700', marginBottom: '8px', color: 'var(--text-main)' }}>Project Not Found</h3>
            <p style={{ marginBottom: '24px' }}>{projError}</p>
            <button className="btn btn-primary" onClick={() => navigate('/projects')}>← Back to Projects</button>
        </div>
    );


    const handleTabChange = (tabName) => {
        setActiveTab(tabName);
        const normalized = tabName.split(' (')[0];
        setSearchParams({ tab: normalized });
    };

    return (
        <div className="project-details-page-wrapper" style={{ position: 'relative' }}>
            <div className="project-details-container" style={{ padding: '0 10px 60px 10px' }}>
                {/* ── Header ───────────────────────────────────────────────────── */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px', flexWrap: 'wrap' }}>
                    <button
                        onClick={() => navigate('/projects')}
                        style={{
                            background: 'white', border: '1px solid var(--border)', borderRadius: '8px',
                            padding: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', boxShadow: 'var(--shadow-sm)'
                        }}
                    >
                        <ArrowLeft size={20} color="var(--text-main)" />
                    </button>
                    <div style={{ flex: '1 1 300px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                            <h1 style={{ fontSize: 'min(28px, 6vw)', fontWeight: '700', color: 'var(--text-main)', margin: 0 }}>
                                {project.name || 'Unnamed Project'}
                            </h1>
                            <ProjectStatusDropdown project={project} onStatusChange={handleUpdateProjectStatus} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', color: 'var(--text-muted)', fontSize: '13px', flexWrap: 'wrap', marginTop: '6px' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Briefcase size={13} />
                                {(project._id || project.id || '').toString().slice(-6).toUpperCase() || '—'}
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={13} /> {project.location || 'No Location'}</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Users size={13} /> Client: {project.client || 'No Client'}</span>
                        </div>
                    </div>

                    {/* Quick-action buttons */}
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        {user?.role === 'Site Engineer' && (
                            <button className="btn btn-primary" onClick={() => setIsDPRModalOpen(true)}>
                                <FileText size={16} /> Submit DPR
                            </button>
                        )}
                        {(user?.role === 'Super Admin' || user?.role === 'Administrator' || user?.role === 'Project Coordinator') && (
                            <button
                                className="btn btn-outline"
                                onClick={() => setIsEditProjectOpen(true)}
                                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                            >
                                <Settings size={16} /> Edit Details
                            </button>
                        )}
                    </div>
                </div>

                {/* ── KPI Cards ─────────────────────────────────────────────────── */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '32px' }}>
                    {[
                        ...(user?.role === 'Super Admin' || user?.role === 'Manager' ? [
                            { label: 'Credit', value: fmtAmt(project.budget), icon: Wallet, color: '#3B82F6', bg: '#EFF6FF' },
                            { label: 'Debit', value: fmtAmt(spent), icon: TrendingUp, color: '#EF4444', bg: '#FEF2F2' }
                        ] : []),
                        { label: 'Progress', value: `${taskProgress}%`, icon: BarChart2, color: '#8B5CF6', bg: '#F5F3FF' },
                        { label: 'DPRs', value: dprCount, icon: FileText, color: '#F59E0B', bg: '#FFFBEB' },
                        { label: 'Tasks', value: `${completedTasks}/${taskCount}`, icon: CheckCircle, color: '#059669', bg: '#ECFDF5' },
                    ].map((kpi, i) => (
                        <div key={i} className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '14px', borderLeft: `4px solid ${kpi.color}` }}>
                            <div style={{ padding: '10px', borderRadius: '10px', backgroundColor: kpi.bg, color: kpi.color, flexShrink: 0 }}>
                                <kpi.icon size={20} />
                            </div>
                            <div style={{ minWidth: 0, overflow: 'hidden' }}>
                                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '2px', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{kpi.label}</p>
                                <h3 style={{ fontSize: 'min(22px, 5vw)', fontWeight: '800', lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{kpi.value}</h3>
                            </div>
                        </div>
                    ))}
                </div>

                {/* ── Tabs ──────────────────────────────────────────────────────── */}
                <div style={{ display: 'flex', borderBottom: '2px solid var(--border)', marginBottom: '32px', gap: '4px', overflowX: 'auto', whiteSpace: 'nowrap', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                    {tabs.map((tab) => {
                        const TabIcon = tab.icon;
                        const isActive = activeTab === tab.name || (activeTab === 'Tasks' && tab.name.includes('Tasks')) || (activeTab === 'DPR' && tab.name.includes('DPR'));
                        return (
                            <button
                                key={tab.name}
                                onClick={() => handleTabChange(tab.name)}
                                style={{
                                    padding: '12px 20px',
                                    border: 'none',
                                    background: 'none',
                                    borderBottom: isActive ? '3px solid var(--primary)' : '3px solid transparent',
                                    marginBottom: '-2px',
                                    color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                                    fontWeight: isActive ? '700' : '600',
                                    fontSize: '14px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    transition: 'all 0.2s ease',
                                    whiteSpace: 'nowrap',
                                    flexShrink: 0
                                }}
                            >
                                <TabIcon size={16} />
                                {tab.name}
                            </button>
                        );
                    })}
                </div>

                {/* Content */}
                {activeTab === 'Workflow Tracking' && (
                    <div className="animate-fade-in">
                        <WorkflowTracking projectId={id} />
                    </div>
                )}

                {/* Overview Tab */}
                {activeTab === 'Overview' && (
                    <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '28px' }}>
                        <div className="card" style={{ padding: '32px' }}>
                            <h2 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '28px' }}>Project Information</h2>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                {[
                                    { label: 'Client', value: project.client },
                                    { label: 'Location', value: project.location },
                                    { label: 'Start Date', value: fmtDate(project.start_date) },
                                    { label: 'Completion Date', value: fmtDate(project.end_date) },
                                ].map(({ label, value }) => (
                                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #F1F5F9' }}>
                                        <span style={{ color: 'var(--text-muted)', fontSize: '14px', fontWeight: '600' }}>{label}</span>
                                        <span style={{ fontWeight: '700', fontSize: '14px' }}>{value}</span>
                                    </div>
                                ))}
                                <div>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '14px', fontWeight: '600', display: 'block', marginBottom: '10px' }}>Description</span>
                                    <p style={{ fontSize: '14px', lineHeight: '1.7', color: '#374151' }}>
                                        {project.description || `${project.name} — ${project.location}. Managed by ${project.engineer_name || (typeof project.engineer_id === 'object' ? (project.engineer_id?.fullName || project.engineer_id?.username || 'N/A') : (project.engineer_id || 'N/A'))}.`}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            {/* Budget utilisation */}
                            {(user?.role === 'Super Admin' || user?.role === 'Manager') && (
                                <div className="card" style={{ padding: '28px' }}>
                                    <h2 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '20px' }}>Budget Utilisation</h2>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                        <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600' }}>Spent: {fmtAmt(spent)}</span>
                                        <span style={{ fontSize: '13px', fontWeight: '800', color: budgetUsedPct > 80 ? '#EF4444' : 'var(--primary)' }}>{budgetUsedPct}%</span>
                                    </div>
                                    <div style={{ width: '100%', height: '12px', backgroundColor: '#E2E8F0', borderRadius: '6px', overflow: 'hidden' }}>
                                        <div style={{
                                            width: `${budgetUsedPct}%`, height: '100%', borderRadius: '6px',
                                            background: budgetUsedPct > 80 ? 'linear-gradient(to right, #F59E0B, #EF4444)' : 'var(--primary)',
                                            transition: 'width 0.5s ease'
                                        }} />
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>₹0</span>
                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Total: {fmtAmt(project.budget)}</span>
                                    </div>
                                </div>
                            )}

                            {/* Overall progress */}
                            <div className="card" style={{ padding: '28px' }}>
                                <h2 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '20px' }}>Overall Progress</h2>
                                <div style={{ position: 'relative', width: '140px', height: '140px', margin: '0 auto 20px' }}>
                                    <svg viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)', width: '140px', height: '140px' }}>
                                        <circle cx="60" cy="60" r="50" fill="none" stroke="#E2E8F0" strokeWidth="12" />
                                        <circle
                                            cx="60" cy="60" r="50" fill="none"
                                            stroke="var(--primary)" strokeWidth="12"
                                            strokeDasharray={`${2 * Math.PI * 50}`}
                                            strokeDashoffset={`${2 * Math.PI * 50 * (1 - taskProgress / 100)}`}
                                            strokeLinecap="round"
                                            style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                                        />
                                    </svg>
                                    <div style={{
                                        position: 'absolute', top: '50%', left: '50%',
                                        transform: 'translate(-50%, -50%)', textAlign: 'center'
                                    }}>
                                        <div style={{ fontSize: '26px', fontWeight: '800', lineHeight: 1 }}>{taskProgress}%</div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>Complete</div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-around', fontSize: '13px' }}>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontWeight: '800', fontSize: '18px', color: '#10B981' }}>
                                            {completedTasks}
                                        </div>
                                        <div style={{ color: 'var(--text-muted)', fontWeight: '600' }}>Done</div>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontWeight: '800', fontSize: '18px', color: '#3B82F6' }}>
                                            {taskList.filter(t => t.status === 'In Progress').length}
                                        </div>
                                        <div style={{ color: 'var(--text-muted)', fontWeight: '600' }}>Active</div>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontWeight: '800', fontSize: '18px', color: '#F59E0B' }}>
                                            {taskList.filter(t => t.status === 'Pending').length}
                                        </div>
                                        <div style={{ color: 'var(--text-muted)', fontWeight: '600' }}>Pending</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}


                {/* Tasks Tab */}
                {activeTab.includes('Tasks') && (
                    <div className="card animate-fade-in">
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', alignItems: 'center' }}>
                            <h2 style={{ fontSize: '20px', fontWeight: '800' }}>Task Management</h2>
                            {!isEngineer && (
                                <button className="btn btn-primary" onClick={() => setIsAddTaskOpen(true)}>
                                    <Plus size={18} /> Add Task
                                </button>
                            )}
                        </div>

                        {taskList.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                                <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
                                <h4 style={{ fontWeight: '700', marginBottom: '8px', color: 'var(--text-main)' }}>No Tasks Yet</h4>
                                <p style={{ marginBottom: '24px', fontSize: '14px' }}>Add tasks to track work on this project.</p>
                                {!isEngineer && (
                                    <button className="btn btn-primary" onClick={() => setIsAddTaskOpen(true)}>
                                        <Plus size={16} /> Add First Task
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div style={{ overflowX: 'visible', paddingBottom: '100px' }}>
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>ID</th>
                                            <th>Task Name</th>
                                            <th>Assigned To</th>
                                            <th>Priority</th>
                                            <th>Start</th>
                                            <th>Due Date</th>
                                            <th>Status</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {taskList.map((task, i) => (
                                            <tr key={i}>
                                                <td style={{ color: 'var(--text-muted)', fontWeight: '600', fontSize: '12px' }}>{task.id || `T-${i + 1}`}</td>
                                                <td style={{ fontWeight: '600' }}>{task.name}</td>
                                                <td style={{ fontWeight: '600', color: 'var(--text-main)' }}>
                                                    {resolveEmployeeName(task.assignedTo)}
                                                </td>
                                                <td>
                                                    <span style={{
                                                        padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700',
                                                        backgroundColor: task.priority === 'High' ? '#FEF2F2' : task.priority === 'Medium' ? '#FFFBEB' : '#F0FDF4',
                                                        color: task.priority === 'High' ? '#EF4444' : task.priority === 'Medium' ? '#F59E0B' : '#10B981',
                                                    }}>
                                                        {task.priority}
                                                    </span>
                                                </td>
                                                <td style={{ fontSize: '13px' }}>{task.startDate}</td>
                                                <td style={{ fontSize: '13px' }}>{task.dueDate} {task.dueTime ? `@ ${task.dueTime}` : ''}</td>
                                                <td>
                                                    <TaskStatusDropdown task={task} onStatusChange={handleTaskStatusChange} />
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <button
                                                            style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '6px', color: '#3B82F6', cursor: 'pointer', padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                            onClick={() => setViewTask(task)}
                                                            title="View Details"
                                                        >
                                                            <Eye size={14} />
                                                        </button>

                                                        {task.status === 'Completed' && (
                                                            <button
                                                                className="btn btn-outline"
                                                                style={{ padding: '6px 10px', fontSize: '11px', minWidth: 'auto', gap: '4px' }}
                                                                onClick={() => handleNotifyAdmin(task)}
                                                            >
                                                                <Bell size={12} /> Update Admin
                                                            </button>
                                                        )}

                                                        {user?.role !== 'Site Engineer' && (
                                                            <button
                                                                style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '6px', color: '#EF4444', cursor: 'pointer', padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                                onClick={() => handleTaskDelete(task.id)}
                                                                title="Delete Task"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {activeTab.includes('DPR') && (
                    <div className="card animate-fade-in">
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '28px', alignItems: 'center' }}>
                            <div>
                                <h2 style={{ fontSize: '20px', fontWeight: '800' }}>Daily Progress Reports</h2>
                                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>Chronological log of all daily site reports</p>
                            </div>
                            <button className="btn btn-primary" onClick={() => setIsDPRModalOpen(true)}>
                                <Plus size={18} /> Submit DPR
                            </button>
                        </div>

                        {dprList.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                                <div style={{ fontSize: '48px', marginBottom: '16px' }}>📄</div>
                                <h4 style={{ fontWeight: '700', marginBottom: '8px', color: 'var(--text-main)' }}>No DPRs Filed Yet</h4>
                                <p style={{ marginBottom: '24px', fontSize: '14px' }}>Submit a Daily Progress Report (DPR) for today's site work.</p>
                                <button className="btn btn-primary" onClick={() => setIsDPRModalOpen(true)}>
                                    <Plus size={16} /> Submit First DPR
                                </button>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {dprList.map((dpr, i) => (
                                    <div key={i} style={{ padding: '20px', border: '1px solid var(--border)', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '24px', backgroundColor: 'white' }}>
                                        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flex: 1 }}>
                                            <div style={{ padding: '10px', borderRadius: '8px', backgroundColor: '#F1F5F9', color: 'var(--primary)', flexShrink: 0 }}>
                                                <FileText size={18} />
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                                                    <h4 style={{ fontSize: '15px', fontWeight: '700' }}>{dpr.date}</h4>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        {(user?.role === 'Super Admin' || user?.role === 'Project Coordinator') ? (
                                                            <DPRStatusDropdown dpr={dpr} onStatusChange={handleUpdateDPRStatus} />
                                                        ) : (
                                                            <span className={`badge ${dpr.status === 'Approved' ? 'badge-success' : dpr.status === 'Rejected' ? 'badge-danger' : 'badge-warning'}`}>
                                                                {dpr.status || 'Pending'}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <p style={{ fontSize: '13px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '400px' }}>
                                                    {dpr.progress}
                                                </p>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <button
                                                className="btn btn-outline btn-sm"
                                                onClick={() => handleViewDPR(dpr)}
                                                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                                            >
                                                <Eye size={16} /> View Details
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Financials Tab */}
                {activeTab === 'Financials' && (
                    <div className="animate-fade-in">
                        {finLoading ? (
                            <div style={{ textAlign: 'center', padding: '80px', color: 'var(--text-muted)' }}>
                                <Loader2 size={36} style={{ animation: 'spin 1s linear infinite', color: 'var(--primary)', margin: '0 auto 12px', display: 'block' }} />
                                <p style={{ fontWeight: '600' }}>Loading financial data...</p>
                            </div>
                        ) : finData ? (
                            <>
                                {/* Summary Cards */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '16px', marginBottom: '28px' }}>
                                    {[
                                        { label: 'Total Sales', value: finData.summary.total_sales, color: '#3B82F6', bg: '#EFF6FF', icon: '📈' },
                                        { label: 'Received', value: finData.summary.total_received, color: '#10B981', bg: '#ECFDF5', icon: '✅' },
                                        { label: 'Outstanding', value: finData.summary.outstanding, color: '#F59E0B', bg: '#FFFBEB', icon: '⏳' },
                                        { label: 'Purchase Bills', value: finData.summary.total_purchase, color: '#EF4444', bg: '#FEF2F2', icon: '🧾' },
                                        { label: 'Expenses', value: finData.summary.total_expenses, color: '#8B5CF6', bg: '#F5F3FF', icon: '💸' },
                                        { label: 'Gross P&L', value: finData.summary.gross_profit, color: finData.summary.gross_profit >= 0 ? '#059669' : '#DC2626', bg: finData.summary.gross_profit >= 0 ? '#ECFDF5' : '#FEF2F2', icon: finData.summary.gross_profit >= 0 ? '💰' : '⚠️' },
                                    ].map((card, ci) => (
                                        <div key={ci} style={{ background: card.bg, padding: '20px', borderRadius: '14px', border: `1px solid ${card.bg === '#EFF6FF' ? '#BFDBFE' : card.bg === '#ECFDF5' ? '#A7F3D0' : card.bg === '#FFFBEB' ? '#FDE68A' : card.bg === '#FEF2F2' ? '#FECACA' : card.bg === '#F5F3FF' ? '#DDD6FE' : '#A7F3D0'}` }}>
                                            <div style={{ fontSize: '20px', marginBottom: '8px' }}>{card.icon}</div>
                                            <div style={{ fontSize: '11px', fontWeight: '700', color: card.color, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>{card.label}</div>
                                            <div style={{ fontSize: '20px', fontWeight: '800', color: card.color }}>{fmtAmt(card.value)}</div>
                                        </div>
                                    ))}
                                </div>

                                {/* Sub-tabs */}
                                <div style={{ display: 'flex', gap: '4px', borderBottom: '2px solid var(--border)', marginBottom: '24px', overflowX: 'auto' }}>
                                    {[
                                        { key: 'sales', label: `Sales Bills (${finData.sales_bills.length})` },
                                        { key: 'receipts', label: `Receipts (${finData.receipts.length})` },
                                        { key: 'purchase', label: `Purchase Bills (${finData.purchase_bills.length})` },
                                        { key: 'expenses', label: `Expenses (${finData.expenses.length})` },
                                    ].map(st => (
                                        <button key={st.key} onClick={() => setFinTab(st.key)} style={{
                                            padding: '10px 18px', border: 'none', background: 'none', cursor: 'pointer',
                                            fontWeight: finTab === st.key ? '700' : '600', fontSize: '13px',
                                            color: finTab === st.key ? 'var(--primary)' : 'var(--text-muted)',
                                            borderBottom: finTab === st.key ? '3px solid var(--primary)' : '3px solid transparent',
                                            marginBottom: '-2px', whiteSpace: 'nowrap'
                                        }}>{st.label}</button>
                                    ))}
                                </div>

                                {/* Sales Bills */}
                                {finTab === 'sales' && (
                                    <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
                                        {finData.sales_bills.length === 0 ? (
                                            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}><div style={{ fontSize: '40px', marginBottom: '12px' }}>📄</div><p style={{ fontWeight: '600' }}>No Sales Bills for this project yet.</p></div>
                                        ) : (
                                            <table className="data-table">
                                                <thead><tr><th>Bill No</th><th>Date</th><th>Description</th><th>Amount</th><th>GST</th><th>Total</th><th>Received</th><th>Status</th></tr></thead>
                                                <tbody>{finData.sales_bills.map((b, i) => (
                                                    <tr key={i}>
                                                        <td style={{ fontWeight: '700', color: 'var(--primary)' }}>{b.bill_no}</td>
                                                        <td style={{ fontSize: '13px' }}>{b.date || b.created_at?.slice(0, 10)}</td>
                                                        <td>{b.description || 'Running Account Bill'}</td>
                                                        <td style={{ fontWeight: '600' }}>{fmtAmt(b.amount)}</td>
                                                        <td style={{ color: '#6366F1' }}>{fmtAmt(b.gst_amount)}</td>
                                                        <td style={{ fontWeight: '800' }}>{fmtAmt(b.total_amount)}</td>
                                                        <td style={{ color: '#10B981', fontWeight: '700' }}>{fmtAmt(b.collection_amount || 0)}</td>
                                                        <td><span className={`badge ${b.status === 'Paid' ? 'badge-success' : b.status === 'Partially Paid' ? 'badge-info' : 'badge-warning'}`}>{b.status}</span></td>
                                                    </tr>
                                                ))}</tbody>
                                            </table>
                                        )}
                                    </div>
                                )}

                                {/* Receipts */}
                                {finTab === 'receipts' && (
                                    <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
                                        {finData.receipts.length === 0 ? (
                                            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}><div style={{ fontSize: '40px', marginBottom: '12px' }}>💳</div><p style={{ fontWeight: '600' }}>No payment receipts recorded yet.</p></div>
                                        ) : (
                                            <table className="data-table">
                                                <thead><tr><th>Date</th><th>Amount</th><th>Mode</th><th>From</th><th>Description</th></tr></thead>
                                                <tbody>{finData.receipts.map((r, i) => (
                                                    <tr key={i}>
                                                        <td style={{ fontSize: '13px' }}>{r.date}</td>
                                                        <td style={{ fontWeight: '800', color: '#10B981' }}>{fmtAmt(r.amount)}</td>
                                                        <td><span className="badge badge-info">{r.payment_mode || 'Bank'}</span></td>
                                                        <td style={{ fontWeight: '600' }}>{r.received_from || '—'}</td>
                                                        <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{r.description || '—'}</td>
                                                    </tr>
                                                ))}</tbody>
                                            </table>
                                        )}
                                    </div>
                                )}

                                {/* Purchase Bills */}
                                {finTab === 'purchase' && (
                                    <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
                                        {finData.purchase_bills.length === 0 ? (
                                            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}><div style={{ fontSize: '40px', marginBottom: '12px' }}>🧾</div><p style={{ fontWeight: '600' }}>No Purchase Bills for this project yet.</p></div>
                                        ) : (
                                            <table className="data-table">
                                                <thead><tr><th>Bill No</th><th>Date</th><th>Vendor</th><th>Items</th><th>Tax</th><th>Total</th><th>Status</th></tr></thead>
                                                <tbody>{finData.purchase_bills.map((pb, i) => (
                                                    <tr key={i}>
                                                        <td style={{ fontWeight: '700', color: 'var(--primary)' }}>{pb.bill_no}</td>
                                                        <td style={{ fontSize: '13px' }}>{pb.bill_date}</td>
                                                        <td style={{ fontWeight: '600' }}>{pb.vendor_name}</td>
                                                        <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{(pb.items || []).length} items</td>
                                                        <td style={{ color: '#6366F1' }}>{fmtAmt(pb.tax_amount || 0)}</td>
                                                        <td style={{ fontWeight: '800', color: '#EF4444' }}>{fmtAmt(pb.total_amount)}</td>
                                                        <td><span className={`badge ${pb.status === 'Paid' ? 'badge-success' : 'badge-warning'}`}>{pb.status || 'Unpaid'}</span></td>
                                                    </tr>
                                                ))}</tbody>
                                            </table>
                                        )}
                                    </div>
                                )}

                                {/* Expenses */}
                                {finTab === 'expenses' && (
                                    <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
                                        {finData.expenses.length === 0 ? (
                                            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}><div style={{ fontSize: '40px', marginBottom: '12px' }}>💸</div><p style={{ fontWeight: '600' }}>No Expenses recorded for this project yet.</p></div>
                                        ) : (
                                            <table className="data-table">
                                                <thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Amount</th><th>Paid By</th></tr></thead>
                                                <tbody>{finData.expenses.map((e, i) => (
                                                    <tr key={i}>
                                                        <td style={{ fontSize: '13px' }}>{e.date}</td>
                                                        <td><span className="badge badge-info">{e.category || '—'}</span></td>
                                                        <td style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{e.description || '—'}</td>
                                                        <td style={{ fontWeight: '800', color: '#8B5CF6' }}>{fmtAmt(e.amount)}</td>
                                                        <td style={{ fontSize: '13px' }}>{e.paid_by || '—'}</td>
                                                    </tr>
                                                ))}</tbody>
                                            </table>
                                        )}
                                    </div>
                                )}
                            </>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '80px' }}>
                                <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
                                <p style={{ fontWeight: '700', color: 'var(--text-main)', marginBottom: '8px' }}>No financial data loaded.</p>
                                <button className="btn btn-primary" onClick={() => { setFinData(null); setActiveTab('Financials'); }}>Retry</button>
                            </div>
                        )}
                    </div>
                )}

                {/* Documents Tab */}
                {activeTab.includes('Documents') && (
                    <div className="card animate-fade-in">
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '28px', alignItems: 'center' }}>
                            <div>
                                <h2 style={{ fontSize: '20px', fontWeight: '800' }}>Project Documents</h2>
                                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>Store and manage site drawings, permits and contracts</p>
                            </div>
                            <button className="btn btn-primary" onClick={() => setIsUploadDocOpen(true)}>
                                <Upload size={18} /> Upload New
                            </button>
                        </div>

                        {docList.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                                <Briefcase size={64} style={{ margin: '0 auto 24px', opacity: 0.4 }} />
                                <h4 style={{ fontWeight: '700', marginBottom: '8px', color: 'var(--text-main)' }}>No Documents Found</h4>
                                <p style={{ marginBottom: '24px', fontSize: '14px' }}>Architectural drawings, permits, and contracts will appear here.</p>
                                <button className="btn btn-primary" onClick={() => setIsUploadDocOpen(true)}>
                                    <Upload size={16} /> Upload First Document
                                </button>
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                                {docList.map((doc, i) => (
                                    <div key={i} style={{ padding: '20px', border: '1px solid var(--border)', borderRadius: '12px', display: 'flex', alignItems: 'flex-start', gap: '16px', backgroundColor: 'white', transition: 'all 0.2s' }} className="hover-card">
                                        <div style={{ padding: '12px', backgroundColor: '#F1F5F9', color: 'var(--primary)', borderRadius: '10px' }}>
                                            <FileText size={24} />
                                        </div>
                                        <div style={{ flex: 1, overflow: 'hidden' }}>
                                            <h4 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.title}</h4>
                                            <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>{doc.category || 'Drawing'}</p>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
                                                <span>{doc.date}</span>
                                                <span style={{ width: '4px', height: '4px', backgroundColor: '#CBD5E1', borderRadius: '50%' }}></span>
                                                <span>{doc.fileSize}</span>
                                            </div>
                                        </div>
                                        <button className="btn btn-outline btn-sm" style={{ padding: '8px' }} title="Download">
                                            <Upload size={14} style={{ transform: 'rotate(180deg)' }} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

            </div>

            {/* ── Modals ──────────────────────────────────────────────── */}
            <AddTaskModal
                isOpen={isAddTaskOpen}
                onClose={() => setIsAddTaskOpen(false)}
                project={project}
                onTaskAdded={reloadProject}
            />

            <CompleteTaskModal
                isOpen={isCompleteTaskOpen}
                onClose={() => setIsCompleteTaskOpen(false)}
                project={project}
                task={completingTask}
                onCompleted={reloadProject}
            />

            <TaskDetailsModal
                isOpen={!!viewTask}
                onClose={() => setViewTask(null)}
                task={viewTask ? {
                    ...viewTask,
                    assignedTo: resolveEmployeeName(viewTask.assignedTo)
                } : null}
            />
            <UploadDocumentModal
                isOpen={isUploadDocOpen}
                onClose={() => setIsUploadDocOpen(false)}
                project={project}
                onDocumentUploaded={reloadProject}
            />
            <DPRModal
                isOpen={isDPRModalOpen}
                onClose={() => setIsDPRModalOpen(false)}
                project={project}
                onDprAdded={reloadProject}
            />
            <DPRViewModal
                isOpen={isDPRViewOpen}
                onClose={() => setIsDPRViewOpen(false)}
                dpr={selectedDPR}
                projectName={project.name}
            />
            <EditProjectModal
                isOpen={isEditProjectOpen}
                onClose={() => setIsEditProjectOpen(false)}
                project={project}
                onProjectUpdated={(updated) => {
                    setProject(updated);
                }}
            />
        </div>
    );
};

export default ProjectDetails;

import React, { useState, useEffect } from 'react';
import {
    CheckCircle2, Clock, PlayCircle, Plus, Search, Filter,
    MoreVertical, FileText, CheckCircle, Package, Share2, Mail, MessageCircle, Briefcase, ChevronDown, Loader2, Bell
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { projectAPI, employeeAPI } from '../../utils/api';
import CompleteTaskModal from '../../components/CompleteTaskModal';
import AddTaskModal from '../../components/AddTaskModal';

import CustomSelect from '../../components/CustomSelect';

const Tasks = () => {
    const { user } = useAuth();
    const isEngineer = user?.role === 'Site Engineer';

    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [projectFilter, setProjectFilter] = useState('All');
    const [projectsData, setProjectsData] = useState([]);
    const [employeesMap, setEmployeesMap] = useState({});

    // Helper to resolve employee name from ID
    const resolveEmployeeName = (id) => {
        if (!id || id === 'Unassigned') return 'Unassigned';
        // Handle potential object structure
        const targetId = typeof id === 'object' ? (id._id || id.id || id.$oid || '') : String(id).trim();
        const emp = employeesMap[targetId];
        if (emp) return emp.fullName || emp.name || targetId;
        return targetId;
    };

    const getStringId = (val, fallback = '') => {
        if (!val) return fallback;
        if (typeof val === 'object') {
            return val.username || val.employeeCode || val._id || val.id || val.$oid || fallback;
        }
        return String(val).trim();
    };

    // Modals
    const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
    const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);
    const [selectedTask, setSelectedTask] = useState(null);
    const [selectedProject, setSelectedProject] = useState(null);
    const [openStatusId, setOpenStatusId] = useState(null);

    // Options for CustomSelect
    const projectOptions = [
        { value: 'All', label: 'All Projects' },
        ...projectsData.map(p => ({ value: getStringId(p._id || p.id), label: p.name }))
    ];

    const statusOptions = [
        { value: 'All', label: 'All Statuses' },
        { value: 'Pending', label: 'Pending' },
        { value: 'In Progress', label: 'In Progress' },
        { value: 'Completed', label: 'Completed' }
    ];

    const fetchTasks = async () => {
        setLoading(true);
        try {
            const res = await projectAPI.getAll();
            const projects = res.data || [];
            setProjectsData(projects);

            let allTasks = [];
            projects.forEach(project => {
                const projectTasks = project.tasks || [];
                projectTasks.forEach(t => {
                    // Show all tasks from the projects that the backend allowed us to see
                    allTasks.push({ ...t, pId: getStringId(project._id || project.id), projectName: project.name });
                });
            });

            // Sort by creation date (newest first)
            allTasks.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
            setTasks(allTasks);
        } catch (err) {
            console.error('Failed to fetch tasks', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchEmployees = async () => {
        try {
            const res = await employeeAPI.getAll();
            const emps = res.data || [];
            const empMap = {};
            emps.forEach(e => {
                // Map ALL possible identifiers to the same object
                if (e._id) empMap[e._id] = e;
                if (e.id) empMap[e.id] = e;
                if (e.username) empMap[e.username] = e;
                if (e.employeeCode) empMap[e.employeeCode] = e;
                if (e.fullName) empMap[e.fullName] = e;
            });
            setEmployeesMap(empMap);
        } catch (err) {
            console.error('Failed to fetch employees for sharing', err);
        }
    };

    useEffect(() => {
        fetchTasks();
        fetchEmployees();
    }, [user]);

    // Derived Data
    const filteredTasks = tasks.filter(t => {
        const matchesSearch = t.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.projectName?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'All' || t.status === statusFilter;
        const matchesProject = projectFilter === 'All' || t.pId === projectFilter;
        return matchesSearch && matchesStatus && matchesProject;
    });

    const pendingCount = tasks.filter(t => t.status === 'Pending').length;
    const inProgressCount = tasks.filter(t => t.status === 'In Progress').length;
    const completedCount = tasks.filter(t => t.status === 'Completed').length;

    // Actions
    const handleStatusChange = async (task, newStatus) => {
        if (newStatus === 'Completed') {
            setSelectedTask(task);
            setSelectedProject({ _id: task.pId, name: task.projectName });
            setIsCompleteModalOpen(true);
            return;
        }

        try {
            await projectAPI.updateTask(task.pId, task.id, { status: newStatus });
            if (newStatus === 'In Progress') {
                // Trigger notification to admin
                await projectAPI.notifyTask(task.pId, task.id);
            }
            fetchTasks();
        } catch (err) {
            console.error('Failed to update task status', err);
            alert('Failed to update task status.');
        }
    };

    const handleNotifyAdmin = async (task) => {
        try {
            await projectAPI.notifyTask(task.pId, task.id);
            alert('Admin has been notified successfully! 🚀');
        } catch (err) {
            console.error('Failed to notify admin:', err);
            alert('Failed to notify admin. Please check your connection.');
        }
    };

    const handleShare = async (task, method) => {
        const assignedId = task.assignedTo || 'engineer';
        let employee = employeesMap[assignedId];

        // If not found in map, attempt a generic find
        if (!employee) {
            employee = Object.values(employeesMap).find(e =>
                (e.fullName && e.fullName.toLowerCase() === assignedId.toLowerCase()) ||
                e.username === assignedId
            );
        }

        const phone = employee?.contactNumber || employee?.phone || '';
        const taskDetails = `Task: ${task.name}\nProject: ${task.projectName}\nPriority: ${task.priority}\nDueDate: ${task.dueDate || 'N/A'}\nStatus: ${task.status}`;

        if (method === 'whatsapp') {
            if (!phone) {
                alert(`No contact number found for ${assignedId}.`);
                return;
            }
            const cleanPhone = phone.replace(/\D/g, '');
            const encodedText = encodeURIComponent(`Hello,\nHere are the details for your assigned task:\n\n${taskDetails}`);
            window.open(`https://wa.me/${cleanPhone}?text=${encodedText}`, '_blank');
        } else if (method === 'email') {
            try {
                // Call Server side email share
                const res = await projectAPI.shareTaskEmail(task.pId, task.id);
                if (res.data?.success) {
                    alert(`✅ Task details shared successfully via Email to ${employee?.fullName || assignedId}`);
                }
            } catch (err) {
                console.error('Failed to share via email', err);
                // Fallback to mailto link if API fails
                const email = employee?.email || '';
                if (email) {
                    const encodedSubject = encodeURIComponent(`Assigned Task: ${task.name}`);
                    const encodedBody = encodeURIComponent(`Hello,\nHere are the details for your assigned task:\n\n${taskDetails}`);
                    window.open(`mailto:${email}?subject=${encodedSubject}&body=${encodedBody}`);
                } else {
                    alert('Failed to send email. No recipient address available.');
                }
            }
        }
    };

    return (
        <div className="animate-fade-in" style={{ padding: '0 10px 40px 10px' }}>
            {/* ── Header ─────────────────────────────────────────── */}
            <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: '32px', fontWeight: '800', color: 'var(--text-main)', marginBottom: '4px' }}>Tasks & Workflow</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '15px' }}>Manage site activities and execution progress.</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="btn btn-primary" onClick={() => setIsAddTaskModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Plus size={18} /> NEW TASK
                    </button>
                </div>
            </div>

            {/* ── KPI Row ────────────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '32px' }}>
                <div className="card" style={{ padding: '20px', display: 'flex', gap: '16px', borderTop: '4px solid #64748B', borderRadius: '12px' }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '10px', backgroundColor: '#F1F5F9', color: '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FileText size={22} />
                    </div>
                    <div>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '2px' }}>Total Tasks</p>
                        <h4 style={{ fontSize: '28px', fontWeight: '900', color: 'var(--text-main)', margin: 0 }}>{tasks.length}</h4>
                    </div>
                </div>

                <div className="card" style={{ padding: '20px', display: 'flex', gap: '16px', borderTop: '4px solid #F59E0B', borderRadius: '12px' }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '10px', backgroundColor: '#FFFBEB', color: '#F59E0B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Clock size={22} />
                    </div>
                    <div>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '2px' }}>Pending</p>
                        <h4 style={{ fontSize: '28px', fontWeight: '900', color: 'var(--text-main)', margin: 0 }}>{pendingCount}</h4>
                    </div>
                </div>

                <div className="card" style={{ padding: '20px', display: 'flex', gap: '16px', borderTop: '4px solid #3B82F6', borderRadius: '12px' }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '10px', backgroundColor: '#EFF6FF', color: '#3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <PlayCircle size={22} />
                    </div>
                    <div>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '2px' }}>In Progress</p>
                        <h4 style={{ fontSize: '28px', fontWeight: '900', color: 'var(--text-main)', margin: 0 }}>{inProgressCount}</h4>
                    </div>
                </div>

                <div className="card" style={{ padding: '20px', display: 'flex', gap: '16px', borderTop: '4px solid #10B981', borderRadius: '12px' }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '10px', backgroundColor: '#ECFDF5', color: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <CheckCircle2 size={22} />
                    </div>
                    <div>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '2px' }}>Completed</p>
                        <h4 style={{ fontSize: '28px', fontWeight: '900', color: 'var(--text-main)', margin: 0 }}>{completedCount}</h4>
                    </div>
                </div>
            </div>

            {/* ── Filters ────────────────────────────────────────── */}
            <div className="card" style={{ padding: '16px 24px', marginBottom: '24px', display: 'flex', gap: '24px', alignItems: 'center', overflow: 'visible' }}>
                <div style={{ flex: 1, position: 'relative' }}>
                    <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', zIndex: 1 }} />
                    <input
                        type="text"
                        placeholder="Search tasks by name or project..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        style={{ width: '100%', padding: '10px 10px 10px 40px', borderRadius: '12px', border: '1px solid var(--border)', backgroundColor: '#f8fafc', fontSize: '14px', outline: 'none' }}
                    />
                </div>

                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <CustomSelect
                        options={projectOptions}
                        value={projectFilter}
                        onChange={setProjectFilter}
                        icon={Briefcase}
                        placeholder="All Projects"
                        searchable={true}
                    />

                    <CustomSelect
                        options={statusOptions}
                        value={statusFilter}
                        onChange={setStatusFilter}
                        icon={Filter}
                        placeholder="All Statuses"
                        searchable={false}
                    />
                </div>
            </div>

            {/* ── Task List ────────────────────────────────────────── */}
            <div className="card" style={{ padding: '0', overflow: 'visible' }}>
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Task Name</th>
                            <th>Project</th>
                            <th>Priority</th>
                            <th>Status</th>
                            <th>Assigned To</th>
                            <th style={{ textAlign: 'right' }}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredTasks.length > 0 ? (
                            filteredTasks.map((t) => (
                                <tr key={`${t.pId}-${t.id}`}>
                                    <td>
                                        <div style={{ fontWeight: '600', color: 'var(--text-main)' }}>{t.name}</div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Due: {t.dueDate || 'N/A'}</div>
                                    </td>
                                    <td>
                                        <div style={{ fontWeight: '500', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <Package size={14} /> {t.projectName}
                                        </div>
                                    </td>
                                    <td>
                                        <span style={{
                                            padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600',
                                            backgroundColor: t.priority === 'High' ? '#FEE2E2' : t.priority === 'Medium' ? '#FEF3C7' : '#EFF6FF',
                                            color: t.priority === 'High' ? '#DC2626' : t.priority === 'Medium' ? '#D97706' : '#2563EB'
                                        }}>
                                            {t.priority || 'Normal'}
                                        </span>
                                    </td>
                                    <td>
                                        <div style={{ position: 'relative', display: 'inline-block' }}>
                                            <button
                                                onClick={() => {
                                                    if (t.status !== 'Completed') {
                                                        setOpenStatusId(openStatusId === `${t.pId}-${t.id}` ? null : `${t.pId}-${t.id}`);
                                                    }
                                                }}
                                                style={{
                                                    padding: '6px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: '600',
                                                    border: '1px solid var(--border)', outline: 'none', cursor: t.status === 'Completed' ? 'default' : 'pointer',
                                                    backgroundColor: t.status === 'Completed' ? '#ECFDF5' : t.status === 'In Progress' ? '#EFF6FF' : '#FFFBEB',
                                                    color: t.status === 'Completed' ? '#059669' : t.status === 'In Progress' ? '#2563EB' : '#D97706',
                                                    display: 'flex', alignItems: 'center', gap: '8px'
                                                }}
                                            >
                                                {t.status || 'Pending'}
                                                {t.status !== 'Completed' && <ChevronDown size={14} />}
                                            </button>

                                            {openStatusId === `${t.pId}-${t.id}` && (
                                                <>
                                                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 90 }} onClick={() => setOpenStatusId(null)}></div>
                                                    <div style={{
                                                        position: 'absolute', top: '100%', left: '0', marginTop: '4px',
                                                        backgroundColor: 'white', border: '1px solid var(--border)',
                                                        borderRadius: '8px', boxShadow: '0 4px 12px -1px rgba(0,0,0,0.1)',
                                                        zIndex: 100, flexDirection: 'column', minWidth: '130px', padding: '4px',
                                                        display: 'flex'
                                                    }}>
                                                        {['Pending', 'In Progress', 'Completed'].map(st => (
                                                            <button
                                                                key={st}
                                                                onClick={() => {
                                                                    handleStatusChange(t, st);
                                                                    setOpenStatusId(null);
                                                                }}
                                                                style={{
                                                                    padding: '8px 12px', background: 'none', border: 'none',
                                                                    textAlign: 'left', fontSize: '13px', cursor: 'pointer',
                                                                    borderRadius: '4px', fontWeight: '500', color: 'var(--text-main)'
                                                                }}
                                                                className="hover-status-item"
                                                            >
                                                                {st}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                    <td style={{ color: 'var(--text-main)', fontSize: '14px', fontWeight: '600' }}>
                                        {resolveEmployeeName(t.assignedTo)}
                                    </td>
                                    <td style={{ textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: '12px', alignItems: 'center' }}>
                                        {/* Share Action - Only if not completed */}
                                        {t.status !== 'Completed' && (
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleShare(t, 'whatsapp'); }}
                                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '50%', background: '#dcfce7', border: 'none', cursor: 'pointer', color: '#10B981', transition: 'all 0.2s' }}
                                                    className="hover-scale"
                                                    title="Share via WhatsApp"
                                                >
                                                    <MessageCircle size={14} />
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleShare(t, 'email'); }}
                                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '50%', background: '#eff6ff', border: 'none', cursor: 'pointer', color: '#3B82F6', transition: 'all 0.2s' }}
                                                    className="hover-scale"
                                                    title="Share via Email"
                                                >
                                                    <Mail size={14} />
                                                </button>
                                            </div>
                                        )}
                                        <style>{`
                                            .hover-status-item:hover { background-color: #f1f5f9; }
                                            .hover-scale:hover { transform: scale(1.1); }
                                        `}</style>

                                        {t.status === 'Completed' ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <button
                                                    className="btn btn-outline hover-scale"
                                                    style={{ padding: '4px 10px', fontSize: '11px', minWidth: 'auto', gap: '4px' }}
                                                    onClick={(e) => { e.stopPropagation(); handleNotifyAdmin(t); }}
                                                    title="Notify Admin about this completed task"
                                                >
                                                    <Bell size={12} /> Update Admin
                                                </button>
                                                <span style={{ color: '#10B981', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: '700', justifyContent: 'flex-end' }}>
                                                    <CheckCircle size={16} /> Done
                                                </span>
                                            </div>
                                        ) : (
                                            <button
                                                className="btn btn-primary btn-sm"
                                                onClick={() => handleStatusChange(t, 'Completed')}
                                                style={{ padding: '6px 12px', fontSize: '12px', minWidth: '85px' }}
                                            >
                                                Mark Done
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                                    <CheckCircle size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                                    <p>No tasks found.</p>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Complete Task Modal */}
            <CompleteTaskModal
                isOpen={isCompleteModalOpen}
                onClose={() => {
                    setIsCompleteModalOpen(false);
                    setSelectedTask(null);
                    setSelectedProject(null);
                }}
                task={selectedTask}
                project={selectedProject}
                onCompleted={fetchTasks}
            />

            {/* Add Task Modal */}
            <AddTaskModal
                isOpen={isAddTaskModalOpen}
                onClose={() => setIsAddTaskModalOpen(false)}
                projects={projectsData}
                onTaskAdded={fetchTasks}
            />

        </div>
    );
};

export default Tasks;

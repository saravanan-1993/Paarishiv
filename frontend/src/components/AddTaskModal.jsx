import React, { useState, useEffect } from 'react';
import { X, ClipboardList, User, Calendar, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { projectAPI, employeeAPI } from '../utils/api';
import CustomSelect from './CustomSelect';
import CustomTimePicker from './CustomTimePicker';
import { Briefcase } from 'lucide-react';

const AddTaskModal = ({ isOpen, onClose, project, projects = [], onTaskAdded }) => {
    // Helper to get a string ID from potential populated object
    const getStringId = (val, fallback = '') => {
        if (!val) return fallback;
        if (typeof val === 'object') {
            return val.$oid || val._id || val.id || val.username || val.employeeCode || fallback;
        }
        return String(val).trim();
    };

    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [form, setForm] = useState({
        name: '',
        assignedTo: '',
        priority: 'Medium',
        startDate: '',
        dueDate: '',
        dueTime: '18:00',
        status: 'Pending',
        instructions: '',
    });
    const [loading, setLoading] = useState(false);
    const [engineerName, setEngineerName] = useState('');

    // Derived values - much safer than keeping in sync via effects
    const activeProject = project || (projects || []).find(p => getStringId(p._id || p.id) === selectedProjectId) || (projects?.length > 0 ? projects[0] : null);
    const engineerId = getStringId(activeProject?.engineer_id);
    const engineerDisplayName = engineerName || (engineerId ? engineerId.charAt(0).toUpperCase() + engineerId.slice(1) : 'Engineer');

    // 1. Reset form and sync internal ID when modal opens or project prop changes
    useEffect(() => {
        if (isOpen) {
            setForm({
                name: '',
                assignedTo: '',
                priority: 'Medium',
                startDate: '',
                dueDate: '',
                dueTime: '18:00',
                status: 'Pending',
                instructions: '',
            });

            if (project) {
                setSelectedProjectId(getStringId(project._id || project.id));
            } else if (projects?.length > 0 && !selectedProjectId) {
                setSelectedProjectId(getStringId(projects[0]._id || projects[0].id));
            }
        }
    }, [isOpen, project]);

    // 2. Fetch/Resolve Engineer Name whenever the engineerId changes
    useEffect(() => {
        if (!isOpen) return;
        
        const fetchName = async () => {
            if (!engineerId) {
                setEngineerName('');
                return;
            }

            // Immediate feedback reset
            setEngineerName('');

            if (engineerId === 'engineer') {
                setEngineerName('Suki Engineer');
            } else if (engineerId === 'admin') {
                setEngineerName('Super Admin');
            } else {
                try {
                    const res = await employeeAPI.getAll();
                    const emps = res.data || [];
                    const emp = emps.find(e => 
                        getStringId(e._id) === engineerId || 
                        getStringId(e.username) === engineerId ||
                        getStringId(e.employeeCode) === engineerId
                    );
                    if (emp) {
                        setEngineerName(emp.fullName);
                    } else {
                        // Keep ID capitalized as name
                    }
                } catch (err) {
                    console.error('Failed to resolve engineer name:', err);
                }
            }
        };

        fetchName();
    }, [isOpen, engineerId]);

    const handleTimeChange = (time) => {
        setForm(prev => ({ ...prev, dueTime: time }));
    };

    if (!isOpen) return null;

    const handleChange = (e) => {
        setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async () => {
        if (!form.name.trim()) {
            alert('Task description is required.');
            return;
        }
        if (!form.startDate) {
            alert('Start date is required.');
            return;
        }
        if (!form.dueDate) {
            alert('Due date is required.');
            return;
        }
        if (!form.dueTime) {
            alert('Due time is required.');
            return;
        }
        setLoading(true);
        try {
            const targetProjectId = getStringId(project?._id || project?.id || selectedProjectId);
            if (!targetProjectId) {
                alert('Please select a project first.');
                return;
            }
            await projectAPI.addTask(targetProjectId, {
                ...form,
                assignedTo: form.assignedTo || engineerId,
            });
            alert(`Notification sent: Task assigned to ${engineerDisplayName || 'engineer'}`);
            // Reset form
            setForm({ name: '', assignedTo: '', priority: 'Medium', startDate: '', dueDate: '', dueTime: '18:00', status: 'Pending', instructions: '' });
            onTaskAdded?.();  // Refresh project data in parent
            onClose();
        } catch (err) {
            console.error(err);
            alert(err?.response?.data?.detail || 'Failed to add task. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <div style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)'
            }}>
                <div className="animate-fade-in" style={{
                    backgroundColor: 'white', width: '100%', maxWidth: '520px',
                    borderRadius: '14px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
                    display: 'flex', flexDirection: 'column', overflow: 'hidden'
                }}>
                    {/* Header */}
                    <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(135deg,#1e3a5f,#2F5D8A)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ padding: '10px', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: '8px', color: 'white' }}>
                                <ClipboardList size={20} />
                            </div>
                            <div>
                                <h2 style={{ fontSize: '18px', fontWeight: '700', color: 'white' }}>Add New Task</h2>
                                <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>
                                    {project?.name || 'Project'} • Assign work to site engineer
                                </p>
                            </div>
                        </div>
                        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.8)' }}>
                            <X size={22} />
                        </button>
                    </div>

                    {/* Body */}
                    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>

                        {/* Project Selection (if no project is passed) */}
                        {!project && projects?.length > 0 && (
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>
                                    Select Project *
                                </label>
                                <CustomSelect
                                    options={(projects?.length > 0 ? projects : (project ? [project] : [])).map(p => ({ value: getStringId(p._id || p.id), label: p.name }))}
                                    value={selectedProjectId}
                                    onChange={(val) => {
                                        setSelectedProjectId(val);
                                        setForm(prev => ({ ...prev, assignedTo: '' }));
                                    }}
                                    placeholder="— Select Project —"
                                    icon={Briefcase}
                                    width="full"
                                    searchable={true}
                                />
                            </div>
                        )}

                        {/* Task Name */}
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>
                                Task Description *
                            </label>
                            <input
                                name="name"
                                value={form.name}
                                onChange={handleChange}
                                placeholder="e.g. Foundation Piling Station B"
                                style={{ width: '100%', padding: '11px 14px', borderRadius: '8px', border: '1.5px solid var(--border)', fontSize: '14px', boxSizing: 'border-box' }}
                            />
                        </div>

                        {/* Assign To — only Site Engineer of this project */}
                        <div>
                            <CustomSelect
                                label="Assign To (Site Incharge) *"
                                options={engineerId ? [
                                    { value: engineerId, label: engineerDisplayName }
                                ] : []}
                                value={form.assignedTo || engineerId}
                                onChange={(val) => setForm(prev => ({ ...prev, assignedTo: val }))}
                                placeholder={engineerId ? "Select Engineer" : "— No Site Engineer —"}
                                icon={User}
                                width="full"
                                searchable={true}
                            />
                            {!engineerId && (
                                <p style={{ fontSize: '12px', color: '#F59E0B', marginTop: '6px', fontWeight: '600' }}>
                                    ⚠ Go to Project settings and assign a Site Engineer first.
                                </p>
                            )}
                        </div>

                        {/* Priority + Status */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div>
                                <CustomSelect
                                    label="Priority"
                                    options={[
                                        { value: 'High', label: 'High' },
                                        { value: 'Medium', label: 'Medium' },
                                        { value: 'Low', label: 'Low' }
                                    ]}
                                    value={form.priority}
                                    onChange={(val) => setForm(prev => ({ ...prev, priority: val }))}
                                    icon={AlertCircle}
                                    width="full"
                                    searchable={false}
                                />
                            </div>
                            <div>
                                <CustomSelect
                                    label="Status"
                                    options={[
                                        { value: 'Pending', label: 'Pending' },
                                        { value: 'In Progress', label: 'In Progress' },
                                        { value: 'Completed', label: 'Completed' }
                                    ]}
                                    value={form.status}
                                    onChange={(val) => setForm(prev => ({ ...prev, status: val }))}
                                    icon={CheckCircle2}
                                    width="full"
                                    searchable={false}
                                />
                            </div>
                        </div>

                        {/* Dates */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Start Date *</label>
                                <div style={{ position: 'relative' }}>
                                    <Calendar size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                                    <input
                                        name="startDate"
                                        type="date"
                                        value={form.startDate}
                                        onChange={handleChange}
                                        style={{
                                            width: '100%', padding: '11px 11px 11px 36px', borderRadius: '10px',
                                            border: '1.5px solid var(--border)', fontSize: '14px', boxSizing: 'border-box',
                                            accentColor: 'var(--primary)',
                                            outline: 'none'
                                        }}
                                    />
                                </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Due Date & Time *</label>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <div style={{ position: 'relative', flex: '1.2' }}>
                                        <Calendar size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                                        <input
                                            name="dueDate"
                                            type="date"
                                            value={form.dueDate}
                                            onChange={handleChange}
                                            style={{
                                                width: '100%', padding: '11px 11px 11px 36px', borderRadius: '10px',
                                                border: '1.5px solid var(--border)', fontSize: '14px', boxSizing: 'border-box',
                                                outline: 'none'
                                            }}
                                        />
                                    </div>
                                    <div style={{ flex: '1' }}>
                                        <CustomTimePicker
                                            value={form.dueTime}
                                            onChange={handleTimeChange}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Instructions */}
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Instructions (Optional)</label>
                            <textarea
                                name="instructions"
                                value={form.instructions}
                                onChange={handleChange}
                                placeholder="Specify any additional details for the site engineer..."
                                style={{ width: '100%', padding: '11px 14px', borderRadius: '8px', border: '1.5px solid var(--border)', minHeight: '72px', fontFamily: 'inherit', fontSize: '14px', resize: 'vertical', boxSizing: 'border-box' }}
                            />
                        </div>
                    </div>

                    {/* Footer */}
                    <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '12px', backgroundColor: '#f8fafc' }}>
                        <button className="btn btn-outline" onClick={onClose} disabled={loading} style={{ padding: '10px 24px' }}>Cancel</button>
                        <button
                            className="btn btn-primary"
                            onClick={handleSubmit}
                            disabled={loading}
                            style={{ padding: '10px 32px', background: 'linear-gradient(135deg,#1e3a5f,#2F5D8A)', border: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                            {loading ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Saving...</> : '✓ Assign Task'}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default AddTaskModal;

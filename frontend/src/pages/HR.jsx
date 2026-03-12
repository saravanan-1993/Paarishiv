import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Users,
    UserPlus,
    CheckCircle,
    Clock,
    Calendar,
    IndianRupee,
    ShieldCheck,
    HardHat,
    Trash2,
    Edit3,
    Plus,
    LayoutDashboard,
    Briefcase,
    Wallet,
    ShoppingCart,
    Package,
    FileCheck,
    FileText,
    HelpCircle,
    MessageSquare,
    Settings,
    Shield,
    RotateCw,
    UserCog,
    History,
    Building2
} from 'lucide-react';

import CreateRoleModal from '../components/CreateRoleModal';
import AddEmployeeModal from '../components/AddEmployeeModal';
import EmployeeDetailsModal from '../components/EmployeeDetailsModal';
import AddContractorModal from '../components/AddContractorModal';
import AddLabourModal from '../components/AddLabourModal';
import ProcessPayrollModal from '../components/ProcessPayrollModal';
import { getRoles, saveRoles, hasPermission } from '../utils/rbac';
import { useAuth } from '../context/AuthContext';

const HR = () => {
    const { user } = useAuth();
    const [activeMainTab, setActiveMainTab] = useState('Roles');
    const [activeSubTab, setActiveSubTab] = useState('All');
    const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
    const [isAddEmployeeModalOpen, setIsAddEmployeeModalOpen] = useState(false);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [isAddContractorModalOpen, setIsAddContractorModalOpen] = useState(false);
    const [isAddLabourModalOpen, setIsAddLabourModalOpen] = useState(false);
    const [isProcessPayrollModalOpen, setIsProcessPayrollModalOpen] = useState(false);
    const [editingRole, setEditingRole] = useState(null);
    const [viewingEmployee, setViewingEmployee] = useState(null);
    const [editingEmployee, setEditingEmployee] = useState(null);
    const [payrollEmployee, setPayrollEmployee] = useState(null);
    const [payrollStatuses, setPayrollStatuses] = useState({});

    const [contractors, setContractors] = useState([]);

    const [labours, setLabours] = useState([]);

    // Keep the icons statically mapping here since we can't save lucide-react instances to string
    const iconMapping = {
        'Dashboard': LayoutDashboard,
        'Projects': Briefcase,
        'Budget & Finance': Wallet,
        'Procurement': ShoppingCart,
        'HRMS': Users,
        'Inventory Management': Package,
        'Reports': FileText,
        'User Management': UserCog,
        'System Logs': History,
        'Settings': Settings
    };

    const loadRoles = () => {
        const storedRoles = getRoles();
        return storedRoles.map(r => ({
            ...r,
            permissions: r.permissions.map(p => ({
                ...p,
                icon: iconMapping[p.name] || LayoutDashboard
            }))
        }));
    };

    const [roles, setRoles] = useState(loadRoles());
    const [employees, setEmployees] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const [attendance, setAttendance] = useState([]);

    const fetchEmployees = async () => {
        try {
            setIsLoading(true);
            const baseUrl = '/api';
            const empRes = await axios.get(`${baseUrl}/employees/`);
            const mappedEmployees = empRes.data.map(emp => ({
                id: emp.employeeCode,
                name: emp.fullName,
                role: emp.roles.join(', '),
                dept: emp.department,
                mobile: emp.phone,
                status: emp.status || 'Active',
                ...emp
            }));
            setEmployees(mappedEmployees);

            const labRes = await axios.get(`${baseUrl}/labour/`);
            const mappedLabours = labRes.data.map(lab => ({
                name: lab.name,
                cat: lab.category,
                site: 'Project Site', // Default or fetch from project
                rate: `₹${lab.daily_wage}`,
                ot: '0h',
                status: 'Active',
                ...lab
            }));
            setLabours(mappedLabours);
        } catch (error) {
            console.error('Error fetching HR data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchEmployees();
    }, []);

    useEffect(() => {
        const handleOpenRole = () => {
            setIsRoleModalOpen(true);
            setEditingRole(null);
        };
        document.addEventListener('openCreateRole', handleOpenRole);
        return () => document.removeEventListener('openCreateRole', handleOpenRole);
    }, []);

    const handleRoleCreated = (newRole, isUpdate) => {
        let updatedRoles;
        if (isUpdate) {
            updatedRoles = roles.map(r => r.name === editingRole.name ? newRole : r);
        } else {
            updatedRoles = [...roles, newRole];
        }
        setRoles(updatedRoles);
        // Save cleaned roles to local storage
        saveRoles(updatedRoles.map(r => ({ ...r, permissions: r.permissions.map(p => ({ name: p.name, actions: p.actions })) })));
        setEditingRole(null);
    };

    const handleEmployeeAdded = async () => {
        try {
            await fetchEmployees(); // Refresh list from server
            setIsAddEmployeeModalOpen(false);
            setEditingEmployee(null);
            setActiveSubTab('All');
        } catch (error) {
            console.error('Error handling employee update/add:', error);
        }
    };

    const handleContractorAdded = (newContractor) => {
        setContractors(prev => [...prev, newContractor]);
        setIsAddContractorModalOpen(false);
    };

    const handleLabourAdded = async (newLabour) => {
        try {
            const backendData = {
                name: newLabour.name,
                contact: newLabour.phone || '0000000000',
                category: newLabour.category || 'Helper',
                daily_wage: parseFloat(newLabour.wageRate) || 0,
                current_project_id: null
            };
            const baseUrl = '/api';
            const response = await axios.post(`${baseUrl}/labour/`, backendData);

            const addedLabour = {
                ...response.data,
                name: response.data.name,
                cat: response.data.category,
                site: 'Assigned Site',
                rate: `₹${response.data.daily_wage}`,
                ot: '0h',
                status: 'Active'
            };
            setLabours(prev => [...prev, addedLabour]);
            setIsAddLabourModalOpen(false);
        } catch (error) {
            console.error('Error adding labour:', error);
            alert('Failed to add labour.');
        }
    };

    const handleDeleteRole = (roleName) => {
        if (roleName === 'Administrator' || roleName === 'Super Admin') {
            alert(`Cannot delete ${roleName} role`);
            return;
        }
        if (window.confirm(`Are you sure you want to delete the ${roleName} role?`)) {
            const updated = roles.filter(r => r.name !== roleName);
            setRoles(updated);
            saveRoles(updated.map(r => ({ ...r, permissions: r.permissions.map(p => ({ name: p.name, actions: p.actions })) })));
        }
    };

    const handleEditRole = (role) => {
        setEditingRole(role);
        setIsRoleModalOpen(true);
    };

    const handleCreateRoleClick = () => {
        setEditingRole(null);
        setIsRoleModalOpen(true);
    };

    const handleViewProfile = (emp) => {
        setViewingEmployee(emp);
        setIsDetailsModalOpen(true);
    };

    const handleEditEmployee = (emp) => {
        setEditingEmployee(emp);
        setIsAddEmployeeModalOpen(true);
    };

    const presentCount = employees.filter(emp => ['IN-OFFICE', 'In-office', 'Present', 'Active'].includes(emp.status)).length;
    const totalSalaryBudget = employees.reduce((acc, emp) => acc + (parseFloat(emp.basicSalary) || 0) + (parseFloat(emp.hra) || 0), 0);
    const pendingPayrollCount = employees.filter(emp => (payrollStatuses[emp.id] || 'Pending') === 'Pending').length;

    const kpis = [
        { label: 'EMPLOYEES', value: employees.length.toString(), icon: Users, color: '#3B82F6', bgColor: '#EFF6FF' },
        { label: 'PRESENT TODAY', value: presentCount.toString(), icon: CheckCircle, color: '#10B981', bgColor: '#ECFDF5' },
        { label: 'ATT. RATE', value: employees.length > 0 ? `${Math.round((presentCount / employees.length) * 100)}%` : '0%', icon: FileCheck, color: '#4B5563', bgColor: '#f8fafc' },
        { label: 'TOTAL OT', value: '0h', icon: Clock, color: '#F59E0B', bgColor: '#FFFBEB' },
        { label: 'SALARY BUDGET', value: `₹${totalSalaryBudget.toLocaleString('en-IN')}`, icon: IndianRupee, color: '#8B5CF6', bgColor: '#F5F3FF' },
        { label: 'PAYROLL PENDING', value: pendingPayrollCount.toString(), icon: Wallet, color: '#EF4444', bgColor: '#FEF2F2' },
    ];

    return (
        <div className="hr-container" style={{ position: 'relative' }}>
            <div className="animate-fade-in" style={{ padding: '0 10px 40px 10px' }}>
                {/* Page Header */}
                <div style={{ marginBottom: '32px' }}>
                    <h1 style={{ fontSize: '32px', fontWeight: '800', color: 'var(--text-main)', marginBottom: '4px' }}>HRMS</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '15px' }}>Employee management, attendance & payroll</p>
                </div>

                {/* KPI Row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '16px', marginBottom: '32px' }}>
                    {kpis.map((kpi, i) => (
                        <div key={i} className="card" style={{ padding: '20px', display: 'flex', gap: '16px', borderTop: `4px solid ${kpi.color}`, borderRadius: '4px' }}>
                            <div style={{
                                width: '40px', height: '40px', borderRadius: '8px',
                                backgroundColor: kpi.bgColor, color: kpi.color,
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <kpi.icon size={20} />
                            </div>
                            <div>
                                <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '2px' }}>{kpi.label}</p>
                                <h4 style={{ fontSize: '18px', fontWeight: '800' }}>{kpi.value}</h4>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Main Tabs */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
                    {[
                        { name: 'Roles', id: 'Roles', icon: ShieldCheck },
                        { name: 'Employees', id: 'Employees', icon: Users },
                        { name: 'Contractor', id: 'Contractor', icon: Building2 },
                        { name: 'Labour', id: 'Labour', icon: HardHat },
                        { name: 'Payroll', id: 'Payroll', icon: Wallet },
                    ].map((tab) => {
                        const isActive = activeMainTab === tab.id;
                        const TabIcon = tab.icon || Users;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveMainTab(tab.id)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '8px', border: 'none',
                                    background: isActive ? '#f1f5f9' : 'transparent', color: isActive ? 'var(--text-main)' : 'var(--text-muted)',
                                    fontWeight: isActive ? '700' : '600', fontSize: '14px', cursor: 'pointer'
                                }}
                            >
                                <TabIcon size={18} />
                                {tab.name}
                            </button>
                        );
                    })}
                </div>

                {activeMainTab === 'Roles' && (
                    <div className="animate-fade-in">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                            <div>
                                <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '4px' }}>Roles & Permissions</h3>
                                <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Manage roles and configure module-level permissions</p>
                            </div>
                            {hasPermission(user, 'User Management', 'edit') && (
                                <button className="btn btn-primary" style={{ padding: '12px 24px', fontWeight: '800' }} onClick={handleCreateRoleClick}>
                                    <Plus size={18} /> CREATE ROLE
                                </button>
                            )}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px' }}>
                            {roles.map((role, idx) => (
                                <div key={idx} className="card" style={{ padding: '24px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                                        <div>
                                            <h4 style={{ fontSize: '16px', fontWeight: '700' }}>{role.name}</h4>
                                            <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{role.description}</p>
                                        </div>
                                        <div style={{ display: 'flex', gap: '12px' }}>
                                            <Edit3 size={18} style={{ color: 'var(--text-muted)', cursor: 'pointer' }} onClick={() => handleEditRole(role)} />
                                            {role.name !== 'Administrator' && role.name !== 'Super Admin' && (
                                                <Trash2 size={18} style={{ color: '#EF4444', cursor: 'pointer' }} onClick={() => handleDeleteRole(role.name)} />
                                            )}
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                                        {role.tags.map(tag => (
                                            <span key={tag} style={{
                                                padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600',
                                                backgroundColor: tag === 'System' ? '#EFF6FF' : '#f1f5f9',
                                                color: tag === 'System' ? '#3B82F6' : 'var(--text-muted)',
                                                border: '1px solid var(--border)'
                                            }}>
                                                {tag}
                                            </span>
                                        ))}
                                    </div>

                                    <div style={{ padding: '16px 0', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', marginBottom: '16px' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                                            {role.permissions.map(perm => {
                                                const acts = perm.actions || { view: true, edit: false, delete: false };
                                                return (
                                                    <div key={perm.name} style={{
                                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px',
                                                        borderRadius: '6px', border: '1px solid var(--border)', fontSize: '11px', fontWeight: '600',
                                                        color: 'var(--text-main)', background: '#f8fafc'
                                                    }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            {perm.icon ? <perm.icon size={12} style={{ color: 'var(--primary)' }} /> : <Shield size={12} style={{ color: 'var(--primary)' }} />}
                                                            <span style={{ fontSize: '12px' }}>{perm.name}</span>
                                                        </div>
                                                        <div style={{ display: 'flex', gap: '3px' }}>
                                                            <span style={{ color: acts.view ? '#10B981' : '#CBD5E1' }}>V</span>
                                                            <span style={{ color: acts.edit ? '#F59E0B' : '#CBD5E1' }}>E</span>
                                                            <span style={{ color: acts.delete ? '#EF4444' : '#CBD5E1' }}>D</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                        {role.userCount} user(s)
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeMainTab === 'Employees' && (
                    <>
                        {/* Sub Tabs */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                {[
                                    { name: `All (${employees.length})`, id: 'All', icon: Users },
                                    { name: `Attendance (${attendance.length})`, id: 'Attendance', icon: Calendar },
                                ].map((tab) => {
                                    const isActive = activeSubTab === tab.id;
                                    return (
                                        <button
                                            key={tab.id}
                                            onClick={() => setActiveSubTab(tab.id)}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 16px', borderRadius: '8px',
                                                border: isActive ? '1px solid var(--border)' : '1px solid transparent',
                                                background: isActive ? 'white' : 'transparent', color: isActive ? 'var(--text-main)' : 'var(--text-muted)',
                                                fontWeight: isActive ? '700' : '600', fontSize: '13px', cursor: 'pointer',
                                                boxShadow: isActive ? 'var(--shadow-sm)' : 'none'
                                            }}
                                        >
                                            <tab.icon size={16} />
                                            {tab.name}
                                        </button>
                                    );
                                })}
                            </div>
                            {hasPermission(user, 'HRMS', 'edit') && (
                                <button className="btn btn-primary" style={{ padding: '10px 20px', fontWeight: '800' }} onClick={() => setIsAddEmployeeModalOpen(true)}>
                                    <UserPlus size={18} /> ADD NEW EMPLOYEE
                                </button>
                            )}
                        </div>

                        {activeSubTab === 'All' && (
                            <div className="card">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                                    <h3 style={{ fontSize: '18px', fontWeight: '700' }}>Employee Directory</h3>
                                </div>
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>ID</th>
                                            <th>Name</th>
                                            <th>Designation</th>
                                            <th>Department</th>
                                            <th>Contact</th>
                                            <th>Status</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {employees.map((emp, i) => (
                                            <tr key={i}>
                                                <td style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)' }}>{emp.id}</td>
                                                <td style={{ fontWeight: '600' }}>{emp.name}</td>
                                                <td>{emp.role}</td>
                                                <td>{emp.dept}</td>
                                                <td style={{ fontSize: '13px' }}>{emp.mobile}</td>
                                                <td>
                                                    <span className={`badge ${emp.status === 'Leave' ? 'badge-danger' : 'badge-success'}`}>
                                                        {emp.status}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                                        <button
                                                            onClick={() => handleViewProfile(emp)}
                                                            style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                                            title="View Profile"
                                                        >
                                                            <ShieldCheck size={18} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleEditEmployee(emp)}
                                                            style={{ background: 'none', border: 'none', color: '#F59E0B', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                                            title="Edit Employee"
                                                        >
                                                            <Edit3 size={18} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {activeSubTab === 'Attendance' && (
                            <div className="card">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                                    <div>
                                        <h3 style={{ fontSize: '18px', fontWeight: '700' }}>Daily Attendance Log</h3>
                                        <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Tracking for {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                                    </div>
                                    <div style={{ display: 'flex', gap: '12px' }}>
                                        <button className="btn btn-outline btn-sm">Export PDF</button>
                                        <button className="btn btn-primary btn-sm">Mark Bulk Attendance</button>
                                    </div>
                                </div>
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Employee</th>
                                            <th>Date</th>
                                            <th>Check In</th>
                                            <th>Check Out</th>
                                            <th>Work Hours</th>
                                            <th>Status</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {attendance.map((log, i) => (
                                            <tr key={i}>
                                                <td>
                                                    <div style={{ fontWeight: '600' }}>{log.name}</div>
                                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{log.id}</div>
                                                </td>
                                                <td>{log.date}</td>
                                                <td style={{ color: '#059669', fontWeight: '700' }}>{log.checkIn}</td>
                                                <td style={{ color: log.checkOut === '--' ? 'var(--text-muted)' : '#EF4444', fontWeight: '700' }}>{log.checkOut}</td>
                                                <td style={{ fontWeight: '600' }}>{log.workHours}</td>
                                                <td>
                                                    <span className={`badge ${log.status === 'Present' ? 'badge-success' : 'badge-info'}`}>
                                                        {log.status}
                                                    </span>
                                                </td>
                                                <td>
                                                    <button style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: '700', fontSize: '12px' }}>Update</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>
                )}

                {activeMainTab === 'Labour' && (
                    <div className="card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h3 style={{ fontSize: '18px', fontWeight: '700' }}>Labour Workforce (Daily Wage)</h3>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button className="btn btn-outline btn-sm">
                                    <Plus size={16} /> Bulk Attendance
                                </button>
                                <button className="btn btn-primary btn-sm" onClick={() => setIsAddLabourModalOpen(true)}>
                                    <UserPlus size={16} /> Add Labourer
                                </button>
                            </div>
                        </div>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Category</th>
                                    <th>Assigned Site</th>
                                    <th>Wage Rate</th>
                                    <th>Overtime</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {labours.map((lab, i) => (
                                    <tr key={i}>
                                        <td style={{ fontWeight: '600' }}>{lab.name}</td>
                                        <td>{lab.cat}</td>
                                        <td>{lab.site}</td>
                                        <td style={{ fontWeight: '700' }}>{lab.rate}</td>
                                        <td>{lab.ot}</td>
                                        <td><span className="badge badge-success">{lab.status}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {activeMainTab === 'Contractor' && (
                    <div className="card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h3 style={{ fontSize: '18px', fontWeight: '700' }}>Registered Contractors</h3>
                            <button className="btn btn-primary btn-sm" onClick={() => setIsAddContractorModalOpen(true)}>
                                <Plus size={16} /> Add Contractor
                            </button>
                        </div>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Company Name</th>
                                    <th>Type</th>
                                    <th>Assigned Projects</th>
                                    <th>Lead Contact</th>
                                    <th>Status</th>
                                    <th>Payment</th>
                                </tr>
                            </thead>
                            <tbody>
                                {contractors.map((con, i) => (
                                    <tr key={i}>
                                        <td style={{ fontWeight: '600' }}>{con.company}</td>
                                        <td>{con.type}</td>
                                        <td>{con.projects}</td>
                                        <td>{con.contact}</td>
                                        <td><span className="badge badge-success">{con.status}</span></td>
                                        <td style={{ color: 'var(--primary)', fontWeight: '600', cursor: 'pointer' }}>View Dues</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}


                {activeMainTab === 'Payroll' && (
                    <div className="card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h3 style={{ fontSize: '18px', fontWeight: '700' }}>Payroll Processing ({new Date().toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })})</h3>
                            <button className="btn btn-success btn-sm" onClick={() => {
                                const confirmAll = window.confirm("Are you sure you want to process payroll for ALL pending employees automatically?");
                                if (confirmAll) {
                                    const newStatuses = { ...payrollStatuses };
                                    employees.forEach(emp => { newStatuses[emp.id] = 'Generated'; });
                                    setPayrollStatuses(newStatuses);
                                    alert("Payroll has been successfully processed for all employees.");
                                }
                            }}>
                                <RotateCw size={16} /> Run All Payroll
                            </button>
                        </div>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Employee</th>
                                    <th>Base Salary</th>
                                    <th>Allowances</th>
                                    <th>OT Amount</th>
                                    <th>Deductions</th>
                                    <th>Net Payable</th>
                                    <th>Status</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {employees.map((emp, i) => {
                                    const base = parseFloat(emp.basicSalary) || 0;
                                    const allow = parseFloat(emp.hra) || 0;
                                    const net = base + allow;
                                    const status = payrollStatuses[emp.id] || 'Pending';

                                    return (
                                        <tr key={i}>
                                            <td style={{ fontWeight: '600' }}>
                                                {emp.name}
                                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{emp.id}</div>
                                            </td>
                                            <td>₹{base.toLocaleString('en-IN')}</td>
                                            <td>₹{allow.toLocaleString('en-IN')}</td>
                                            <td>₹0</td>
                                            <td>₹0</td>
                                            <td style={{ fontWeight: '800', color: 'var(--primary)' }}>₹{net.toLocaleString('en-IN')}</td>
                                            <td><span className={`badge ${status === 'Generated' ? 'badge-success' : 'badge-warning'}`}>{status}</span></td>
                                            <td>
                                                {status === 'Pending' ? (
                                                    <button
                                                        className="btn btn-outline"
                                                        style={{ padding: '4px 12px', fontSize: '11px', fontWeight: '700' }}
                                                        onClick={() => { setPayrollEmployee(emp); setIsProcessPayrollModalOpen(true); }}
                                                    >
                                                        Review & Process
                                                    </button>
                                                ) : (
                                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>Processed</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {employees.length === 0 && (
                                    <tr>
                                        <td colSpan={8} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                                            No employees found for payroll generation.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <CreateRoleModal
                isOpen={isRoleModalOpen}
                onClose={() => {
                    setIsRoleModalOpen(false);
                    setEditingRole(null);
                }}
                onRoleCreated={handleRoleCreated}
                initialData={editingRole}
            />
            <AddEmployeeModal
                isOpen={isAddEmployeeModalOpen}
                onClose={() => {
                    setIsAddEmployeeModalOpen(false);
                    setEditingEmployee(null);
                }}
                onEmployeeAdded={handleEmployeeAdded}
                roles={roles}
                employee={editingEmployee}
            />
            <EmployeeDetailsModal
                isOpen={isDetailsModalOpen}
                onClose={() => {
                    setIsDetailsModalOpen(false);
                    setViewingEmployee(null);
                }}
                employee={viewingEmployee}
            />
            <AddContractorModal
                isOpen={isAddContractorModalOpen}
                onClose={() => setIsAddContractorModalOpen(false)}
                onContractorAdded={handleContractorAdded}
            />
            <AddLabourModal
                isOpen={isAddLabourModalOpen}
                onClose={() => setIsAddLabourModalOpen(false)}
                onLabourAdded={handleLabourAdded}
            />
            <ProcessPayrollModal
                isOpen={isProcessPayrollModalOpen}
                onClose={() => setIsProcessPayrollModalOpen(false)}
                employee={payrollEmployee}
                onConfirm={(empId) => {
                    setPayrollStatuses(prev => ({ ...prev, [empId]: 'Generated' }));
                }}
            />
        </div>
    );
};

export default HR;


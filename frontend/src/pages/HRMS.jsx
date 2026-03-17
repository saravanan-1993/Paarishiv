import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    Users, UserPlus, CheckCircle, Clock, Calendar, IndianRupee,
    Briefcase, Wallet, FileText, Plus, Search, Filter,
    Check, X, XCircle, AlertCircle, TrendingUp, BarChart2, Shield, Edit3, Loader2, Eye, Power, Trash2, UserCheck, UserX, Save
} from 'lucide-react';
import { employeeAPI, hrmsAPI, projectAPI, approvalsAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { hasPermission, hasSubTabAccess, DEFAULT_ROLES } from '../utils/rbac';
import AddEmployeeModal from '../components/AddEmployeeModal';
import EmployeeDetailsModal from '../components/EmployeeDetailsModal';
import ApplyLeaveModal from '../components/ApplyLeaveModal';
import SurpriseVisitModal from '../components/SurpriseVisitModal';
import ProcessPayrollModal from '../components/ProcessPayrollModal';
import { surpriseVisitAPI } from '../utils/api';
import { MapPin, Camera, Settings as SettingsIcon, PartyPopper, Cake, Star } from 'lucide-react';
import HrmsSettingsModal from '../components/HrmsSettingsModal';
import CustomSelect from '../components/CustomSelect';
import AttendanceCalendar from '../components/AttendanceCalendar';
import AttendanceRoster from '../components/AttendanceRoster';

const HRMS = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const urlTab = searchParams.get('tab');
    const [activeTab, setActiveTab] = useState('Dashboard');

    const availableTabs = useMemo(() => [
        'Dashboard', 'Employee Master', 'Attendance', 'Leave Management', 'Payroll', 'Surprise Visits', 'Workforce'
    ].filter(tab => hasSubTabAccess(user, 'HRMS', tab)), [user]);

    useEffect(() => {
        if (urlTab && availableTabs.includes(urlTab)) {
            setActiveTab(urlTab);
        }
    }, [urlTab, availableTabs]);

    const handleTabChange = (tabId) => {
        setActiveTab(tabId);
        setSearchParams({ tab: tabId });
    };

    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ totalEmployees: 0, todayPresent: 0, pendingLeaves: 0, monthlyPayable: 0 });
    const [employees, setEmployees] = useState([]);
    const [attendance, setAttendance] = useState([]);
    const [leaves, setLeaves] = useState([]);
    const isAdmin = user?.role === 'Super Admin' || user?.role === 'Administrator' || user?.role === 'HR Manager';

    useEffect(() => {
        if (!hasPermission(user, 'HRMS', 'view')) {
            navigate('/');
        }
    }, [user, navigate]);

    const [payroll, setPayroll] = useState([]);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

    // Modals
    const [isAddEmployeeOpen, setIsAddEmployeeOpen] = useState(false);
    const [isApplyLeaveOpen, setIsApplyLeaveOpen] = useState(false);
    const [isEmployeeDetailsOpen, setIsEmployeeDetailsOpen] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [editingEmployee, setEditingEmployee] = useState(null);
    const [isSurpriseVisitOpen, setIsSurpriseVisitOpen] = useState(false);
    const [isProcessPayrollOpen, setIsProcessPayrollOpen] = useState(false);
    const [payrollEmployee, setPayrollEmployee] = useState(null);
    const [surpriseVisits, setSurpriseVisits] = useState([]);
    const [manpowerRequests, setManpowerRequests] = useState([]);
    const [attendanceData, setAttendanceData] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedRole, setSelectedRole] = useState('All');
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [attendanceView, setAttendanceView] = useState('list'); // 'list' or 'calendar'
    const [selectedCalendarEmployee, setSelectedCalendarEmployee] = useState(null);
    const [hrmsSettings, setHrmsSettings] = useState({ officeStartTime: '09:00', gracePeriod: 15, birthdayWishes: true, workAnniversaryWishes: true });
    const [lateComers, setLateComers] = useState([]);
    const [celebrations, setCelebrations] = useState([]);
    const [projects, setProjects] = useState([]);
    const [attendanceSearchQuery, setAttendanceSearchQuery] = useState('');
    const [selectedAttendanceSite, setSelectedAttendanceSite] = useState('All');
    const [manpowerFilter, setManpowerFilter] = useState('Approved');
    const [selectedManpowerProject, setSelectedManpowerProject] = useState('All');
    const [refreshingManpower, setRefreshingManpower] = useState(false);

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        try {
            setLoading(true);
            const [statsRes, empRes, settingsRes, projRes] = await Promise.all([
                hrmsAPI.getStats(),
                employeeAPI.getAll(),
                hrmsAPI.getSettings(),
                projectAPI.getAll()
            ]);
            setStats(statsRes.data);
            setEmployees(empRes.data);
            setHrmsSettings(settingsRes.data);
            setProjects(projRes.data || []);

            // Pre-fetch leaves as They are needed for attendance mapping
            fetchLeaves();

            // Calculate Celebrations
            const today = new Date();
            const todayMonthDay = today.toISOString().slice(5, 10); // MM-DD
            const celbs = empRes.data.map(emp => {
                const results = [];
                if (emp.dob && emp.dob.slice(5, 10) === todayMonthDay) {
                    results.push({ name: emp.fullName, type: 'Birthday', icon: Cake, color: '#FF6B6B' });
                }
                if (emp.joiningDate) {
                    const joinDate = new Date(emp.joiningDate);
                    const years = today.getFullYear() - joinDate.getFullYear();
                    if (years > 0 && emp.joiningDate.slice(5, 10) === todayMonthDay) {
                        results.push({ name: emp.fullName, type: 'Work Anniversary', years, icon: Star, color: '#4DABF7' });
                    }
                }
                return results;
            }).flat();
            setCelebrations(celbs);

        } catch (err) {
            console.error('Failed to fetch HRMS data', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchAttendance = async (date) => {
        try {
            const res = await hrmsAPI.getAttendance(date);
            setAttendance(res.data);
        } catch (err) {
            console.error('Failed to fetch attendance', err);
        }
    };

    const fetchLeaves = async () => {
        try {
            const res = await hrmsAPI.getLeaves();
            let data = res.data || [];
            if (!isAdmin && user) {
                // Filter leaves to show only current user's leaves
                const userEmpCode = user.employeeCode || user.id || user.username;
                data = data.filter(l => l && (l.employeeId === userEmpCode || l.employeeName === user?.name || l.employeeName === user?.fullName));
            }
            setLeaves(data);
        } catch (err) {
            console.error('Failed to fetch leaves', err);
            setLeaves([]);
        }
    };

    const fetchPayroll = async (month) => {
        try {
            const res = await hrmsAPI.getPayroll(month);
            setPayroll(res.data);
        } catch (err) {
            console.error('Failed to fetch payroll', err);
        }
    };

    const fetchSurpriseVisits = async () => {
        try {
            const res = await surpriseVisitAPI.getAll();
            setSurpriseVisits(res.data);
        } catch (err) {
            console.error('Failed to fetch surprise visits', err);
        }
    };

    const fetchManpowerRequests = async () => {
        setRefreshingManpower(true);
        try {
            const mpRes = await approvalsAPI.getAll(manpowerFilter);
            setManpowerRequests(mpRes.data.manpower || []);
        } catch (err) {
            console.error('Failed to fetch manpower requests', err);
        } finally {
            setTimeout(() => setRefreshingManpower(false), 500);
        }
    };

    useEffect(() => {
        if (activeTab === 'Attendance') {
            fetchAttendance(selectedDate);
            fetchLeaves(); // Also refresh leaves for accurate mapping
        }
        if (activeTab === 'Leave Management') fetchLeaves();
        if (activeTab === 'Payroll') fetchPayroll(selectedMonth);
        if (activeTab === 'Surprise Visits') fetchSurpriseVisits();
        if (activeTab === 'Workforce') fetchManpowerRequests();
    }, [activeTab, selectedDate, selectedMonth, manpowerFilter]);

    useEffect(() => {
        if (employees.length > 0) {
            const todayLate = [];
            const mappedAttendanceIds = new Set();

            const initialMap = employees.map(emp => {
                const empId = emp.id || emp._id;
                const rec = (attendance || []).find(a => {
                    const am = a.employeeId === empId ||
                        a.user_id === empId ||
                        a.username === emp.username ||
                        a.username === emp.employeeCode ||
                        a.employeeId === emp.employeeCode;
                    if (am) mappedAttendanceIds.add(a.id || a._id);
                    return am;
                });

                const formatTime = (iso) => {
                    if (!iso || iso.length <= 5) return iso;
                    try {
                        const d = new Date(iso);
                        if (isNaN(d.getTime())) return iso;
                        return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
                    } catch (e) { return iso; }
                };

                const checkInTime = formatTime(rec?.check_in || rec?.checkIn);

                // Late calculation
                if (checkInTime && hrmsSettings.officeStartTime) {
                    const [startH, startM] = hrmsSettings.officeStartTime.split(':').map(Number);
                    const [checkH, checkM] = checkInTime.split(':').map(Number);
                    const diffMins = (checkH * 60 + checkM) - (startH * 60 + startM);
                    if (diffMins > hrmsSettings.gracePeriod) {
                        if (!todayLate.some(l => l.name === emp.fullName)) {
                            todayLate.push({ name: emp.fullName, delay: diffMins });
                        }
                    }
                }

                // Check if employee is on approved leave for selectedDate
                const isOnLeave = (leaves || []).some(l =>
                    l && l.status === 'Approved' &&
                    (
                        (l.employeeId && (l.employeeId === empId || l.employeeId === emp.employeeCode)) ||
                        (l.employeeName && l.employeeName.trim() === emp.fullName.trim())
                    ) &&
                    selectedDate >= l.fromDate &&
                    selectedDate <= l.toDate
                );

                return {
                    employeeId: empId,
                    fullName: emp.fullName,
                    employeeCode: emp.employeeCode,
                    siteName: emp.siteName || 'Head Office',
                    checkIn: checkInTime || '',
                    checkOut: formatTime(rec?.check_out || rec?.checkOut) || '',
                    status: rec?.status || (isOnLeave ? 'Leave' : 'Absent'),
                    id: rec?.id || rec?._id
                };
            });

            // Add unmapped attendance (e.g. system users/demo users not in employee master)
            (attendance || []).forEach(a => {
                if (!mappedAttendanceIds.has(a.id || a._id)) {
                    const formatTime = (iso) => {
                        if (!iso || iso.length <= 5) return iso;
                        try {
                            const d = new Date(iso);
                            if (isNaN(d.getTime())) return iso;
                            return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
                        } catch (e) { return iso; }
                    };

                    initialMap.push({
                        employeeId: a.user_id || a.username || a.employeeId,
                        fullName: a.username ? a.username.charAt(0).toUpperCase() + a.username.slice(1) : 'System User',
                        employeeCode: a.username || 'USR',
                        siteName: a.location || 'Head Office',
                        checkIn: formatTime(a.check_in || a.checkIn) || '',
                        checkOut: formatTime(a.check_out || a.checkOut) || '',
                        status: a.status || 'Present',
                        id: a.id || a._id
                    });
                }
            });

            setAttendanceData(initialMap);
            setLateComers(todayLate);
        }
    }, [attendance, employees, hrmsSettings, leaves, selectedDate]);

    const handleAttendanceChange = (index, field, value) => {
        const item = filteredAttendanceData[index];
        const actualIndex = attendanceData.findIndex(d => d.employeeId === item.employeeId);
        if (actualIndex > -1) {
            const newData = [...attendanceData];
            newData[actualIndex][field] = value;
            setAttendanceData(newData);
        }
    };

    const filteredAttendanceData = useMemo(() => {
        return attendanceData.filter(emp => {
            const matchesSearch = emp.fullName.toLowerCase().includes(attendanceSearchQuery.toLowerCase()) ||
                emp.employeeCode?.toLowerCase().includes(attendanceSearchQuery.toLowerCase());
            const matchesSite = selectedAttendanceSite === 'All' || emp.siteName === selectedAttendanceSite;
            return matchesSearch && matchesSite;
        });
    }, [attendanceData, attendanceSearchQuery, selectedAttendanceSite]);

    const handleSaveAttendance = async () => {
        try {
            setLoading(true);
            const records = attendanceData.map(d => ({
                employeeId: d.employeeId,
                employeeName: d.fullName,
                date: selectedDate,
                checkIn: d.checkIn,
                checkOut: d.checkOut,
                status: d.status
            }));
            await hrmsAPI.saveAttendance(records);
            alert('Attendance saved successfully');
            fetchAttendance(selectedDate);
            fetchInitialData();
        } catch (err) {
            console.error('Save attendance failed', err);
            alert('Failed to save attendance');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveSingleAttendance = async (data) => {
        try {
            const record = {
                employeeId: data.employeeId,
                employeeName: data.fullName,
                date: selectedDate,
                checkIn: data.checkIn,
                checkOut: data.checkOut,
                status: data.status
            };
            await hrmsAPI.saveAttendance([record]);
            alert(`Attendance saved for ${data.fullName}`);
            fetchAttendance(selectedDate);
            fetchInitialData();
        } catch (err) {
            console.error('Save attendance failed', err);
            alert('Failed to save attendance');
        }
    };

    const handleBulkPresent = () => {
        setAttendanceData(prev => prev.map(d => ({
            ...d,
            status: 'Present',
            checkIn: '09:00',
            checkOut: '18:00'
        })));
    };

    const handleLeaveAction = async (leaveId, status) => {
        try {
            await hrmsAPI.updateLeave(leaveId, {
                status,
                approvedBy: user.fullName || user.username,
                remarks: `Actioned via dashboard`
            });
            fetchLeaves();
            fetchInitialData();
        } catch (err) {
            console.error('Leave action failed', err);
        }
    };

    const generatePayrollRecord = async () => {
        if (!window.confirm(`Generate payroll for ${selectedMonth}?`)) return;
        try {
            await hrmsAPI.generatePayroll(selectedMonth);
            fetchPayroll(selectedMonth);
            fetchInitialData();
            alert('Payroll generated successfully');
        } catch (err) {
            alert('Failed to generate payroll');
        }
    };

    const handleToggleEmployeeStatus = async (emp) => {
        if (!window.confirm(`Change status for ${emp.fullName}?`)) return;
        try {
            const newStatus = emp.status === 'Active' ? 'Inactive' : 'Active';
            await employeeAPI.update(emp.id || emp._id, { status: newStatus });
            fetchInitialData();
        } catch (err) {
            console.error('Failed to change status', err);
            alert('Failed to change status');
        }
    };

    const handleEditEmployee = (emp) => {
        setEditingEmployee(emp);
        setIsAddEmployeeOpen(true);
    };

    const filteredEmployees = employees.filter(emp => {
        const matchesSearch = (emp.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            emp.employeeCode?.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesRole = selectedRole === 'All' || emp.designation === selectedRole;
        return matchesSearch && matchesRole;
    });

    const renderDashboard = () => (
        <div className="animate-fade-in">
            {/* Celebration Row */}
            {celebrations.length > 0 && (
                <div style={{
                    backgroundColor: '#FFF5F5',
                    border: '1px solid #FFD8D8',
                    borderRadius: '16px',
                    padding: '20px',
                    marginBottom: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '24px',
                    boxShadow: '0 4px 15px rgba(255, 107, 107, 0.1)'
                }}>
                    <div style={{
                        width: '60px', height: '60px', borderRadius: '50%', backgroundColor: '#FF6B6B',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
                        animation: 'bounce 2s infinite'
                    }}>
                        <PartyPopper size={32} />
                    </div>
                    <div>
                        <h4 style={{ color: '#C92A2A', fontWeight: '900', fontSize: '18px', marginBottom: '4px' }}>Today's Celebrations!</h4>
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                            {celebrations.map((c, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'white', padding: '6px 12px', borderRadius: '8px', border: '1px solid #FFD8D8', fontSize: '14px', fontWeight: '700' }}>
                                    <c.icon size={16} style={{ color: c.color }} />
                                    <span>{c.name}</span>
                                    <span style={{ color: 'var(--text-muted)', fontWeight: '500', fontSize: '12px' }}>({c.type === 'Birthday' ? 'Birthday 🎂' : `${c.years} Year Anniversary 🎊`})</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '32px' }}>
                {[
                    { label: "Total Employees", value: stats.totalEmployees, icon: Users, color: '#3B82F6', hide: !isAdmin },
                    { label: "Today Present", value: stats.todayPresent, icon: CheckCircle, color: '#10B981', hide: !isAdmin },
                    { label: "Pending Leaves", value: isAdmin ? stats.pendingLeaves : leaves.filter(l => l.status === 'Pending').length, icon: Clock, color: '#F59E0B' },
                    { label: "Salary Payable", value: `₹${(stats?.monthlyPayable || 0).toLocaleString()}`, icon: IndianRupee, color: '#8B5CF6', hide: !isAdmin },
                    { label: "My Total Leaves", value: leaves.length, icon: Calendar, color: '#3B82F6', hide: isAdmin },
                    { label: "Approved Leaves", value: leaves.filter(l => l.status === 'Approved').length, icon: CheckCircle, color: '#10B981', hide: isAdmin }
                ].filter(kpi => !kpi.hide).map((kpi, i) => (
                    <div key={i} className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '24px' }}>
                        <div style={{
                            width: '48px', height: '48px', borderRadius: '12px',
                            backgroundColor: `${kpi.color}15`, color: kpi.color,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                        }}>
                            <kpi.icon size={24} />
                        </div>
                        <div>
                            <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>{kpi.label}</div>
                            <div style={{ fontSize: '24px', fontWeight: '800' }}>{kpi.value}</div>
                        </div>
                    </div>
                ))}
                {!isAdmin && (
                    <div className="card" onClick={() => setIsApplyLeaveOpen(true)} style={{
                        display: 'flex', alignItems: 'center', gap: '16px', padding: '24px',
                        cursor: 'pointer', backgroundColor: '#EFF6FF', border: '1px dashed #3B82F6'
                    }}>
                        <div style={{
                            width: '48px', height: '48px', borderRadius: '12px',
                            backgroundColor: '#3B82F6', color: 'white',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <Plus size={24} />
                        </div>
                        <div>
                            <div style={{ fontSize: '13px', color: '#1E40AF', fontWeight: '800' }}>QUICK ACTION</div>
                            <div style={{ fontSize: '18px', fontWeight: '800', color: '#1E3A8A' }}>Apply Leave</div>
                        </div>
                    </div>
                )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
                <div className="card">
                    <h3 style={{ marginBottom: '24px', fontSize: '18px', fontWeight: '800', color: 'var(--text-main)' }}>{isAdmin ? 'Recent Leave Requests' : 'My Leave History'}</h3>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Employee</th>
                                <th>Dates</th>
                                <th>Type</th>
                                <th>Status</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {leaves.slice(0, 5).map((l, i) => (
                                <tr key={i}>
                                    <td style={{ fontWeight: '600' }}>{l.employeeName}</td>
                                    <td style={{ fontSize: '12px' }}>{l.fromDate} to {l.toDate}</td>
                                    <td><span style={{ fontSize: '11px', fontWeight: '800', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#f1f5f9' }}>{l.leaveType}</span></td>
                                    <td>
                                        <span className={`badge ${l.status === 'Approved' ? 'badge-success' : l.status === 'Rejected' ? 'badge-danger' : 'badge-warning'}`}>
                                            {l.status}
                                        </span>
                                    </td>
                                    <td>
                                        {l.status === 'Pending' && hasPermission(user, 'HRMS', 'edit') && (
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button onClick={() => handleLeaveAction(l.id, 'Approved')} className="icon-btn" style={{ color: '#10B981', padding: '4px' }}><Check size={16} /></button>
                                                <button onClick={() => handleLeaveAction(l.id, 'Rejected')} className="icon-btn" style={{ color: '#EF4444', padding: '4px' }}><X size={16} /></button>
                                            </div>
                                        )}
                                        {l.status === 'Pending' && !hasPermission(user, 'HRMS', 'edit') && (
                                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Pending Review</span>
                                        )}
                                        {l.status !== 'Pending' && (
                                            <span style={{ fontSize: '11px', fontWeight: '700', color: l.status === 'Approved' ? '#10B981' : '#EF4444', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                {l.status === 'Approved' ? <CheckCircle size={14} /> : <XCircle size={14} />}
                                                {l.status}
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {leaves.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No recent requests</td></tr>}
                        </tbody>
                    </table>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div className="card" style={{ height: 'fit-content' }}>
                        <h3 style={{ marginBottom: '24px', fontSize: '18px', fontWeight: '800', color: 'var(--text-main)' }}>Attendance Overview</h3>
                        <div style={{ textAlign: 'center', padding: '20px 0' }}>
                            <div style={{ fontSize: '48px', fontWeight: '900', color: 'var(--primary)' }}>
                                {stats.totalEmployees > 0 ? Math.round((stats.todayPresent / stats.totalEmployees) * 100) : 0}%
                            </div>
                            <p style={{ color: 'var(--text-muted)', fontWeight: '600' }}>Attendance Rate for Today</p>
                            <div style={{ width: '100%', height: '8px', backgroundColor: '#f1f5f9', borderRadius: '4px', marginTop: '20px', overflow: 'hidden' }}>
                                <div style={{
                                    width: `${stats.totalEmployees > 0 ? (stats.todayPresent / stats.totalEmployees) * 100 : 0}%`,
                                    height: '100%',
                                    backgroundColor: 'var(--primary)',
                                    transition: 'width 0.5s ease'
                                }}></div>
                            </div>
                        </div>
                    </div>

                    {/* Late Comers Vertical Scroll Box (Inside Grid) */}
                    {lateComers.length > 0 && (
                        <div className="card" style={{ padding: '20px', border: '1px solid #FECACA', background: '#FFF5F5' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#DC2626', fontWeight: '900', fontSize: '15px', marginBottom: '16px', borderBottom: '1px solid #FECACA', paddingBottom: '12px' }}>
                                <AlertCircle size={20} /> LATE COMERS
                            </div>
                            <div style={{ height: '160px', overflowY: 'auto', position: 'relative', paddingRight: '4px' }}>
                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '10px'
                                }}>
                                    {lateComers.map((l, i) => (
                                        <div key={i} style={{
                                            padding: '10px 14px',
                                            backgroundColor: 'white',
                                            borderRadius: '10px',
                                            border: '1px solid #FECACA',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            boxShadow: '0 1px 3px rgba(220, 38, 38, 0.05)'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#DC2626' }}></div>
                                                <span style={{ fontWeight: '700', color: '#1e293b', fontSize: '13px' }}>{l.name}</span>
                                            </div>
                                            <span style={{ color: '#DC2626', fontSize: '11px', fontWeight: '800' }}>
                                                {l.delay > 60
                                                    ? `${Math.floor(l.delay / 60)}h ${l.delay % 60}m`
                                                    : `${l.delay}m`} Late
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                @keyframes vertical-marquee {
                    0% { transform: translateY(0); }
                    100% { transform: translateY(-50%); }
                }
            `}</style>
        </div>
    );

    const renderEmployeeMaster = () => (
        <div className="animate-fade-in">
            <div className="card" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ display: 'flex', gap: '16px', flex: '1 1 300px', flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative', flex: '1 1 200px' }}>
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            type="text"
                            placeholder="Search by name or code..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{ width: '100%', padding: '10px 12px 10px 40px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '14px' }}
                        />
                    </div>
                    <CustomSelect
                        options={[
                            { value: 'All', label: 'All Designations' },
                            ...[...new Set(employees.map(e => e.designation))].filter(Boolean).map(role => ({ value: role, label: role }))
                        ]}
                        value={selectedRole}
                        onChange={setSelectedRole}
                        placeholder="All Designations"
                        width="200px"
                        searchable={true}
                        icon={Briefcase}
                    />
                </div>
                <button className="btn btn-primary" onClick={() => setIsAddEmployeeOpen(true)} style={{ flex: '1 1 auto', justifyContent: 'center' }}>
                    <UserPlus size={18} /> ADD EMPLOYEE
                </button>
            </div>

            <div className="card" style={{ padding: 0 }}>
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Code</th>
                            <th>Name</th>
                            <th>Designation</th>
                            <th>Site/Project</th>
                            <th>Salary Type</th>
                            <th>Basic/Wage</th>
                            <th>Status</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredEmployees.map((emp, i) => (
                            <tr key={i}>
                                <td style={{ fontWeight: '700', color: 'var(--primary)' }}>{emp.employeeCode || 'E-NEW'}</td>
                                <td style={{ fontWeight: '600' }}>{emp.fullName}</td>
                                <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{emp.designation}</td>
                                <td>{emp.siteName || 'Not Assigned'}</td>
                                <td><span style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: '#64748b' }}>{emp.salaryType}</span></td>
                                <td style={{ fontWeight: '700' }}>₹{(emp.salaryType === 'daily' ? emp.dailyWage : emp.basicSalary)?.toLocaleString()}</td>
                                <td>
                                    <span style={{
                                        padding: '4px 10px',
                                        borderRadius: '6px',
                                        fontSize: '11px',
                                        fontWeight: '800',
                                        background: emp.status === 'Active' ? '#f0fdf4' : '#fef2f2',
                                        color: emp.status === 'Active' ? '#16a34a' : '#dc2626',
                                        border: `1px solid ${emp.status === 'Active' ? '#bbf7d0' : '#fecaca'}`
                                    }}>
                                        {emp.status?.toUpperCase()}
                                    </span>
                                </td>
                                <td>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <button
                                            className="icon-btn"
                                            title="View Details"
                                            onClick={() => { setSelectedEmployee({ ...emp, id: emp.id || emp._id, name: emp.fullName, mobile: emp.phone, dept: 'Operations' }); setIsEmployeeDetailsOpen(true); }}
                                            style={{ background: '#f0f9ff', color: '#0369a1', borderRadius: '8px', border: '1px solid #bae6fd', padding: '8px', transition: 'all 0.2s' }}
                                        >
                                            <Eye size={16} />
                                        </button>
                                        <button
                                            className="icon-btn"
                                            title="Edit Employee"
                                            onClick={() => handleEditEmployee(emp)}
                                            style={{ background: '#fff7ed', color: '#f59e0b', borderRadius: '8px', border: '1px solid #fed7aa', padding: '8px', transition: 'all 0.2s' }}
                                        >
                                            <Edit3 size={16} />
                                        </button>
                                        <button
                                            className="icon-btn"
                                            title={emp.status === 'Active' ? 'Deactivate Employee' : 'Activate Employee'}
                                            onClick={() => handleToggleEmployeeStatus(emp)}
                                            style={{
                                                background: emp.status === 'Active' ? '#fef2f2' : '#f0fdf4',
                                                color: emp.status === 'Active' ? '#dc2626' : '#16a34a',
                                                borderRadius: '8px',
                                                border: `1px solid ${emp.status === 'Active' ? '#fecaca' : '#bbf7d0'}`,
                                                padding: '8px',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            <Power size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const renderAttendance = () => (
        <div className="animate-fade-in">
            {/* View Toggle */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                <button 
                    onClick={() => setAttendanceView('list')}
                    style={{ 
                        padding: '10px 20px', fontSize: '13px', fontWeight: '700', borderRadius: '10px',
                        backgroundColor: attendanceView === 'list' ? 'var(--primary)' : 'white',
                        color: attendanceView === 'list' ? 'white' : 'var(--text-muted)',
                        border: '1px solid ' + (attendanceView === 'list' ? 'var(--primary)' : 'var(--border)'),
                        cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '8px'
                    }}
                >
                    <Clock size={16} /> DAILY LIST
                </button>
                <button 
                    onClick={() => {
                        setAttendanceView('calendar');
                        if (!selectedCalendarEmployee && employees.length > 0) {
                            const firstEmp = employees[0];
                            setSelectedCalendarEmployee({
                                id: firstEmp.id || firstEmp._id,
                                name: firstEmp.fullName,
                                code: firstEmp.employeeCode
                            });
                        }
                    }}
                    style={{ 
                        padding: '10px 20px', fontSize: '13px', fontWeight: '700', borderRadius: '10px',
                        backgroundColor: attendanceView === 'calendar' ? 'var(--primary)' : 'white',
                        color: attendanceView === 'calendar' ? 'white' : 'var(--text-muted)',
                        border: '1px solid ' + (attendanceView === 'calendar' ? 'var(--primary)' : 'var(--border)'),
                        cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '8px'
                    }}
                >
                    <Calendar size={16} /> MONTHLY CALENDAR
                </button>
            </div>

            {attendanceView === 'list' ? (
                <>
                    <div className="card" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                <Calendar size={20} style={{ color: 'var(--primary)' }} />
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontWeight: '700' }}
                                />
                            </div>
                            <div style={{ position: 'relative', width: '220px' }}>
                                <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input
                                    type="text"
                                    placeholder="Search employee..."
                                    value={attendanceSearchQuery}
                                    onChange={(e) => setAttendanceSearchQuery(e.target.value)}
                                    style={{ width: '100%', padding: '8px 12px 8px 40px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '14px' }}
                                />
                            </div>
                            <CustomSelect
                                options={[
                                    { value: 'All', label: 'All Sites' },
                                    ...projects.map(p => ({ value: p.name, label: p.name }))
                                ]}
                                value={selectedAttendanceSite}
                                onChange={setSelectedAttendanceSite}
                                width="200px"
                                placeholder="Filter by Site"
                                icon={MapPin}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', flex: '1 1 auto', justifyContent: 'flex-end' }}>
                            <button className="btn btn-outline" onClick={handleBulkPresent}><CheckCircle size={18} /> Bulk Present</button>
                            <button className="btn btn-success" onClick={handleSaveAttendance} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px', fontWeight: '700', fontSize: '14px', letterSpacing: '0.025em' }}>
                                <Save size={18} /> SAVE CHANGES
                            </button>
                        </div>
                    </div>

                    <div className="card" style={{ padding: 0 }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Employee</th>
                                    <th>Site/Project</th>
                                    <th>Check In</th>
                                    <th>Check Out</th>
                                    <th>Status</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredAttendanceData.map((emp, i) => (
                                    <tr key={i}>
                                        <td>
                                            <div style={{ fontWeight: '600' }}>{emp.fullName}</div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{emp.employeeCode}</div>
                                        </td>
                                        <td>{emp.siteName || 'Head Office'}</td>
                                        <td><input type="time" value={emp.checkIn} onChange={(e) => handleAttendanceChange(i, 'checkIn', e.target.value)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: '#F8FAFC', fontSize: '13px', fontWeight: '500', outline: 'none', transition: 'all 0.2s', width: '110px' }} /></td>
                                        <td><input type="time" value={emp.checkOut} onChange={(e) => handleAttendanceChange(i, 'checkOut', e.target.value)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: '#F8FAFC', fontSize: '13px', fontWeight: '500', outline: 'none', transition: 'all 0.2s', width: '110px' }} /></td>
                                        <td>
                                            <CustomSelect
                                                options={[
                                                    { value: 'Present', label: 'Present' },
                                                    { value: 'Absent', label: 'Absent' },
                                                    { value: 'Half Day', label: 'Half Day' },
                                                    { value: 'Leave', label: 'Leave' }
                                                ]}
                                                value={emp.status}
                                                onChange={(val) => handleAttendanceChange(i, 'status', val)}
                                                width="130px"
                                                searchable={false}
                                                style={{
                                                    fontWeight: '800',
                                                    backgroundColor: emp.status === 'Present' ? '#f0fdf4' : emp.status === 'Absent' ? '#fef2f2' : emp.status === 'Half Day' ? '#fffbeb' : '#f1f5f9',
                                                    color: emp.status === 'Present' ? '#166534' : emp.status === 'Absent' ? '#991b1b' : emp.status === 'Half Day' ? '#92400e' : '#475569',
                                                }}
                                            />
                                        </td>
                                        <td>
                                            <button
                                                className="icon-btn"
                                                title="Save Row"
                                                onClick={() => handleSaveSingleAttendance(emp)}
                                                style={{
                                                    background: '#f0fdf4',
                                                    color: '#16a34a',
                                                    borderRadius: '8px',
                                                    border: '1px solid #bbf7d0',
                                                    padding: '8px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}
                                            >
                                                <Check size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            ) : (
                <div className="animate-fade-in">
                    <div className="card" style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <CustomSelect
                                options={[
                                    { value: 'All', label: 'All Sites' },
                                    ...projects.map(p => ({ value: p.name, label: p.name }))
                                ]}
                                value={selectedAttendanceSite}
                                onChange={setSelectedAttendanceSite}
                                width="200px"
                                placeholder="Filter by Site"
                                icon={MapPin}
                            />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Users size={18} color="var(--primary)" />
                            </div>
                            <span style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text-main)' }}>Select Employee:</span>
                        </div>
                        <CustomSelect 
                            options={[
                                { value: 'all', label: 'All Employees (Monthly Roster)' },
                                ...employees
                                    .filter(e => selectedAttendanceSite === 'All' || e.siteName === selectedAttendanceSite)
                                    .map(e => ({ value: e.id || e._id, label: e.fullName }))
                            ]}
                            value={selectedCalendarEmployee?.id}
                            onChange={(val) => {
                                if (val === 'all') {
                                    setSelectedCalendarEmployee({ id: 'all', name: 'All Employees' });
                                } else {
                                    const emp = employees.find(e => (e.id || e._id) === val);
                                    if (emp) setSelectedCalendarEmployee({ id: val, name: emp.fullName, code: emp.employeeCode });
                                }
                            }}
                            placeholder="Pick an employee"
                            width="300px"
                            searchable={true}
                        />
                    </div>
                    
                    {selectedCalendarEmployee ? (
                        selectedCalendarEmployee.id === 'all' ? (
                            <AttendanceRoster 
                                employees={employees} 
                                selectedSite={selectedAttendanceSite} 
                            />
                        ) : (
                            <AttendanceCalendar 
                                employeeId={selectedCalendarEmployee.id} 
                                employeeName={selectedCalendarEmployee.name} 
                                employeeCode={selectedCalendarEmployee.code}
                            />
                        )
                    ) : (
                        <div style={{ textAlign: 'center', padding: '100px 20px', backgroundColor: 'white', borderRadius: '20px', border: '2px dashed var(--border)' }}>
                            <Users size={48} style={{ opacity: 0.1, margin: '0 auto 16px' }} />
                            <p style={{ fontWeight: '600', color: 'var(--text-muted)' }}>Please select an employee from the dropdown above to view their attendance calendar.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );

    const renderLeaves = () => (
        <div className="animate-fade-in">
            <div className="card" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-main)' }}>Leave Applications</h3>
                {user && (
                    <button className="btn btn-primary" onClick={() => setIsApplyLeaveOpen(true)}>
                        <Plus size={18} /> APPLY LEAVE
                    </button>
                )}
            </div>

            <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Employee</th>
                            <th>Leave Type</th>
                            <th>Duration</th>
                            <th>Reason</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(leaves || []).length > 0 ? leaves.map((l, i) => (
                            <tr key={l.id || i}>
                                <td style={{ fontWeight: '600' }}>{l.employeeName || 'Unknown'}</td>
                                <td><span className="badge badge-info">{l.leaveType}</span></td>
                                <td>
                                    <div style={{ fontSize: '13px', fontWeight: '700' }}>{l.fromDate} to {l.toDate}</div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{l.leaveType} Request</div>
                                </td>
                                <td style={{ maxWidth: '200px', fontSize: '12px' }}>{l.reason || 'No reason provided'}</td>
                                <td>
                                    <span className={`badge ${l.status === 'Approved' ? 'badge-success' : l.status === 'Rejected' ? 'badge-danger' : 'badge-warning'}`}>
                                        {l.status}
                                    </span>
                                </td>
                                <td>
                                    {(isAdmin && l.status === 'Pending') && (
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button onClick={() => handleLeaveAction(l.id, 'Approved')} className="btn btn-success btn-sm" style={{ padding: '4px 8px', fontSize: '11px' }}>Approve</button>
                                            <button onClick={() => handleLeaveAction(l.id, 'Rejected')} className="btn btn-outline btn-sm" style={{ padding: '4px 8px', fontSize: '11px', color: '#EF4444' }}>Reject</button>
                                        </div>
                                    )}
                                    {(!isAdmin && l.status === 'Pending') && (
                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Pending Review</span>
                                    )}
                                    {(l.status !== 'Pending') && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <span style={{ fontSize: '11px', fontWeight: '700', color: l.status === 'Approved' ? '#10B981' : '#EF4444', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                {l.status === 'Approved' ? <CheckCircle size={14} /> : <XCircle size={14} />}
                                                {l.status}
                                            </span>
                                            {l.remarks && (
                                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', maxWidth: '150px' }}>
                                                    Note: {l.remarks}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                                    No leave applications found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const renderPayroll = () => (
        <div className="animate-fade-in">
            <div className="card" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <Wallet size={20} style={{ color: 'var(--primary)' }} />
                    <input
                        type="month"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontWeight: '700' }}
                    />
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="btn btn-outline"><FileText size={18} /> Export Payslips</button>
                    <button className="btn btn-primary" onClick={generatePayrollRecord}>GENERATE PAYROLL</button>
                </div>
            </div>

            <div className="card" style={{ padding: 0 }}>
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Employee</th>
                            <th>Total/Present Days</th>
                            <th>LOP Days</th>
                            <th>Salary Config</th>
                            <th>Net Payable</th>
                            <th>Status</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {payroll.map((p, i) => (
                            <tr key={i}>
                                <td style={{ fontWeight: '600' }}>{p.employeeName}</td>
                                <td>{p.totalDays} / <span style={{ color: '#10B981', fontWeight: '700' }}>{p.presentDays}</span></td>
                                <td style={{ color: '#EF4444', fontWeight: '700' }}>{p.lopDays}</td>
                                <td style={{ fontSize: '12px' }}>
                                    {employees.find(e => (e.id || e._id) === p.employeeId)?.salaryType === 'monthly' ? 'Monthly Basic' : 'Daily Wage'}
                                </td>
                                <td style={{ fontWeight: '800', color: 'var(--primary)' }}>₹{p.netSalary.toLocaleString()}</td>
                                <td><span className={`badge ${p.status === 'Paid' ? 'badge-success' : 'badge-warning'}`}>{p.status}</span></td>
                                <td>
                                    <button
                                        className="icon-btn"
                                        onClick={() => {
                                            const emp = employees.find(e => (e.id || e._id) === p.employeeId);
                                            if (emp) {
                                                setPayrollEmployee({
                                                    ...emp,
                                                    id: emp.id || emp._id,
                                                    name: emp.fullName,
                                                    payrollData: p
                                                });
                                                setIsProcessPayrollOpen(true);
                                            }
                                        }}
                                    >
                                        <Edit3 size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {payroll.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>No records for this month. Click Generate to start.</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const renderManpowerReq = () => {
        const filteredRequests = manpowerRequests.filter(req => 
            selectedManpowerProject === 'All' || req.project_name === selectedManpowerProject
        );

        return (
            <div className="animate-fade-in">
                <div className="card" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                    <div>
                        <h3 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '4px', color: 'var(--text-main)' }}>Workforce Requirements History</h3>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Track site requisitions and arrangements</p>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <select 
                            className="form-control" 
                            style={{ padding: '8px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', width: '200px' }}
                            value={selectedManpowerProject}
                            onChange={(e) => setSelectedManpowerProject(e.target.value)}
                        >
                            <option value="All">All Sites</option>
                            {projects.map(p => (
                                <option key={p._id} value={p.name}>{p.name}</option>
                            ))}
                        </select>
                        <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '10px' }}>
                            <button 
                                onClick={() => setManpowerFilter('Pending')}
                                style={{ 
                                    padding: '6px 16px', borderRadius: '8px', border: 'none', fontSize: '12px', fontWeight: '800', 
                                    background: manpowerFilter === 'Pending' ? 'white' : 'transparent',
                                    color: manpowerFilter === 'Pending' ? '#2563EB' : '#64748b',
                                    boxShadow: manpowerFilter === 'Pending' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                                    cursor: 'pointer'
                                }}
                            >
                                REQUESTED
                            </button>
                            <button 
                                onClick={() => setManpowerFilter('Approved')}
                                style={{ 
                                    padding: '6px 16px', borderRadius: '8px', border: 'none', fontSize: '12px', fontWeight: '800', 
                                    background: manpowerFilter === 'Approved' ? 'white' : 'transparent',
                                    color: manpowerFilter === 'Approved' ? '#2563EB' : '#64748b',
                                    boxShadow: manpowerFilter === 'Approved' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                                    cursor: 'pointer'
                                }}
                            >
                                TO ARRANGE
                            </button>
                            <button 
                                onClick={() => setManpowerFilter('Completed')}
                                style={{ 
                                    padding: '6px 16px', borderRadius: '8px', border: 'none', fontSize: '12px', fontWeight: '800', 
                                    background: manpowerFilter === 'Completed' ? 'white' : 'transparent',
                                    color: manpowerFilter === 'Completed' ? '#2563EB' : '#64748b',
                                    boxShadow: manpowerFilter === 'Completed' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                                    cursor: 'pointer'
                                }}
                            >
                                COMPLETED
                            </button>
                            <button 
                                onClick={() => setManpowerFilter('all')}
                                style={{ 
                                    padding: '6px 16px', borderRadius: '8px', border: 'none', fontSize: '12px', fontWeight: '800', 
                                    background: manpowerFilter === 'all' ? 'white' : 'transparent',
                                    color: manpowerFilter === 'all' ? '#2563EB' : '#64748b',
                                    boxShadow: manpowerFilter === 'all' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                                    cursor: 'pointer'
                                }}
                            >
                                ALL
                            </button>
                        </div>
                        <button 
                            className="btn btn-outline btn-sm" 
                            onClick={fetchManpowerRequests}
                            disabled={refreshingManpower}
                            title="Refresh Workforce Requests"
                        >
                            <Clock size={16} className={refreshingManpower ? "animate-spin" : ""} />
                        </button>
                    </div>
                </div>

                <div className="card" style={{ padding: 0 }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Project</th>
                                <th>Requirements</th>
                                <th>Verified By</th>
                                <th>Status</th>
                                <th style={{ textAlign: 'right' }}>Action</th>
                            </tr>
                        </thead>
                    <tbody>
                        {filteredRequests.map((req, i) => (
                            <tr key={i}>
                                <td style={{ fontSize: '12px', whiteSpace: 'nowrap', fontWeight: '600' }}>
                                    {req.created_at ? new Date(req.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
                                </td>
                                <td style={{ fontWeight: '700', color: '#1e293b' }}>{req.project_name}</td>
                                <td>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                        {(req.requested_items || []).map((item, idx) => (
                                            <span key={idx} style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '800', color: '#475569' }}>
                                                {item.role}: {item.count}
                                            </span>
                                        ))}
                                    </div>
                                </td>
                                <td style={{ fontSize: '12px' }}>{req.approvedBy || 'Admin'}</td>
                                <td>
                                    <span className={`badge ${req.status === 'Approved' ? 'badge-info' : (req.status === 'Completed' ? 'badge-success' : 'badge-warning')}`} style={{ fontSize: '10px' }}>
                                        {req.status === 'Approved' ? 'Verified' : req.status.toUpperCase()}
                                    </span>
                                </td>
                                <td>
                                    {req.status === 'Approved' && (
                                        <button
                                            className="btn btn-success btn-sm"
                                            style={{ padding: '6px 12px', fontSize: '11px', fontWeight: '800' }}
                                            onClick={async () => {
                                                if (!window.confirm("Mark this manpower request as arranged and completed?")) return;
                                                console.log("Processing Manpower Req:", req);
                                                try {
                                                    await approvalsAPI.action('manpower', req._id, 'complete');
                                                    alert('Manpower arranged successfully!');
                                                    fetchManpowerRequests();
                                                } catch (err) {
                                                    const errorMsg = err.response?.data?.detail || err.message || 'Failed to update status';
                                                    alert(`Error: ${errorMsg}`);
                                                }
                                            }}
                                        >
                                            MARK ARRANGED
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {filteredRequests.length === 0 && (
                            <tr>
                                <td colSpan={6} style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                                        <AlertCircle size={32} opacity={0.3} />
                                        <p style={{ fontWeight: '600' }}>No manpower requests found for this selection.</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

    return (
        <div style={{ padding: '0 10px 40px 10px', position: 'relative' }}>
            <div className="animate-fade-in">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                    <div>
                        <h1 style={{ fontSize: '32px', fontWeight: '800', color: 'var(--text-main)', marginBottom: '4px' }}>HRMS</h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '15px' }}>Team Master, Attendance, Leaves & Payroll</p>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        {isAdmin && (
                            <button className="btn btn-outline" onClick={() => setIsSettingsOpen(true)}>
                                <SettingsIcon size={18} /> SETTINGS
                            </button>
                        )}
                        <button className="btn btn-outline" onClick={fetchInitialData}><Clock size={18} /> Refresh</button>
                        <button className="btn btn-primary" onClick={() => setIsAddEmployeeOpen(true)}><UserPlus size={18} /> ADD EMPLOYEE</button>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '32px', borderBottom: '1px solid var(--border)', marginBottom: '32px', overflowX: 'auto' }}>
                    {availableTabs.map(tab => (
                        <button
                            key={tab}
                            onClick={() => handleTabChange(tab)}
                            style={{
                                padding: '12px 20px', fontSize: '14px', fontWeight: activeTab === tab ? '700' : '600',
                                color: activeTab === tab ? 'var(--primary)' : 'var(--text-muted)',
                                borderBottom: activeTab === tab ? '3px solid var(--primary)' : '3px solid transparent',
                                background: activeTab === tab ? 'rgba(37, 99, 235, 0.05)' : 'none',
                                border: 'none', cursor: 'pointer', borderRadius: '8px 8px 0 0', outline: 'none', transition: 'all 0.2s'
                            }}
                        >
                            {tab.toUpperCase()}
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
                        <Loader2 size={36} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
                        <p style={{ fontWeight: '600' }}>Fetching HRMS data...</p>
                        <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
                    </div>
                ) : (
                    <>
                        {activeTab === 'Dashboard' && renderDashboard()}
                        {activeTab === 'Employee Master' && renderEmployeeMaster()}
                        {activeTab === 'Attendance' && renderAttendance()}
                        {activeTab === 'Surprise Visits' && (
                            <div className="animate-fade-in">
                                <div className="card" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <h3 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '4px', color: 'var(--text-main)' }}>Surprise Inspection Logs</h3>
                                        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Admin-marked audit attendance per project session</p>
                                    </div>
                                    {hasPermission(user, 'HRMS', 'edit') && (
                                        <button className="btn btn-primary" onClick={() => setIsSurpriseVisitOpen(true)}>
                                            <Shield size={18} style={{ marginRight: '8px' }} /> MARK SURPRISE VISIT
                                        </button>
                                    )}
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                                    {surpriseVisits.map((visit, idx) => (
                                        <div key={idx} className="card" style={{ padding: '20px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                                                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                                                    <div style={{
                                                        width: '40px', height: '40px', borderRadius: '10px',
                                                        backgroundColor: visit.session === 'Morning' ? '#FEF3C7' : '#E0E7FF',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: visit.session === 'Morning' ? '#D97706' : '#4338CA'
                                                    }}>
                                                        {visit.session === 'Morning' ? <Clock size={20} /> : <Clock size={20} />}
                                                    </div>
                                                    <div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <span style={{ fontSize: '16px', fontWeight: '800' }}>{visit.project_name}</span>
                                                            <span className={`badge ${visit.session === 'Morning' ? 'badge-warning' : 'badge-info'}`} style={{ fontSize: '10px' }}>{visit.session.toUpperCase()}</span>
                                                        </div>
                                                        <div style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'flex', gap: '12px', marginTop: '4px' }}>
                                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={14} /> {visit.date}</span>
                                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={14} /> {visit.time}</span>
                                                            {visit.location && (
                                                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--primary)' }}><MapPin size={14} /> GPS Tracked</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div style={{ textAlign: 'right' }}>
                                                    <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>MARKED BY</div>
                                                    <div style={{ fontSize: '13px', fontWeight: '800' }}>{visit.marked_by}</div>
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', gap: '20px' }}>
                                                {visit.photo_url && (
                                                    <div style={{ width: '120px', height: '120px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                                                        <img src={visit.photo_url} alt="Visit Photo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    </div>
                                                )}
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontWeight: '700', fontSize: '13px', marginBottom: '8px' }}>Present Staff ({visit.present_employees.length})</div>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                        {visit.present_employees.map((emp, i) => (
                                                            <span key={i} style={{
                                                                fontSize: '11px', fontWeight: '600', padding: '4px 10px',
                                                                borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc'
                                                            }} title={emp.designation}>
                                                                {emp.name}
                                                            </span>
                                                        ))}
                                                    </div>
                                                    {visit.remarks && (
                                                        <div style={{ marginTop: '12px', padding: '10px', borderRadius: '8px', backgroundColor: '#f1f5f9', fontSize: '12px', fontStyle: 'italic', color: '#475569' }}>
                                                            " {visit.remarks} "
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {surpriseVisits.length === 0 && (
                                        <div style={{ textAlign: 'center', padding: '100px 0', border: '2px dashed var(--border)', borderRadius: '16px' }}>
                                            <div style={{ color: 'var(--text-muted)' }}>
                                                <Shield size={48} style={{ opacity: 0.2, margin: '0 auto 16px' }} />
                                                <p style={{ fontWeight: '600' }}>No surprise inspection records found.</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                        {activeTab === 'Leave Management' && renderLeaves()}
                        {activeTab === 'Payroll' && renderPayroll()}
                        {activeTab === 'Workforce' && renderManpowerReq()}
                    </>
                )}
            </div>

            <AddEmployeeModal
                isOpen={isAddEmployeeOpen}
                onClose={() => {
                    setIsAddEmployeeOpen(false);
                    setEditingEmployee(null);
                }}
                onEmployeeAdded={fetchInitialData}
                roles={DEFAULT_ROLES}
                employee={editingEmployee}
            />
            <ApplyLeaveModal
                isOpen={isApplyLeaveOpen}
                onClose={() => setIsApplyLeaveOpen(false)}
                onLeaveApplied={() => { fetchLeaves(); fetchInitialData(); }}
            />
            <EmployeeDetailsModal
                isOpen={isEmployeeDetailsOpen}
                onClose={() => setIsEmployeeDetailsOpen(false)}
                employee={selectedEmployee}
                onEdit={() => {
                    setIsEmployeeDetailsOpen(false);
                    // selectedEmployee in HRMS.jsx needs to be the original employee object for editing
                    const empForEdit = employees.find(e => (e.id || e._id) === selectedEmployee?.id);
                    if (empForEdit) handleEditEmployee(empForEdit);
                }}
            />
            <SurpriseVisitModal
                isOpen={isSurpriseVisitOpen}
                onClose={() => setIsSurpriseVisitOpen(false)}
                onSaved={fetchSurpriseVisits}
            />
            <HrmsSettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                onSaved={fetchInitialData}
            />
            <ProcessPayrollModal
                isOpen={isProcessPayrollOpen}
                onClose={() => setIsProcessPayrollOpen(false)}
                employee={payrollEmployee}
                onConfirm={async (empId, data) => {
                    // Logic to update local state or call API to mark as paid
                    try {
                        console.log('Processed Payroll Data:', data);
                        // After generating, fetch updated payroll
                        fetchPayroll(selectedMonth);
                        alert(`Payroll generated successfully for ${payrollEmployee?.name}. Net Amount: ₹${data.netSalary.toLocaleString()}`);
                    } catch (err) {
                        console.error('Failed to confirm individual payroll', err);
                    }
                }}
            />
        </div>
    );
};

export default HRMS;

import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    Users, UserPlus, CheckCircle, Clock, Calendar, IndianRupee,
    Briefcase, Wallet, FileText, Plus, Search, Filter,
    Check, X, XCircle, AlertCircle, TrendingUp, BarChart2, Shield, ShieldCheck, Edit3, Loader2, Eye, Power, Trash2, UserCheck, UserX, Save,
    Mail, MoreVertical, Edit2, ListTodo, ShoppingCart, Package, UserCog, History, Settings as SettingsIcon2, DollarSign
} from 'lucide-react';
import { employeeAPI, hrmsAPI, projectAPI, approvalsAPI, settingsAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { hasPermission, hasSubTabAccess, getRoles, saveRoles, fetchAndSyncRoles, isAdminRole, isEngineerRole } from '../utils/rbac';
import AddEmployeeModal from '../components/AddEmployeeModal';
import EmployeeDetailsModal from '../components/EmployeeDetailsModal';
import ApplyLeaveModal from '../components/ApplyLeaveModal';
import SurpriseVisitModal from '../components/SurpriseVisitModal';
import ProcessPayrollModal from '../components/ProcessPayrollModal';
import CreateRoleModal from '../components/CreateRoleModal';
import { surpriseVisitAPI, labourAttendanceAPI } from '../utils/api';
import { MapPin, Camera, Settings as SettingsIcon, PartyPopper, Cake, Star, LayoutDashboard, Download } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import HrmsSettingsModal from '../components/HrmsSettingsModal';
import CustomSelect from '../components/CustomSelect';
import AttendanceCalendar from '../components/AttendanceCalendar';
import AttendanceRoster from '../components/AttendanceRoster';
import Pagination from '../components/Pagination';

const HRMS = () => {
    const { user } = useAuth();
    const toast = useToast();
    const confirm = useConfirm();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const urlTab = searchParams.get('tab');
    const [activeTab, setActiveTab] = useState('Dashboard');

    const availableTabs = useMemo(() => [
        'Dashboard', 'Employee Master', 'Attendance', 'Leave Management', 'Payroll', 'Surprise Visits', 'Workforce', 'Authorized Users', 'Roles & Permissions'
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
    const [leaveFilter, setLeaveFilter] = useState('All');
    const canEditHRMS = hasPermission(user, 'HRMS', 'edit');
    const canDeleteHRMS = hasPermission(user, 'HRMS', 'delete');
    const isAdmin = canEditHRMS;

    useEffect(() => {
        if (!hasPermission(user, 'HRMS', 'view')) {
            navigate('/');
        }
    }, [user, navigate]);

    const [payroll, setPayroll] = useState([]);
    // Attendance records for the selected payroll month — used to derive
    // Total/Present days when a payroll record hasn't been processed yet
    // (i.e. DRAFT rows that would otherwise show "—/—").
    const [payrollMonthAttendance, setPayrollMonthAttendance] = useState([]);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
    const [empPage, setEmpPage] = useState(1);
    const [leavesPage, setLeavesPage] = useState(1);
    const EMP_PAGE_SIZE = 20;

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
    const [companyInfo, setCompanyInfo] = useState({});
    const [attendanceSearchQuery, setAttendanceSearchQuery] = useState('');
    const [selectedAttendanceSite, setSelectedAttendanceSite] = useState('All');
    const [manpowerFilter, setManpowerFilter] = useState('Approved');
    const [selectedManpowerProject, setSelectedManpowerProject] = useState('All');
    const [refreshingManpower, setRefreshingManpower] = useState(false);

    // === User Management State ===
    const [umSearchTerm, setUmSearchTerm] = useState('');
    const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
    const [newUser, setNewUser] = useState({ fullName: '', employeeCode: '', email: '', roles: [], password: '', status: 'Active' });
    const [umUsers, setUmUsers] = useState([]);
    const [umLoading, setUmLoading] = useState(false);
    const [openMenuId, setOpenMenuId] = useState(null);
    const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
    const [editingRole, setEditingRole] = useState(null);
    const [editingUser, setEditingUser] = useState(null);

    const iconMapping = {
        'Dashboard': LayoutDashboard, 'Projects': Briefcase, 'Tasks': ListTodo,
        'Accounts': Wallet, 'Procurement': ShoppingCart, 'HRMS': Users,
        'Inventory Management': Package, 'Reports': FileText, 'System Logs': History, 'Settings': SettingsIcon
    };

    const loadRoles = () => {
        return getRoles().map(r => ({
            ...r,
            permissions: r.permissions.map(p => ({ ...p, icon: iconMapping[p.name] || LayoutDashboard }))
        }));
    };

    const [umRoles, setUmRoles] = useState(loadRoles());

    const fetchUmUsers = async () => {
        try {
            setUmLoading(true);
            const res = await employeeAPI.getAll();
            setUmUsers(res.data.map(u => ({
                id: u._id, name: u.fullName || u.name || u.employeeCode,
                employeeCode: u.employeeCode || '',
                email: u.email || 'No email', role: u.roles ? u.roles[0] : (u.role || 'Staff'),
                status: u.status || 'Active', lastLogin: u.lastLogin || 'N/A'
            })));
        } catch (err) {
            console.error('Failed to fetch users', err);
            if (err?.response?.status === 403) {
                toast.error(err.response?.data?.detail || "You don't have permission to view this data.");
            }
        }
        finally { setUmLoading(false); }
    };

    const handleDeleteUser = async (userId) => {
        if (!hasPermission(user, 'HRMS', 'delete')) {
            toast.error("You don't have permission to delete users.");
            return;
        }
        if (!(await confirm({ title: 'Delete User', message: 'Are you sure you want to delete this user?', confirmText: 'Delete', danger: true }))) return;
        try { await employeeAPI.delete(userId); fetchUmUsers(); }
        catch (err) { console.error('Delete failed', err); toast.error('Failed to delete user'); }
    };

    const handleEditUser = (u) => {
        setNewUser({ id: u.id, fullName: u.name, employeeCode: u.employeeCode || '', email: u.email === 'No email' ? '' : u.email, roles: [u.role], password: '', status: u.status });
        setEditingUser(u);
        setIsAddUserModalOpen(true);
    };

    const handleCreateUser = async () => {
        if (!hasPermission(user, 'HRMS', 'add') && !hasPermission(user, 'HRMS', 'edit')) {
            toast.error("You don't have permission to create/update users.");
            return;
        }
        if (!newUser.fullName || !newUser.employeeCode || (!editingUser && !newUser.password)) {
            toast.warning('Please fill in required fields (Name, Code, Password)'); return;
        }
        try {
            if (editingUser) { await employeeAPI.update(editingUser.id, newUser); }
            else { await employeeAPI.create(newUser); }
            setIsAddUserModalOpen(false); setEditingUser(null);
            setNewUser({ fullName: '', employeeCode: '', email: '', roles: [], password: '', status: 'Active' });
            fetchUmUsers();
        } catch (err) {
            const detail = err.response?.data?.detail;
            const errorMsg = Array.isArray(detail) ? detail.map(d => `${d.loc.join('.')}: ${d.msg}`).join('\n') : detail || 'Failed to save user';
            toast.error(errorMsg);
        }
    };

    const handleToggleUserStatus = async (u) => {
        try { await employeeAPI.update(u.id, { status: u.status === 'Active' ? 'Inactive' : 'Active' }); fetchUmUsers(); }
        catch (err) { console.error('Status update failed', err); }
    };

    const handleRoleCreated = (newRole, isUpdate) => {
        let updatedRoles;
        if (isUpdate) { updatedRoles = umRoles.map(r => r.name === editingRole.name ? newRole : r); }
        else { updatedRoles = [...umRoles, newRole]; }
        setUmRoles(updatedRoles);
        saveRoles(updatedRoles.map(r => ({ name: r.name, description: r.description, tags: r.tags, permissions: r.permissions.map(p => ({ name: p.name, actions: p.actions, subTabs: p.subTabs })), dashboardCards: r.dashboardCards || [], features: r.features || [] })));
        setEditingRole(null); setIsRoleModalOpen(false);
    };

    const handleDeleteRole = async (roleName) => {
        if (!hasPermission(user, 'HRMS', 'delete')) {
            toast.error("You don't have permission to delete roles.");
            return;
        }
        if (isAdminRole(roleName)) {
            toast.warning(`Cannot delete ${roleName} role`);
            return;
        }
        if (await confirm({ title: 'Delete Role', message: `Are you sure you want to delete the ${roleName} role?`, confirmText: 'Delete', danger: true })) {
            const updated = umRoles.filter(r => r.name !== roleName);
            setUmRoles(updated);
            saveRoles(updated.map(r => ({ name: r.name, description: r.description, tags: r.tags, permissions: r.permissions.map(p => ({ name: p.name, actions: p.actions, subTabs: p.subTabs })), dashboardCards: r.dashboardCards || [], features: r.features || [] })));
        }
    };

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        try {
            setLoading(true);
            const [statsRes, empRes, settingsRes, projRes, companyRes] = await Promise.all([
                hrmsAPI.getStats(),
                employeeAPI.getAll(),
                hrmsAPI.getSettings(),
                projectAPI.getAll(),
                settingsAPI.getCompany()
            ]);
            setStats(statsRes.data);
            setEmployees(empRes.data);
            setHrmsSettings(settingsRes.data);
            setProjects(projRes.data || []);
            setCompanyInfo(companyRes.data || {});

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
            if (err?.response?.status === 403) {
                toast.error(err.response?.data?.detail || "You don't have permission to view this data.");
            }
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
            if (err?.response?.status === 403) {
                toast.error(err.response?.data?.detail || "You don't have permission to view this data.");
            }
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
            if (err?.response?.status === 403) {
                toast.error(err.response?.data?.detail || "You don't have permission to view this data.");
            }
        }
    };

    const fetchPayroll = async (month) => {
        try {
            const res = await hrmsAPI.getPayroll(month);
            setPayroll(res.data);
        } catch (err) {
            console.error('Failed to fetch payroll', err);
            if (err?.response?.status === 403) {
                toast.error(err.response?.data?.detail || "You don't have permission to view this data.");
            }
        }
    };

    // Pull the full month of attendance records so the Payroll table can
    // surface a live Total/Present-days figure for DRAFT rows.
    const fetchPayrollMonthAttendance = async (month) => {
        try {
            const [year, mn] = month.split('-').map(Number);
            if (!year || !mn) return;
            const numDays = new Date(year, mn, 0).getDate();
            const pad = (n) => String(n).padStart(2, '0');
            const firstDay = `${year}-${pad(mn)}-01`;
            const lastDay = `${year}-${pad(mn)}-${pad(numDays)}`;
            const res = await hrmsAPI.getAttendanceRange(firstDay, lastDay);
            setPayrollMonthAttendance(res.data || []);
        } catch (err) {
            console.error('Failed to fetch payroll-month attendance', err);
        }
    };

    // Compute total/present days for one employee from the loaded
    // attendance records. Half Day counts as 0.5 of a present day.
    const getMonthAttendanceStats = (emp) => {
        const [year, mn] = (selectedMonth || '').split('-').map(Number);
        if (!year || !mn) return { totalDays: '—', presentDays: '—' };
        const totalDays = new Date(year, mn, 0).getDate();
        const empId = emp.id || emp._id;
        const empCode = emp.employeeCode;
        const records = (payrollMonthAttendance || []).filter(r =>
            r.employeeId === empId || r.employeeId === empCode ||
            r.username === empCode || r.user_id === empId
        );
        let presentDays = 0;
        for (const r of records) {
            if (r.status === 'Present') presentDays += 1;
            else if (r.status === 'Half Day') presentDays += 0.5;
        }
        return { totalDays, presentDays };
    };

    const [labourByProjectDate, setLabourByProjectDate] = useState({});

    const fetchSurpriseVisits = async () => {
        try {
            const [svRes, laRes] = await Promise.all([
                surpriseVisitAPI.getAll(),
                labourAttendanceAPI.getAll({}),
            ]);
            setSurpriseVisits(svRes.data);
            // Build lookup: "projectName||date" → labour record
            const map = {};
            (laRes.data || []).forEach(rec => {
                const key = `${rec.project_name}||${rec.date}`;
                map[key] = rec;
            });
            setLabourByProjectDate(map);
        } catch (err) {
            console.error('Failed to fetch surprise visits', err);
            if (err?.response?.status === 403) {
                toast.error(err.response?.data?.detail || "You don't have permission to view this data.");
            }
        }
    };

    const fetchManpowerRequests = async () => {
        setRefreshingManpower(true);
        try {
            const mpRes = await approvalsAPI.getAll(manpowerFilter);
            setManpowerRequests(mpRes.data.manpower || []);
        } catch (err) {
            console.error('Failed to fetch manpower requests', err);
            if (err?.response?.status === 403) {
                toast.error(err.response?.data?.detail || "You don't have permission to view this data.");
            }
        } finally {
            setTimeout(() => setRefreshingManpower(false), 500);
        }
    };

    useEffect(() => {
        if (activeTab === 'Attendance') {
            // Refresh employee list so newly added employees appear
            employeeAPI.getAll().then(res => setEmployees(res.data)).catch(() => {});
            fetchAttendance(selectedDate);
            fetchLeaves(); // Also refresh leaves for accurate mapping
        }
        if (activeTab === 'Leave Management') fetchLeaves();
        if (activeTab === 'Payroll') {
            fetchPayroll(selectedMonth);
            fetchPayrollMonthAttendance(selectedMonth);
        }
        if (activeTab === 'Surprise Visits') fetchSurpriseVisits();
        if (activeTab === 'Workforce') fetchManpowerRequests();
        if (activeTab === 'Authorized Users') fetchUmUsers();
        if (activeTab === 'Roles & Permissions') {
            const syncRoles = async () => {
                const serverRoles = await fetchAndSyncRoles();
                if (serverRoles) {
                    setUmRoles(serverRoles.map(r => ({ ...r, permissions: r.permissions.map(p => ({ ...p, icon: iconMapping[p.name] || LayoutDashboard })) })));
                }
            };
            syncRoles();
        }
    }, [activeTab, selectedDate, selectedMonth, manpowerFilter]);

    // Close user action dropdown on outside click
    useEffect(() => {
        const handleClickOutside = () => setOpenMenuId(null);
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

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
                const isOnLeave = (leaves || []).some(l => {
                    if (!l || !l.status || l.status.toLowerCase() !== 'approved') return false;
                    const matchesEmployee = (l.employeeId && (l.employeeId === empId || l.employeeId === emp.employeeCode)) ||
                        (l.employeeName && l.employeeName.trim() === emp.fullName?.trim());
                    if (!matchesEmployee) return false;
                    // Robust date comparison using Date objects
                    if (!l.fromDate || !l.toDate || !selectedDate) return false;
                    const selDate = new Date(selectedDate).setHours(0, 0, 0, 0);
                    const fromDate = new Date(l.fromDate).setHours(0, 0, 0, 0);
                    const toDate = new Date(l.toDate).setHours(0, 0, 0, 0);
                    if (isNaN(selDate) || isNaN(fromDate) || isNaN(toDate)) return false;
                    return selDate >= fromDate && selDate <= toDate;
                });

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
                employeeId: d.employeeCode || d.employeeId,
                employeeName: d.fullName,
                date: selectedDate,
                checkIn: d.checkIn,
                checkOut: d.checkOut,
                status: d.status
            }));
            await hrmsAPI.saveAttendance(records);
            toast.success('Attendance saved successfully');
            fetchAttendance(selectedDate);
            fetchInitialData();
        } catch (err) {
            console.error('Save attendance failed', err);
            toast.error('Failed to save attendance');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveSingleAttendance = async (data) => {
        try {
            const record = {
                employeeId: data.employeeCode || data.employeeId,
                employeeName: data.fullName,
                date: selectedDate,
                checkIn: data.checkIn,
                checkOut: data.checkOut,
                status: data.status
            };
            await hrmsAPI.saveAttendance([record]);
            toast.success(`Attendance saved for ${data.fullName}`);
            fetchAttendance(selectedDate);
            fetchInitialData();
        } catch (err) {
            console.error('Save attendance failed', err);
            toast.error('Failed to save attendance');
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
            // Refresh attendance since leave approval auto-marks attendance as "Leave"
            if (status === 'Approved' && selectedDate) fetchAttendance(selectedDate);
        } catch (err) {
            console.error('Leave action failed', err);
        }
    };

    const generatePayrollRecord = async () => {
        if (!hasPermission(user, 'HRMS', 'add', 'Payroll') && !hasPermission(user, 'HRMS', 'edit', 'Payroll') && !hasPermission(user, 'HRMS', 'add')) {
            toast.error("You don't have permission to generate payroll.");
            return;
        }
        if (!(await confirm({ title: 'Generate Payroll', message: `Generate payroll for ${selectedMonth}?`, confirmText: 'Generate' }))) return;
        try {
            await hrmsAPI.generatePayroll(selectedMonth);
            fetchPayroll(selectedMonth);
            fetchInitialData();
            toast.success('Payroll generated successfully');
        } catch (err) {
            toast.error('Failed to generate payroll');
        }
    };

    const downloadPaySlip = (emp, p) => {
        try {
        const doc = new jsPDF();
        const pageW = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight();
        const margin = 14;
        const contentW = pageW - margin * 2;
        const fmt = (n) => `Rs. ${(parseFloat(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
        const [yr, mn] = (p.month || selectedMonth).split('-');
        const monthLabel = new Date(yr, mn - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
        const cName = companyInfo.companyName || 'Paari Shiv Homes';
        const cAddr = companyInfo.address || '';
        const cPhone = companyInfo.contactNumber || '';
        const cEmail = companyInfo.email || '';
        const cGstin = companyInfo.gstin || '';

        // === DECORATIVE TOP LINE ===
        doc.setFillColor(30, 64, 175);
        doc.rect(0, 0, pageW, 4, 'F');

        // === COMPANY HEADER ===
        let y = 18;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.setTextColor(30, 64, 175);
        doc.text(cName.toUpperCase(), pageW / 2, y, { align: 'center' });
        y += 7;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        if (cAddr) { doc.text(cAddr, pageW / 2, y, { align: 'center' }); y += 4; }
        const contactParts = [cPhone, cEmail].filter(Boolean).join('  |  ');
        if (contactParts) { doc.text(contactParts, pageW / 2, y, { align: 'center' }); y += 4; }
        if (cGstin) { doc.text(`GSTIN: ${cGstin}`, pageW / 2, y, { align: 'center' }); y += 4; }

        // === PAYSLIP TITLE BAR ===
        y += 4;
        doc.setFillColor(30, 64, 175);
        doc.rect(margin, y, contentW, 10, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(255, 255, 255);
        doc.text(`PAYSLIP FOR ${monthLabel.toUpperCase()}`, pageW / 2, y + 7, { align: 'center' });
        y += 18;

        // === EMPLOYEE DETAILS TABLE ===
        autoTable(doc, {
            startY: y,
            body: [
                ['Employee Name', emp.fullName || '—', 'Employee ID', emp.employeeCode || '—'],
                ['Designation', emp.designation || '—', 'Department', emp.department || '—'],
                ['Date of Joining', emp.doj ? new Date(emp.doj).toLocaleDateString('en-IN') : '—', 'Pay Period', monthLabel],
            ],
            theme: 'plain',
            styles: { fontSize: 9, cellPadding: { top: 3, bottom: 3, left: 6, right: 6 } },
            columnStyles: {
                0: { fontStyle: 'bold', textColor: [100, 116, 139], cellWidth: 38 },
                1: { textColor: [15, 23, 42], cellWidth: 55 },
                2: { fontStyle: 'bold', textColor: [100, 116, 139], cellWidth: 38 },
                3: { textColor: [15, 23, 42] },
            },
            margin: { left: margin, right: margin },
        });
        y = doc.lastAutoTable.finalY + 2;

        // Thin separator
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.5);
        doc.line(margin, y, pageW - margin, y);
        y += 8;

        // === ATTENDANCE SUMMARY ===
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(30, 64, 175);
        doc.text('ATTENDANCE SUMMARY', margin, y);
        y += 4;
        autoTable(doc, {
            startY: y,
            head: [['Total Days', 'Present Days', 'Leave Days', 'LOP / Absent']],
            body: [[p.totalDays || '—', p.presentDays ?? '—', p.leaveDays ?? 0, p.lopDays ?? 0]],
            theme: 'grid',
            styles: { fontSize: 9, cellPadding: 4, halign: 'center', lineColor: [226, 232, 240], lineWidth: 0.3 },
            headStyles: { fillColor: [241, 245, 249], textColor: [51, 65, 85], fontStyle: 'bold' },
            margin: { left: margin, right: margin },
        });
        y = doc.lastAutoTable.finalY + 8;

        // === EARNINGS & DEDUCTIONS SIDE BY SIDE ===
        const colW = (contentW - 8) / 2;

        // Section headers
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(22, 163, 74);
        doc.text('EARNINGS', margin, y);
        doc.setTextColor(220, 38, 38);
        doc.text('DEDUCTIONS', margin + colW + 8, y);
        y += 4;

        const basicSalary = parseFloat(p.basicSalary || emp.basicSalary || 0);
        const hra = parseFloat(p.hra || emp.hra || 0);
        const earningsRows = [['Basic Salary', fmt(basicSalary)]];
        if (hra > 0) earningsRows.push(['HRA / Allowance', fmt(hra)]);

        // Earnings table
        autoTable(doc, {
            startY: y,
            head: [['Particulars', 'Amount (Rs.)']],
            body: earningsRows,
            foot: [['Gross Earnings', fmt(p.grossEarnings || basicSalary + hra)]],
            theme: 'grid',
            styles: { fontSize: 9, cellPadding: 4, lineColor: [226, 232, 240], lineWidth: 0.3 },
            headStyles: { fillColor: [220, 252, 231], textColor: [22, 101, 52], fontStyle: 'bold' },
            footStyles: { fillColor: [187, 247, 208], textColor: [22, 101, 52], fontStyle: 'bold' },
            columnStyles: { 1: { halign: 'right' } },
            tableWidth: colW,
            margin: { left: margin },
        });
        const earningsEndY = doc.lastAutoTable.finalY;

        // Deductions table
        const deductionRows = [];
        if (p.pfAmount > 0) deductionRows.push(['Provident Fund (PF)', fmt(p.pfAmount)]);
        if (p.ptAmount > 0) deductionRows.push(['Professional Tax', fmt(p.ptAmount)]);
        if (p.lopAmount > 0) deductionRows.push([`LOP Deduction (${p.lopDays || 0} days)`, fmt(p.lopAmount)]);
        if (p.advanceAmount > 0) deductionRows.push(['Advance Deduction', fmt(p.advanceAmount)]);
        if (deductionRows.length === 0) deductionRows.push(['No Deductions', fmt(0)]);

        autoTable(doc, {
            startY: y,
            head: [['Particulars', 'Amount (Rs.)']],
            body: deductionRows,
            foot: [['Total Deductions', fmt(p.totalDeductions || 0)]],
            theme: 'grid',
            styles: { fontSize: 9, cellPadding: 4, lineColor: [226, 232, 240], lineWidth: 0.3 },
            headStyles: { fillColor: [254, 226, 226], textColor: [153, 27, 27], fontStyle: 'bold' },
            footStyles: { fillColor: [254, 202, 202], textColor: [153, 27, 27], fontStyle: 'bold' },
            columnStyles: { 1: { halign: 'right' } },
            tableWidth: colW,
            margin: { left: margin + colW + 8 },
        });
        const deductionsEndY = doc.lastAutoTable.finalY;

        // === NET PAY BOX ===
        let netY = Math.max(earningsEndY, deductionsEndY) + 10;
        doc.setFillColor(30, 64, 175);
        doc.roundedRect(margin, netY, contentW, 16, 2, 2, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(11);
        doc.text('NET PAYABLE', margin + 8, netY + 11);
        doc.setFontSize(15);
        doc.text(fmt(p.netSalary || 0), pageW - margin - 8, netY + 11, { align: 'right' });

        // === AMOUNT IN WORDS ===
        netY += 24;
        const netAmount = parseFloat(p.netSalary || 0);
        const amountWords = numberToWords(Math.round(netAmount));
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105);
        doc.text(`Amount in words: ${amountWords} Rupees Only`, margin, netY);

        // === FOOTER SEPARATOR ===
        netY += 12;
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.line(margin, netY, pageW - margin, netY);

        // === FOOTER ===
        netY += 8;
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text('This is a system-generated payslip and does not require a signature.', pageW / 2, netY, { align: 'center' });
        netY += 5;
        doc.text(`Generated on ${new Date().toLocaleDateString('en-IN')} | ${cName}`, pageW / 2, netY, { align: 'center' });

        // === BOTTOM DECORATIVE LINE ===
        doc.setFillColor(30, 64, 175);
        doc.rect(0, pageH - 4, pageW, 4, 'F');

        doc.save(`PaySlip_${emp.employeeCode || 'EMP'}_${p.month || selectedMonth}.pdf`);
        toast.success('Pay slip downloaded');
        } catch (err) {
            console.error('Pay slip generation failed:', err);
            toast.error('Failed to generate pay slip: ' + err.message);
        }
    };

    const numberToWords = (num) => {
        if (num === 0) return 'Zero';
        const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
            'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
        const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
        const scales = ['', 'Thousand', 'Lakh', 'Crore'];
        if (num < 0) return 'Minus ' + numberToWords(-num);
        const convert2 = (n) => n < 20 ? ones[n] : tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
        const convert3 = (n) => n >= 100 ? ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + convert2(n % 100) : '') : convert2(n);
        // Indian numbering: ones, thousands, lakhs, crores
        const parts = [];
        let rem = Math.floor(num);
        const firstChunk = rem % 1000; rem = Math.floor(rem / 1000);
        if (firstChunk) parts.push(convert3(firstChunk));
        let scaleIdx = 1;
        while (rem > 0) {
            const chunk = rem % 100; rem = Math.floor(rem / 100);
            if (chunk) parts.push(convert2(chunk) + ' ' + scales[scaleIdx]);
            scaleIdx++;
        }
        return parts.reverse().join(' ') || 'Zero';
    };

    const handleToggleEmployeeStatus = async (emp) => {
        if (!hasPermission(user, 'HRMS', 'edit')) {
            toast.error("You don't have permission to change employee status.");
            return;
        }
        if (!(await confirm({ title: 'Change Status', message: `Change status for ${emp.fullName}?`, confirmText: 'Change' }))) return;
        try {
            const newStatus = emp.status === 'Active' ? 'Inactive' : 'Active';
            await employeeAPI.update(emp.id || emp._id, { status: newStatus });
            fetchInitialData();
        } catch (err) {
            console.error('Failed to change status', err);
            toast.error('Failed to change status');
        }
    };

    const handleEditEmployee = (emp) => {
        setEditingEmployee(emp);
        setIsAddEmployeeOpen(true);
    };

    const filteredEmployees = employees.filter(emp => {
        // Exclude drivers and non-monthly salary employees
        if ((emp.designation || '').toLowerCase() === 'driver') return false;
        if (emp.salaryType && emp.salaryType !== 'monthly') return false;
        const matchesSearch = (emp.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            emp.employeeCode?.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesRole = selectedRole === 'All' || emp.designation === selectedRole;
        return matchesSearch && matchesRole;
    });
    // Bug 1.7 - Pagination
    const paginatedEmployees = filteredEmployees.slice((empPage - 1) * EMP_PAGE_SIZE, empPage * EMP_PAGE_SIZE);
    useEffect(() => { setEmpPage(1); }, [searchQuery, selectedRole]);

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
                                                <button onClick={() => handleLeaveAction(l.id, 'Approved')} className="icon-btn" aria-label="Approve leave" title="Approve" style={{ color: '#10B981', padding: '4px' }}><Check size={16} /></button>
                                                <button onClick={() => handleLeaveAction(l.id, 'Rejected')} className="icon-btn" aria-label="Reject leave" title="Reject" style={{ color: '#EF4444', padding: '4px' }}><X size={16} /></button>
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
                            style={{ width: '100%', padding: '10px 40px 10px 40px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '14px' }}
                        />
                        {searchQuery && (
                            <button type="button" onClick={() => setSearchQuery('')} aria-label="Clear search" style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', display: 'flex', alignItems: 'center' }}>
                                <X size={15} />
                            </button>
                        )}
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
                {hasPermission(user, 'HRMS', 'add') && (
                    <button className="btn btn-primary" onClick={() => setIsAddEmployeeOpen(true)} style={{ flex: '1 1 auto', justifyContent: 'center' }}>
                        <UserPlus size={18} /> ADD EMPLOYEE
                    </button>
                )}
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
                            <th>Basic</th>
                            <th>Status</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedEmployees.map((emp, i) => (
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
                                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                        <button
                                            className="icon-btn"
                                            title="View Details"
                                            aria-label="View employee details"
                                            onClick={() => { setSelectedEmployee({ ...emp, id: emp.id || emp._id, name: emp.fullName, mobile: emp.phone, dept: emp.department || emp.designation || '' }); setIsEmployeeDetailsOpen(true); }}
                                            style={{ background: '#f0f9ff', color: '#0369a1', borderRadius: '8px', border: '1px solid #bae6fd', padding: '8px', transition: 'all 0.2s' }}
                                        >
                                            <Eye size={16} />
                                        </button>
                                        <button
                                            className="icon-btn"
                                            title="View Salary & Payslip"
                                            aria-label="View salary and payslip"
                                            onClick={() => { setSelectedEmployee({ ...emp, id: emp.id || emp._id, name: emp.fullName, mobile: emp.phone, dept: emp.department || emp.designation || '', basicSalary: emp.basicSalary, bankAccount: emp.bankAccount, designation: emp.designation, role: emp.roles?.[0] || '' }); setIsEmployeeDetailsOpen(true); }}
                                            style={{ background: '#ecfdf5', color: '#059669', borderRadius: '8px', border: '1px solid #a7f3d0', padding: '8px', transition: 'all 0.2s' }}
                                        >
                                            <FileText size={16} />
                                        </button>
                                        <button
                                            className="icon-btn"
                                            title="Attendance Log"
                                            aria-label="View attendance log"
                                            onClick={() => { setActiveTab('Attendance'); }}
                                            style={{ background: '#f5f3ff', color: '#7c3aed', borderRadius: '8px', border: '1px solid #ddd6fe', padding: '8px', transition: 'all 0.2s' }}
                                        >
                                            <History size={16} />
                                        </button>
                                        {canEditHRMS && (<button
                                            className="icon-btn"
                                            title="Edit Employee"
                                            aria-label="Edit employee"
                                            onClick={() => handleEditEmployee(emp)}
                                            style={{ background: '#fff7ed', color: '#f59e0b', borderRadius: '8px', border: '1px solid #fed7aa', padding: '8px', transition: 'all 0.2s' }}
                                        >
                                            <Edit3 size={16} />
                                        </button>)}
                                        {canEditHRMS && (<button
                                            className="icon-btn"
                                            title={emp.status === 'Active' ? 'Deactivate Employee' : 'Activate Employee'}
                                            aria-label={emp.status === 'Active' ? 'Deactivate employee' : 'Activate employee'}
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
                                        </button>)}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <Pagination currentPage={empPage} totalItems={filteredEmployees.length} pageSize={EMP_PAGE_SIZE} onPageChange={setEmpPage} />
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
                            {/* Bulk Present hidden */}
                            {canEditHRMS && <button className="btn btn-success" onClick={handleSaveAttendance} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px', fontWeight: '700', fontSize: '14px', letterSpacing: '0.025em' }}>
                                <Save size={18} /> SAVE CHANGES
                            </button>}
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
                                            {canEditHRMS && (
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
                                            )}
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

    const renderLeaves = () => {
        const filteredLeaves = (leaves || []).filter(l => leaveFilter === 'All' || l.status === leaveFilter);
        const statusCounts = {
            All: (leaves || []).length,
            Pending: (leaves || []).filter(l => l.status === 'Pending').length,
            Approved: (leaves || []).filter(l => l.status === 'Approved').length,
            Rejected: (leaves || []).filter(l => l.status === 'Rejected').length,
        };
        return (
        <div className="animate-fade-in">
            <div className="card" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-main)' }}>Leave Applications</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <div role="tablist" aria-label="Filter leaves" style={{ display: 'flex', backgroundColor: '#F1F5F9', padding: '4px', borderRadius: '10px' }}>
                        {['All', 'Pending', 'Approved', 'Rejected'].map(s => (
                            <button
                                key={s}
                                role="tab"
                                aria-selected={leaveFilter === s}
                                onClick={() => setLeaveFilter(s)}
                                style={{
                                    padding: '6px 14px', borderRadius: '8px', border: 'none', fontSize: '12px', fontWeight: '700',
                                    background: leaveFilter === s ? 'white' : 'transparent',
                                    color: leaveFilter === s ? 'var(--primary)' : '#64748b',
                                    boxShadow: leaveFilter === s ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                                    cursor: 'pointer'
                                }}
                            >
                                {s} ({statusCounts[s] || 0})
                            </button>
                        ))}
                    </div>
                    {hasPermission(user, 'HRMS', 'add') && (
                        <button className="btn btn-primary" onClick={() => setIsApplyLeaveOpen(true)}>
                            <Plus size={18} aria-hidden="true" /> APPLY LEAVE
                        </button>
                    )}
                </div>
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
                        {filteredLeaves.length > 0 ? filteredLeaves.slice((leavesPage - 1) * EMP_PAGE_SIZE, leavesPage * EMP_PAGE_SIZE).map((l, i) => (
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
                                    {(canEditHRMS && l.status === 'Pending') && (
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button onClick={() => handleLeaveAction(l.id, 'Approved')} className="btn btn-success btn-sm" style={{ padding: '4px 8px', fontSize: '11px' }}>Approve</button>
                                            <button onClick={() => handleLeaveAction(l.id, 'Rejected')} className="btn btn-outline btn-sm" style={{ padding: '4px 8px', fontSize: '11px', color: '#EF4444' }}>Reject</button>
                                        </div>
                                    )}
                                    {(!canEditHRMS && l.status === 'Pending') && (
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
                <Pagination currentPage={leavesPage} totalItems={filteredLeaves.length} pageSize={EMP_PAGE_SIZE} onPageChange={setLeavesPage} />
            </div>
        </div>
        );
    };

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
                </div>
            </div>

            <div className="card" style={{ padding: 0 }}>
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Emp ID</th>
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
                        {employees.filter(emp => {
                            if ((emp.designation || '').toLowerCase() === 'driver') return false;
                            if (emp.salaryType && emp.salaryType !== 'monthly') return false;
                            return emp.status === 'Active';
                        }).sort((a, b) => (a.employeeCode || '').localeCompare(b.employeeCode || '')).map((emp, i) => {
                            const empId = emp.id || emp._id;
                            const p = payroll.find(pr => pr.employeeId === empId) || {};
                            // Live fallback from monthly attendance for DRAFT rows
                            // (payroll not yet processed → p.totalDays / p.presentDays empty).
                            const attStats = getMonthAttendanceStats(emp);
                            const displayTotalDays = (p.totalDays && p.totalDays > 0) ? p.totalDays : attStats.totalDays;
                            const displayPresentDays = (p.presentDays !== undefined && p.presentDays !== null) ? p.presentDays : attStats.presentDays;
                            return (
                            <tr key={i}>
                                <td style={{ fontWeight: '700', color: 'var(--primary)', fontSize: '12px' }}>{emp.employeeCode || '—'}</td>
                                <td style={{ fontWeight: '600' }}>{emp.fullName}</td>
                                <td>{displayTotalDays} / <span style={{ color: '#10B981', fontWeight: '700' }}>{displayPresentDays}</span></td>
                                <td style={{ color: '#EF4444', fontWeight: '700' }}>{p.lopDays ?? 0}</td>
                                <td style={{ fontSize: '12px' }}>Monthly Basic</td>
                                <td style={{ fontWeight: '800', color: 'var(--primary)' }}>₹{(p.netSalary || parseFloat(emp.basicSalary) || 0).toLocaleString()}</td>
                                <td><span className={`badge ${p.status === 'Processed' || p.status === 'Paid' ? 'badge-success' : 'badge-warning'}`}>{p.status || 'DRAFT'}</span></td>
                                <td>
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                        {p.status !== 'Processed' && p.status !== 'Paid' ? (
                                            (hasPermission(user, 'HRMS', 'edit', 'Payroll') || hasPermission(user, 'HRMS', 'add', 'Payroll')) && (
                                            <button
                                                title="Process Payroll"
                                                onClick={() => {
                                                    setPayrollEmployee({
                                                        ...emp,
                                                        id: empId,
                                                        name: emp.fullName,
                                                        // Pre-populate from live attendance when no payroll
                                                        // record exists yet so the modal opens with real days.
                                                        payrollData: Object.keys(p).length > 0 ? p : {
                                                            month: selectedMonth,
                                                            totalDays: typeof displayTotalDays === 'number' ? displayTotalDays : 0,
                                                            presentDays: typeof displayPresentDays === 'number' ? displayPresentDays : 0,
                                                            lopDays: (typeof displayTotalDays === 'number' && typeof displayPresentDays === 'number')
                                                                ? Math.max(0, displayTotalDays - displayPresentDays)
                                                                : 0,
                                                        }
                                                    });
                                                    setIsProcessPayrollOpen(true);
                                                }}
                                                style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid var(--border)', background: 'white', color: 'var(--primary)', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', transition: 'all 0.15s' }}
                                                onMouseEnter={e => { e.currentTarget.style.background = 'var(--primary)'; e.currentTarget.style.color = 'white'; e.currentTarget.style.borderColor = 'var(--primary)'; }}
                                                onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.color = 'var(--primary)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                                            >
                                                <Edit3 size={14} /> Process
                                            </button>
                                            )
                                        ) : (
                                            <>
                                                <span style={{ padding: '6px 14px', borderRadius: '8px', background: '#f0fdf4', color: '#16a34a', fontSize: '12px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                                    <CheckCircle size={14} /> Processed
                                                </span>
                                                <button
                                                    title="Download Pay Slip"
                                                    onClick={() => downloadPaySlip(emp, p)}
                                                    style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#16a34a', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', transition: 'all 0.15s' }}
                                                    onMouseEnter={e => { e.currentTarget.style.background = '#16a34a'; e.currentTarget.style.color = 'white'; }}
                                                    onMouseLeave={e => { e.currentTarget.style.background = '#f0fdf4'; e.currentTarget.style.color = '#16a34a'; }}
                                                >
                                                    <Download size={14} /> Pay Slip
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ); })}
                        {employees.filter(e => e.status === 'Active' && (e.designation || '').toLowerCase() !== 'driver' && (!e.salaryType || e.salaryType === 'monthly')).length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>No monthly employees found.</td></tr>}
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
                                    {req.status === 'Approved' && canEditHRMS && (
                                        <button
                                            className="btn btn-success btn-sm"
                                            style={{ padding: '6px 12px', fontSize: '11px', fontWeight: '800' }}
                                            onClick={async () => {
                                                if (!(await confirm({ title: 'Confirm Arrangement', message: 'Mark this manpower request as arranged and completed?', confirmText: 'Mark Arranged' }))) return;
                                                try {
                                                    await approvalsAPI.action('manpower', req._id, 'complete');
                                                    toast.success('Manpower arranged successfully!');
                                                    fetchManpowerRequests();
                                                } catch (err) {
                                                    const errorMsg = err.response?.data?.detail || err.message || 'Failed to update status';
                                                    toast.error(`Error: ${errorMsg}`);
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
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '32px', borderBottom: '1px solid var(--border)', marginBottom: '32px', overflowX: 'auto', overflowY: 'hidden', minWidth: 0, maxWidth: '100%', scrollbarWidth: 'thin' }}>
                    {availableTabs.map(tab => (
                        <button
                            key={tab}
                            onClick={() => handleTabChange(tab)}
                            style={{
                                padding: '12px 20px', fontSize: '14px', fontWeight: activeTab === tab ? '700' : '600',
                                color: activeTab === tab ? 'var(--primary)' : 'var(--text-muted)',
                                borderTop: 'none', borderLeft: 'none', borderRight: 'none',
                                borderBottom: activeTab === tab ? '3px solid var(--primary)' : '3px solid transparent',
                                background: activeTab === tab ? 'rgba(37, 99, 235, 0.05)' : 'none',
                                cursor: 'pointer', borderRadius: '8px 8px 0 0', outline: 'none', transition: 'all 0.2s',
                                whiteSpace: 'nowrap', flexShrink: 0,
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
                                    {hasPermission(user, 'HRMS', 'add') && (
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

                                                    {/* Labour Verification from Surprise Visit + cross-reference */}
                                                    {(() => {
                                                        const vl = visit.verified_labour;
                                                        const labRec = labourByProjectDate[`${visit.project_name}||${visit.date}`];
                                                        const hasVerified = vl && vl.length > 0;
                                                        const hasLabRec = labRec && labRec.categories?.length > 0;
                                                        if (!hasVerified && !hasLabRec) return null;
                                                        return (
                                                            <div style={{ marginTop: 14, padding: 12, borderRadius: 10, border: '1px solid #E0E7FF', backgroundColor: '#EFF6FF' }}>
                                                                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: '#1D4ED8', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                                    <Users size={14} /> Labour {hasVerified ? 'Verification' : 'Count'}: {hasLabRec ? labRec.total_count : ''}
                                                                    {hasLabRec && (
                                                                        <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 800, color: '#0F172A' }}>
                                                                            Cost: ₹{(labRec.day_cost || 0).toLocaleString('en-IN')}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                                                    {hasVerified ? vl.map((v, i) => {
                                                                        const match = v.verified;
                                                                        const mismatch = match && v.actual_count !== null && v.actual_count !== v.reported_count;
                                                                        return (
                                                                            <span key={i} style={{
                                                                                fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 6,
                                                                                backgroundColor: match ? (mismatch ? '#FEF3C7' : '#DCFCE7') : '#F1F5F9',
                                                                                color: match ? (mismatch ? '#92400E' : '#15803D') : '#64748B',
                                                                            }}>
                                                                                {v.party ? `${v.party} — ` : ''}{v.category}: {v.reported_count}
                                                                                {match && v.actual_count !== null ? ` → ${v.actual_count}` : ''}
                                                                                {match ? ' ✓' : ''}
                                                                            </span>
                                                                        );
                                                                    }) : labRec.categories.map((c, i) => (
                                                                        <span key={i} style={{
                                                                            fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 6,
                                                                            backgroundColor: '#DBEAFE', color: '#1D4ED8',
                                                                        }}>
                                                                            {c.party ? `${c.party} — ` : ''}{c.category}: {c.count}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}
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

                        {/* === Authorized Users Tab === */}
                        {activeTab === 'Authorized Users' && (
                            <div className="animate-fade-in">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                                    <h3 style={{ fontSize: '18px', fontWeight: '700' }}>Manage System Users</h3>
                                    {/* Add New User button hidden */}
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '24px' }}>
                                    {[
                                        { label: 'Total Users', value: umUsers.length, icon: Shield, color: '#3B82F6' },
                                        { label: 'Super Admins', value: umUsers.filter(u => isAdminRole(u.role)).length, icon: ShieldCheck, color: '#10B981' },
                                        { label: 'Site Engineers', value: umUsers.filter(u => isEngineerRole(u.role)).length, icon: Shield, color: '#F59E0B' },
                                        { label: 'Active Now', value: umUsers.filter(u => u.status === 'Active').length, icon: CheckCircle, color: '#8B5CF6' },
                                    ].map((stat, i) => (
                                        <div key={i} className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px' }}>
                                            <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: `${stat.color}15`, color: stat.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <stat.icon size={20} />
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{stat.label}</div>
                                                <div style={{ fontSize: '20px', fontWeight: '700' }}>{stat.value}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="card" style={{ marginBottom: '24px', padding: '16px' }}>
                                    <div style={{ display: 'flex', gap: '16px' }}>
                                        <div style={{ flex: 1, position: 'relative' }}>
                                            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                            <input type="text" placeholder="Search by name, email or role..." value={umSearchTerm} onChange={(e) => setUmSearchTerm(e.target.value)} style={{ width: '100%', padding: '10px 12px 10px 40px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: '14px' }} />
                                        </div>
                                    </div>
                                </div>

                                <div className="card">
                                    <h3 style={{ marginBottom: '20px', fontSize: '18px' }}>Authorized System Users</h3>
                                    {umLoading ? (
                                        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><Loader2 className="animate-spin" size={32} color="var(--primary)" /></div>
                                    ) : (
                                        <table className="data-table">
                                            <thead><tr><th>User Details</th><th>Role</th><th>Status</th><th>Last Login</th><th>Action</th></tr></thead>
                                            <tbody>
                                                {umUsers.filter(u => u.name.toLowerCase().includes(umSearchTerm.toLowerCase()) || u.role.toLowerCase().includes(umSearchTerm.toLowerCase())).map((u, i) => (
                                                    <tr key={i}>
                                                        <td>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                                <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '600', fontSize: '14px' }}>{u.name.charAt(0)}</div>
                                                                <div>
                                                                    <div style={{ fontWeight: '600', fontSize: '14px' }}>{u.name}</div>
                                                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}><Mail size={12} /> {u.email}</div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <span style={{ padding: '4px 10px', borderRadius: '6px', backgroundColor: 'var(--bg-main)', fontSize: '12px', fontWeight: '600', color: (u.role === 'Super Admin' || u.role === 'Admin') ? 'var(--primary)' : 'var(--text-muted)', border: (u.role === 'Super Admin' || u.role === 'Admin') ? '1px solid var(--primary-light)' : '1px solid var(--border)' }}>{u.role}</span>
                                                        </td>
                                                        <td>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                {u.status === 'Active' ? <CheckCircle size={14} color="#10B981" /> : <XCircle size={14} color="#EF4444" />}
                                                                <span style={{ fontSize: '13px', color: u.status === 'Active' ? '#10B981' : '#EF4444', fontWeight: '500' }}>{u.status}</span>
                                                            </div>
                                                        </td>
                                                        <td style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{u.lastLogin}</td>
                                                        <td style={{ textAlign: 'right', paddingRight: '20px' }}>
                                                            <div style={{ display: 'inline-flex', alignItems: 'center', backgroundColor: '#f8fafc', padding: '4px', borderRadius: '10px', border: '1px solid #e2e8f0', gap: '4px' }}>
                                                                {canEditHRMS && <button onClick={() => handleEditUser(u)} title="Edit User" style={{ padding: '8px', borderRadius: '8px', border: 'none', background: 'transparent', color: 'var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Edit2 size={16} /></button>}
                                                                {canEditHRMS && canDeleteHRMS && <div style={{ width: '1px', height: '16px', backgroundColor: '#e2e8f0' }}></div>}
                                                                {canDeleteHRMS && <button onClick={() => handleDeleteUser(u.id)} title="Delete User" style={{ padding: '8px', borderRadius: '8px', border: 'none', background: 'transparent', color: '#EF4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Trash2 size={16} /></button>}
                                                                <div style={{ width: '1px', height: '16px', backgroundColor: '#e2e8f0' }}></div>
                                                                <div style={{ position: 'relative' }}>
                                                                    <button title="More Options" onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === u.id ? null : u.id); }} style={{ padding: '8px', borderRadius: '8px', border: 'none', background: openMenuId === u.id ? '#F1F5F9' : 'transparent', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MoreVertical size={16} /></button>
                                                                    {openMenuId === u.id && (
                                                                        <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '8px', backgroundColor: 'white', borderRadius: '12px', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)', zIndex: 100, minWidth: '180px', padding: '6px' }}>
                                                                            <div onClick={() => handleToggleUserStatus(u)} style={{ padding: '10px 12px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }} className="dropdown-item-hover">
                                                                                {u.status === 'Active' ? <XCircle size={14} color="#EF4444" /> : <CheckCircle size={14} color="#10B981" />}
                                                                                {u.status === 'Active' ? 'Deactivate User' : 'Activate User'}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {umUsers.length === 0 && <tr><td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No users found in the system.</td></tr>}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* === Roles & Permissions Tab === */}
                        {activeTab === 'Roles & Permissions' && (
                            <div className="animate-fade-in">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                                    <div>
                                        <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '4px' }}>Role Definitions</h3>
                                        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Define access permissions for each role below</p>
                                    </div>
                                    {hasPermission(user, 'HRMS', 'add') && (
                                        <button className="btn btn-primary" style={{ padding: '10px 20px', fontWeight: '800' }} onClick={() => { setEditingRole(null); setIsRoleModalOpen(true); }}>
                                            <Plus size={18} /> CREATE ROLE
                                        </button>
                                    )}
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px', alignItems: 'start' }}>
                                    {umRoles.map((role, idx) => (
                                        <div key={idx} className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                                                <div style={{ flex: 1 }}>
                                                    <h4 style={{ fontSize: '16px', fontWeight: '700' }}>{role.name}</h4>
                                                    <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{role.description}</p>
                                                </div>
                                                {canEditHRMS && (
                                                <div style={{ display: 'flex', gap: '8px', marginLeft: '12px', flexShrink: 0 }}>
                                                    <button onClick={() => { setEditingRole(role); setIsRoleModalOpen(true); }} style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: '600', color: '#0284c7' }}><Edit3 size={14} /> Edit</button>
                                                    {canDeleteHRMS && !isAdminRole(role.name) && (
                                                        <button onClick={() => handleDeleteRole(role.name)} style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: '600', color: '#dc2626' }}><Trash2 size={14} /> Delete</button>
                                                    )}
                                                </div>
                                                )}
                                            </div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
                                                {(role.tags || []).map(tag => (
                                                    <span key={tag} style={{ padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', backgroundColor: tag === 'System' ? '#EFF6FF' : '#f1f5f9', color: tag === 'System' ? '#3B82F6' : 'var(--text-muted)', border: '1px solid var(--border)' }}>{tag}</span>
                                                ))}
                                            </div>
                                            <div style={{ padding: '16px 0', borderTop: '1px solid var(--border)', flex: 1 }}>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                                                    {role.permissions.map(perm => {
                                                        const acts = perm.actions || { view: true, edit: false, delete: false };
                                                        return (
                                                            <div key={perm.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '11px', fontWeight: '600', color: 'var(--text-main)', background: '#f8fafc', minHeight: '38px' }}>
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: 0 }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                        {perm.icon ? <perm.icon size={12} style={{ color: 'var(--primary)', flexShrink: 0 }} /> : <Shield size={12} style={{ color: 'var(--primary)', flexShrink: 0 }} />}
                                                                        <span style={{ fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{perm.name}</span>
                                                                    </div>
                                                                    {perm.subTabs && perm.subTabs.length > 0 && (
                                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', paddingLeft: '18px' }}>
                                                                            {perm.subTabs.map(st => (
                                                                                <span key={st} style={{ fontSize: '9px', padding: '1px 4px', backgroundColor: '#e2e8f0', borderRadius: '3px', color: 'var(--text-muted)' }}>{st}</span>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div style={{ display: 'flex', gap: '4px', flexShrink: 0, marginLeft: '6px' }}>
                                                                    <span style={{ fontSize: '10px', fontWeight: '700', color: acts.view ? '#10B981' : '#CBD5E1' }}>V</span>
                                                                    <span style={{ fontSize: '10px', fontWeight: '700', color: acts.edit ? '#F59E0B' : '#CBD5E1' }}>E</span>
                                                                    <span style={{ fontSize: '10px', fontWeight: '700', color: acts.delete ? '#EF4444' : '#CBD5E1' }}>D</span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* User Management Modals */}
            <CreateRoleModal
                isOpen={isRoleModalOpen}
                onClose={() => { setIsRoleModalOpen(false); setEditingRole(null); }}
                onRoleCreated={handleRoleCreated}
                initialData={editingRole}
            />
            {isAddUserModalOpen && (
                <div className="modal-overlay">
                    <div className="card animate-fade-in" style={{ width: '450px', padding: '32px', maxHeight: '90vh', overflowY: 'auto' }}>
                        <h3 style={{ marginBottom: '24px' }}>{editingUser ? 'Edit System User' : 'Create New System User'}</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600' }}>Full Name *</label>
                                <input placeholder="Enter full name" value={newUser.fullName} onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600' }}>User Code / ID *</label>
                                <input placeholder="e.g. EMP1001" value={newUser.employeeCode} onChange={(e) => setNewUser({ ...newUser, employeeCode: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600' }}>Email Address</label>
                                <input placeholder="email@example.com" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: '600' }}>Assign Role</label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                    {umRoles.map(r => r.name).map(role => (
                                        <div key={role} style={{ padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', backgroundColor: newUser.roles.includes(role) ? 'var(--primary)' : '#f1f5f9', color: newUser.roles.includes(role) ? 'white' : 'var(--text-muted)', border: newUser.roles.includes(role) ? '1px solid var(--primary)' : '1px solid var(--border)' }} onClick={() => setNewUser({ ...newUser, roles: [role] })}>{role}</div>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: '600' }}>{editingUser ? 'New Password (Optional)' : 'Initial Password *'}</label>
                                {editingUser && <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>Leave blank to keep current password</p>}
                                <input type="password" placeholder="••••••••" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }} />
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
                            <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => { setIsAddUserModalOpen(false); setEditingUser(null); }}>Cancel</button>
                            <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleCreateUser}>{editingUser ? 'Update User' : 'Create User'}</button>
                        </div>
                    </div>
                </div>
            )}

            <AddEmployeeModal
                isOpen={isAddEmployeeOpen}
                onClose={() => {
                    setIsAddEmployeeOpen(false);
                    setEditingEmployee(null);
                }}
                onEmployeeAdded={fetchInitialData}
                roles={getRoles()}
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
                onConfirm={() => {
                    fetchPayroll(selectedMonth);
                }}
            />
        </div>
    );
};

export default HRMS;

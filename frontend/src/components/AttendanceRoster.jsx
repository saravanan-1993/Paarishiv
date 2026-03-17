import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Users, Calendar as CalendarIcon, Loader2, Download, Search } from 'lucide-react';
import { hrmsAPI } from '../utils/api';

const AttendanceRoster = ({ employees, selectedSite }) => {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [monthlyRecords, setMonthlyRecords] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const numDays = new Date(year, month + 1, 0).getDate();
    const monthName = currentMonth.toLocaleString('default', { month: 'long' });

    const days = useMemo(() => Array.from({ length: numDays }, (_, i) => i + 1), [numDays]);

    const fetchMonthlyData = async () => {
        setLoading(true);
        try {
            const firstDay = `${year}-${(month + 1).toString().padStart(2, '0')}-01`;
            const lastDay = `${year}-${(month + 1).toString().padStart(2, '0')}-${numDays}`;
            const res = await hrmsAPI.getAttendanceRange(firstDay, lastDay);
            setMonthlyRecords(res.data || []);
        } catch (err) {
            console.error("Failed to fetch monthly roster", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMonthlyData();
    }, [currentMonth]);

    const filteredEmployees = useMemo(() => {
        return employees.filter(emp => {
            const matchesSite = selectedSite === 'All' || emp.siteName === selectedSite;
            const matchesSearch = emp.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                 emp.employeeCode?.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesSite && matchesSearch;
        });
    }, [employees, selectedSite, searchQuery]);

    const getStatusFlag = (empId, empCode, day) => {
        const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        const record = monthlyRecords.find(r => 
            (r.date === dateStr) && 
            (r.employeeId === empId || r.employeeId === empCode || r.username === empCode || r.user_id === empId)
        );

        if (!record) return null;

        const status = record.status;
        if (status === 'Present') return { char: 'P', color: '#16a34a', bg: '#f0fdf4' };
        if (status === 'Absent') return { char: 'A', color: '#dc2626', bg: '#fef2f2' };
        if (status === 'Leave') return { char: 'L', color: '#2563eb', bg: '#eff6ff' };
        if (status === 'Half Day') return { char: 'H', color: '#d97706', bg: '#fffbeb' };
        return null;
    };

    return (
        <div className="card animate-fade-in" style={{ padding: '24px', backgroundColor: 'white', borderRadius: '20px', boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: '#EFF6FF', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Users size={24} />
                    </div>
                    <div>
                        <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>Monthly Attendance Roster</h3>
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>{monthName} {year} • {selectedSite === 'All' ? 'All Sites' : selectedSite}</p>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ position: 'relative', width: '250px' }}>
                        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input 
                            type="text" 
                            placeholder="Filter by name..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{ width: '100%', padding: '8px 12px 8px 36px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px' }}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '8px', border: '1px solid var(--border)', borderRadius: '10px', padding: '4px' }}>
                        <button onClick={() => setCurrentMonth(new Date(year, month - 1, 1))} className="icon-btn" style={{ padding: '6px' }}><ChevronLeft size={18} /></button>
                        <button onClick={() => setCurrentMonth(new Date())} style={{ fontSize: '12px', fontWeight: '800', padding: '0 12px', color: 'var(--primary)' }}>Today</button>
                        <button onClick={() => setCurrentMonth(new Date(year, month + 1, 1))} className="icon-btn" style={{ padding: '6px' }}><ChevronRight size={18} /></button>
                    </div>
                </div>
            </div>

            <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '12px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '2px solid var(--border)' }}>
                            <th style={{ position: 'sticky', left: 0, backgroundColor: '#F8FAFC', zIndex: 10, padding: '16px', textAlign: 'left', minWidth: '200px', borderRight: '2px solid var(--border)', fontWeight: '800', color: '#475569' }}>Employee Name</th>
                            {days.map(d => (
                                <th key={d} style={{ padding: '12px', textAlign: 'center', minWidth: '36px', fontWeight: '800', color: '#64748b', borderRight: '1px solid #e2e8f0' }}>
                                    {d}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={days.length + 1} style={{ padding: '60px', textAlign: 'center' }}>
                                    <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 12px', color: 'var(--primary)' }} />
                                    <p style={{ fontWeight: '600', color: 'var(--text-muted)' }}>Generating Roster...</p>
                                </td>
                            </tr>
                        ) : filteredEmployees.length === 0 ? (
                            <tr>
                                <td colSpan={days.length + 1} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No employees found for selection.</td>
                            </tr>
                        ) : filteredEmployees.map((emp, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F1F5F9'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                                <td style={{ position: 'sticky', left: 0, backgroundColor: 'white', zIndex: 9, padding: '12px 16px', borderRight: '2px solid var(--border)', fontWeight: '700' }}>
                                    <div>{emp.fullName}</div>
                                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '500' }}>{emp.employeeCode} • {emp.designation}</div>
                                </td>
                                {days.map(d => {
                                    const status = getStatusFlag(emp.id || emp._id, emp.employeeCode, d);
                                    return (
                                        <td key={d} style={{ padding: '8px', textAlign: 'center', borderRight: '1px solid #f1f5f9' }}>
                                            {status ? (
                                                <div style={{ 
                                                    width: '26px', height: '26px', borderRadius: '6px', margin: '0 auto',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    backgroundColor: status.bg, color: status.color,
                                                    fontWeight: '900', fontSize: '11px', border: `1px solid ${status.color}20`
                                                }}>
                                                    {status.char}
                                                </div>
                                            ) : (
                                                <span style={{ color: '#cbd5e1' }}>-</span>
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div style={{ marginTop: '24px', display: 'flex', gap: '20px', flexWrap: 'wrap', padding: '16px', backgroundColor: '#F8FAFC', borderRadius: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontWeight: '700' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#f0fdf4', border: '1px solid #16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a' }}>P</div>
                    <span>Present</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontWeight: '700' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#fef2f2', border: '1px solid #dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626' }}>A</div>
                    <span>Absent</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontWeight: '700' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#eff6ff', border: '1px solid #2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>L</div>
                    <span>Leave</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontWeight: '700' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#fffbeb', border: '1px solid #d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d97706' }}>H</div>
                    <span>Half Day</span>
                </div>
            </div>
        </div>
    );
};

export default AttendanceRoster;

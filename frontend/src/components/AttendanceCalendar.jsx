import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, CheckCircle, XCircle, Clock, Calendar, Users } from 'lucide-react';
import { hrmsAPI } from '../utils/api';

const AttendanceCalendar = ({ employeeId, employeeName, employeeCode }) => {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [attendanceDays, setAttendanceDays] = useState({});
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState({ present: 0, absent: 0, leave: 0, halfDay: 0 });

    const fetchMonthData = async () => {
        if (!employeeId) return;
        setLoading(true);
        try {
            const year = currentMonth.getFullYear();
            const month = currentMonth.getMonth();
            const firstDay = new Date(year, month, 1).toISOString().split('T')[0];
            const lastDay = new Date(year, month + 1, 0).toISOString().split('T')[0];
            
            const res = await hrmsAPI.getAttendanceRange(firstDay, lastDay);
            // Filter for specific employee
            const empRecords = (res.data || []).filter(r => 
                r.employeeId === employeeId || 
                r.user_id === employeeId || 
                r.username === employeeId ||
                r.employeeCode === employeeCode ||
                r.employeeId === employeeCode ||
                r.username === employeeCode
            );
            
            const mapped = {};
            const newStats = { present: 0, absent: 0, leave: 0, halfDay: 0 };
            empRecords.forEach(r => {
                mapped[r.date] = r;
                if (r.status === 'Present') newStats.present++;
                if (r.status === 'Absent') newStats.absent++;
                if (r.status === 'Leave') newStats.leave++;
                if (r.status === 'Half Day') newStats.halfDay++;
            });
            setAttendanceDays(mapped);
            setStats(newStats);
        } catch (err) {
            console.error("Failed to fetch calendar data", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMonthData();
    }, [currentMonth, employeeId, employeeCode]);

    const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
    const startDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

    const renderHeader = () => {
        const monthName = currentMonth.toLocaleString('default', { month: 'long' });
        const year = currentMonth.getFullYear();

        return (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ 
                        width: '40px', height: '40px', borderRadius: '10px', 
                        backgroundColor: '#EFF6FF', color: '#2563EB', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center' 
                    }}>
                        <Calendar size={20} />
                    </div>
                    <div>
                        <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>
                            {monthName} {year}
                        </h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>{employeeName}</p>
                            <span style={{ color: '#E2E8F0' }}>•</span>
                            <div style={{ display: 'flex', gap: '8px', fontSize: '12px', fontWeight: '800' }}>
                                <span style={{ backgroundColor: '#f0fdf4', color: '#16a34a', padding: '2px 8px', borderRadius: '12px', border: '1px solid #bbf7d0' }}>{stats.present}P</span>
                                <span style={{ backgroundColor: '#fef2f2', color: '#dc2626', padding: '2px 8px', borderRadius: '12px', border: '1px solid #fecaca' }}>{stats.absent}A</span>
                                <span style={{ backgroundColor: '#eff6ff', color: '#2563eb', padding: '2px 8px', borderRadius: '12px', border: '1px solid #bfdbfe' }}>{stats.leave}L</span>
                                <span style={{ backgroundColor: '#fffbeb', color: '#d97706', padding: '2px 8px', borderRadius: '12px', border: '1px solid #fef3c7' }}>{stats.halfDay}H</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button 
                        onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
                        className="btn btn-outline" style={{ padding: '8px', borderRadius: '8px' }}
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <button 
                        onClick={() => setCurrentMonth(new Date())}
                        className="btn btn-outline" style={{ fontSize: '12px', padding: '8px 16px', fontWeight: '700' }}
                    >
                        Today
                    </button>
                    <button 
                        onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
                        className="btn btn-outline" style={{ padding: '8px', borderRadius: '8px' }}
                    >
                        <ChevronRight size={18} />
                    </button>
                </div>
            </div>
        );
    };

    const renderDays = () => {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px', backgroundColor: 'var(--border)', border: '1px solid var(--border)', borderRadius: '12px 12px 0 0', overflow: 'hidden' }}>
                {days.map(day => (
                    <div key={day} style={{ textAlign: 'center', fontWeight: '800', color: '#64748b', fontSize: '11px', padding: '12px 0', backgroundColor: '#F8FAFC', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {day}
                    </div>
                ))}
            </div>
        );
    };

    const renderCells = () => {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const numDays = daysInMonth(year, month);
        const startDay = startDayOfMonth(year, month);
        const cells = [];

        // Padding for week start
        for (let i = 0; i < startDay; i++) {
            cells.push(<div key={`empty-${i}`} style={{ backgroundColor: 'white', borderBottom: '1px solid #f1f5f9', borderRight: '1px solid #f1f5f9' }}></div>);
        }

        const today = new Date().toISOString().split('T')[0];

        for (let day = 1; day <= numDays; day++) {
            const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
            const record = attendanceDays[dateStr];
            const isToday = dateStr === today;
            
            let color = 'white';
            let textColor = '#1e293b';
            let statusBadge = null;

            if (record) {
                if (record.status === 'Present') {
                    statusBadge = <div style={{ background: '#10B981', width: '6px', height: '6px', borderRadius: '50%' }}></div>;
                    color = '#f0fdf4';
                } else if (record.status === 'Absent') {
                    statusBadge = <div style={{ background: '#EF4444', width: '6px', height: '6px', borderRadius: '50%' }}></div>;
                    color = '#fef2f2';
                } else if (record.status === 'Leave') {
                    statusBadge = <div style={{ background: '#3B82F6', width: '6px', height: '6px', borderRadius: '50%' }}></div>;
                    color = '#eff6ff';
                } else if (record.status === 'Half Day') {
                    statusBadge = <div style={{ background: '#F59E0B', width: '6px', height: '6px', borderRadius: '50%' }}></div>;
                    color = '#fffbeb';
                }
            }

            cells.push(
                <div 
                    key={day} 
                    style={{ 
                        height: '110px', 
                        backgroundColor: isToday ? '#FBFCFF' : color, 
                        padding: '12px',
                        borderBottom: '1px solid #f1f5f9',
                        borderRight: '1px solid #f1f5f9',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        transition: 'all 0.2s',
                        cursor: record ? 'pointer' : 'default',
                        boxShadow: isToday ? 'inset 0 0 0 2px var(--primary)' : 'none',
                        position: 'relative'
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ 
                            fontWeight: '800', 
                            fontSize: '15px', 
                            color: isToday ? 'var(--primary)' : '#475569' 
                        }}>
                            {day}
                        </span>
                        {statusBadge}
                    </div>
                    
                    {record && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ 
                                fontSize: '10px', 
                                fontWeight: '800', 
                                color: textColor,
                                textTransform: 'uppercase',
                                letterSpacing: '0.02em',
                                opacity: 0.8
                            }}>
                                {record.status}
                            </div>
                            {record.checkIn && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '9px', fontWeight: '600', color: '#64748b' }}>
                                    <Clock size={10} /> {record.checkIn} {record.checkOut ? `- ${record.checkOut}` : ''}
                                </div>
                            )}
                        </div>
                    )}
                    
                    {!record && !isToday && new Date(dateStr) < new Date() && (
                        <div style={{ fontSize: '10px', color: '#cbd5e1', fontWeight: '600' }}>No Record</div>
                    )}
                </div>
            );
        }

        return (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', backgroundColor: '#f1f5f9', border: '1px solid #f1f5f9', borderTop: 'none', borderRadius: '0 0 12px 12px', overflow: 'hidden' }}>
                {cells}
            </div>
        );
    };

    return (
        <div className="attendance-calendar-v2 animate-fade-in" style={{ backgroundColor: 'white', borderRadius: '20px', padding: '24px', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}>
            {renderHeader()}
            
            {loading ? (
                <div style={{ height: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                    <div className="loader" style={{ width: '40px', height: '40px', border: '3px solid #f3f3f3', borderTop: '3px solid var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                    <p style={{ fontWeight: '600', color: 'var(--text-muted)' }}>Fetching attendance data...</p>
                </div>
            ) : (
                <>
                    {renderDays()}
                    {renderCells()}
                </>
            )}
            
            <div style={{ 
                marginTop: '24px', 
                padding: '16px', 
                backgroundColor: '#F8FAFC', 
                borderRadius: '12px',
                display: 'flex', 
                justifyContent: 'center',
                gap: '24px', 
                flexWrap: 'wrap' 
            }}>
                {[
                    { label: 'Present', color: '#10B981', bg: '#f0fdf4' },
                    { label: 'Absent', color: '#EF4444', bg: '#fef2f2' },
                    { label: 'Leave', color: '#3B82F6', bg: '#eff6ff' },
                    { label: 'Half Day', color: '#F59E0B', bg: '#fffbeb' }
                ].map(item => (
                    <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: '700', color: '#475569' }}>
                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: item.color }}></div>
                        {item.label}
                    </div>
                ))}
            </div>

            <style>{`
                @keyframes spin { 
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default AttendanceCalendar;

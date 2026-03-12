import React from 'react';
import { Clock, Activity, Coffee, Briefcase as BriefcaseIcon, UserCircle, ChevronDown } from 'lucide-react';

const AttendanceWidget = ({
    attendanceStatus,
    isClocking,
    timer,
    formatTimer,
    handleClockAction,
    isAwayMenuOpen,
    setIsAwayMenuOpen
}) => {
    return (
        <div className="card attendance-widget" style={{ padding: '24px', marginBottom: '32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Clock size={20} className="text-primary" /> My Attendance
                </h3>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    {!attendanceStatus?.current_session || attendanceStatus.current_session.check_out ? (
                        <button
                            className="btn"
                            disabled={isClocking}
                            onClick={() => handleClockAction('in')}
                            style={{ backgroundColor: '#10B981', color: 'white' }}
                        >
                            Clock In
                        </button>
                    ) : (
                        <>
                            {attendanceStatus.current_session.on_break ? (
                                <button
                                    className="btn"
                                    disabled={isClocking}
                                    onClick={() => handleClockAction('break-end')}
                                    style={{ backgroundColor: '#F59E0B', color: 'white' }}
                                >
                                    Return / Resume
                                </button>
                            ) : (
                                <div style={{ position: 'relative' }}>
                                    <button
                                        className="btn btn-outline"
                                        onClick={(e) => { e.stopPropagation(); setIsAwayMenuOpen(!isAwayMenuOpen); }}
                                        disabled={isClocking}
                                        style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '150px' }}
                                    >
                                        <Activity size={18} /> Mark Away... <ChevronDown size={16} />
                                    </button>
                                    {isAwayMenuOpen && (
                                        <div style={{
                                            position: 'absolute',
                                            top: 'calc(100% + 8px)',
                                            right: '0',
                                            backgroundColor: 'white',
                                            borderRadius: '12px',
                                            padding: '8px',
                                            zIndex: 100,
                                            boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                                            border: '1px solid var(--border)',
                                            minWidth: '220px'
                                        }}>
                                            {[
                                                { label: 'Tea / Lunch Break', value: 'Break', icon: <Coffee size={16} />, color: '#B45309' },
                                                { label: 'Official Duty', value: 'Official Duty', icon: <BriefcaseIcon size={16} />, color: '#1D4ED8' },
                                                { label: 'Permission (Personal)', value: 'Permission', icon: <UserCircle size={16} />, color: '#6D28D9' }
                                            ].map((opt) => (
                                                <button
                                                    key={opt.value}
                                                    onClick={() => {
                                                        setIsAwayMenuOpen(false);
                                                        handleClockAction('break-start', { type: opt.value });
                                                    }}
                                                    style={{
                                                        width: '100%', textAlign: 'left', padding: '12px', borderRadius: '8px', fontSize: '13px',
                                                        background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
                                                        gap: '12px', color: 'var(--text-main)', fontWeight: '600'
                                                    }}
                                                >
                                                    <span style={{ color: opt.color }}>{opt.icon}</span>
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                            <button
                                className="btn"
                                disabled={isClocking}
                                onClick={() => handleClockAction('out')}
                                style={{ backgroundColor: '#EF4444', color: 'white' }}
                            >
                                Clock Out
                            </button>
                        </>
                    )}
                </div>
            </div>

            {!attendanceStatus?.current_session || attendanceStatus.current_session.check_out ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>You haven't clocked in today yet.</p>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '20px', borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
                    <div>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '4px', textTransform: 'uppercase' }}>Work Time</p>
                        <p style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-main)' }}>{formatTimer(timer.work)}</p>
                    </div>
                    <div>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '4px', textTransform: 'uppercase' }}>Away Time</p>
                        <p style={{ fontSize: '24px', fontWeight: '800', color: '#F59E0B' }}>{formatTimer(timer.break)}</p>
                    </div>
                    {timer.official > 0 && (
                        <div>
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '4px', textTransform: 'uppercase' }}>Official Duty</p>
                            <p style={{ fontSize: '24px', fontWeight: '800', color: '#3B82F6' }}>{formatTimer(timer.official)}</p>
                        </div>
                    )}
                    <div>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '4px', textTransform: 'uppercase' }}>Logged in at</p>
                        <p style={{ fontSize: '18px', fontWeight: '800', color: 'var(--primary)' }}>
                            {attendanceStatus?.current_session?.check_in ?
                                new Date(attendanceStatus.current_session.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
                                : '--:--'}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AttendanceWidget;

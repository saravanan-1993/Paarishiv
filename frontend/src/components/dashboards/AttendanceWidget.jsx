import React from 'react';
import { Clock } from 'lucide-react';

const formatClockTime = (isoStr) => {
    if (!isoStr) return '--:--';
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return '--:--';
    const h = d.getHours();
    const m = d.getMinutes();
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${ampm}`;
};

const AttendanceWidget = ({
    attendanceStatus,
    isClocking,
    timer,
    formatTimer,
    handleClockAction
}) => {
    const session = attendanceStatus?.current_session;
    const notClockedIn = !session || session.check_out;

    return (
        <div className="card attendance-widget" style={{ padding: '24px', marginBottom: '32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Clock size={20} className="text-primary" /> My Attendance
                </h3>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    {notClockedIn ? (
                        <button
                            className="btn"
                            disabled={isClocking}
                            onClick={() => handleClockAction('in')}
                            style={{ backgroundColor: '#10B981', color: 'white' }}
                        >
                            Clock In
                        </button>
                    ) : (
                        <button
                            className="btn"
                            disabled={isClocking}
                            onClick={() => handleClockAction('out')}
                            style={{ backgroundColor: '#EF4444', color: 'white' }}
                        >
                            Clock Out
                        </button>
                    )}
                </div>
            </div>

            {notClockedIn ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>You haven't clocked in today yet.</p>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '20px', borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
                    <div>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '4px', textTransform: 'uppercase' }}>Work Time</p>
                        <p style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-main)' }}>{formatTimer(timer.work)}</p>
                    </div>
                    <div>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '4px', textTransform: 'uppercase' }}>Logged in at</p>
                        <p style={{ fontSize: '18px', fontWeight: '800', color: 'var(--primary)' }}>
                            {formatClockTime(session?.check_in)}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AttendanceWidget;

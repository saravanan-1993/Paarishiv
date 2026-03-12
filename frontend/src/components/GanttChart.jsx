import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const STATUS_COLORS = {
    'Completed': { bar: '#10B981', bg: '#ECFDF5', text: '#065F46' },
    'In Progress': { bar: '#3B82F6', bg: '#EFF6FF', text: '#1E40AF' },
    'Pending': { bar: '#F59E0B', bg: '#FFFBEB', text: '#92400E' },
    'On Hold': { bar: '#EF4444', bg: '#FEF2F2', text: '#991B1B' },
    'Delayed': { bar: '#EF4444', bg: '#FEF2F2', text: '#991B1B' },
};

/**
 * GanttChart component
 * Props:
 *   tasks: Array<{ id, name, assignedTo, status, startDate, endDate, priority }>
 *   projectStart: Date  (project start month — sets the left edge of the chart)
 *   months: number      (how many months to display, default 12)
 */
const GanttChart = ({ tasks = [], projectStart, months = 12 }) => {
    const [offset, setOffset] = useState(0);          // pan left/right by months
    const [hoveredTask, setHoveredTask] = useState(null);

    // anchor reference: first day of the visible window
    const anchorDate = projectStart ? new Date(projectStart) : new Date();
    anchorDate.setDate(1);
    anchorDate.setMonth(anchorDate.getMonth() + offset);

    const visibleMonths = Array.from({ length: months }, (_, i) => {
        const d = new Date(anchorDate);
        d.setMonth(d.getMonth() + i);
        return d;
    });

    const totalDays = visibleMonths.reduce((acc, m) => {
        return acc + new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
    }, 0);

    const windowStart = visibleMonths[0];
    const windowEnd = new Date(visibleMonths[months - 1]);
    windowEnd.setMonth(windowEnd.getMonth() + 1);
    windowEnd.setDate(0); // last day of last visible month

    // Convert a date to a percentage position across the window
    const dateToPercent = (date) => {
        const d = new Date(date);
        const msTotal = windowEnd - windowStart;
        const msOffset = Math.min(Math.max(d - windowStart, 0), msTotal);
        return (msOffset / msTotal) * 100;
    };

    // Clamp bar between 0% and 100%
    const getBarStyle = (start, end, status) => {
        const s = dateToPercent(new Date(start));
        const e = dateToPercent(new Date(end));
        const width = Math.max(e - s, 1.5); // min 1.5% width for tiny tasks
        const colors = STATUS_COLORS[status] || STATUS_COLORS['Pending'];
        return { left: `${s}%`, width: `${width}%`, backgroundColor: colors.bar };
    };

    // Is any part of the task in the visible window?
    const isVisible = (start, end) => {
        const s = new Date(start);
        const e = new Date(end);
        return e >= windowStart && s <= windowEnd;
    };

    const today = new Date();
    const todayPercent = dateToPercent(today);

    return (
        <div style={{ width: '100%', overflowX: 'hidden', userSelect: 'none' }}>
            {/* Navigation controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-muted)' }}>
                    {MONTHS[windowStart.getMonth()]} {windowStart.getFullYear()} — {MONTHS[windowEnd.getMonth()]} {windowEnd.getFullYear()}
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        onClick={() => setOffset(o => o - 3)}
                        style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <button
                        onClick={() => setOffset(0)}
                        style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', fontSize: '12px', fontWeight: '700' }}
                    >
                        Today
                    </button>
                    <button
                        onClick={() => setOffset(o => o + 3)}
                        style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr' }}>
                {/* Left column: Task names */}
                <div>
                    {/* Header spacer */}
                    <div style={{ height: '40px', borderBottom: '1px solid var(--border)', backgroundColor: '#F8FAFC' }} />
                    {tasks.map((task, i) => {
                        const colors = STATUS_COLORS[task.status] || STATUS_COLORS['Pending'];
                        return (
                            <div
                                key={task.id}
                                style={{
                                    height: '44px', display: 'flex', alignItems: 'center', gap: '10px',
                                    padding: '0 12px', borderBottom: '1px solid #F1F5F9',
                                    backgroundColor: hoveredTask === task.id ? '#F8FAFC' : 'white',
                                    cursor: 'default', transition: 'background 0.15s'
                                }}
                                onMouseEnter={() => setHoveredTask(task.id)}
                                onMouseLeave={() => setHoveredTask(null)}
                            >
                                <span style={{
                                    width: '8px', height: '8px', borderRadius: '50%',
                                    backgroundColor: colors.bar, flexShrink: 0
                                }} />
                                <div style={{ overflow: 'hidden' }}>
                                    <div style={{ fontSize: '13px', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {task.name}
                                    </div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                        {task.assignedTo}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Right column: Timeline bars */}
                <div style={{ position: 'relative', overflow: 'hidden' }}>
                    {/* Month headers */}
                    <div style={{ display: 'flex', height: '40px', borderBottom: '1px solid var(--border)', backgroundColor: '#F8FAFC' }}>
                        {visibleMonths.map((m, i) => (
                            <div
                                key={i}
                                style={{
                                    flex: new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate(),
                                    borderRight: '1px solid var(--border)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)',
                                    backgroundColor: m.getMonth() === today.getMonth() && m.getFullYear() === today.getFullYear()
                                        ? '#EFF6FF' : 'transparent'
                                }}
                            >
                                {MONTHS[m.getMonth()]} '{String(m.getFullYear()).slice(2)}
                            </div>
                        ))}
                    </div>

                    {/* Task rows */}
                    {tasks.map((task, i) => (
                        <div
                            key={task.id}
                            style={{
                                height: '44px', position: 'relative', display: 'flex', alignItems: 'center',
                                borderBottom: '1px solid #F1F5F9',
                                backgroundColor: hoveredTask === task.id ? '#F8FAFC' : (i % 2 === 0 ? 'white' : '#FAFAFA'),
                                transition: 'background 0.15s'
                            }}
                            onMouseEnter={() => setHoveredTask(task.id)}
                            onMouseLeave={() => setHoveredTask(null)}
                        >
                            {/* Vertical month grid lines */}
                            {visibleMonths.map((m, mi) => {
                                const left = (visibleMonths.slice(0, mi).reduce((acc, mm) => {
                                    return acc + new Date(mm.getFullYear(), mm.getMonth() + 1, 0).getDate();
                                }, 0) / totalDays) * 100;
                                return (
                                    <div key={mi} style={{
                                        position: 'absolute', left: `${left}%`, top: 0, bottom: 0,
                                        width: '1px', backgroundColor: '#E2E8F0', pointerEvents: 'none'
                                    }} />
                                );
                            })}

                            {/* Today line */}
                            {todayPercent >= 0 && todayPercent <= 100 && (
                                <div style={{
                                    position: 'absolute', left: `${todayPercent}%`, top: 0, bottom: 0,
                                    width: '2px', backgroundColor: '#EF4444', opacity: 0.6, pointerEvents: 'none', zIndex: 2
                                }} />
                            )}

                            {/* Task bar */}
                            {isVisible(task.startDate, task.endDate) && (
                                <div
                                    title={`${task.name}\n${task.startDate} → ${task.endDate}\nStatus: ${task.status}`}
                                    style={{
                                        position: 'absolute',
                                        ...getBarStyle(task.startDate, task.endDate, task.status),
                                        height: '22px',
                                        borderRadius: '6px',
                                        display: 'flex', alignItems: 'center', paddingLeft: '8px',
                                        fontSize: '11px', fontWeight: '700', color: 'white',
                                        overflow: 'hidden', whiteSpace: 'nowrap',
                                        transition: 'opacity 0.15s',
                                        opacity: hoveredTask === task.id ? 1 : 0.85,
                                        cursor: 'pointer',
                                        zIndex: 1,
                                        boxShadow: hoveredTask === task.id ? '0 2px 8px rgba(0,0,0,0.2)' : 'none',
                                    }}
                                >
                                    {task.name}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', gap: '24px', marginTop: '20px', flexWrap: 'wrap' }}>
                {Object.entries(STATUS_COLORS).map(([status, colors]) => (
                    <div key={status} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                        <div style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: colors.bar }} />
                        <span style={{ color: 'var(--text-muted)', fontWeight: '600' }}>{status}</span>
                    </div>
                ))}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '1px', backgroundColor: '#EF4444', opacity: 0.6 }} />
                    <span style={{ color: 'var(--text-muted)', fontWeight: '600' }}>Today</span>
                </div>
            </div>
        </div>
    );
};

export default GanttChart;

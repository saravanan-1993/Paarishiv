import React, { useState, useEffect } from 'react';
import { History, Search, Filter, Clock, Download, AlertTriangle, Shield, CheckCircle, RefreshCw, Trash2, Loader2, Info } from 'lucide-react';
import { logsAPI } from '../utils/api';
import Pagination from '../components/Pagination';

const TYPE_CONFIG = {
    info:    { icon: History,       color: '#3B82F6', bg: '#EFF6FF', label: 'Info' },
    success: { icon: CheckCircle,   color: '#10B981', bg: '#ECFDF5', label: 'Success' },
    warning: { icon: AlertTriangle, color: '#F59E0B', bg: '#FFFBEB', label: 'Warning' },
    danger:  { icon: Shield,        color: '#EF4444', bg: '#FEF2F2', label: 'Critical' },
};

function timeAgo(isoString) {
    if (!isoString) return '—';
    const diff = Date.now() - new Date(isoString).getTime();
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days  = Math.floor(diff / 86400000);
    if (mins  < 1)  return 'Just now';
    if (mins  < 60) return `${mins} min${mins !== 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    if (days  < 7)  return `${days} day${days !== 1 ? 's' : ''} ago`;
    return new Date(isoString).toLocaleDateString();
}

const Logs = () => {
    const [logs, setLogs]           = useState([]);
    const [loading, setLoading]     = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState('All');
    const [showFilters, setShowFilters] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const PAGE_SIZE = 20;

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const res = await logsAPI.getLogs(200);
            setLogs(res.data || []);
        } catch (err) {
            console.error('Failed to fetch logs', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchLogs(); }, []);

    useEffect(() => { setCurrentPage(1); }, [searchTerm, typeFilter]);

    const filtered = logs.filter(log => {
        const matchType   = typeFilter === 'All' || log.type === typeFilter;
        const q = searchTerm.toLowerCase();
        const matchSearch = !q ||
            log.action?.toLowerCase().includes(q) ||
            log.username?.toLowerCase().includes(q) ||
            log.details?.toLowerCase().includes(q);
        return matchType && matchSearch;
    });

    const exportCSV = () => {
        const header = 'Timestamp,User,Action,Details,Type\n';
        const rows = filtered.map(l =>
            `"${l.timestamp || ''}","${l.username || ''}","${l.action || ''}","${l.details || ''}","${l.type || ''}"`
        ).join('\n');
        const blob = new Blob([header + rows], { type: 'text/csv' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url; a.download = `system_logs_${new Date().toISOString().slice(0,10)}.csv`; a.click();
        URL.revokeObjectURL(url);
    };

    const logCounts = {
        info:    logs.filter(l => l.type === 'info').length,
        success: logs.filter(l => l.type === 'success').length,
        warning: logs.filter(l => l.type === 'warning').length,
        danger:  logs.filter(l => l.type === 'danger').length,
    };

    return (
        <div className="animate-fade-in" style={{ padding: '0 10px 40px 10px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
                <div>
                    <h1 style={{ fontSize: '32px', fontWeight: '800', color: 'var(--text-main)', marginBottom: '4px' }}>System Logs</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '15px' }}>Real-time audit trail of all system activities and security events.</p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        className="btn btn-outline"
                        onClick={fetchLogs}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        <RefreshCw size={16} /> Refresh
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '28px' }}>
                {Object.entries(TYPE_CONFIG).map(([key, cfg]) => {
                    const Icon = cfg.icon;
                    return (
                        <div
                            key={key}
                            className="card"
                            onClick={() => setTypeFilter(typeFilter === key ? 'All' : key)}
                            style={{
                                padding: '18px 20px',
                                display: 'flex',
                                gap: '14px',
                                alignItems: 'center',
                                borderTop: `4px solid ${cfg.color}`,
                                borderRadius: '12px',
                                cursor: 'pointer',
                                outline: typeFilter === key ? `2px solid ${cfg.color}` : 'none',
                                transition: 'all 0.2s ease',
                            }}
                        >
                            <div style={{
                                width: '42px', height: '42px', borderRadius: '10px',
                                backgroundColor: cfg.bg, color: cfg.color,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                            }}>
                                <Icon size={20} />
                            </div>
                            <div>
                                <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '2px' }}>{cfg.label}</p>
                                <h4 style={{ fontSize: '26px', fontWeight: '900', color: 'var(--text-main)', margin: 0 }}>{logCounts[key]}</h4>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Search & Filter Bar */}
            <div className="card" style={{ marginBottom: '20px', padding: '14px 20px' }}>
                <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                    <div style={{ flex: 1, position: 'relative' }}>
                        <Search size={17} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            type="text"
                            placeholder="Search by user, action or keyword..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            style={{ width: '100%', padding: '10px 12px 10px 40px', borderRadius: '10px', border: '1px solid var(--border)', backgroundColor: '#f8fafc', fontSize: '14px', outline: 'none' }}
                        />
                    </div>
                    <select
                        value={typeFilter}
                        onChange={e => setTypeFilter(e.target.value)}
                        style={{ padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border)', fontSize: '14px', color: 'var(--text-main)', backgroundColor: 'white', cursor: 'pointer' }}
                    >
                        <option value="All">All Types</option>
                        <option value="info">Info</option>
                        <option value="success">Success</option>
                        <option value="warning">Warning</option>
                        <option value="danger">Critical</option>
                    </select>
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {filtered.length} of {logs.length} events
                    </span>
                </div>
            </div>

            {/* Log List */}
            <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
                {loading ? (
                    <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <Loader2 size={32} style={{ margin: '0 auto 12px', animation: 'spin 1s linear infinite' }} />
                        <p>Loading system logs...</p>
                    </div>
                ) : filtered.length === 0 ? (
                    <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <Info size={36} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                        <p style={{ fontWeight: '600' }}>No logs found</p>
                        <p style={{ fontSize: '13px', marginTop: '4px' }}>System activity will appear here as users perform actions.</p>
                    </div>
                ) : (
                    filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE).map((log, i) => {
                        const cfg  = TYPE_CONFIG[log.type] || TYPE_CONFIG.info;
                        const Icon = cfg.icon;
                        return (
                            <div
                                key={log.id || i}
                                style={{
                                    padding: '16px 24px',
                                    borderBottom: '1px solid var(--border)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '18px',
                                    transition: 'background 0.15s',
                                }}
                                className="log-row"
                            >
                                {/* Icon */}
                                <div style={{
                                    width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0,
                                    backgroundColor: cfg.bg, color: cfg.color,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                    <Icon size={18} />
                                </div>

                                {/* Content */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '3px' }}>
                                        <span style={{ fontWeight: '700', color: 'var(--text-main)', fontSize: '14px' }}>{log.action}</span>
                                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0, marginLeft: '16px' }}>
                                            <Clock size={12} /> {timeAgo(log.timestamp)}
                                        </span>
                                    </div>
                                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        <span style={{ color: cfg.color, fontWeight: '600' }}>{log.username || 'System'}:</span>{' '}{log.details}
                                    </p>
                                </div>

                                {/* Badge */}
                                <span style={{
                                    padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', flexShrink: 0,
                                    backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}30`
                                }}>
                                    {cfg.label}
                                </span>
                            </div>
                        );
                    })
                )}
                {!loading && filtered.length > 0 && (
                    <div style={{ padding: '0 24px' }}>
                        <Pagination currentPage={currentPage} totalItems={filtered.length} pageSize={PAGE_SIZE} onPageChange={setCurrentPage} />
                    </div>
                )}
            </div>

            <style>{`
                .log-row:hover { background-color: var(--bg-main) !important; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
};

export default Logs;

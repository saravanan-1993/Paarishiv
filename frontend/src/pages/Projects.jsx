import React, { useState, useEffect } from 'react';
import {
    Plus, Search, Filter, MapPin, Calendar,
    ArrowRight, Loader2, AlertCircle, RefreshCw
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import CreateProjectModal from '../components/CreateProjectModal';
import { useAuth } from '../context/AuthContext';
import { projectAPI } from '../utils/api';
import { hasPermission, hasFeature } from '../utils/rbac';

// Helper: format budget number → "₹2.5 Cr" or "₹85 L"
const formatBudget = (amount) => {
    if (!amount && amount !== 0) return '₹0';
    if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`;
    return `₹${amount.toLocaleString('en-IN')}`;
};

// Helper: format ISO date → "Jun 2027"
const formatDate = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
};

const STATUS_STYLE = {
    Ongoing: { bg: '#ECFDF5', color: '#10B981' },
    Completed: { bg: '#EFF6FF', color: '#3B82F6' },
    'On Hold': { bg: '#F3F4F6', color: '#6B7280' },
    Delayed: { bg: '#FEF2F2', color: '#EF4444' },
};

const Projects = () => {
    const navigate = useNavigate();
    const { user } = useAuth();

    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('All');
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // ── Fetch projects from backend ─────────────────────────────────────────
    const fetchProjects = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await projectAPI.getAll();
            setProjects(res.data || []);
        } catch (err) {
            console.error('Fetch projects error:', err);
            setError('Could not load projects. Check backend connection.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchProjects(); }, []);

    // ── Handle new project created ──────────────────────────────────────────
    const handleProjectCreated = (newProject) => {
        setProjects(prev => [newProject, ...prev]);
    };

    // ── Filter ──────────────────────────────────────────────────────────────
    const filtered = projects.filter(p => {
        const q = searchTerm.toLowerCase();
        const matchSearch = (p.name || '').toLowerCase().includes(q) ||
            (p.client || '').toLowerCase().includes(q) ||
            (p.location || '').toLowerCase().includes(q);

        const matchStatus = filterStatus === 'All' || p.status === filterStatus;

        if (user?.role === 'Site Engineer') {
            return matchSearch && matchStatus && p.engineer_id === user.username;
        }
        return matchSearch && matchStatus;
    });

    return (
        <div className="projects-container" style={{ position: 'relative' }}>
            <div className="projects-page animate-fade-in">
                {/* ── Header ─────────────────────────────────────────────── */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                    <div>
                        <h2 style={{ fontSize: '26px', fontWeight: '800', marginBottom: '4px' }}>Project Management</h2>
                        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                            Manage and track all ongoing construction projects.
                            {!loading && <span style={{ marginLeft: '8px', fontWeight: '700', color: 'var(--primary)' }}>{filtered.length} project(s)</span>}
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button className="btn btn-outline" onClick={fetchProjects} title="Refresh">
                            <RefreshCw size={16} />
                        </button>
                        {(hasFeature(user, 'add_project') || hasPermission(user, 'Projects', 'edit')) && (
                            <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
                                <Plus size={18} /> Create New Project
                            </button>
                        )}
                    </div>
                </div>

                {/* ── Search bar ─────────────────────────────────────────── */}
                <div className="card" style={{ marginBottom: '24px', padding: '16px' }}>
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                        <div style={{ flex: '1 1 300px', position: 'relative' }}>
                            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input
                                type="text"
                                placeholder="Search by project name, client or location..."
                                style={{ width: '100%', padding: '10px 12px 10px 40px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: '14px' }}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div style={{ position: 'relative' }}>
                            <button
                                className={`btn ${filterStatus !== 'All' ? 'btn-primary' : 'btn-outline'}`}
                                onClick={() => setIsFilterOpen(!isFilterOpen)}
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', justifyContent: 'center' }}
                            >
                                <Filter size={18} />
                                Filters {filterStatus !== 'All' && `(1)`}
                            </button>

                            {isFilterOpen && (
                                <>
                                    <div
                                        style={{ position: 'fixed', inset: 0, zIndex: 90 }}
                                        onClick={() => setIsFilterOpen(false)}
                                    />
                                    <div className="card animate-fade-in" style={{
                                        position: 'absolute', top: '100%', right: 0, marginTop: '8px',
                                        width: '200px', zIndex: 100, padding: '12px', border: '1px solid var(--border)',
                                        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'
                                    }}>
                                        <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase' }}>Filter by Status</div>
                                        {['All', 'Ongoing', 'On Hold', 'Completed'].map(status => (
                                            <div
                                                key={status}
                                                onClick={() => {
                                                    setFilterStatus(status);
                                                    setIsFilterOpen(false);
                                                }}
                                                style={{
                                                    padding: '8px 12px', borderRadius: '6px', fontSize: '14px', cursor: 'pointer',
                                                    backgroundColor: filterStatus === status ? '#F1F5F9' : 'transparent',
                                                    color: filterStatus === status ? 'var(--primary)' : 'var(--text-main)',
                                                    fontWeight: filterStatus === status ? '700' : '500',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                    transition: 'all 0.1s'
                                                }}
                                                className="filter-option"
                                            >
                                                {status}
                                                {filterStatus === status && <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--primary)' }} />}
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Loading state ────────────────────────────────────────── */}
                {loading && (
                    <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-muted)' }}>
                        <Loader2 size={36} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
                        <p style={{ fontWeight: '600' }}>Loading projects from database...</p>
                        <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
                    </div>
                )}

                {/* ── Error state ──────────────────────────────────────────── */}
                {!loading && error && (
                    <div style={{ padding: '32px', textAlign: 'center', backgroundColor: '#FEF2F2', borderRadius: '12px', border: '1px solid #FECACA' }}>
                        <AlertCircle size={36} style={{ color: '#EF4444', margin: '0 auto 12px' }} />
                        <p style={{ color: '#DC2626', fontWeight: '700', marginBottom: '12px' }}>{error}</p>
                        <button className="btn btn-outline" onClick={fetchProjects}>Retry</button>
                    </div>
                )}

                {/* ── Empty state ──────────────────────────────────────────── */}
                {!loading && !error && filtered.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-muted)' }}>
                        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏗️</div>
                        <h3 style={{ fontWeight: '700', marginBottom: '8px' }}>
                            {searchTerm ? 'No projects match your search' : 'No projects yet'}
                        </h3>
                        <p style={{ marginBottom: '24px' }}>
                            {searchTerm ? 'Try a different search term.' : 'Click "Create New Project" to get started.'}
                        </p>
                        {!searchTerm && (
                            <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
                                <Plus size={18} /> Create First Project
                            </button>
                        )}
                    </div>
                )}

                {/* ── Project Cards Grid ───────────────────────────────────── */}
                {!loading && !error && filtered.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '24px' }}>
                        {filtered.map((project) => {
                            const status = project.status || 'Ongoing';
                            const style = STATUS_STYLE[status] || STATUS_STYLE['Ongoing'];
                            const progress = project.progress || 0;
                            const projectId = project._id || project.id;

                            return (
                                <div
                                    key={projectId}
                                    className="card project-card"
                                    style={{ padding: '0', overflow: 'hidden', transition: 'transform 0.2s, box-shadow 0.2s', cursor: 'pointer' }}
                                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = 'var(--shadow-lg)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
                                    onClick={() => navigate(`/projects/${projectId}`)}
                                >
                                    {/* Top colour bar */}
                                    <div style={{ height: '4px', backgroundColor: style.color }} />

                                    <div style={{ padding: '20px' }}>
                                        {/* Title + Status */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                                            <div>
                                                <h3 style={{ fontSize: '17px', fontWeight: '800', marginBottom: '3px' }}>{project.name}</h3>
                                                <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{project.client}</p>
                                            </div>
                                            <span style={{
                                                padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700',
                                                textTransform: 'uppercase', backgroundColor: style.bg, color: style.color, flexShrink: 0, marginLeft: '8px'
                                            }}>
                                                {status}
                                            </span>
                                        </div>

                                        {/* Location + Date */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '18px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
                                                <MapPin size={13} /> {project.location}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
                                                <Calendar size={13} /> Ends: {formatDate(project.end_date)}
                                            </div>
                                        </div>

                                        {/* Progress bar */}
                                        <div style={{ marginBottom: '18px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
                                                <span style={{ fontWeight: '700' }}>Overall Progress</span>
                                                <span style={{ color: style.color, fontWeight: '800' }}>{progress}%</span>
                                            </div>
                                            <div style={{ width: '100%', height: '8px', backgroundColor: '#F1F5F9', borderRadius: '4px', overflow: 'hidden' }}>
                                                <div style={{ width: `${progress}%`, height: '100%', backgroundColor: style.color, borderRadius: '4px', transition: 'width 0.6s ease' }} />
                                            </div>
                                        </div>

                                        {/* Footer */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
                                            {(user?.role === 'Super Admin' || user?.role === 'Manager') ? (
                                                <div style={{ display: 'flex', gap: '20px' }}>
                                                    <div>
                                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>Credit</div>
                                                        <div style={{ fontSize: '14px', fontWeight: '800' }}>{formatBudget(project.budget)}</div>
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>Debit</div>
                                                        <div style={{ fontSize: '14px', fontWeight: '800', color: '#EF4444' }}>{formatBudget(project.spent || 0)}</div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div style={{ display: 'flex', gap: '20px' }}>
                                                    <div>
                                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>Project Amount</div>
                                                        <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-muted)' }}>Classified</div>
                                                    </div>
                                                </div>
                                            )}
                                            <button
                                                onClick={() => navigate(`/projects/${projectId}`)}
                                                style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '13px' }}
                                            >
                                                Details <ArrowRight size={15} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ── Modal ───────────────────────────────────────────────── */}
            <CreateProjectModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onProjectCreated={handleProjectCreated}
            />
        </div>
    );
};

export default Projects;

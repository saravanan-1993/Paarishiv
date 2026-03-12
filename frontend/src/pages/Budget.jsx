import React, { useState, useEffect } from 'react';
import {
    Calculator, Briefcase, Loader2, PieChart, TrendingUp, Target, AlertCircle
} from 'lucide-react';
import PremiumSelect from '../components/PremiumSelect';
import CustomSelect from '../components/CustomSelect';
import { useAuth } from '../context/AuthContext';
import { hasPermission } from '../utils/rbac';
import { projectAPI } from '../utils/api';

const IndianRupee = ({ size, className, style }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
        <path d="M6 3h12" />
        <path d="M6 8h12" />
        <path d="M6 13l8.5 8" />
        <path d="M6 13h3" />
        <path d="M9 13c6.667 0 6.667-10 0-10" />
    </svg>
);

const fmt = (n) => {
    if (!n && n !== 0) return '₹0';
    if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
    if (n >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
    return `₹${Number(n).toLocaleString('en-IN')}`;
};

const Budget = () => {
    const [activeTab, setActiveTab] = useState('Overview');
    const [selectedProject, setSelectedProject] = useState('All Projects');
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await projectAPI.getAll();
            setProjects(res.data || []);
        } catch (err) {
            console.error('Budget fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const visibleProjects = selectedProject === 'All Projects'
        ? projects
        : projects.filter(p => p.name === selectedProject);

    const totalBudget = visibleProjects.reduce((s, p) => s + (p.budget || 0), 0);
    const totalSpent = visibleProjects.reduce((s, p) => s + (p.spent || 0), 0);
    const remaining = totalBudget - totalSpent;

    const spentPct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;
    const remainingPct = totalBudget > 0 ? Math.round((remaining / totalBudget) * 100) : 0;

    const kpiCards = [
        { label: 'TOTAL ALLOCATED BUDGET', value: fmt(totalBudget), icon: Target, color: '#3B82F6', bgColor: '#EFF6FF' },
        { label: 'TOTAL CONSUMED', value: `${fmt(totalSpent)} (${spentPct}%)`, icon: TrendingUp, color: '#F59E0B', bgColor: '#FFFBEB' },
        { label: 'TOTAL REMAINING', value: `${fmt(remaining)} (${remainingPct}%)`, icon: PieChart, color: '#10B981', bgColor: '#ECFDF5' },
    ];

    const projectDropdown = ['All Projects', ...projects.map(p => p.name).filter(Boolean)];

    if (!user || (!hasPermission(user, 'Budget Control', 'view') && user.role !== 'Super Admin' && user.role !== 'Manager')) {
        return (
            <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' }}>
                <AlertCircle size={48} style={{ color: '#EF4444', margin: '0 auto 16px' }} />
                <h3 style={{ fontWeight: '700', marginBottom: '8px', color: 'var(--text-main)' }}>Access Denied</h3>
                <p style={{ marginBottom: '24px' }}>You don't have permission to view Budget Control. This page is restricted to authorized personnel.</p>
            </div>
        );
    }

    return (
        <div className="budget-container" style={{ position: 'relative' }}>
            <div className="animate-fade-in">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <div>
                        <h2 style={{ fontSize: '28px', fontWeight: '800', marginBottom: '4px' }}>Budget Control</h2>
                        <p style={{ color: 'var(--text-muted)', fontSize: '15px' }}>
                            Track project budgets, variations and cost value reconciliation.
                        </p>
                    </div>
                </div>

                <div className="kpi-grid" style={{ marginBottom: '32px' }}>
                    {kpiCards.map((kpi, i) => (
                        <div key={i} className="card kpi-card" style={{ borderTop: `4px solid ${kpi.color}` }}>
                            <div className="kpi-icon" style={{ backgroundColor: kpi.bgColor, color: kpi.color }}>
                                <kpi.icon size={20} />
                            </div>
                            <div className="kpi-info">
                                <h4 style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '800' }}>{kpi.label}</h4>
                                <div className="value" style={{ fontSize: '18px' }}>
                                    {loading ? '—' : kpi.value}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <CustomSelect
                            label="Filter by Project"
                            options={projectDropdown.map(p => ({ value: p, label: p }))}
                            value={selectedProject}
                            onChange={setSelectedProject}
                            icon={Briefcase}
                            width="300px"
                        />
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                        {[
                            { id: 'Overview', label: 'Budget Overview', icon: IndianRupee },
                            { id: 'CVR', label: 'Cost Value Reconciliation (CVR)', icon: Calculator },
                        ].map(tab => {
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px',
                                        borderRadius: '8px',
                                        border: isActive ? '1px solid var(--border)' : '1px solid transparent',
                                        background: isActive ? 'white' : 'transparent',
                                        color: isActive ? 'var(--text-main)' : 'var(--text-muted)',
                                        fontWeight: isActive ? '700' : '600', fontSize: '14px', cursor: 'pointer',
                                        boxShadow: isActive ? 'var(--shadow-sm)' : 'none'
                                    }}
                                >
                                    <tab.icon size={18} /> {tab.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
                        <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
                        <p style={{ fontWeight: '600' }}>Loading budget data…</p>
                    </div>
                ) : (
                    <>
                        {activeTab === 'Overview' && (
                            <div className="card">
                                <h3 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '24px' }}>
                                    Project Budget vs Actual
                                </h3>
                                {visibleProjects.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
                                        <IndianRupee size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
                                        <h4 style={{ fontWeight: '700', marginBottom: '8px' }}>No Projects Found</h4>
                                        <p>Budget data will appear once projects are created.</p>
                                    </div>
                                ) : (
                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                <th>Project</th>
                                                <th>Status</th>
                                                <th style={{ textAlign: 'right' }}>Allocated Budget</th>
                                                <th style={{ textAlign: 'right' }}>Total Spent</th>
                                                <th style={{ textAlign: 'right' }}>Remaining Balance</th>
                                                <th>Utilisation</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {visibleProjects.map((p, i) => {
                                                const spent = p.spent || 0;
                                                const budget = p.budget || 0;
                                                const remain = budget - spent;
                                                const usedPct = budget > 0 ? Math.round((spent / budget) * 100) : 0;
                                                return (
                                                    <tr key={i}>
                                                        <td style={{ fontWeight: '700' }}>{p.name}</td>
                                                        <td>
                                                            <span className={`badge ${p.status === 'Ongoing' ? 'badge-success' :
                                                                p.status === 'Completed' ? 'badge-primary' :
                                                                    p.status === 'Delayed' ? 'badge-danger' : 'badge-warning'
                                                                }`}>{p.status || 'Ongoing'}</span>
                                                        </td>
                                                        <td style={{ textAlign: 'right', fontWeight: '600' }}>{fmt(budget)}</td>
                                                        <td style={{ textAlign: 'right', fontWeight: '600', color: spent > 0 ? '#DC2626' : 'var(--text-muted)' }}>{fmt(spent)}</td>
                                                        <td style={{ textAlign: 'right', fontWeight: '700', color: remain >= 0 ? '#059669' : '#EF4444' }}>{fmt(remain)}</td>
                                                        <td style={{ minWidth: '160px' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                                <div style={{ flex: 1, height: '8px', backgroundColor: '#E2E8F0', borderRadius: '4px', overflow: 'hidden' }}>
                                                                    <div style={{
                                                                        width: `${usedPct}%`, height: '100%', borderRadius: '4px',
                                                                        background: usedPct > 80 ? '#EF4444' : usedPct > 50 ? '#F59E0B' : '#10B981',
                                                                        transition: 'width 0.5s ease'
                                                                    }} />
                                                                </div>
                                                                <span style={{ fontSize: '12px', fontWeight: '700', minWidth: '36px' }}>{usedPct}%</span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        )}

                        {activeTab === 'CVR' && (
                            <div className="card" style={{ padding: '0' }}>
                                <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <h3 style={{ fontSize: '18px', fontWeight: '800' }}>Cost Value Reconciliation</h3>
                                        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Tracking variance and margins between estimated budget and actual project costs.</p>
                                    </div>
                                </div>
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Project Name</th>
                                            <th style={{ textAlign: 'right' }}>Target Value</th>
                                            <th style={{ textAlign: 'right' }}>Incurred Cost</th>
                                            <th style={{ textAlign: 'right' }}>Variance</th>
                                            <th>Margin %</th>
                                            <th>Risk Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {visibleProjects.map((p) => {
                                            const value = p.budget || 0;
                                            const cost = p.spent || 0;
                                            const dev = value - cost;
                                            const margin = value > 0 ? ((dev / value) * 100).toFixed(1) : 0;
                                            const isHealthy = dev >= 0 && margin >= 5;
                                            const isWarning = dev >= 0 && margin < 5;
                                            const isDanger = dev < 0;

                                            return (
                                                <tr key={p._id || p.id}>
                                                    <td style={{ fontWeight: '700' }}>{p.name}</td>
                                                    <td style={{ textAlign: 'right', fontWeight: '600', color: '#3B82F6' }}>{fmt(value)}</td>
                                                    <td style={{ textAlign: 'right', color: '#EF4444', fontWeight: '600' }}>{fmt(cost)}</td>
                                                    <td style={{ textAlign: 'right', fontWeight: '800', color: isDanger ? '#EF4444' : '#10B981' }}>
                                                        {dev > 0 ? '+' : ''}{fmt(dev)}
                                                    </td>
                                                    <td>
                                                        <span style={{ fontWeight: '800', color: isDanger ? '#EF4444' : isWarning ? '#F59E0B' : '#10B981' }}>
                                                            {margin}%
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span className={`badge ${isDanger ? 'badge-danger' : isWarning ? 'badge-warning' : 'badge-success'}`}>
                                                            {isDanger ? 'Critical (Loss)' : isWarning ? 'At Risk' : 'Healthy'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default Budget;

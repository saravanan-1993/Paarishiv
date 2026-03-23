import React from 'react';
import { IndianRupee, CreditCard, Activity, CalendarDays, TrendingDown, Clock, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const AccountsView = ({ hrmsStats, onRefresh }) => {
    const navigate = useNavigate();

    // Default placeholder
    const salaryPayable = hrmsStats?.monthlyPayable || 0;
    const vendorPayable = hrmsStats?.vendorPayable || 0;
    const expensesTotal = hrmsStats?.monthlyExpenses || 0;

    const fmt = (n) => {
        if (!n && n !== 0) return '₹0';
        if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
        if (n >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
        return `₹${Number(n).toLocaleString('en-IN')}`;
    };

    return (
        <div className="accounts-view animate-fade-in">
            <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-main)', marginBottom: '4px' }}>
                        Accounts & Finance Dashboard
                    </h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px', fontWeight: '500' }}>
                        Real-time overview of cash outflows, vendor dues, and payroll.
                    </p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginBottom: '32px' }}>

                {/* Salary Payable */}
                <div className="card" style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', right: '-15px', top: '-15px', color: '#EFF6FF', zIndex: 0 }}>
                        <IndianRupee size={120} strokeWidth={1} />
                    </div>
                    <div style={{ position: 'relative', zIndex: 1 }}>
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <CalendarDays size={16} /> Salary Payable (This Month)
                        </p>
                        <h3 style={{ fontSize: '32px', fontWeight: '800', color: '#1E3A8A', marginBottom: '8px' }}>
                            {fmt(salaryPayable)}
                        </h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#3B82F6', cursor: 'pointer', fontWeight: '600' }} onClick={() => navigate('/hrms')}>
                            Go to Payroll <ArrowRight size={14} />
                        </div>
                    </div>
                </div>

                {/* Vendor Dues */}
                <div className="card" style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', right: '-15px', top: '-15px', color: '#FEF2F2', zIndex: 0 }}>
                        <Clock size={120} strokeWidth={1} />
                    </div>
                    <div style={{ position: 'relative', zIndex: 1 }}>
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <CreditCard size={16} /> Vendor Payment Pending
                        </p>
                        <h3 style={{ fontSize: '32px', fontWeight: '800', color: '#991B1B', marginBottom: '8px' }}>
                            {fmt(vendorPayable)}
                        </h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#EF4444', cursor: 'pointer', fontWeight: '600' }} onClick={() => navigate('/finance')}>
                            Make Payment <ArrowRight size={14} />
                        </div>
                    </div>
                </div>

                {/* Expenses Overview */}
                <div className="card" style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', right: '-15px', top: '-15px', color: '#F5F3FF', zIndex: 0 }}>
                        <TrendingDown size={120} strokeWidth={1} />
                    </div>
                    <div style={{ position: 'relative', zIndex: 1 }}>
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Activity size={16} /> Total Expenses MTD
                        </p>
                        <h3 style={{ fontSize: '32px', fontWeight: '800', color: '#5B21B6', marginBottom: '8px' }}>
                            {fmt(expensesTotal)}
                        </h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#8B5CF6', cursor: 'pointer', fontWeight: '600' }} onClick={() => navigate('/finance')}>
                            View Ledgers <ArrowRight size={14} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Empty space for future accounts specific components like Aging Summary, Ledger Summary etc */}
            <div className="card" style={{ padding: '32px', textAlign: 'center' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                    Quick access to pending invoices, vouchers, and general ledgers will appear here.
                </p>
                <button className="btn btn-outline" style={{ marginTop: '16px' }} onClick={() => navigate('/finance')}>
                    Explore Full Finance Module
                </button>
            </div>
        </div>
    );
};

export default AccountsView;

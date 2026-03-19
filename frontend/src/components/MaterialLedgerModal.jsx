import React, { useState, useEffect } from 'react';
import { X, FileText, ArrowUpCircle, ArrowDownCircle, History, Package } from 'lucide-react';
import { materialAPI } from '../utils/api';

const MaterialLedgerModal = ({ isOpen, onClose, materialName, projectName }) => {
    const [ledger, setLedger] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && materialName && projectName) {
            setLoading(true);
            materialAPI.getInventoryLedger(projectName, materialName)
                .then(res => setLedger(res.data || []))
                .catch(err => console.error(err))
                .finally(() => setLoading(false));
        }
    }, [isOpen, materialName, projectName]);

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 1100, backdropFilter: 'blur(4px)'
        }}>
            <div className="card animate-fade-in" style={{
                backgroundColor: 'white', width: '100%', maxWidth: '800px',
                borderRadius: '12px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                display: 'flex', flexDirection: 'column', maxHeight: '85vh'
            }}>
                {/* Header */}
                <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <h2 style={{ fontSize: '20px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <History size={24} color="var(--primary)" /> Material Ledger
                        </h2>
                        <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>{materialName} • {projectName}</p>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                        <X size={24} />
                    </button>
                </div>

                {/* Body */}
                <div style={{ padding: '24px', overflowY: 'auto' }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Loading ledger records...</div>
                    ) : ledger.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '60px 40px', color: 'var(--text-muted)' }}>
                            <Package size={48} style={{ margin: '0 auto 16px', opacity: 0.2 }} />
                            <p>No transactions found for this material at this site.</p>
                        </div>
                    ) : (
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Transaction Type</th>
                                    <th>Reference</th>
                                    <th style={{ textAlign: 'right' }}>Qty In</th>
                                    <th style={{ textAlign: 'right' }}>Qty Out</th>
                                    <th style={{ textAlign: 'right' }}>Balance</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ledger.map((row, i) => {
                                    const dateObj = row.date ? new Date(row.date) : null;
                                    const formattedDate = dateObj && !isNaN(dateObj)
                                        ? dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                                        : '—';

                                    return (
                                        <tr key={i}>
                                            <td style={{ fontSize: '13px' }}>{formattedDate}</td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    {row.in_qty > 0 || (row.type && (row.type.includes('In') || row.type === 'GRN' || row.type === 'Stock Return' || row.type.includes('GRN'))) ? (
                                                        <ArrowUpCircle size={14} color="#10B981" />
                                                    ) : row.out_qty > 0 || (row.type && (row.type.includes('Out') || row.type === 'Stock Issue')) ? (
                                                        <ArrowDownCircle size={14} color="#EF4444" />
                                                    ) : (
                                                        <ArrowUpCircle size={14} color="#94a3b8" />
                                                    )}
                                                    <span style={{ fontWeight: '600', fontSize: '13px' }}>{row.type || 'Entry'}</span>
                                                </div>
                                            </td>
                                            <td style={{ fontFamily: 'monospace', fontWeight: '700', color: 'var(--primary)' }}>{row.ref}</td>
                                            <td style={{ textAlign: 'right', color: '#10B981', fontWeight: '700' }}>{row.in_qty > 0 ? `+${row.in_qty}` : '-'}</td>
                                            <td style={{ textAlign: 'right', color: '#EF4444', fontWeight: '700' }}>{row.out_qty > 0 ? `-${row.out_qty}` : '-'}</td>
                                            <td style={{ textAlign: 'right', fontWeight: '800' }}>{row.balance}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Footer */}
                <div style={{ padding: '20px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
                    <button className="btn btn-primary" onClick={onClose} style={{ padding: '8px 32px' }}>Close</button>
                </div>
            </div>
        </div>
    );
};

export default MaterialLedgerModal;

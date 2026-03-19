import React, { useState, useEffect } from 'react';
import { X, Fuel, ArrowUpRight, ArrowDownLeft, Droplets, History, Plus } from 'lucide-react';
import { fleetAPI } from '../utils/api';
import FuelStockModal from './FuelStockModal';

const FuelInventoryModal = ({ isOpen, onClose, projectName = 'All Sites' }) => {
    const [activeTab, setActiveTab] = useState('Stock');
    const [isStockModalOpen, setIsStockModalOpen] = useState(false);
    const [summary, setSummary] = useState({ currentStock: 0, monthUsage: 0 });
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const sumRes = await fleetAPI.getFuelSummary(projectName);
            setSummary(sumRes.data);
            
            const logRes = await fleetAPI.getFuelLogs(projectName);
            const stockRes = await fleetAPI.getFuelStock(projectName);
            
            // Combine and sort logs
            const combined = [
                ...logRes.data.map(l => ({
                    date: l.date,
                    type: 'Usage',
                    qty: `-${l.qty} L`,
                    info: `${l.assetName} at ${l.site}`
                })),
                ...stockRes.data.map(s => ({
                    date: new Date(s.date).toLocaleDateString(),
                    type: 'Stock In',
                    qty: `+${s.qty} L`,
                    info: s.supplier ? `${s.supplier} ${s.site && projectName === 'All Sites' ? `(@${s.site})` : ''}` : (projectName === 'All Sites' ? `@${s.site}` : 'Direct Purchase')
                }))
            ].sort((a, b) => new Date(b.date) - new Date(a.date));
            
            setLogs(combined);
        } catch (err) {
            console.error('Failed to fetch fuel data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchData();
        }
    }, [isOpen, projectName]);

    if (!isOpen) return null;

    return (
        <>
            <div className="modal-overlay">
                <div className="modal-content" style={{ maxWidth: '700px', width: '95%' }}>
                    <div className="modal-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '40px', height: '40px', backgroundColor: '#fff7ed', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f97316' }}>
                                <Fuel size={20} />
                            </div>
                            <div>
                                <h3 style={{ fontSize: '18px', fontWeight: '800' }}>{projectName === 'All Sites' ? 'TOTAL' : projectName.toUpperCase()} FUEL INVENTORY</h3>
                                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Monitor diesel stock and consumption</p>
                            </div>
                        </div>
                        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                            <X size={24} />
                        </button>
                    </div>

                    <div className="modal-body" style={{ padding: '24px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
                            <div className="card" style={{ padding: '16px', border: '1px solid var(--border)', backgroundColor: '#f8fafc' }}>
                                <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px' }}>CURRENT STOCK</div>
                                <div style={{ fontSize: '24px', fontWeight: '800', color: '#B45309' }}>{summary.currentStock} L</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                    {summary.currentStock > 0 ? 'Available for use' : 'No stock entries yet'}
                                </div>
                            </div>
                            <div className="card" style={{ padding: '16px', border: '1px solid var(--border)', backgroundColor: '#f8fafc' }}>
                                <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px' }}>USAGE (THIS MONTH)</div>
                                <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--primary)' }}>{summary.monthUsage} L</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>From machinery logs</div>
                            </div>
                            <div className="card" style={{ padding: '16px', border: '1px solid var(--border)', backgroundColor: '#f8fafc' }}>
                                <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px' }}>EST. DAYS LEFT</div>
                                <div style={{ fontSize: '24px', fontWeight: '800', color: '#10B981' }}>
                                    {summary.monthUsage > 0 ? Math.round(summary.currentStock / (summary.monthUsage / 30)) : '—'}
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Based on recent usage</div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                            <button
                                className={`btn ${activeTab === 'Stock' ? 'btn-primary' : 'btn-outline'} btn-sm`}
                                onClick={() => setActiveTab('Stock')}
                            >
                                <Droplets size={16} /> Stock Details
                            </button>
                            <button
                                className={`btn ${activeTab === 'Logs' ? 'btn-primary' : 'btn-outline'} btn-sm`}
                                onClick={() => setActiveTab('Logs')}
                            >
                                <History size={16} /> Transaction History
                            </button>
                        </div>

                        <div style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                <table className="data-table" style={{ margin: 0 }}>
                                    <thead style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: 'white' }}>
                                        <tr>
                                            <th>Date</th>
                                            <th>Type</th>
                                            <th>Qty</th>
                                            <th>Info</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loading ? (
                                            <tr><td colSpan={4} style={{ textAlign: 'center', padding: '32px' }}>Loading...</td></tr>
                                        ) : logs.length === 0 ? (
                                            <tr><td colSpan={4} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>No fuel transactions yet</td></tr>
                                        ) : logs.filter(l => activeTab === 'Stock' ? l.type === 'Stock In' : true).map((log, i) => (
                                            <tr key={i}>
                                                <td style={{ fontSize: '13px' }}>{log.date}</td>
                                                <td>
                                                    <span style={{
                                                        display: 'flex', alignItems: 'center', gap: '4px',
                                                        color: log.type === 'Stock In' ? '#10B981' : '#f97316',
                                                        fontSize: '12px', fontWeight: '700'
                                                    }}>
                                                        {log.type === 'Stock In' ? <ArrowUpRight size={14} /> : <ArrowDownLeft size={14} />}
                                                        {log.type}
                                                    </span>
                                                </td>
                                                <td style={{ fontWeight: '700' }}>{log.qty}</td>
                                                <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                                    {log.info}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <div className="modal-footer" style={{ padding: '20px 24px', justifyContent: 'flex-end', borderTop: '1px solid var(--border)' }}>
                        <button className="btn btn-primary" style={{ fontWeight: '800' }} onClick={() => setIsStockModalOpen(true)}>
                            <Plus size={18} /> ADD STOCK ENTRY
                        </button>
                    </div>
                </div>
            </div>

            <FuelStockModal
                isOpen={isStockModalOpen}
                onClose={() => setIsStockModalOpen(false)}
                onStockAdded={fetchData}
                projectName={projectName}
            />
        </>
    );
};

export default FuelInventoryModal;

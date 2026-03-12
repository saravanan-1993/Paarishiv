import React from 'react';
import { X, Construction, Settings, Calendar, Shield, MapPin, Gauge, Clock } from 'lucide-react';

const AssetDetailsModal = ({ isOpen, onClose, asset, onEdit }) => {
    if (!isOpen || !asset) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '800px', width: '95%' }}>
                <div className="modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', backgroundColor: '#eff6ff', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                            <Construction size={20} />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '18px', fontWeight: '800' }}>{asset.id} - {asset.name}</h3>
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{asset.category} | Currently at {asset.site}</p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <span className={`badge ${asset.status === 'Working' ? 'badge-success' : 'badge-warning'}`}>
                            {asset.status}
                        </span>
                        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                            <X size={24} />
                        </button>
                    </div>
                </div>

                <div className="modal-body" style={{ padding: '24px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
                        {/* Sidebar info */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div className="card" style={{ padding: '16px', border: '1px solid var(--border)', backgroundColor: '#f8fafc' }}>
                                <div style={{ marginBottom: '16px' }}>
                                    <h4 style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>TOTAL HOURS</h4>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '20px', fontWeight: '800' }}>
                                        <Clock size={20} color="var(--primary)" /> {asset.hours}
                                    </div>
                                </div>
                                <div>
                                    <h4 style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>AVG FUEL / DAY</h4>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '20px', fontWeight: '800' }}>
                                        <Gauge size={20} color="#f97316" /> {asset.diesel}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Main detailed area */}
                        <div>
                            <div style={{ display: 'flex', gap: '24px', borderBottom: '1px solid var(--border)', marginBottom: '20px' }}>
                                <button style={{ padding: '8px 4px', fontSize: '14px', fontWeight: '700', borderBottom: '2px solid var(--primary)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)' }}>
                                    Maintenance History
                                </button>
                                <button style={{ padding: '8px 4px', fontSize: '14px', fontWeight: '600', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                                    Documents
                                </button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', justifyContent: 'center', padding: '40px 0', opacity: 0.5 }}>
                                <Settings size={40} />
                                <p style={{ fontSize: '14px' }}>No history records found.</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="modal-footer" style={{ padding: '20px 24px', justifyContent: 'space-between', borderTop: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn btn-outline btn-sm">Download Log</button>
                        <button className="btn btn-outline btn-sm">Transfer History</button>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button className="btn btn-outline" onClick={onEdit}>EDIT DETAILS</button>
                        <button className="btn btn-primary" style={{ fontWeight: '800' }}>SCHEDULE SERVICE</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AssetDetailsModal;

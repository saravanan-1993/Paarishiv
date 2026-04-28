import React, { useState, useEffect } from 'react';
import { X, Construction, Settings, Calendar, Gauge, Clock, Wrench, FileText, Fuel, MapPin, Truck } from 'lucide-react';
import { fleetAPI } from '../utils/api';

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const AssetDetailsModal = ({ isOpen, onClose, asset, onEdit, onDownloadLog, onTransferHistory, onScheduleService }) => {
    const [activeTab, setActiveTab] = useState('details');
    const [maintenance, setMaintenance] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && asset) {
            setActiveTab('details');
            setMaintenance([]);
        }
    }, [isOpen, asset]);

    if (!isOpen || !asset) return null;

    const equipId = asset.equipmentId || asset.vehicleNumber || asset.id || '';
    const equipName = asset.name || asset.vehicleType || asset.category || '';
    const isEquipment = !!asset.equipmentId;

    const tabs = [
        { id: 'details', label: 'Equipment Details' },
        { id: 'maintenance', label: `Maintenance (${maintenance.length})` },
    ];

    return (
        <div className="modal-overlay">
            <div style={{ backgroundColor: 'white', borderRadius: 16, width: '95%', maxWidth: 800, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }}>
                {/* Header */}
                <div style={{ padding: '18px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 44, height: 44, backgroundColor: '#EFF6FF', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3B82F6' }}>
                            <Construction size={22} />
                        </div>
                        <div>
                            <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>{equipId} — {equipName}</h3>
                            <p style={{ fontSize: 13, color: '#64748B', margin: 0 }}>{asset.category || ''} | Currently at {asset.site || 'Yard'}</p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ padding: '4px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, backgroundColor: asset.status === 'Active' || asset.status === 'Working' ? '#DCFCE7' : '#FEF3C7', color: asset.status === 'Active' || asset.status === 'Working' ? '#15803D' : '#92400E' }}>
                            {asset.status || 'Working'}
                        </span>
                        <button onClick={onClose} style={{ background: '#F1F5F9', border: 'none', cursor: 'pointer', color: '#64748B', width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #E2E8F0', padding: '0 24px' }}>
                    {tabs.map(t => (
                        <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
                            padding: '12px 18px', fontSize: 13, fontWeight: activeTab === t.id ? 700 : 500, cursor: 'pointer',
                            background: 'none', border: 'none', borderBottom: activeTab === t.id ? '2px solid #3B82F6' : '2px solid transparent',
                            color: activeTab === t.id ? '#3B82F6' : '#64748B',
                        }}>{t.label}</button>
                    ))}
                </div>

                {/* Body */}
                <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
                    {activeTab === 'details' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            <InfoCard icon={Construction} label="Equipment ID" value={equipId} />
                            <InfoCard icon={Truck} label="Machine Name" value={equipName} />
                            <InfoCard icon={Settings} label="Category" value={asset.category || '—'} />
                            <InfoCard icon={MapPin} label="Current Site" value={asset.site || 'Yard'} />
                            <InfoCard icon={Clock} label="Total Hours" value={asset.hours || '0h'} />
                            <InfoCard icon={Fuel} label="Avg Diesel/Day" value={asset.diesel || '—'} />
                            {asset.ownerType && <InfoCard icon={FileText} label="Owner Type" value={asset.ownerType} />}
                            {asset.createdAt && <InfoCard icon={Calendar} label="Registered On" value={fmtDate(asset.createdAt)} />}
                        </div>
                    )}

                    {activeTab === 'maintenance' && (
                        <div>
                            {loading ? (
                                <div style={{ textAlign: 'center', padding: 40, color: '#64748B' }}>Loading...</div>
                            ) : maintenance.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: 60, color: '#64748B' }}>
                                    <Wrench size={40} style={{ opacity: 0.3, margin: '0 auto 12px' }} />
                                    <p style={{ fontWeight: 600 }}>No maintenance records found.</p>
                                </div>
                            ) : (
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                    <thead>
                                        <tr style={{ backgroundColor: '#F8FAFC' }}>
                                            <th style={thStyle}>Date</th>
                                            <th style={thStyle}>Type</th>
                                            <th style={thStyle}>Description</th>
                                            <th style={{ ...thStyle, textAlign: 'right' }}>Cost</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {maintenance.map((m, i) => (
                                            <tr key={i} style={{ borderTop: '1px solid #F1F5F9' }}>
                                                <td style={tdStyle}>{fmtDate(m.date || m.created_at)}</td>
                                                <td style={tdStyle}>{m.type || m.serviceType || '—'}</td>
                                                <td style={tdStyle}>{m.description || m.notes || '—'}</td>
                                                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }}>₹{(m.cost || 0).toLocaleString('en-IN')}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{ padding: '16px 24px', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                    {onEdit && <button className="btn btn-outline" onClick={() => onEdit(asset)} style={{ padding: '8px 20px' }}>Edit</button>}
                    {onScheduleService && <button className="btn btn-outline" onClick={() => onScheduleService(asset)} style={{ padding: '8px 20px' }}>Set Maintenance</button>}
                    <button className="btn btn-outline" onClick={onClose} style={{ padding: '8px 20px' }}>Close</button>
                </div>
            </div>
        </div>
    );
};

const InfoCard = ({ icon: Icon, label, value }) => (
    <div style={{ padding: '12px 14px', borderRadius: 10, border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', display: 'flex', alignItems: 'center', gap: 10 }}>
        <Icon size={16} color="#64748B" />
        <div>
            <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>{label}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>{value}</div>
        </div>
    </div>
);

const thStyle = { padding: '10px 14px', fontSize: 11, fontWeight: 700, color: '#64748B', textAlign: 'left' };
const tdStyle = { padding: '10px 14px', fontSize: 13, color: '#334155' };

export default AssetDetailsModal;

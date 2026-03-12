import React, { useState } from 'react';
import {
    Settings, HardHat, Construction, Calendar, MapPin, Gauge, UserPlus,
    Truck, Plus, Search, Filter, Fuel, Clock, ArrowRightLeft, ClipboardList
} from 'lucide-react';

import { fleetAPI, projectAPI } from '../utils/api';

import AssetUsageModal from '../components/AssetUsageModal';
import TransferModal from '../components/TransferModal';
import AddAssetModal from '../components/AddAssetModal';
import FuelInventoryModal from '../components/FuelInventoryModal';
import AssetDetailsModal from '../components/AssetDetailsModal';

const EditAssetModal = ({ isOpen, onClose, asset, onAssetUpdated, projects }) => {
    const [formData, setFormData] = useState({
        id: '',
        name: '',
        category: '',
        site: '',
        status: 'Working',
        diesel: '',
        hours: ''
    });

    useEffect(() => {
        if (asset) {
            setFormData({
                id: asset.id,
                name: asset.name,
                category: asset.category,
                site: asset.site,
                status: asset.status,
                diesel: asset.diesel?.replace('L/day', '') || '',
                hours: asset.hours?.replace('h', '') || ''
            });
        }
    }, [asset]);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        onAssetUpdated({
            ...formData,
            diesel: `${formData.diesel}L/day`,
            hours: `${formData.hours}h`
        });
        onClose();
    };

    return (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
            <div className="modal-content" style={{ maxWidth: '540px', width: '95%' }}>
                <div className="modal-header">
                    <h3 style={{ fontSize: '18px', fontWeight: '800' }}>EDIT MACHINE DETAILS</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><Plus size={24} style={{ transform: 'rotate(45deg)' }} /></button>
                </div>
                <form onSubmit={handleSubmit} className="modal-body" style={{ padding: '24px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                        <div className="form-group">
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px' }}>MACHINE NAME</label>
                            <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1.5px solid var(--border)' }} />
                        </div>
                        <div className="form-group">
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px' }}>STATUS</label>
                            <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1.5px solid var(--border)' }}>
                                <option value="Working">Working</option>
                                <option value="Maintenance">Maintenance</option>
                                <option value="Out of Service">Out of Service</option>
                            </select>
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                        <div className="form-group">
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px' }}>HOURS</label>
                            <input type="number" value={formData.hours} onChange={(e) => setFormData({ ...formData, hours: e.target.value })} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1.5px solid var(--border)' }} />
                        </div>
                        <div className="form-group">
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px' }}>FUEL (L/DAY)</label>
                            <input type="number" value={formData.diesel} onChange={(e) => setFormData({ ...formData, diesel: e.target.value })} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1.5px solid var(--border)' }} />
                        </div>
                    </div>
                    <div className="modal-footer" style={{ borderTop: '1px solid var(--border)', padding: '20px 0 0 0', gap: '12px', justifyContent: 'flex-end', display: 'flex' }}>
                        <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary">SAVE CHANGES</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const Assets = () => {
    const [activeTab, setActiveTab] = useState('Fleet');
    const [searchTerm, setSearchTerm] = useState('');
    const [isUsageModalOpen, setIsUsageModalOpen] = useState(false);
    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
    const [isAddAssetModalOpen, setIsAddAssetModalOpen] = useState(false);
    const [isFuelModalOpen, setIsFuelModalOpen] = useState(false);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedAsset, setSelectedAsset] = useState(null);

    const [fleet, setFleet] = useState([]);
    const [loading, setLoading] = useState(false);
    const [dailyLogs, setDailyLogs] = useState([]);
    const [transfers, setTransfers] = useState([]);
    const [projects, setProjects] = useState([]);

    const fetchFleet = async () => {
        setLoading(true);
        try {
            const res = await fleetAPI.getVehicles();
            setFleet(res.data || []);
            const pRes = await projectAPI.getAll();
            setProjects(pRes.data || []);
        } catch (err) {
            console.error('Failed to load fleet:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFleet();
    }, []);

    const handleLogAdded = (newLog) => {
        setDailyLogs([newLog, ...dailyLogs]);
    };

    const handleAssetAdded = async (newAsset) => {
        try {
            await fleetAPI.createVehicle(newAsset);
            fetchFleet();
        } catch (err) {
            alert('Error adding vehicle');
        }
    };

    const handleViewDetails = (asset) => {
        setSelectedAsset(asset);
        setIsDetailsModalOpen(true);
    };

    const handleTransferAdded = (newTransfer) => {
        setTransfers([newTransfer, ...transfers]);
    };

    const handleAssetUpdated = async (updatedData) => {
        try {
            await fleetAPI.updateVehicle(selectedAsset.id || selectedAsset._id, updatedData);
            fetchFleet();
            setIsEditModalOpen(false);
            setIsDetailsModalOpen(false);
        } catch (err) {
            alert('Error updating vehicle');
        }
    };

    const handleActionClick = () => {
        if (activeTab === 'Logs') setIsUsageModalOpen(true);
        if (activeTab === 'Transfers') setIsTransferModalOpen(true);
    };

    return (
        <>
            <div className="animate-fade-in" style={{ padding: '0 10px 40px 10px' }}>
                {/* Page Header */}
                <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h1 style={{ fontSize: '32px', fontWeight: '800', color: 'var(--text-main)', marginBottom: '4px' }}>PLANT & MACHINERY</h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '15px' }}>Equipment tracking, diesel consumption & site logistics</p>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => setIsFuelModalOpen(true)}>
                            <Fuel size={18} /> FUEL INVENTORY
                        </button>
                        {(activeTab === 'Logs' || activeTab === 'Transfers') && (
                            <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={handleActionClick}>
                                <Plus size={18} /> {activeTab === 'Logs' ? 'NEW LOG ENTRY' : 'NEW TRANSFER'}
                            </button>
                        )}
                        {activeTab === 'Fleet' && (
                            <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => setIsAddAssetModalOpen(true)}>
                                <Plus size={18} /> ADD EQUIPMENT
                            </button>
                        )}
                    </div>
                </div>

                {/* Sub Tabs */}
                <div style={{ display: 'flex', gap: '24px', borderBottom: '1px solid var(--border)', marginBottom: '32px' }}>
                    {[
                        { id: 'Fleet', label: 'Equipment Fleet', icon: Construction },
                        { id: 'Logs', label: 'Daily Usage Logs', icon: ClipboardList },
                        { id: 'Transfers', label: 'Site Transfers', icon: ArrowRightLeft },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            style={{
                                padding: '12px 4px', fontSize: '14px', fontWeight: '700',
                                color: activeTab === tab.id ? 'var(--primary)' : 'var(--text-muted)',
                                borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
                                background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
                            }}
                        >
                            <tab.icon size={16} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {activeTab === 'Fleet' && (
                    <div className="card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h3 style={{ fontSize: '18px', fontWeight: '700' }}>Active Fleet at Sites</h3>
                            <div style={{ position: 'relative', width: '300px' }}>
                                <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input
                                    type="text" placeholder="Search machine name or ID..."
                                    style={{ width: '100%', padding: '10px 12px 10px 40px', borderRadius: '8px', border: '1px solid var(--border)' }}
                                />
                            </div>
                        </div>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Equipment ID</th>
                                    <th>Machine Name</th>
                                    <th>Category</th>
                                    <th>Current Site</th>
                                    <th>Total Hours</th>
                                    <th>Avg. Diesel</th>
                                    <th>Status</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {fleet.length === 0 ? (
                                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                                            <Construction size={48} style={{ opacity: 0.3 }} />
                                            <strong>No Equipment Added Yet</strong>
                                            <span>Click "ADD EQUIPMENT" to register your first machine.</span>
                                        </div>
                                    </td></tr>
                                ) : fleet.map((item, i) => (
                                    <tr key={i}>
                                        <td style={{ fontWeight: '700', color: 'var(--primary)' }}>{item.id}</td>
                                        <td style={{ fontWeight: '600' }}>{item.name}</td>
                                        <td>{item.category}</td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <MapPin size={14} style={{ color: 'var(--text-muted)' }} />
                                                {item.site}
                                            </div>
                                        </td>
                                        <td style={{ fontWeight: '600' }}>{item.hours}</td>
                                        <td>{item.diesel}</td>
                                        <td>
                                            <span className={`badge ${item.status === 'Working' ? 'badge-success' : 'badge-warning'}`}>
                                                {item.status}
                                            </span>
                                        </td>
                                        <td>
                                            <button
                                                onClick={() => handleViewDetails(item)}
                                                style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: '700' }}
                                            >
                                                Details
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {activeTab === 'Logs' && (
                    <div className="card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <div>
                                <h3 style={{ fontSize: '18px', fontWeight: '700' }}>Daily Operational Logs</h3>
                                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Updated by Site Engineers</p>
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button className="btn btn-outline btn-sm">Export Report</button>
                            </div>
                        </div>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Asset ID</th>
                                    <th>Project Site</th>
                                    <th>Hours Run</th>
                                    <th>Diesel Used</th>
                                    <th>Site Engineer</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {dailyLogs.length === 0 ? (
                                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                                            <ClipboardList size={48} style={{ opacity: 0.3 }} />
                                            <strong>No Usage Logs Yet</strong>
                                            <span>Click "NEW LOG ENTRY" to record daily equipment usage.</span>
                                        </div>
                                    </td></tr>
                                ) : dailyLogs.map((log, i) => (
                                    <tr key={i}>
                                        <td>{log.date}</td>
                                        <td style={{ fontWeight: '700' }}>{log.asset}</td>
                                        <td>{log.site}</td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <Clock size={14} style={{ color: 'var(--primary)' }} />
                                                {log.hoursUsed}
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#B45309', fontWeight: '700' }}>
                                                <Gauge size={14} />
                                                {log.dieselConsumed}
                                            </div>
                                        </td>
                                        <td>{log.engineer}</td>
                                        <td>
                                            <button style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: '700' }}>Edit</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {activeTab === 'Transfers' && (
                    <div className="card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <div>
                                <h3 style={{ fontSize: '18px', fontWeight: '700' }}>Inter-Site Movements</h3>
                                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Material & Machinery Transfers</p>
                            </div>
                        </div>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Transfer ID</th>
                                    <th>Category</th>
                                    <th>Details</th>
                                    <th>From Site</th>
                                    <th>To Site</th>
                                    <th>Vehicle Info</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {transfers.length === 0 ? (
                                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                                            <ArrowRightLeft size={48} style={{ opacity: 0.3 }} />
                                            <strong>No Transfers Recorded Yet</strong>
                                            <span>Click "NEW TRANSFER" to log your first site movement.</span>
                                        </div>
                                    </td></tr>
                                ) : transfers.map((trf, i) => (
                                    <tr key={i}>
                                        <td style={{ fontWeight: '700', color: 'var(--primary)' }}>{trf.id}</td>
                                        <td>
                                            <span className={`badge ${trf.type === 'Material' ? 'badge-info' : 'badge-warning'}`}>
                                                {trf.type}
                                            </span>
                                        </td>
                                        <td style={{ fontWeight: '600' }}>{trf.item}</td>
                                        <td>{trf.from}</td>
                                        <td>{trf.to}</td>
                                        <td style={{ fontSize: '12px' }}>{trf.vehicle}</td>
                                        <td>
                                            <span className={`badge ${trf.status === 'Delivered' ? 'badge-success' : 'badge-info'}`}>
                                                {trf.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

            </div>

            <AssetUsageModal
                isOpen={isUsageModalOpen}
                onClose={() => setIsUsageModalOpen(false)}
                onLogAdded={handleLogAdded}
                fleet={fleet}
            />
            <TransferModal
                isOpen={isTransferModalOpen}
                onClose={() => setIsTransferModalOpen(false)}
                onTransferAdded={handleTransferAdded}
            />
            <AddAssetModal
                isOpen={isAddAssetModalOpen}
                onClose={() => setIsAddAssetModalOpen(false)}
                onAssetAdded={handleAssetAdded}
            />
            <FuelInventoryModal
                isOpen={isFuelModalOpen}
                onClose={() => setIsFuelModalOpen(false)}
            />
            <AssetDetailsModal
                isOpen={isDetailsModalOpen}
                onClose={() => setIsDetailsModalOpen(false)}
                asset={selectedAsset}
                onEdit={() => setIsEditModalOpen(true)}
            />
            <EditAssetModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                asset={selectedAsset}
                onAssetUpdated={handleAssetUpdated}
            />
        </>
    );
};


export default Assets;

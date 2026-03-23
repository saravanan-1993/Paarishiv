import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import { fleetAPI, employeeAPI } from '../utils/api';
import CustomSelect from './CustomSelect';

const VehicleModal = ({ isOpen, onClose, onSuccess, vehicle = null }) => {
    const [formData, setFormData] = useState({
        vehicleNumber: '',
        vehicleType: 'Tipper',
        ownerType: 'Company',
        fuelType: 'Diesel',
        driverId: '',
        driverName: '',
        rcExpiry: '',
        insuranceExpiry: '',
        fcExpiry: '',
        avgMileage: 0,
        currentKm: 0,
        status: 'Active'
    });
    const [drivers, setDrivers] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchDrivers();
            if (vehicle) setFormData(vehicle);
            else setFormData({
                vehicleNumber: '',
                vehicleType: 'Tipper',
                ownerType: 'Company',
                fuelType: 'Diesel',
                driverId: '',
                driverName: '',
                rcExpiry: '',
                insuranceExpiry: '',
                fcExpiry: '',
                avgMileage: 0,
                currentKm: 0,
                status: 'Active'
            });
        }
    }, [isOpen, vehicle]);

    const fetchDrivers = async () => {
        try {
            const res = await employeeAPI.getAll();
            setDrivers(res.data.filter(e => e.roles?.includes('Driver') || e.role === 'Driver'));
        } catch (err) {
            console.error('Failed to fetch drivers', err);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (vehicle) {
                await fleetAPI.updateVehicle(vehicle.id, formData);
            } else {
                await fleetAPI.createVehicle(formData);
            }
            onSuccess();
            onClose();
        } catch (err) {
            alert('Failed to save vehicle');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div className="card animate-fade-in" style={{ width: '600px', padding: '32px', minHeight: '400px', overflow: 'visible' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
                    <h2 style={{ fontSize: '24px', fontWeight: '800' }}>{vehicle ? 'Edit Equipment' : 'Register New Equipment'}</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X /></button>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '700' }}>Vehicle Number *</label>
                            <input
                                required placeholder="e.g. TN 01 AB 1234"
                                value={formData.vehicleNumber}
                                onChange={e => setFormData({ ...formData, vehicleNumber: e.target.value })}
                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}
                            />
                        </div>
                        <div style={{ flex: 1 }}>
                            <CustomSelect
                                label="Vehicle Type"
                                options={['Tipper', 'Lorry', 'JCB', 'Tractor', 'Excavator', 'Crane', 'Concrete Mixer', 'Dumper', 'Compressor', 'Roller', 'Bulldozer', 'Backhoe Loader', 'Transit Mixer', 'Piling Rig', 'Generator', 'Water Tanker', 'Car', 'Pickup', 'Other'].map(opt => ({ value: opt, label: opt }))}
                                value={formData.vehicleType}
                                onChange={(val) => setFormData({ ...formData, vehicleType: val })}
                                width="full"
                            />
                        </div>
                        <div style={{ flex: 1 }}>
                            <CustomSelect
                                label="Owner Type"
                                options={['Company', 'Rental', 'Own'].map(opt => ({ value: opt, label: opt }))}
                                value={formData.ownerType}
                                onChange={(val) => setFormData({ ...formData, ownerType: val })}
                                width="full"
                            />
                        </div>
                        <div style={{ flex: 1 }}>
                            <CustomSelect
                                label="Assign Driver"
                                options={drivers.map(d => ({ value: d.id, label: d.fullName }))}
                                value={formData.driverId}
                                onChange={(val) => {
                                    const d = drivers.find(dr => dr.id === val);
                                    setFormData({ ...formData, driverId: val, driverName: d ? d.fullName : '' });
                                }}
                                width="full"
                                placeholder="Select Driver"
                                searchable={true}
                            />
                            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                New driver? Add them in <span style={{ color: 'var(--primary)', fontWeight: '700', cursor: 'pointer' }} onClick={() => window.location.href = '/users'}>User Management</span>
                            </p>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '700' }}>RC Expiry</label>
                            <input type="date" value={formData.rcExpiry} onChange={e => setFormData({ ...formData, rcExpiry: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }} />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '700' }}>Insurance Expiry</label>
                            <input type="date" value={formData.insuranceExpiry} onChange={e => setFormData({ ...formData, insuranceExpiry: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }} />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '700' }}>FC Expiry</label>
                            <input type="date" value={formData.fcExpiry} onChange={e => setFormData({ ...formData, fcExpiry: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }} />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '700' }}>Avg. Mileage (km/l)</label>
                            <input type="number" step="0.1" value={formData.avgMileage} onChange={e => setFormData({ ...formData, avgMileage: parseFloat(e.target.value) })} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }} />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '700' }}>Current Odometer (km)</label>
                            <input type="number" value={formData.currentKm} onChange={e => setFormData({ ...formData, currentKm: parseInt(e.target.value) })} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }} />
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                        <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={loading}>
                            {loading ? 'Saving...' : 'Save Vehicle'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default VehicleModal;

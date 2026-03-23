import React, { useState, useEffect } from 'react';
import { X, Save, IndianRupee, Truck, User, MapPin, Briefcase } from 'lucide-react';
import { fleetAPI, projectAPI, employeeAPI } from '../utils/api';
import CustomSelect from './CustomSelect';

const TripModal = ({ isOpen, onClose, onSuccess, vehicles, projects, drivers, trip = null }) => {
    const [formData, setFormData] = useState({
        tripId: Math.random().toString(36).substr(2, 6).toUpperCase(),
        vehicleId: '',
        vehicleNumber: '',
        driverId: '',
        driverName: '',
        loadType: '',
        fromLocation: '',
        toLocation: '',
        projectId: '',
        projectName: '',
        tripType: 'Project Trip',
        ratePerLoad: 0,
        customerName: '',
        totalRevenue: 0,
        totalExpense: 0,
        paymentStatus: 'Pending'
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (trip) {
                setFormData({ ...trip });
            } else {
                setFormData({
                    tripId: 'T-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
                    vehicleId: '',
                    vehicleNumber: '',
                    driverId: '',
                    driverName: '',
                    loadType: '',
                    fromLocation: '',
                    toLocation: '',
                    projectId: '',
                    projectName: '',
                    tripType: 'Project Trip',
                    ratePerLoad: 0,
                    customerName: '',
                    totalRevenue: 0,
                    totalExpense: 0,
                    paymentStatus: 'Pending'
                });
            }
        }
    }, [isOpen, trip]);

    const handleVehicleChange = (vId) => {
        const v = vehicles.find(veh => veh.id === vId);
        if (v) {
            setFormData({
                ...formData,
                vehicleId: vId,
                vehicleNumber: v.vehicleNumber,
                driverId: v.driverId || '',
                driverName: v.driverName || ''
            });
        }
    };

    const handleProjectChange = (pId) => {
        const p = projects.find(pro => (pro.id || pro._id) === pId);
        if (p) {
            setFormData({ ...formData, projectId: pId, projectName: p.name });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            // For Private Trips, ratePerLoad is the revenue
            const finalData = {
                ...formData,
                totalRevenue: formData.tripType === 'Private Trip' ? formData.ratePerLoad : formData.ratePerLoad
                // If it's a project trip, it might be an internal cost or revenue. 
                // Let's assume ratePerLoad is the value of the trip in both cases for now.
            };
            if (trip && trip.id) {
                await fleetAPI.updateTrip(trip.id, finalData);
            } else {
                await fleetAPI.createTrip(finalData);
            }
            onSuccess();
            onClose();
        } catch (err) {
            console.error('Failed to create trip', err);
            const detail = err.response?.data?.detail;
            const errorMsg = Array.isArray(detail)
                ? detail.map(d => `${d.loc.join('.')}: ${d.msg}`).join('\n')
                : detail || 'Failed to create trip';
            alert(errorMsg);
        }
        finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div className="card animate-fade-in" style={{ width: '700px', padding: '32px', maxHeight: '95vh', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
                    <h2 style={{ fontSize: '24px', fontWeight: '800' }}>Create New Trip Record</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X /></button>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {/* Header Info */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', background: '#F8FAFC', padding: '16px', borderRadius: '12px' }}>
                        <div>
                            <label style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>TRIP ID</label>
                            <div style={{ fontWeight: '700', color: 'var(--primary)', marginTop: '4px' }}>{formData.tripId}</div>
                        </div>
                        <div>
                            <label style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>DATE</label>
                            <div style={{ fontWeight: '700', marginTop: '4px' }}>{new Date().toLocaleDateString()}</div>
                        </div>
                        <div>
                            <label style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>STATUS</label>
                            <div style={{ color: '#F59E0B', fontWeight: '800', marginTop: '4px' }}>OPEN</div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        <div>
                            <CustomSelect
                                label="Select Vehicle *"
                                options={vehicles.map(v => ({ value: v.id, label: `${v.vehicleNumber} (${v.vehicleType})` }))}
                                value={formData.vehicleId}
                                onChange={handleVehicleChange}
                                width="full"
                                icon={Truck}
                                searchable={true}
                                placeholder="Choose a vehicle"
                            />
                        </div>
                        <div>
                            <CustomSelect
                                label="Assign Driver *"
                                options={drivers.map(d => ({ value: d.id, label: d.fullName }))}
                                value={formData.driverId}
                                onChange={(val) => {
                                    const d = drivers.find(dr => dr.id === val);
                                    setFormData({ ...formData, driverId: val, driverName: d ? d.fullName : '' });
                                }}
                                width="full"
                                icon={User}
                                searchable={true}
                                placeholder="Choose a driver"
                            />
                            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                New driver? Add them in <span style={{ color: 'var(--primary)', fontWeight: '700', cursor: 'pointer' }} onClick={() => window.location.href = '/hr?tab=Authorized+Users'}>HRMS</span>
                            </p>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '700' }}>Trip Type</label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                {['Project Trip', 'Private Trip'].map(type => (
                                    <button
                                        key={type} type="button"
                                        onClick={() => setFormData({ ...formData, tripType: type })}
                                        style={{
                                            flex: 1, padding: '10px', borderRadius: '8px', fontSize: '12px', fontWeight: '700',
                                            backgroundColor: formData.tripType === type ? 'var(--primary)' : 'white',
                                            color: formData.tripType === type ? 'white' : 'var(--text-muted)',
                                            border: '1px solid ' + (formData.tripType === type ? 'var(--primary)' : 'var(--border)')
                                        }}
                                    >
                                        {type}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {formData.tripType === 'Project Trip' ? (
                            <div style={{ flex: 1 }}>
                                <CustomSelect
                                    label="Project Site"
                                    options={projects.map(p => ({ value: p.id || p._id, label: p.name }))}
                                    value={formData.projectId}
                                    onChange={handleProjectChange}
                                    width="full"
                                    icon={Briefcase}
                                />
                            </div>
                        ) : (
                            <div>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '700' }}>Customer Name *</label>
                                <input required placeholder="Enter customer name" value={formData.customerName} onChange={e => setFormData({ ...formData, customerName: e.target.value.trim() })} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }} />
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: '700' }}>Load Type *</label>
                            <input value={formData.loadType} onChange={e => setFormData({ ...formData, loadType: e.target.value })} placeholder="e.g. Blue Metal, M-Sand, Cement" style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '14px' }} />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: '700' }}>Rate / Fixed Amount (₹)</label>
                            <div style={{ position: 'relative' }}>
                                <IndianRupee size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input type="number" value={formData.ratePerLoad} onChange={e => setFormData({ ...formData, ratePerLoad: parseFloat(e.target.value) || 0 })} placeholder="0" style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '14px' }} />
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: '700' }}>From Location</label>
                            <input value={formData.fromLocation} onChange={e => setFormData({ ...formData, fromLocation: e.target.value })} placeholder="Enter pickup location" style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '14px' }} />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: '700' }}>To Location</label>
                            <input value={formData.toLocation} onChange={e => setFormData({ ...formData, toLocation: e.target.value })} placeholder="Enter drop-off location" style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '14px' }} />
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                        <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={loading}>
                            {loading ? 'Processing...' : 'Start Trip'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default TripModal;

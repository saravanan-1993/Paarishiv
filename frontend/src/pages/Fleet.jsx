import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    Truck, Plus, Search, Filter, Fuel, Clock, ArrowRightLeft,
    ClipboardList, TrendingUp, IndianRupee, AlertCircle,
    CheckCircle, XCircle, MoreVertical, Edit2, Trash2,
    Calendar, MapPin, Gauge, User, Settings as SettingsIcon,
    ChevronRight, BarChart2, Download
} from 'lucide-react';
import { fleetAPI, projectAPI, employeeAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { hasPermission } from '../utils/rbac';
import VehicleModal from '../components/VehicleModal';
import TripModal from '../components/TripModal';
import TripExpenseModal from '../components/TripExpenseModal';
import DriverModal from '../components/DriverModal';
import Pagination from '../components/Pagination';

const Fleet = () => {
    const { user } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const urlTab = searchParams.get('tab');
    const [activeTab, setActiveTab] = useState('Dashboard');

    const availableTabs = useMemo(() => ['Dashboard', 'Trips', 'Vehicles', 'Drivers', 'Maintenance', 'Reports'], []);

    useEffect(() => {
        if (urlTab && availableTabs.includes(urlTab)) {
            setActiveTab(urlTab);
        }
    }, [urlTab, availableTabs]);

    const handleTabChange = (tabId) => {
        setActiveTab(tabId);
        setSearchParams({ tab: tabId });
    };

    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ summary: {}, vehicleStats: [] });
    const [vehicles, setVehicles] = useState([]);
    const [trips, setTrips] = useState([]);
    const [projects, setProjects] = useState([]);
    const [drivers, setDrivers] = useState([]);

    // Modals
    const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
    const [isTripModalOpen, setIsTripModalOpen] = useState(false);
    const [isDriverModalOpen, setIsDriverModalOpen] = useState(false);
    const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
    const [selectedTrip, setSelectedTrip] = useState(null);
    const [selectedDriver, setSelectedDriver] = useState(null);
    const PAGE_SIZE = 15;
    const [tripPage, setTripPage] = useState(1);
    const [driverPage, setDriverPage] = useState(1);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [statsRes, vehiclesRes, tripsRes, projectsRes, employeesRes] = await Promise.all([
                fleetAPI.getStats(),
                fleetAPI.getVehicles(),
                fleetAPI.getTrips(),
                projectAPI.getAll(),
                employeeAPI.getAll()
            ]);
            setStats(statsRes.data);
            setVehicles(vehiclesRes.data);
            setTrips(tripsRes.data);
            setProjects(projectsRes.data);
            setDrivers(employeesRes.data.filter(e => e.roles?.includes('Driver') || e.role === 'Driver'));
        } catch (err) {
            console.error('Failed to fetch fleet data', err);
        } finally {
            setLoading(false);
        }
    };

    const handleMarkPaid = async (tripId) => {
        try {
            await fleetAPI.updateTrip(tripId, { paymentStatus: 'Paid' });
            fetchData();
        } catch (err) {
            console.error('Failed to mark as paid', err);
        }
    };

    const handleDeleteTrip = async (tripId) => {
        if (!window.confirm('Are you sure you want to delete this trip?')) return;
        try {
            await fleetAPI.deleteTrip(tripId);
            fetchData();
        } catch (err) {
            alert('Failed to delete trip');
        }
    };

    const handleDeleteVehicle = async (vehicleId) => {
        if (!window.confirm('Are you sure you want to delete this vehicle?')) return;
        try {
            await fleetAPI.deleteVehicle(vehicleId);
            fetchData();
        } catch (err) {
            alert('Failed to delete vehicle');
        }
    };

    const renderDashboard = () => (
        <div className="animate-fade-in">
            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '32px' }}>
                {[
                    { label: "Today's Trips", value: stats.summary?.todayTrips || 0, icon: Truck, color: '#3B82F6' },
                    { label: "Today's Revenue", value: `₹${(stats.summary?.todayRevenue || 0).toLocaleString()}`, icon: IndianRupee, color: '#10B981' },
                    { label: "Total Revenue", value: `₹${(stats.summary?.totalRevenue || 0).toLocaleString()}`, icon: IndianRupee, color: '#F59E0B' },
                    { label: "Total Expense", value: `₹${(stats.summary?.totalExpense || 0).toLocaleString()}`, icon: TrendingUp, color: '#EF4444' },
                    { label: "Net Profit", value: `₹${(stats.summary?.netProfit || 0).toLocaleString()}`, icon: BarChart2, color: '#8B5CF6' },
                ].map((kpi, i) => (
                    <div key={i} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px', justifyContent: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{
                                width: '36px', height: '36px', borderRadius: '10px',
                                backgroundColor: `${kpi.color}15`, color: kpi.color,
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <kpi.icon size={18} />
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{kpi.label}</div>
                        </div>
                        <div style={{ fontSize: '20px', fontWeight: '900', color: 'var(--text-main)', marginTop: '4px' }}>{kpi.value}</div>
                    </div>
                ))}
            </div>

            {/* Tables for Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
                <div className="card">
                    <h3 style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between' }}>
                        Vehicle Wise Profitability
                        <span style={{ fontSize: '12px', color: 'var(--primary)', cursor: 'pointer' }}>View All</span>
                    </h3>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Vehicle</th>
                                <th>Trips</th>
                                <th>Revenue</th>
                                <th>Expense</th>
                                <th>Profit</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stats.vehicleStats?.map((v, i) => (
                                <tr key={i}>
                                    <td style={{ fontWeight: '700' }}>{v.vehicle}</td>
                                    <td>{v.trips}</td>
                                    <td>₹{v.revenue.toLocaleString()}</td>
                                    <td style={{ color: '#EF4444' }}>₹{v.expense.toLocaleString()}</td>
                                    <td style={{ fontWeight: '800', color: v.profit >= 0 ? '#10B981' : '#EF4444' }}>
                                        ₹{v.profit.toLocaleString()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="card">
                    <h3 style={{ marginBottom: '20px' }}>Pending Payments</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {trips.filter(t => t.paymentStatus === 'Pending' && t.status === 'Closed').length > 0 ? (
                            trips.filter(t => t.paymentStatus === 'Pending' && t.status === 'Closed').map((t, i) => (
                                <div key={i} style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontSize: '13px', fontWeight: '700' }}>{t.tripType === 'Private Trip' ? t.customerName : t.projectName}</div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>T-{t.tripId} | ₹{t.totalRevenue.toLocaleString()}</div>
                                    </div>
                                    <button
                                        className="btn btn-primary btn-sm"
                                        style={{ padding: '4px 8px', fontSize: '11px' }}
                                        onClick={() => handleMarkPaid(t.id)}
                                    >
                                        Mark Paid
                                    </button>
                                </div>
                            ))
                        ) : (
                            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>All payments cleared</div>
                        )}
                    </div>
                </div>

                <div className="card">
                    <h3 style={{ marginBottom: '20px' }}>Maintenance Alerts</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {vehicles.filter(v => {
                            // Simple alert logic: check if date is within 7 days
                            if (!v.insuranceExpiry) return false;
                            const expiry = new Date(v.insuranceExpiry);
                            const diff = expiry - new Date();
                            return diff < 7 * 24 * 60 * 60 * 1000;
                        }).map((v, i) => (
                            <div key={i} style={{ padding: '12px', borderRadius: '8px', backgroundColor: '#FEF2F2', border: '1px solid #FEE2E2', display: 'flex', gap: '10px' }}>
                                <AlertCircle size={18} color="#EF4444" />
                                <div>
                                    <div style={{ fontSize: '13px', fontWeight: '700' }}>{v.vehicleNumber} Insurance Expiring</div>
                                    <div style={{ fontSize: '11px', color: '#991B1B' }}>Expires on {v.insuranceExpiry}</div>
                                </div>
                            </div>
                        ))}
                        {vehicles.length === 0 && <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>No active alerts</div>}
                    </div>
                </div>
            </div>
        </div>
    );

    const renderTrips = () => (
        <div className="animate-fade-in">
            <div className="card" style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '16px', flex: 1 }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input type="text" placeholder="Search by Trip ID, Vehicle or Customer..." style={{ width: '100%', padding: '10px 12px 10px 40px', borderRadius: '8px', border: '1px solid var(--border)' }} />
                        </div>
                        <button className="btn btn-outline"><Filter size={18} /> Filters</button>
                    </div>
                    <button className="btn btn-primary" onClick={() => { setSelectedTrip(null); setIsTripModalOpen(true); }} style={{ marginLeft: '16px' }}>
                        <Plus size={18} /> CREATE TRIP
                    </button>
                </div>
            </div>

            <div className="card" style={{ padding: 0 }}>
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Trip ID</th>
                            <th>Vehicle & Driver</th>
                            <th>Route</th>
                            <th>Load Type</th>
                            <th>Revenue</th>
                            <th>Expense</th>
                            <th>Profit</th>
                            <th>Status/Payment</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {trips.slice((tripPage - 1) * PAGE_SIZE, tripPage * PAGE_SIZE).map((trip, i) => (
                            <tr key={i}>
                                <td style={{ fontWeight: '700', color: 'var(--primary)' }}>T-{trip.tripId}</td>
                                <td>
                                    <div style={{ fontWeight: '600' }}>{trip.vehicleNumber}</div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{trip.driverName}</div>
                                </td>
                                <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                                        {trip.fromLocation} <ChevronRight size={12} /> {trip.toLocation}
                                    </div>
                                    <div style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: '700' }}>
                                        {trip.tripType === 'Project Trip' ? trip.projectName : `Private - ${trip.customerName}`}
                                    </div>
                                </td>
                                <td>{trip.loadType}</td>
                                <td style={{ fontWeight: '700' }}>₹{trip.totalRevenue.toLocaleString()}</td>
                                <td style={{ color: '#EF4444' }}>₹{trip.totalExpense.toLocaleString()}</td>
                                <td style={{ fontWeight: '800', color: trip.netProfit >= 0 ? '#10B981' : '#EF4444' }}>
                                    ₹{trip.netProfit.toLocaleString()}
                                </td>
                                <td>
                                    <span className={`badge ${trip.status === 'Closed' ? 'badge-success' : 'badge-warning'}`} style={{ marginBottom: '4px', display: 'block', textAlign: 'center' }}>
                                        {trip.status}
                                    </span>
                                    <span style={{ fontSize: '10px', color: trip.paymentStatus === 'Paid' ? '#10B981' : '#F59E0B', fontWeight: '800' }}>
                                        {trip.paymentStatus}
                                    </span>
                                </td>
                                <td>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        {trip.paymentStatus === 'Pending' && (
                                            <button className="icon-btn" style={{ color: '#10B981' }} onClick={() => handleMarkPaid(trip.id || trip._id)} title="Mark as Paid">
                                                <CheckCircle size={16} />
                                            </button>
                                        )}
                                        <button className="icon-btn" onClick={() => { setSelectedTrip(trip); setIsExpenseModalOpen(true); }} title="Add Expenses"><IndianRupee size={16} /></button>
                                        <button className="icon-btn" onClick={() => { setSelectedTrip(trip); setIsTripModalOpen(true); }} title="Edit Trip"><Edit2 size={16} /></button>
                                        <button className="icon-btn" style={{ color: '#EF4444' }} onClick={() => handleDeleteTrip(trip.id || trip._id)} title="Delete Trip"><Trash2 size={16} /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {trips.length === 0 && (
                            <tr><td colSpan={9} style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>No trips recorded yet</td></tr>
                        )}
                    </tbody>
                </table>
                <Pagination currentPage={tripPage} totalItems={trips.length} pageSize={PAGE_SIZE} onPageChange={setTripPage} />
            </div>
        </div>
    );

    const renderVehicles = () => (
        <div className="animate-fade-in">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '24px' }}>
                {vehicles.map((v, i) => (
                    <div key={i} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                        <div style={{ padding: '20px', borderBottom: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                                <div style={{ background: '#F1F5F9', padding: '4px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: '800' }}>{v.ownerType}</div>
                                <div style={{ color: v.status === 'Active' ? '#10B981' : '#EF4444', fontSize: '11px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'currentColor' }}></div> {v.status}
                                </div>
                            </div>
                            <h3 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '4px' }}>{v.vehicleNumber}</h3>
                            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>{v.vehicleType} | {v.fuelType}</p>
                        </div>
                        <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>DRIVER</div>
                                <div style={{ fontSize: '13px', fontWeight: '700' }}>{v.driverName || 'Not Assigned'}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>AVG MILEAGE</div>
                                <div style={{ fontSize: '13px', fontWeight: '700' }}>{v.avgMileage} km/l</div>
                            </div>
                            <div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>INSURANCE</div>
                                <div style={{ fontSize: '13px', fontWeight: '700', color: '#B45309' }}>{v.insuranceExpiry || 'N/A'}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>LAST SERVICE</div>
                                <div style={{ fontSize: '13px', fontWeight: '700' }}>{v.lastServiceDate || 'N/A'}</div>
                            </div>
                        </div>
                        <div style={{ padding: '12px 20px', background: '#F8FAFC', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
                            <button className="btn btn-outline btn-sm" style={{ padding: '4px 12px' }}>History</button>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button className="icon-btn" style={{ padding: '4px' }} onClick={() => { setSelectedTrip(v); setIsVehicleModalOpen(true); }} title="Edit Vehicle"><Edit2 size={14} /></button>
                                <button className="icon-btn" style={{ padding: '4px', color: '#EF4444' }} onClick={() => handleDeleteVehicle(v.id)} title="Delete Vehicle"><Trash2 size={14} /></button>
                            </div>
                        </div>
                    </div>
                ))}
                <div
                    onClick={() => { setSelectedTrip(null); setIsVehicleModalOpen(true); }}
                    style={{
                        border: '2px dashed var(--border)', borderRadius: '16px', display: 'flex',
                        flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        padding: '40px', cursor: 'pointer', color: 'var(--text-muted)'
                    }}
                >
                    <Plus size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
                    <span style={{ fontWeight: '700' }}>Register New Vehicle</span>
                </div>
            </div>
        </div>
    );

    const renderDrivers = () => (
        <div className="animate-fade-in">
            <div className="card" style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '16px', flex: 1 }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input type="text" placeholder="Search drivers by name or phone..." style={{ width: '100%', padding: '10px 12px 10px 40px', borderRadius: '8px', border: '1px solid var(--border)' }} />
                        </div>
                    </div>
                    <button className="btn btn-primary" onClick={() => { setSelectedDriver(null); setIsDriverModalOpen(true); }} style={{ marginLeft: '16px' }}>
                        <Plus size={18} /> ADD NEW DRIVER
                    </button>
                </div>
            </div>

            <div className="card" style={{ padding: 0 }}>
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Driver Name</th>
                            <th>Contact Info</th>
                            <th>Daily Salary</th>
                            <th>License Number</th>
                            <th>License Expiry</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {drivers.slice((driverPage - 1) * PAGE_SIZE, driverPage * PAGE_SIZE).map((driver, i) => (
                            <tr key={i}>
                                <td style={{ fontWeight: '700' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--primary-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', fontWeight: '800', fontSize: '12px' }}>
                                            {driver.fullName?.charAt(0)}
                                        </div>
                                        {driver.fullName}
                                    </div>
                                </td>
                                <td>
                                    <div style={{ fontSize: '13px' }}>{driver.phone}</div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{driver.email}</div>
                                </td>
                                <td style={{ fontWeight: '700' }}>₹{driver.dailyWage || 0} / Day</td>
                                <td>{driver.licenseNumber || 'N/A'}</td>
                                <td style={{ color: driver.licenseExpiry && new Date(driver.licenseExpiry) < new Date() ? '#EF4444' : 'inherit' }}>
                                    {driver.licenseExpiry || 'N/A'}
                                </td>
                                <td>
                                    <span className={`badge ${driver.status === 'Active' ? 'badge-success' : 'badge-danger'}`}>{driver.status}</span>
                                </td>
                                <td>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button className="icon-btn" onClick={() => { setSelectedDriver(driver); setIsDriverModalOpen(true); }} title="Edit Driver"><Edit2 size={16} /></button>
                                        <button className="icon-btn" style={{ color: '#EF4444' }} onClick={async () => {
                                            if (window.confirm('Are you sure you want to delete this driver?')) {
                                                try {
                                                    await employeeAPI.delete(driver.id || driver._id);
                                                    fetchData();
                                                } catch (err) { alert('Failed to delete driver'); }
                                            }
                                        }} title="Delete Driver"><Trash2 size={16} /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {drivers.length === 0 && (
                            <tr><td colSpan={7} style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>No drivers found</td></tr>
                        )}
                    </tbody>
                </table>
                <Pagination currentPage={driverPage} totalItems={drivers.length} pageSize={PAGE_SIZE} onPageChange={setDriverPage} />
            </div>
        </div>
    );

    return (
        <div className="fleet-container" style={{ position: 'relative' }}>
            <div className="animate-fade-in" style={{ padding: '0 10px 40px 10px' }}>
                {/* Header */}
                <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h1 style={{ fontSize: '32px', fontWeight: '800', color: 'var(--text-main)', marginBottom: '4px' }}>Fleet Management</h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '15px' }}>Vehicle trips, profitability and logistics tracking</p>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button className="btn btn-outline" onClick={fetchData}><Clock size={18} /> Refresh Data</button>
                        <button className="btn btn-primary" onClick={() => setIsTripModalOpen(true)}><Plus size={18} /> NEW TRIP</button>
                    </div>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: '32px', borderBottom: '1px solid var(--border)', marginBottom: '32px' }}>
                    {availableTabs.map(tab => (
                        <button
                            key={tab}
                            onClick={() => handleTabChange(tab)}
                            style={{
                                padding: '12px 4px', fontSize: '14px', fontWeight: '700',
                                color: activeTab === tab ? 'var(--primary)' : 'var(--text-muted)',
                                borderBottom: activeTab === tab ? '2px solid var(--primary)' : '2px solid transparent',
                                background: 'none', border: 'none', cursor: 'pointer'
                            }}
                        >
                            {tab.toUpperCase()}
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}>
                        <div style={{ width: '40px', height: '40px', border: '3px solid #E2E8F0', borderTop: '3px solid var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                    </div>
                ) : (
                    <>
                        {activeTab === 'Dashboard' && renderDashboard()}
                        {activeTab === 'Trips' && renderTrips()}
                        {activeTab === 'Vehicles' && renderVehicles()}
                        {activeTab === 'Drivers' && renderDrivers()}
                        {activeTab === 'Maintenance' && (
                            <div className="animate-fade-in card">
                                <h3 style={{ marginBottom: '20px' }}>Vehicle Service & Compliance Tracker</h3>
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Vehicle</th>
                                            <th>Insurance Expiry</th>
                                            <th>FC Expiry</th>
                                            <th>Last Service</th>
                                            <th>Odometer</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {vehicles.map((v, i) => (
                                            <tr key={i}>
                                                <td style={{ fontWeight: '700' }}>{v.vehicleNumber}</td>
                                                <td style={{ color: '#B45309' }}>{v.insuranceExpiry || 'N/A'}</td>
                                                <td>{v.fcExpiry || 'N/A'}</td>
                                                <td>{v.lastServiceDate || 'N/A'}</td>
                                                <td>{v.currentKm?.toLocaleString()} km</td>
                                                <td>
                                                    <span className={`badge ${v.status === 'Active' ? 'badge-success' : 'badge-danger'}`}>{v.status}</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        {activeTab === 'Reports' && (
                            <div className="animate-fade-in card">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                                    <div>
                                        <h3 style={{ fontSize: '18px', fontWeight: '700' }}>Fleet Performance Report</h3>
                                        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Consolidated trip and profitability data</p>
                                    </div>
                                    <button className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Download size={18} /> EXPORT CSV
                                    </button>
                                </div>
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Vehicle</th>
                                            <th>Trips</th>
                                            <th>Total Revenue</th>
                                            <th>Total Expense</th>
                                            <th>Net Profit</th>
                                            <th>Efficiency</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {stats.vehicleStats?.map((v, i) => (
                                            <tr key={i}>
                                                <td>All Time</td>
                                                <td style={{ fontWeight: '700' }}>{v.vehicle}</td>
                                                <td>{v.trips}</td>
                                                <td>₹{v.revenue.toLocaleString()}</td>
                                                <td style={{ color: '#EF4444' }}>₹{v.expense.toLocaleString()}</td>
                                                <td style={{ fontWeight: '800', color: v.profit >= 0 ? '#10B981' : '#EF4444' }}>
                                                    ₹{v.profit.toLocaleString()}
                                                </td>
                                                <td style={{ fontWeight: '700' }}>
                                                    {v.revenue > 0 ? ((v.profit / v.revenue) * 100).toFixed(1) + '%' : '0%'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>
                )}

                <VehicleModal
                    isOpen={isVehicleModalOpen}
                    onClose={() => setIsVehicleModalOpen(false)}
                    onSuccess={fetchData}
                    vehicle={selectedTrip} // Reuse selectedTrip state for vehicle edit
                />
                <TripModal
                    isOpen={isTripModalOpen}
                    onClose={() => setIsTripModalOpen(false)}
                    onSuccess={fetchData}
                    vehicles={vehicles}
                    projects={projects}
                    drivers={drivers}
                    trip={selectedTrip}
                />
                <DriverModal
                    isOpen={isDriverModalOpen}
                    onClose={() => setIsDriverModalOpen(false)}
                    onSaved={fetchData}
                    driver={selectedDriver}
                />
                <TripExpenseModal
                    isOpen={isExpenseModalOpen}
                    onClose={() => setIsExpenseModalOpen(false)}
                    onSuccess={fetchData}
                    trip={selectedTrip}
                />
            </div>
        </div>
    );
};

export default Fleet;

import React, { useState, useEffect } from 'react';
import { ShoppingCart, Clock, CheckCircle, Truck, FileText, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { inventoryAPI, purchaseOrderAPI } from '../../utils/api';

const PurchaseOfficerView = () => {
    const navigate = useNavigate();
    const [pendingRequests, setPendingRequests] = useState(0);
    const [activePOs, setActivePOs] = useState(0);

    useEffect(() => {
        // Fetch material requests that are approved by coordinator and waiting for PO
        inventoryAPI.getRequests().then(res => {
            const requests = res.data || [];
            const approved = requests.filter(r => r.status === 'Approved');
            setPendingRequests(approved.length);
        }).catch(err => {
            console.error("Failed to fetch requests", err);
        });

        // Fetch POs
        purchaseOrderAPI.getAll().then(res => {
            const pos = res.data || [];
            const active = pos.filter(p => !['Completed', 'Closed', 'Rejected'].includes(p.status));
            setActivePOs(active.length);
        }).catch(err => {
            console.error("Failed to fetch POs", err);
        });
    }, []);

    return (
        <div className="po-view animate-fade-in">
            <h2 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-main)', marginBottom: '4px' }}>
                Procurement Dashboard
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', fontWeight: '500', marginBottom: '32px' }}>
                Overview of Purchase Requests, Purchase Orders, and Vendor Deliveries.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '32px' }}>
                <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '14px', borderLeft: '4px solid #F59E0B' }}>
                    <div style={{ padding: '12px', borderRadius: '10px', backgroundColor: '#FEF3C7', color: '#F59E0B', flexShrink: 0 }}>
                        <Clock size={24} />
                    </div>
                    <div>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '600', textTransform: 'uppercase' }}>Pending PO Requests</p>
                        <h3 style={{ fontSize: '24px', fontWeight: '700', lineHeight: 1 }}>{pendingRequests}</h3>
                    </div>
                </div>

                <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '14px', borderLeft: '4px solid #10B981' }}>
                    <div style={{ padding: '12px', borderRadius: '10px', backgroundColor: '#ECFDF5', color: '#10B981', flexShrink: 0 }}>
                        <CheckCircle size={24} />
                    </div>
                    <div>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '600', textTransform: 'uppercase' }}>Active POs</p>
                        <h3 style={{ fontSize: '24px', fontWeight: '700', lineHeight: 1 }}>{activePOs}</h3>
                    </div>
                </div>

                <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '14px', borderLeft: '4px solid #3B82F6' }}>
                    <div style={{ padding: '12px', borderRadius: '10px', backgroundColor: '#EFF6FF', color: '#3B82F6', flexShrink: 0 }}>
                        <Truck size={24} />
                    </div>
                    <div>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '600', textTransform: 'uppercase' }}>Vendor Order Status</p>
                        <h3 style={{ fontSize: '24px', fontWeight: '700', lineHeight: 1 }}>Tracking</h3>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
                <div className="card" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <FileText size={20} color="#3B82F6" /> Material Requests Needing PO
                        </h3>
                        <button className="btn btn-outline btn-sm" onClick={() => navigate('/workflow')} style={{ fontSize: '11px' }}>
                            View All
                        </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {pendingRequests > 0 ? (
                            <div style={{ backgroundColor: '#F0FDF4', padding: '16px', borderRadius: '12px', border: '1px solid #BBF7D0' }}>
                                <p style={{ fontSize: '14px', fontWeight: '700', color: '#166534', marginBottom: '8px' }}>{pendingRequests} Approved Requests Waiting</p>
                                <button className="btn btn-primary" onClick={() => navigate('/workflow')} style={{ width: '100%', justifyContent: 'center', backgroundColor: '#16A34A', border: 'none' }}>
                                    PROCESS REQUESTS
                                </button>
                            </div>
                        ) : (
                            <p style={{ fontSize: '14px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No approved requests waiting for Purchase Order.</p>
                        )}

                        <div style={{ marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                            <h4 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '12px' }}>Quick Actions</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <button className="btn btn-outline" onClick={() => navigate('/workflow?action=new_po')} style={{ fontSize: '12px', justifyContent: 'center' }}>
                                    <ShoppingCart size={16} /> NEW PO
                                </button>
                                <button className="btn btn-outline" onClick={() => navigate('/materials')} style={{ fontSize: '12px', justifyContent: 'center' }}>
                                    <Plus size={16} /> STOCK REQ
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="card" style={{ padding: '24px', backgroundColor: '#F8FAFC' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Clock size={20} color="#F59E0B" /> My HR Actions
                        </h3>
                        <button className="btn btn-primary btn-sm" onClick={() => navigate('/hr')} style={{ fontSize: '11px' }}>
                            HRMS
                        </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ background: 'white', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)', textAlign: 'center' }}>
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>Need time off or personal leave?</p>
                            <button className="btn btn-primary" onClick={() => navigate('/hr')} style={{ width: '100%', justifyContent: 'center', gap: '8px' }}>
                                <Plus size={18} /> APPLY FOR LEAVE
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PurchaseOfficerView;

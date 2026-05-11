import React, { useState, useEffect } from 'react';
import { Package, AlertTriangle, Building, MapPin, Warehouse } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { inventoryAPI } from '../../utils/api';

const InventoryManagerView = () => {
    const navigate = useNavigate();
    const [totalItems, setTotalItems] = useState(0);
    const [lowStockCount, setLowStockCount] = useState(0);
    const [siteCount, setSiteCount] = useState(0);

    useEffect(() => {
        inventoryAPI.getWarehouse().then(res => {
            const items = res.data || [];
            setTotalItems(items.length);
            setLowStockCount(items.filter(w => w.stock > 0 && w.stock < 10).length);
        }).catch(err => {
            console.error("Failed to fetch warehouse", err);
        });

        inventoryAPI.getRequests().then(res => {
            const reqs = res.data || [];
            const uniqueSites = new Set(reqs.map(r => r.project_id).filter(Boolean));
            setSiteCount(uniqueSites.size);
        }).catch(err => {
            console.error("Failed to fetch site requests", err);
        });
    }, []);

    return (
        <div className="inventory-view animate-fade-in">
            <h2 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-main)', marginBottom: '4px' }}>
                Inventory Dashboard
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', fontWeight: '500', marginBottom: '32px' }}>
                Overview of Central Warehouse Stock, Site Inventory & Alerts.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '32px' }}>
                <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '14px', borderLeft: '4px solid #3B82F6' }}>
                    <div style={{ padding: '12px', borderRadius: '10px', backgroundColor: '#EFF6FF', color: '#3B82F6', flexShrink: 0 }}>
                        <Package size={24} aria-hidden="true" />
                    </div>
                    <div>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '600', textTransform: 'uppercase' }}>Total Warehouse Items</p>
                        <h3 style={{ fontSize: '24px', fontWeight: '700', lineHeight: 1 }}>{totalItems}</h3>
                    </div>
                </div>

                <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '14px', borderLeft: `4px solid ${lowStockCount > 0 ? '#EF4444' : '#10B981'}` }}>
                    <div style={{ padding: '12px', borderRadius: '10px', backgroundColor: lowStockCount > 0 ? '#FEF2F2' : '#ECFDF5', color: lowStockCount > 0 ? '#EF4444' : '#10B981', flexShrink: 0 }}>
                        <AlertTriangle size={24} aria-hidden="true" />
                    </div>
                    <div>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '600', textTransform: 'uppercase' }}>Low Stock Alerts</p>
                        <h3 style={{ fontSize: '24px', fontWeight: '700', lineHeight: 1 }}>{lowStockCount}</h3>
                    </div>
                </div>

                <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '14px', borderLeft: '4px solid #10B981' }}>
                    <div style={{ padding: '12px', borderRadius: '10px', backgroundColor: '#ECFDF5', color: '#10B981', flexShrink: 0 }}>
                        <Building size={24} aria-hidden="true" />
                    </div>
                    <div>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '600', textTransform: 'uppercase' }}>Active Sites</p>
                        <h3 style={{ fontSize: '24px', fontWeight: '700', lineHeight: 1 }}>{siteCount}</h3>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
                <div className="card" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <MapPin size={20} color="#3B82F6" /> Site & Warehouse Inventory
                        </h3>
                        <button className="btn btn-outline" onClick={() => navigate('/materials')} style={{ padding: '6px 12px', fontSize: '12px' }}>
                            <Warehouse size={14} style={{ marginRight: '6px' }} /> Go to Inventory
                        </button>
                    </div>
                    <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
                        Transfer materials and review minimum stock shortages across all projects.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default InventoryManagerView;

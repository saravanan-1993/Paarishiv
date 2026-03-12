import React, { useState } from 'react';
import { X, Plus, Trash2, IndianRupee } from 'lucide-react';
import { fleetAPI } from '../utils/api';

const TripExpenseModal = ({ isOpen, onClose, onSuccess, trip }) => {
    const [expenses, setExpenses] = useState([
        { category: 'Driver Bata', amount: 0, remarks: '' },
        { category: 'Fuel', amount: 0, remarks: '' },
        { category: 'Toll', amount: 0, remarks: '' }
    ]);
    const [loading, setLoading] = useState(false);

    const addExpenseRow = () => {
        setExpenses([...expenses, { category: 'Other', amount: 0, remarks: '' }]);
    };

    const removeExpenseRow = (index) => {
        setExpenses(expenses.filter((_, i) => i !== index));
    };

    const updateExpense = (index, field, value) => {
        const newExpenses = [...expenses];
        newExpenses[index][field] = value;
        setExpenses(newExpenses);
    };

    const handleSubmit = async (shouldClose = false) => {
        setLoading(true);
        try {
            const totalExpense = expenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
            const updateData = {
                expenses: expenses,
                totalExpense: totalExpense,
                status: shouldClose ? 'Closed' : trip.status
            };
            await fleetAPI.updateTrip(trip.id, updateData);
            onSuccess();
            onClose();
        } catch (err) {
            alert('Failed to update expenses');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen || !trip) return null;

    const total = expenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div className="card animate-fade-in" style={{ width: '600px', padding: '32px', maxHeight: '90vh', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
                    <div>
                        <h2 style={{ fontSize: '24px', fontWeight: '800' }}>Trip Expenses & Close</h2>
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Trip ID: T-{trip.tripId} | Vehicle: {trip.vehicleNumber}</p>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X /></button>
                </div>

                <div style={{ marginBottom: '24px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr', gap: '12px', marginBottom: '12px', fontSize: '12px', fontWeight: '800', color: 'var(--text-muted)' }}>
                        <div>EXPENSE CATEGORY</div>
                        <div>AMOUNT</div>
                        <div>ACTION</div>
                    </div>
                    {expenses.map((exp, i) => (
                        <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr', gap: '12px', marginBottom: '8px' }}>
                            <select
                                value={exp.category}
                                onChange={e => updateExpense(i, 'category', e.target.value)}
                                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)' }}
                            >
                                <option>Driver Bata</option>
                                <option>Fuel</option>
                                <option>Toll</option>
                                <option>Loading / Unloading</option>
                                <option>Quarry Payment / Material</option>
                                <option>Maintenance</option>
                                <option>Repair</option>
                                <option>Other</option>
                            </select>
                            <div style={{ position: 'relative' }}>
                                <IndianRupee size={14} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input
                                    type="number"
                                    value={exp.amount}
                                    onChange={e => updateExpense(i, 'amount', parseFloat(e.target.value) || 0)}
                                    style={{ width: '100%', padding: '8px 8px 8px 28px', borderRadius: '6px', border: '1px solid var(--border)' }}
                                />
                            </div>
                            <button className="icon-btn" style={{ color: '#EF4444' }} onClick={() => removeExpenseRow(i)}><Trash2 size={16} /></button>
                        </div>
                    ))}
                    <button className="btn btn-outline btn-sm" onClick={addExpenseRow} style={{ marginTop: '8px' }}><Plus size={14} /> Add Line Item</button>
                </div>

                <div style={{ padding: '20px', backgroundColor: '#F8FAFC', borderRadius: '12px', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontWeight: '600' }}>Trip Revenue:</span>
                        <span style={{ fontWeight: '700' }}>₹{trip.totalRevenue.toLocaleString()}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#EF4444' }}>
                        <span style={{ fontWeight: '600' }}>Total Expenses:</span>
                        <span style={{ fontWeight: '700' }}>- ₹{total.toLocaleString()}</span>
                    </div>
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '8px', marginTop: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '18px' }}>
                        <span style={{ fontWeight: '800' }}>Estimated Profit:</span>
                        <span style={{ fontWeight: '900', color: (trip.totalRevenue - total) >= 0 ? '#10B981' : '#EF4444' }}>
                            ₹{(trip.totalRevenue - total).toLocaleString()}
                        </span>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => handleSubmit(false)} disabled={loading}>Save Progress</button>
                    <button className="btn btn-primary" style={{ flex: 2 }} onClick={() => handleSubmit(true)} disabled={loading}>
                        {loading ? 'Processing...' : 'Close Trip & Finalize'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TripExpenseModal;

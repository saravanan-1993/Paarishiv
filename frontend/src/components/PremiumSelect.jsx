import React, { useState } from 'react';
import { ChevronDown, Briefcase, Check } from 'lucide-react';

const PremiumSelect = ({ options, value, onChange, placeholder = "Select Project", icon: Icon = Briefcase }) => {
    const [isOpen, setIsOpen] = useState(false);

    const normalizedValue = (value && typeof value === 'object') ? (value.username || value.employeeCode || value._id || value.id) : value;

    const selectedOption = options.find(opt => opt.value === normalizedValue) || { label: placeholder };

    return (
        <div style={{ position: 'relative', width: '100%' }}>
            <div
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 16px',
                    backgroundColor: 'white',
                    border: '1.5px solid var(--border)',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: 'var(--text-main)'
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--primary)';
                    e.currentTarget.style.backgroundColor = '#F8FAFC';
                }}
                onMouseLeave={(e) => {
                    if (!isOpen) {
                        e.currentTarget.style.borderColor = 'var(--border)';
                        e.currentTarget.style.backgroundColor = 'white';
                    }
                }}
            >
                <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    backgroundColor: '#EFF6FF',
                    color: 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                }}>
                    <Icon size={18} />
                </div>
                <div style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {selectedOption.label}
                </div>
                <ChevronDown
                    size={18}
                    style={{
                        color: 'var(--text-muted)',
                        transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.3s ease'
                    }}
                />
            </div>

            {isOpen && (
                <>
                    <div
                        style={{ position: 'fixed', inset: 0, zIndex: 1000 }}
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="animate-fade-in" style={{
                        position: 'absolute',
                        top: 'calc(100% + 8px)',
                        left: 0,
                        right: 0,
                        backgroundColor: 'white',
                        border: '1px solid var(--border)',
                        borderRadius: '14px',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                        zIndex: 1001,
                        padding: '6px',
                        maxHeight: '300px',
                        overflowY: 'auto'
                    }}>
                        {options.map((opt) => (
                            <div
                                key={opt.value}
                                onClick={() => {
                                    onChange(opt.value);
                                    setIsOpen(false);
                                }}
                                style={{
                                    padding: '10px 14px',
                                    borderRadius: '10px',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    color: normalizedValue === opt.value ? 'var(--primary)' : 'var(--text-main)',
                                    backgroundColor: normalizedValue === opt.value ? '#F1F5F9' : 'transparent',
                                    transition: 'all 0.1s'
                                }}
                                onMouseEnter={(e) => { if (normalizedValue !== opt.value) e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
                                onMouseLeave={(e) => { if (normalizedValue !== opt.value) e.currentTarget.style.backgroundColor = 'transparent'; }}
                            >
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {opt.label}
                                </span>
                                {normalizedValue === opt.value && <Check size={16} />}
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

export default PremiumSelect;

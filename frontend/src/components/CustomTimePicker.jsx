
import React, { useState, useRef, useEffect } from 'react';
import { Clock, ChevronDown } from 'lucide-react';

const CustomTimePicker = ({ value, onChange, label }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    const [h, m] = (value || '09:00').split(':');

    const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
    const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (newH, newM) => {
        onChange(`${newH}:${newM}`);
    };

    return (
        <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
            {label && (
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>
                    {label}
                </label>
            )}
            <div
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 14px',
                    backgroundColor: 'white',
                    border: '1.5px solid var(--border)',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    transition: 'all 0.2s'
                }}
            >
                <Clock size={16} style={{ color: 'var(--text-muted)' }} />
                <span style={{ flex: 1 }}>{value || 'Select Time'}</span>
                <ChevronDown size={14} style={{ color: 'var(--text-muted)', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </div>

            {isOpen && (
                <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 5px)',
                    left: 0,
                    backgroundColor: 'white',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                    zIndex: 2005,
                    display: 'flex',
                    padding: '10px',
                    gap: '10px',
                    maxHeight: '250px'
                }}>
                    <div className="custom-scrollbar" style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '4px' }}>HRS</span>
                        {hours.map(hour => (
                            <button
                                key={hour}
                                type="button"
                                onClick={() => handleSelect(hour, m)}
                                style={{
                                    padding: '6px 12px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    backgroundColor: hour === h ? 'var(--primary)' : 'transparent',
                                    color: hour === h ? 'white' : 'var(--text-main)',
                                    fontWeight: hour === h ? '700' : '500',
                                    cursor: 'pointer',
                                    fontSize: '13px'
                                }}
                            >
                                {hour}
                            </button>
                        ))}
                    </div>
                    <div style={{ borderLeft: '1px solid var(--border)' }}></div>
                    <div className="custom-scrollbar" style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '4px' }}>MIN</span>
                        {minutes.filter(min => parseInt(min) % 5 === 0).map(min => (
                            <button
                                key={min}
                                type="button"
                                onClick={() => handleSelect(h, min)}
                                style={{
                                    padding: '6px 12px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    backgroundColor: min === m ? 'var(--primary)' : 'transparent',
                                    color: min === m ? 'white' : 'var(--text-main)',
                                    fontWeight: min === m ? '700' : '500',
                                    cursor: 'pointer',
                                    fontSize: '13px'
                                }}
                            >
                                {min}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomTimePicker;

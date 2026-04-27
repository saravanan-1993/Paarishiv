import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { ChevronDown, Briefcase, Check } from 'lucide-react';

const PremiumSelect = ({ options, value, onChange, placeholder = "Select Project", icon: Icon = Briefcase }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
    const triggerRef = useRef(null);
    const portalRef = useRef(null);

    const normalizedValue = (value && typeof value === 'object') ? (value.username || value.employeeCode || value._id || value.id) : value;
    const selectedOption = options.find(opt => opt.value === normalizedValue) || { label: placeholder };

    const updatePosition = useCallback(() => {
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const openAbove = spaceBelow < 320 && rect.top > 320;
            setDropdownPos({
                top: openAbove ? rect.top - 310 : rect.bottom + 8,
                left: rect.left,
                width: rect.width,
            });
        }
    }, []);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (triggerRef.current && !triggerRef.current.contains(event.target) &&
                portalRef.current && !portalRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            updatePosition();
            document.addEventListener('mousedown', handleClickOutside);
            window.addEventListener('scroll', updatePosition, true);
            window.addEventListener('resize', updatePosition);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('scroll', updatePosition, true);
            window.removeEventListener('resize', updatePosition);
        };
    }, [isOpen, updatePosition]);

    return (
        <div style={{ position: 'relative', width: '100%' }}>
            <div
                ref={triggerRef}
                onClick={() => { updatePosition(); setIsOpen(!isOpen); }}
                style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '10px 16px', backgroundColor: 'white',
                    border: '1.5px solid var(--border)', borderRadius: '12px',
                    cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                    fontSize: '14px', fontWeight: '600', color: 'var(--text-main)'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
                onMouseLeave={(e) => { if (!isOpen) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.backgroundColor = 'white'; } }}
            >
                <div style={{
                    width: '32px', height: '32px', borderRadius: '8px',
                    backgroundColor: '#EFF6FF', color: 'var(--primary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>
                    <Icon size={18} />
                </div>
                <div style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {selectedOption.label}
                </div>
                <ChevronDown size={18} style={{ color: 'var(--text-muted)', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s ease' }} />
            </div>

            {isOpen && ReactDOM.createPortal(
                <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => setIsOpen(false)} />
                    <div ref={portalRef} className="animate-fade-in" style={{
                        position: 'fixed',
                        top: `${dropdownPos.top}px`,
                        left: `${dropdownPos.left}px`,
                        width: `${dropdownPos.width}px`,
                        backgroundColor: 'white',
                        border: '1px solid var(--border)',
                        borderRadius: '14px',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.06)',
                        zIndex: 9999,
                        padding: '6px',
                        maxHeight: '300px',
                        overflowY: 'auto'
                    }}>
                        {options.map((opt) => (
                            <div
                                key={opt.value}
                                onClick={() => { onChange(opt.value); setIsOpen(false); }}
                                style={{
                                    padding: '10px 14px', borderRadius: '10px', fontSize: '14px', fontWeight: '600',
                                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    color: normalizedValue === opt.value ? 'var(--primary)' : 'var(--text-main)',
                                    backgroundColor: normalizedValue === opt.value ? '#F1F5F9' : 'transparent',
                                    transition: 'all 0.1s'
                                }}
                                onMouseEnter={(e) => { if (normalizedValue !== opt.value) e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
                                onMouseLeave={(e) => { if (normalizedValue !== opt.value) e.currentTarget.style.backgroundColor = 'transparent'; }}
                            >
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opt.label}</span>
                                {normalizedValue === opt.value && <Check size={16} />}
                            </div>
                        ))}
                    </div>
                </>,
                document.body
            )}
        </div>
    );
};

export default PremiumSelect;

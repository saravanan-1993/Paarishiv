import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { ChevronDown, Search, Check, Plus } from 'lucide-react';

const CustomSelect = ({
    options = [],
    value,
    onChange,
    onAdd,
    placeholder = 'Select option',
    label,
    icon: Icon,
    className = '',
    style = {},
    searchable = true,
    creatable = false,
    error = false,
    disabled = false,
    width = '200px'
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
    const dropdownRef = useRef(null);
    const buttonRef = useRef(null);
    const portalRef = useRef(null);

    // Normalize options to { value, label }
    const normalizedOptions = options.map(opt => {
        if (typeof opt === 'string') return { value: opt, label: opt };
        return {
            value: opt.value !== undefined ? opt.value : (opt.id || opt._id),
            label: opt.label || opt.name || opt.fullName || opt.bill_no || opt.voucher_no || 'Option',
            ...opt
        };
    });

    const normalizedValue = (value && typeof value === 'object') ? (value.username || value.employeeCode || value._id || value.id) : value;
    const selectedOption = normalizedOptions.find(opt => opt.value === normalizedValue);
    const displayValue = selectedOption ? selectedOption.label : placeholder;

    const filteredOptions = normalizedOptions.filter(opt => {
        const labelText = (opt.label || '').toLowerCase();
        return labelText.includes(searchQuery.toLowerCase());
    });

    // Calculate dropdown position relative to viewport
    const updatePosition = useCallback(() => {
        if (buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const dropdownHeight = 320; // max-height of dropdown
            const openAbove = spaceBelow < dropdownHeight && rect.top > dropdownHeight;

            setDropdownPos({
                top: openAbove ? rect.top - dropdownHeight - 4 : rect.bottom + 4,
                left: rect.left,
                width: rect.width,
                openAbove
            });
        }
    }, []);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target) &&
                portalRef.current && !portalRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            updatePosition();
            document.addEventListener('mousedown', handleClickOutside);
            window.addEventListener('scroll', updatePosition, true);
            window.addEventListener('resize', updatePosition);
        } else {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('scroll', updatePosition, true);
            window.removeEventListener('resize', updatePosition);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('scroll', updatePosition, true);
            window.removeEventListener('resize', updatePosition);
        };
    }, [isOpen, updatePosition]);

    return (
        <div
            className={`custom-select-container ${className}`}
            ref={dropdownRef}
            style={{
                position: 'relative',
                width: width === 'full' ? '100%' : width,
                ...style
            }}
        >
            {label && (
                <label style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: '700',
                    color: 'var(--text-muted)',
                    marginBottom: '6px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.025em'
                }}>
                    {label}
                </label>
            )}

            <button
                ref={buttonRef}
                type="button"
                disabled={disabled}
                onClick={() => { if (!disabled) { updatePosition(); setIsOpen(!isOpen); } }}
                style={{
                    width: '100%',
                    display: 'flex',
                    itemsCenter: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 16px',
                    backgroundColor: disabled ? '#F8FAFC' : 'white',
                    border: `1.5px solid ${error ? '#EF4444' : (isOpen ? 'var(--primary)' : 'var(--border)')}`,
                    borderRadius: 'var(--radius-lg)',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: isOpen ? '0 0 0 4px rgba(37, 99, 235, 0.1)' : 'var(--shadow-sm)',
                    fontSize: '14px',
                    color: 'var(--text-main)',
                    outline: 'none',
                    textAlign: 'left',
                    gap: '12px',
                    alignItems: 'center'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden', flex: 1 }}>
                    {Icon && (
                        <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            backgroundColor: isOpen ? 'rgba(37, 99, 235, 0.1)' : 'rgba(100, 116, 139, 0.05)',
                            color: isOpen ? 'var(--primary)' : 'var(--text-muted)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            transition: 'all 0.2s'
                        }}>
                            <Icon size={18} />
                        </div>
                    )}
                    <span style={{
                        display: 'block',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontWeight: selectedOption ? '600' : '500',
                        color: selectedOption ? 'var(--text-main)' : 'var(--text-muted)',
                        flex: 1
                    }}>
                        {displayValue}
                    </span>
                </div>
                <ChevronDown
                    size={18}
                    style={{
                        color: 'var(--text-muted)',
                        transition: 'transform 0.2s',
                        transform: isOpen ? 'rotate(180deg)' : 'rotate(0)'
                    }}
                />
            </button>

            {isOpen && ReactDOM.createPortal(
                <div
                    ref={portalRef}
                    style={{
                        position: 'fixed',
                        top: `${dropdownPos.top}px`,
                        left: `${dropdownPos.left}px`,
                        width: `${dropdownPos.width}px`,
                        zIndex: 9999,
                        backgroundColor: 'white',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-lg, 12px)',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.06)',
                        overflow: 'hidden',
                    }}
                >
                    {searchable && (
                        <div style={{
                            padding: '10px',
                            borderBottom: '1px solid var(--border)',
                            backgroundColor: '#F8FAFC'
                        }}>
                            <div style={{ position: 'relative' }}>
                                <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder={creatable ? "Type to search or add new..." : "Search..."}
                                    style={{
                                        width: '100%',
                                        padding: '8px 12px 8px 36px',
                                        fontSize: '13px',
                                        backgroundColor: 'white',
                                        border: '1px solid var(--border)',
                                        borderRadius: '8px',
                                        outline: 'none',
                                        transition: 'border-color 0.2s'
                                    }}
                                    autoFocus
                                    onKeyDown={e => e.stopPropagation()}
                                />
                            </div>
                        </div>
                    )}

                    <div
                        className="custom-scrollbar"
                        style={{
                            maxHeight: '280px',
                            overflowY: 'auto',
                            padding: '6px'
                        }}
                    >
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((option) => {
                                const isSelected = normalizedValue === option.value;

                                return (
                                    <button
                                        key={String(option.value)}
                                        type="button"
                                        onClick={() => {
                                            onChange(option.value);
                                            setIsOpen(false);
                                            setSearchQuery('');
                                        }}
                                        style={{
                                            width: '100%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '10px 14px',
                                            borderRadius: '8px',
                                            fontSize: '14px',
                                            transition: 'all 0.15s',
                                            marginBottom: '2px',
                                            border: 'none',
                                            cursor: 'pointer',
                                            textAlign: 'left',
                                            backgroundColor: isSelected ? 'rgba(37, 99, 235, 0.08)' : 'transparent',
                                            color: isSelected ? 'var(--primary)' : 'var(--text-main)',
                                            fontWeight: isSelected ? '700' : '500',
                                        }}
                                        onMouseEnter={e => {
                                            if (!isSelected) e.currentTarget.style.backgroundColor = '#F1F5F9';
                                        }}
                                        onMouseLeave={e => {
                                            if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                                        }}
                                    >
                                        <span style={{
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                            flex: 1
                                        }} title={option.label}>
                                            {option.label}
                                        </span>
                                        {isSelected && <Check size={16} style={{ color: 'var(--primary)', flexShrink: 0, marginLeft: '8px' }} />}
                                    </button>
                                );
                            })
                        ) : (
                            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                                No options found
                            </div>
                        )}
                        {/* Show "Add <typed value>" when user types something new */}
                        {creatable && searchQuery.trim() && !normalizedOptions.some(o => o.label.toLowerCase() === searchQuery.trim().toLowerCase()) && (
                            <button
                                type="button"
                                onClick={async () => {
                                    const val = searchQuery.trim();
                                    if (onAdd) await onAdd(val);
                                    onChange(val);
                                    setIsOpen(false);
                                    setSearchQuery('');
                                }}
                                style={{
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '10px 14px',
                                    borderRadius: '8px',
                                    fontSize: '14px',
                                    border: 'none',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    backgroundColor: '#eff6ff',
                                    color: 'var(--primary)',
                                    fontWeight: '600',
                                    marginTop: '4px',
                                    borderTop: '1px solid var(--border)',
                                }}
                            >
                                <Plus size={14} /> Add "{searchQuery.trim()}"
                            </button>
                        )}
                        {/* Always show "Add New" button when creatable and user hasn't typed anything */}
                        {creatable && !searchQuery.trim() && (
                            <button
                                type="button"
                                onClick={async (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const newValue = window.prompt(`Enter new ${label ? label.replace(' *', '').toLowerCase() : 'value'}:`);
                                    if (newValue && newValue.trim()) {
                                        if (onAdd) await onAdd(newValue.trim());
                                        onChange(newValue.trim());
                                        setIsOpen(false);
                                        setSearchQuery('');
                                    }
                                }}
                                style={{
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '12px 14px',
                                    borderRadius: '8px',
                                    fontSize: '14px',
                                    border: 'none',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    backgroundColor: '#f0fdf4',
                                    color: '#059669',
                                    fontWeight: '700',
                                    marginTop: '4px',
                                    borderTop: '1px solid var(--border)',
                                }}
                            >
                                <Plus size={16} /> Add New {label ? label.replace(' *', '') : 'Value'}
                            </button>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default CustomSelect;

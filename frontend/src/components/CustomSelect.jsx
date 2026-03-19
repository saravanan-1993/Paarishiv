import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, Check, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const CustomSelect = ({
    options = [],
    value,
    onChange,
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
    const dropdownRef = useRef(null);

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

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        } else {
            document.removeEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

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
                type="button"
                disabled={disabled}
                onClick={() => !disabled && setIsOpen(!isOpen)}
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

            {isOpen && (
                <div
                    style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        zIndex: 1000,
                        backgroundColor: 'white',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-lg)',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                        overflow: 'hidden',
                        marginTop: '4px'
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
                                    placeholder="Search..."
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
                        {creatable && searchQuery.trim() && !normalizedOptions.some(o => o.label.toLowerCase() === searchQuery.trim().toLowerCase()) && (
                            <button
                                type="button"
                                onClick={() => {
                                    onChange(searchQuery.trim());
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
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomSelect;

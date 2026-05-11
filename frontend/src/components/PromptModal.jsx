import React, { useState, useEffect } from 'react';
import { X, AlertTriangle } from 'lucide-react';

const PromptModal = ({
    isOpen,
    onClose,
    onSubmit,
    title = 'Enter Reason',
    message = '',
    placeholder = 'Type your response here…',
    confirmText = 'Submit',
    cancelText = 'Cancel',
    defaultValue = '',
    required = false,
    danger = false,
    multiline = true
}) => {
    const [value, setValue] = useState(defaultValue);

    useEffect(() => {
        if (isOpen) setValue(defaultValue);
    }, [isOpen, defaultValue]);

    useEffect(() => {
        if (!isOpen) return;
        const handler = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e?.preventDefault?.();
        if (required && !value.trim()) return;
        onSubmit(value);
        onClose();
    };

    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(15, 23, 42, 0.55)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 99980,
                animation: 'pm-fade 150ms ease-out'
            }}
        >
            <form
                onClick={(e) => e.stopPropagation()}
                onSubmit={handleSubmit}
                role="dialog"
                aria-modal="true"
                style={{
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
                    maxWidth: '480px',
                    width: '90%',
                    overflow: 'hidden',
                    animation: 'pm-pop 180ms ease-out'
                }}
            >
                <div style={{ padding: '20px 20px 0', display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                    <div style={{
                        width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0,
                        backgroundColor: danger ? '#FEF2F2' : '#EFF6FF',
                        color: danger ? '#EF4444' : '#3B82F6',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <AlertTriangle size={22} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>{title}</h3>
                        {message && <p style={{ marginTop: '6px', marginBottom: 0, fontSize: '13px', color: '#475569', lineHeight: 1.5 }}>{message}</p>}
                    </div>
                    <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 0 }}>
                        <X size={18} />
                    </button>
                </div>
                <div style={{ padding: '16px 20px 0' }}>
                    {multiline ? (
                        <textarea
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            placeholder={placeholder}
                            rows={4}
                            autoFocus
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                borderRadius: '8px',
                                border: '1px solid #E2E8F0',
                                fontSize: '14px',
                                fontFamily: 'inherit',
                                resize: 'vertical',
                                outline: 'none'
                            }}
                        />
                    ) : (
                        <input
                            type="text"
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            placeholder={placeholder}
                            autoFocus
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                borderRadius: '8px',
                                border: '1px solid #E2E8F0',
                                fontSize: '14px',
                                outline: 'none'
                            }}
                        />
                    )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '16px 20px 20px' }}>
                    <button
                        type="button"
                        onClick={onClose}
                        style={{
                            padding: '8px 16px', borderRadius: '8px', fontWeight: 600, fontSize: '13px',
                            border: '1px solid #E2E8F0', backgroundColor: 'white', color: '#475569',
                            cursor: 'pointer'
                        }}
                    >
                        {cancelText}
                    </button>
                    <button
                        type="submit"
                        disabled={required && !value.trim()}
                        style={{
                            padding: '8px 16px', borderRadius: '8px', fontWeight: 600, fontSize: '13px',
                            border: 'none',
                            backgroundColor: danger ? '#EF4444' : 'var(--primary, #3B82F6)',
                            color: 'white',
                            cursor: (required && !value.trim()) ? 'not-allowed' : 'pointer',
                            opacity: (required && !value.trim()) ? 0.6 : 1
                        }}
                    >
                        {confirmText}
                    </button>
                </div>
                <style>{`
                    @keyframes pm-fade { from { opacity: 0; } to { opacity: 1; } }
                    @keyframes pm-pop  { from { transform: scale(.96); opacity: 0; } to { transform: scale(1); opacity: 1; } }
                `}</style>
            </form>
        </div>
    );
};

export default PromptModal;

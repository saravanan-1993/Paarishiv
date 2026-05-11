import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

const ConfirmContext = createContext(null);

export const ConfirmProvider = ({ children }) => {
    const [state, setState] = useState(null); // { title, message, confirmText, cancelText, danger, resolve }

    const confirm = useCallback((options) => {
        return new Promise((resolve) => {
            const config = typeof options === 'string' ? { message: options } : (options || {});
            setState({
                title: config.title || 'Confirm Action',
                message: config.message || 'Are you sure?',
                confirmText: config.confirmText || 'Confirm',
                cancelText: config.cancelText || 'Cancel',
                danger: !!config.danger,
                resolve
            });
        });
    }, []);

    const handleConfirm = useCallback(() => {
        if (state?.resolve) state.resolve(true);
        setState(null);
    }, [state]);

    const handleCancel = useCallback(() => {
        if (state?.resolve) state.resolve(false);
        setState(null);
    }, [state]);

    useEffect(() => {
        if (!state) return;
        const handleEsc = (e) => {
            if (e.key === 'Escape') handleCancel();
            else if (e.key === 'Enter') handleConfirm();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [state, handleConfirm, handleCancel]);

    return (
        <ConfirmContext.Provider value={confirm}>
            {children}
            {state && (
                <div
                    onClick={handleCancel}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        backgroundColor: 'rgba(15, 23, 42, 0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 99990,
                        animation: 'cd-fade 150ms ease-out'
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="confirm-title"
                        style={{
                            backgroundColor: 'white',
                            borderRadius: '12px',
                            boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
                            maxWidth: '440px',
                            width: '90%',
                            overflow: 'hidden',
                            animation: 'cd-pop 180ms ease-out'
                        }}
                    >
                        <div style={{ padding: '20px 20px 0', display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                            <div style={{
                                width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0,
                                backgroundColor: state.danger ? '#FEF2F2' : '#FEF3C7',
                                color: state.danger ? '#EF4444' : '#F59E0B',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <AlertTriangle size={22} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <h3 id="confirm-title" style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>{state.title}</h3>
                                <p style={{ marginTop: '6px', marginBottom: 0, fontSize: '14px', color: '#475569', lineHeight: 1.5 }}>{state.message}</p>
                            </div>
                            <button onClick={handleCancel} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 0 }}>
                                <X size={18} />
                            </button>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '16px 20px 20px', marginTop: '12px' }}>
                            <button
                                onClick={handleCancel}
                                style={{
                                    padding: '8px 16px', borderRadius: '8px', fontWeight: 600, fontSize: '13px',
                                    border: '1px solid #E2E8F0', backgroundColor: 'white', color: '#475569',
                                    cursor: 'pointer'
                                }}
                            >
                                {state.cancelText}
                            </button>
                            <button
                                onClick={handleConfirm}
                                autoFocus
                                style={{
                                    padding: '8px 16px', borderRadius: '8px', fontWeight: 600, fontSize: '13px',
                                    border: 'none',
                                    backgroundColor: state.danger ? '#EF4444' : 'var(--primary, #3B82F6)',
                                    color: 'white',
                                    cursor: 'pointer'
                                }}
                            >
                                {state.confirmText}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <style>{`
                @keyframes cd-fade { from { opacity: 0; } to { opacity: 1; } }
                @keyframes cd-pop  { from { transform: scale(.96); opacity: 0; } to { transform: scale(1); opacity: 1; } }
            `}</style>
        </ConfirmContext.Provider>
    );
};

export const useConfirm = () => {
    const ctx = useContext(ConfirmContext);
    if (!ctx) {
        // Fallback to native confirm if used outside provider
        return (options) => {
            const msg = typeof options === 'string' ? options : (options?.message || 'Are you sure?');
            return Promise.resolve(window.confirm(msg));
        };
    }
    return ctx;
};

export default ConfirmContext;

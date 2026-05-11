import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

let _id = 0;
const nextId = () => ++_id;

const TYPE_STYLES = {
    success: { bg: '#ECFDF5', color: '#065F46', border: '#10B981', Icon: CheckCircle2 },
    error:   { bg: '#FEF2F2', color: '#991B1B', border: '#EF4444', Icon: AlertCircle },
    warning: { bg: '#FFFBEB', color: '#92400E', border: '#F59E0B', Icon: AlertCircle },
    info:    { bg: '#EFF6FF', color: '#1E40AF', border: '#3B82F6', Icon: Info },
};

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const showToast = useCallback((type, message, duration = 4000) => {
        const id = nextId();
        setToasts(prev => [...prev, { id, type, message }]);
        if (duration > 0) {
            setTimeout(() => removeToast(id), duration);
        }
        return id;
    }, [removeToast]);

    const toast = {
        success: (msg, duration) => showToast('success', msg, duration),
        error:   (msg, duration) => showToast('error', msg, duration ?? 6000),
        warning: (msg, duration) => showToast('warning', msg, duration),
        info:    (msg, duration) => showToast('info', msg, duration),
        dismiss: removeToast,
    };

    return (
        <ToastContext.Provider value={toast}>
            {children}
            {/* Toast container */}
            <div style={{
                position: 'fixed',
                top: '20px',
                right: '20px',
                zIndex: 99999,
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                maxWidth: '420px',
                pointerEvents: 'none'
            }}>
                {toasts.map(t => {
                    const style = TYPE_STYLES[t.type] || TYPE_STYLES.info;
                    const { Icon } = style;
                    return (
                        <div key={t.id} role="alert" style={{
                            backgroundColor: style.bg,
                            color: style.color,
                            border: `1px solid ${style.border}`,
                            borderLeft: `4px solid ${style.border}`,
                            padding: '12px 14px',
                            borderRadius: '8px',
                            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '10px',
                            fontSize: '14px',
                            fontWeight: 500,
                            pointerEvents: 'auto',
                            animation: 'toast-in 200ms ease-out'
                        }}>
                            <Icon size={18} style={{ flexShrink: 0, marginTop: '1px', color: style.border }} />
                            <div style={{ flex: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{t.message}</div>
                            <button
                                onClick={() => removeToast(t.id)}
                                aria-label="Dismiss"
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: style.color, padding: 0, opacity: 0.6 }}
                            >
                                <X size={16} />
                            </button>
                        </div>
                    );
                })}
            </div>
            <style>{`
                @keyframes toast-in {
                    from { transform: translateX(20px); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `}</style>
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const ctx = useContext(ToastContext);
    if (!ctx) {
        // Fallback if used outside provider — avoids hard crash. Returns a no-op shim that delegates to alert.
        return {
            success: (m) => { try { window.alert(m); } catch {} },
            error:   (m) => { try { window.alert(m); } catch {} },
            warning: (m) => { try { window.alert(m); } catch {} },
            info:    (m) => { try { window.alert(m); } catch {} },
            dismiss: () => {},
        };
    }
    return ctx;
};

export default ToastContext;

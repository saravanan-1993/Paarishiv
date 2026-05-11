// Centralized formatting helpers for currency, numbers, and dates.
// Use these instead of redefining fmt() in each page.

export const fmtCurrency = (n) => {
    if (n === null || n === undefined || n === '') return '₹0';
    const num = Number(n);
    if (Number.isNaN(num)) return '₹0';
    if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
    if (num >= 100000)   return `₹${(num / 100000).toFixed(2)} L`;
    return `₹${num.toLocaleString('en-IN')}`;
};

export const fmtNumber = (n) => {
    if (n === null || n === undefined || n === '') return '0';
    const num = Number(n);
    if (Number.isNaN(num)) return '0';
    return num.toLocaleString('en-IN');
};

export const fmtDate = (iso, opts) => {
    if (!iso) return '—';
    try {
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return '—';
        return d.toLocaleDateString('en-IN', opts || { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
        return '—';
    }
};

export const fmtDateTime = (iso) => {
    if (!iso) return '—';
    try {
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return '—';
        return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
        return '—';
    }
};

// Alias for the most common case
export const fmt = fmtCurrency;

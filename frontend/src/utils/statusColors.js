// Centralized status color palette. Use instead of redeclaring in every page.
// Each entry returns the bg + text + border colour and an icon hint.

export const STATUS_COLORS = {
    // Project / generic
    Ongoing:            { bg: '#DBEAFE', text: '#1D4ED8', accent: '#3B82F6' },
    Completed:          { bg: '#D1FAE5', text: '#047857', accent: '#10B981' },
    'On Hold':          { bg: '#FEF3C7', text: '#B45309', accent: '#F59E0B' },
    Delayed:            { bg: '#FEE2E2', text: '#B91C1C', accent: '#EF4444' },
    Cancelled:          { bg: '#F3F4F6', text: '#4B5563', accent: '#6B7280' },

    // Task / leave / approval
    Pending:            { bg: '#FEF3C7', text: '#B45309', accent: '#F59E0B' },
    Approved:           { bg: '#D1FAE5', text: '#047857', accent: '#10B981' },
    Rejected:           { bg: '#FEE2E2', text: '#B91C1C', accent: '#EF4444' },
    'In Progress':      { bg: '#DBEAFE', text: '#1D4ED8', accent: '#3B82F6' },

    // Bill / Payment
    Paid:               { bg: '#D1FAE5', text: '#047857', accent: '#10B981' },
    Partial:            { bg: '#FEF3C7', text: '#B45309', accent: '#F59E0B' },
    Unpaid:             { bg: '#FEE2E2', text: '#B91C1C', accent: '#EF4444' },
    Overdue:            { bg: '#FEE2E2', text: '#B91C1C', accent: '#EF4444' },
    Draft:              { bg: '#F3F4F6', text: '#4B5563', accent: '#6B7280' },
    'Partially Paid':   { bg: '#FEF3C7', text: '#B45309', accent: '#F59E0B' },

    // Inventory
    'In Stock':         { bg: '#D1FAE5', text: '#047857', accent: '#10B981' },
    'Low Stock':        { bg: '#FEF3C7', text: '#B45309', accent: '#F59E0B' },
    'Out of Stock':     { bg: '#FEE2E2', text: '#B91C1C', accent: '#EF4444' },
};

const DEFAULT_STATUS = { bg: '#F3F4F6', text: '#4B5563', accent: '#6B7280' };

export const getStatusStyle = (status) => STATUS_COLORS[status] || DEFAULT_STATUS;

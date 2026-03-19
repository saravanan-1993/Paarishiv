import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const Pagination = ({ currentPage, totalItems, pageSize = 20, onPageChange }) => {
    const totalPages = Math.ceil(totalItems / pageSize);
    if (totalPages <= 1) return null;

    const pages = [];
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, currentPage + 2);
    for (let i = start; i <= end; i++) pages.push(i);

    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', borderTop: '1px solid var(--border)', marginTop: '16px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600' }}>
                Showing {Math.min((currentPage - 1) * pageSize + 1, totalItems)}–{Math.min(currentPage * pageSize, totalItems)} of {totalItems}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'white', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', opacity: currentPage === 1 ? 0.4 : 1 }}
                >
                    <ChevronLeft size={16} />
                </button>
                {start > 1 && <>
                    <button onClick={() => onPageChange(1)} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>1</button>
                    {start > 2 && <span style={{ padding: '0 4px', color: 'var(--text-muted)' }}>...</span>}
                </>}
                {pages.map(p => (
                    <button
                        key={p}
                        onClick={() => onPageChange(p)}
                        style={{
                            padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border)',
                            background: p === currentPage ? 'var(--primary)' : 'white',
                            color: p === currentPage ? 'white' : 'var(--text-main)',
                            cursor: 'pointer', fontSize: '13px', fontWeight: '700'
                        }}
                    >
                        {p}
                    </button>
                ))}
                {end < totalPages && <>
                    {end < totalPages - 1 && <span style={{ padding: '0 4px', color: 'var(--text-muted)' }}>...</span>}
                    <button onClick={() => onPageChange(totalPages)} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>{totalPages}</button>
                </>}
                <button
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'white', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', opacity: currentPage === totalPages ? 0.4 : 1 }}
                >
                    <ChevronRight size={16} />
                </button>
            </div>
        </div>
    );
};

export default Pagination;

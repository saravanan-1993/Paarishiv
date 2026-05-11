import React from 'react';

const baseStyle = {
    backgroundColor: '#E2E8F0',
    backgroundImage: 'linear-gradient(90deg, #E2E8F0 0px, #F1F5F9 40px, #E2E8F0 80px)',
    backgroundSize: '600px',
    borderRadius: '6px',
    animation: 'skeleton-shimmer 1.4s ease infinite',
    display: 'inline-block'
};

/** Generic skeleton block. Pass width/height (string with units) or numbers. */
export const Skeleton = ({ width = '100%', height = '16px', radius = '6px', style = {}, className = '' }) => (
    <span
        aria-hidden="true"
        className={className}
        style={{
            ...baseStyle,
            width: typeof width === 'number' ? `${width}px` : width,
            height: typeof height === 'number' ? `${height}px` : height,
            borderRadius: typeof radius === 'number' ? `${radius}px` : radius,
            ...style
        }}
    />
);

/** Card-shaped skeleton (matches `.card` size roughly). */
export const SkeletonCard = ({ height = 160, style = {} }) => (
    <div className="card" style={{ padding: '20px', ...style }} aria-busy="true">
        <Skeleton width="40%" height={18} />
        <div style={{ marginTop: '12px' }}>
            <Skeleton width="100%" height={12} style={{ marginBottom: '8px' }} />
            <Skeleton width="90%" height={12} style={{ marginBottom: '8px' }} />
            <Skeleton width="70%" height={12} />
        </div>
        <div style={{ marginTop: '16px' }}>
            <Skeleton width={140} height={28} radius={14} />
        </div>
    </div>
);

/** KPI card skeleton (icon + 2 lines). */
export const SkeletonKpi = () => (
    <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '14px', borderLeft: '4px solid #E2E8F0' }} aria-busy="true">
        <Skeleton width={48} height={48} radius={10} />
        <div style={{ flex: 1 }}>
            <Skeleton width="60%" height={11} style={{ marginBottom: '6px' }} />
            <Skeleton width="40%" height={24} />
        </div>
    </div>
);

/** Table row skeleton. */
export const SkeletonRow = ({ cols = 5 }) => (
    <tr aria-busy="true">
        {Array.from({ length: cols }).map((_, i) => (
            <td key={i}><Skeleton width={`${60 + (i % 3) * 10}%`} height={14} /></td>
        ))}
    </tr>
);

/** Inject global keyframes once. */
export const SkeletonGlobalStyles = () => (
    <style>{`@keyframes skeleton-shimmer { 0% { background-position: -200px 0; } 100% { background-position: 600px 0; } }`}</style>
);

export default Skeleton;

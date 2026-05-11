// Build a safe URL for a stored logo/avatar path.
// Handles full URLs, /static paths, /api paths, and bare filenames.
export const buildLogoUrl = (raw) => {
    if (!raw) return '';
    const s = String(raw).trim();
    if (!s) return '';
    if (s.startsWith('http://') || s.startsWith('https://')) return s;
    if (s.startsWith('data:')) return s;
    if (s.startsWith('/static/') || s.startsWith('/api/')) return s;
    // Bare filename or relative path — prefix with /api/
    return `/api/${s.replace(/^\/+/, '')}`;
};

export default buildLogoUrl;

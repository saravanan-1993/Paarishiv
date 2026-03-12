import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Lock, User, Building2, Eye, EyeOff, LayoutDashboard, ChevronRight } from 'lucide-react';

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const { login, user } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (user) {
            navigate('/');
        }
    }, [user, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoggingIn(true);

        try {
            const success = await login(username, password);
            if (success) {
                navigate('/');
            } else {
                setError('Invalid username or password');
            }
        } catch (err) {
            setError('Login failed. Please check your connection.');
        } finally {
            setIsLoggingIn(false);
        }
    };

    const handleDemoLogin = async (dUsername, dPassword) => {
        setUsername(dUsername);
        setPassword(dPassword);
        setError('');
        setIsLoggingIn(true);

        try {
            const success = await login(dUsername, dPassword);
            if (success) {
                navigate('/');
            } else {
                setError('Invalid demo credentials');
            }
        } catch (err) {
            setError('Login failed. Please check your connection.');
        } finally {
            setIsLoggingIn(false);
        }
    };

    const demoRoles = [
        { label: 'Site Engineer', username: 'engineer', password: 'password' },
        { label: 'Coordinator', username: 'coordinator', password: 'password' },
        { label: 'Purchase Officer', username: 'purchase', password: 'password' },
        { label: 'Accountant', username: 'accountant', password: 'password' },
        { label: 'Super Admin', username: 'admin', password: 'password', full: true }
    ];

    return (
        <div style={{
            height: '100vh',
            width: '100vw',
            display: 'grid',
            gridTemplateColumns: 'minmax(400px, 1fr) 1.5fr',
            backgroundColor: 'white',
            overflow: 'hidden',
            fontFamily: 'Inter, system-ui, sans-serif'
        }}>
            {/* Left Side: Login Form */}
            <div style={{
                padding: '60px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                backgroundColor: 'white',
                borderRight: '1px solid #f1f5f9'
            }}>
                <div style={{ maxWidth: '400px', width: '100%', margin: '0 auto' }}>
                    <div style={{ marginBottom: '40px' }}>
                        <div style={{
                            width: '48px',
                            height: '48px',
                            backgroundColor: 'var(--primary)',
                            borderRadius: '14px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            marginBottom: '20px',
                            boxShadow: '0 8px 16px rgba(47, 93, 138, 0.2)'
                        }}>
                            <Building2 size={24} />
                        </div>
                        <h1 style={{ fontSize: '32px', color: 'var(--text-main)', fontWeight: '800', marginBottom: '8px' }}>Welcome Back</h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '15px' }}>Sign in to continue to Civil ERP Site Management.</p>
                    </div>

                    <form onSubmit={handleSubmit}>
                        {error && (
                            <div className="animate-fade-in" style={{
                                padding: '14px',
                                backgroundColor: '#FEF2F2',
                                color: '#EF4444',
                                borderRadius: '10px',
                                fontSize: '13px',
                                marginBottom: '24px',
                                border: '1px solid #FEE2E2',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}>
                                <span style={{ fontWeight: 'bold' }}>!</span> {error}
                            </div>
                        )}

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: 'var(--text-main)' }}>Username</label>
                            <div style={{ position: 'relative' }}>
                                <User size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="e.g. admin"
                                    style={{
                                        width: '100%',
                                        padding: '14px 16px 14px 48px',
                                        borderRadius: '12px',
                                        border: '1px solid var(--border)',
                                        outline: 'none',
                                        fontSize: '15px',
                                        transition: 'all 0.2s ease',
                                        backgroundColor: '#F9FAFB'
                                    }}
                                    onFocus={(e) => {
                                        e.target.style.borderColor = 'var(--primary)';
                                        e.target.style.backgroundColor = 'white';
                                        e.target.style.boxShadow = '0 0 0 4px rgba(47, 93, 138, 0.1)';
                                    }}
                                    onBlur={(e) => {
                                        e.target.style.borderColor = 'var(--border)';
                                        e.target.style.backgroundColor = '#F9FAFB';
                                        e.target.style.boxShadow = 'none';
                                    }}
                                    required
                                />
                            </div>
                        </div>

                        <div style={{ marginBottom: '32px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: 'var(--text-main)' }}>Password</label>
                            <div style={{ position: 'relative' }}>
                                <Lock size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    style={{
                                        width: '100%',
                                        padding: '14px 48px 14px 48px',
                                        borderRadius: '12px',
                                        border: '1px solid var(--border)',
                                        outline: 'none',
                                        fontSize: '15px',
                                        transition: 'all 0.2s ease',
                                        backgroundColor: '#F9FAFB'
                                    }}
                                    onFocus={(e) => {
                                        e.target.style.borderColor = 'var(--primary)';
                                        e.target.style.backgroundColor = 'white';
                                        e.target.style.boxShadow = '0 0 0 4px rgba(47, 93, 138, 0.1)';
                                    }}
                                    onBlur={(e) => {
                                        e.target.style.borderColor = 'var(--border)';
                                        e.target.style.backgroundColor = '#F9FAFB';
                                        e.target.style.boxShadow = 'none';
                                    }}
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    style={{
                                        position: 'absolute',
                                        right: '16px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        color: 'var(--text-muted)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: '4px'
                                    }}
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoggingIn}
                            style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                padding: '14px',
                                fontSize: '16px',
                                fontWeight: '600',
                                borderRadius: '12px',
                                border: 'none',
                                backgroundColor: 'var(--primary)',
                                color: 'white',
                                boxShadow: '0 8px 16px rgba(47, 93, 138, 0.2)',
                                opacity: isLoggingIn ? 0.7 : 1,
                                cursor: isLoggingIn ? 'not-allowed' : 'pointer',
                                transition: 'transform 0.2s'
                            }}
                            onMouseDown={(e) => !isLoggingIn && (e.currentTarget.style.transform = 'scale(0.98)')}
                            onMouseUp={(e) => !isLoggingIn && (e.currentTarget.style.transform = 'scale(1)')}
                        >
                            {isLoggingIn ? 'Verifying...' : 'Sign In to ERP'}
                            {!isLoggingIn && <ChevronRight size={18} />}
                        </button>
                    </form>

                    <div style={{ marginTop: '40px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                            <div style={{ height: '1px', flex: 1, backgroundColor: 'var(--border)' }}></div>
                            <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Quick Access Demo</p>
                            <div style={{ height: '1px', flex: 1, backgroundColor: 'var(--border)' }}></div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                            {demoRoles.map((role) => (
                                <button
                                    key={role.username}
                                    onClick={() => handleDemoLogin(role.username, role.password)}
                                    disabled={isLoggingIn}
                                    style={{
                                        padding: '12px',
                                        backgroundColor: role.full ? 'rgba(47, 93, 138, 0.05)' : 'white',
                                        border: '1px solid var(--border)',
                                        borderRadius: '10px',
                                        textAlign: 'left',
                                        cursor: isLoggingIn ? 'not-allowed' : 'pointer',
                                        transition: 'all 0.2s ease',
                                        gridColumn: role.full ? 'span 2' : 'auto',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '2px'
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!isLoggingIn) {
                                            e.currentTarget.style.borderColor = 'var(--primary)';
                                            e.currentTarget.style.backgroundColor = 'white';
                                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(47, 93, 138, 0.08)';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!isLoggingIn) {
                                            e.currentTarget.style.borderColor = 'var(--border)';
                                            e.currentTarget.style.backgroundColor = role.full ? 'rgba(47, 93, 138, 0.05)' : 'white';
                                            e.currentTarget.style.boxShadow = 'none';
                                        }
                                    }}
                                >
                                    <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main)' }}>{role.label}</span>
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Auto-sign in</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Side: Construction Image/Branding */}
            <div style={{
                position: 'relative',
                overflow: 'hidden',
                backgroundColor: 'var(--primary)'
            }}>
                <img
                    src="https://images.unsplash.com/photo-1541888946425-d81bb19240f5?q=80&w=2070&auto=format&fit=crop"
                    alt="Construction Site"
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        opacity: '0.7'
                    }}
                />
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'linear-gradient(to right, rgba(47, 93, 138, 0.9), transparent)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    padding: '80px',
                    color: 'white'
                }}>
                    <div style={{ maxWidth: '450px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                            <LayoutDashboard size={40} />
                            <h2 style={{ fontSize: '40px', fontWeight: '800' }}>Civil ERP</h2>
                        </div>
                        <h3 style={{ fontSize: '24px', fontWeight: '400', lineHeight: '1.4', marginBottom: '32px', opacity: '0.9' }}>
                            Building the future with data-driven site management and real-time project tracking.
                        </h3>
                        <div style={{ display: 'flex', gap: '40px' }}>
                            <div>
                                <p style={{ fontSize: '24px', fontWeight: '800' }}>15+</p>
                                <p style={{ fontSize: '12px', opacity: '0.7' }}>Active Projects</p>
                            </div>
                            <div>
                                <p style={{ fontSize: '24px', fontWeight: '800' }}>100%</p>
                                <p style={{ fontSize: '12px', opacity: '0.7' }}>Transparency</p>
                            </div>
                            <div>
                                <p style={{ fontSize: '24px', fontWeight: '800' }}>24/7</p>
                                <p style={{ fontSize: '12px', opacity: '0.7' }}>On-site Monitoring</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div style={{
                    position: 'absolute',
                    bottom: '40px',
                    right: '40px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                }}>
                    <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: '12px', fontWeight: 'bold' }}>Suki Construction Pvt Ltd</p>
                        <p style={{ fontSize: '10px', opacity: '0.6' }}>Authorized Portal</p>
                    </div>
                    <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '10px',
                        backgroundColor: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--primary)'
                    }}>
                        <Building2 size={24} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;

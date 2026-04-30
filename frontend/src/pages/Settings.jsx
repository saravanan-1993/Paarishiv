import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    User,
    Bell,
    Shield,
    FileText,
    Cloud,
    Mail,
    CheckCircle2,
    Send,
    Save,
    Lock,
    Eye,
    EyeOff,
    Building2,
    Camera,
    CheckCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { hasSubTabAccess, hasPermission } from '../utils/rbac';
import { settingsAPI, profileAPI, notificationAPI } from '../utils/api';
import { Loader2 } from 'lucide-react';

const Settings = () => {
    const { user, updateUser, logout } = useAuth();
    const canEditSettings = hasPermission(user, 'Settings', 'edit');
    const [searchParams, setSearchParams] = useSearchParams();
    const urlTab = searchParams.get('tab');
    const [activeTab, setActiveTab] = useState('Profile');
    const [loading, setLoading] = useState(false);
    const [profileSaved, setProfileSaved] = useState(false);
    const avatarInputRef = useRef(null);

    // Profile State
    const [profile, setProfile] = useState({
        fullName: '',
        email: '',
        phone: '',
        designation: '',
        avatar: ''
    });
    const [avatarPreview, setAvatarPreview] = useState('');

    // Company Info State
    const [companyInfo, setCompanyInfo] = useState({
        companyName: '',
        gstin: '',
        registrationNumber: '',
        address: '',
        contactNumber: '',
        email: '',
        website: '',
        logo: ''
    });

    // Cloudinary State
    const [cloudinaryConfig, setCloudinaryConfig] = useState({
        cloudName: '',
        apiKey: '',
        apiSecret: ''
    });

    // Security / Password State
    const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
    const [passwordMsg, setPasswordMsg] = useState('');

    // SMTP State
    const [smtpConfig, setSmtpConfig] = useState({
        host: '',
        port: '',
        username: '',
        password: '',
        fromName: '',
        useTLS: true
    });
    // Bug 45: Test email state
    const [testEmail, setTestEmail] = useState('');
    const [testEmailMsg, setTestEmailMsg] = useState('');

    // Notification Preferences State
    const NOTIF_CATEGORIES = [
        { key: 'approval', label: 'Approvals', desc: 'Leave, PO, Material, DPR, Expense approval/rejection' },
        { key: 'workflow', label: 'Workflow', desc: 'PO created, GRN, Material consolidation, Procurement chain' },
        { key: 'material', label: 'Materials', desc: 'Material requests, warehouse issues, stock alerts' },
        { key: 'finance', label: 'Finance', desc: 'Payments, bills, overdue reminders' },
        { key: 'hr', label: 'HR', desc: 'Leave applied, attendance anomalies, payroll, surprise visits' },
        { key: 'task', label: 'Tasks', desc: 'Task assignments, overdue alerts, reminders' },
        { key: 'project', label: 'Projects', desc: 'Project created, status changes, assignments' },
        { key: 'fleet', label: 'Fleet', desc: 'Vehicle maintenance due, low fuel stock' },
    ];
    const [notifPrefs, setNotifPrefs] = useState(() => {
        const defaults = {};
        NOTIF_CATEGORIES.forEach(c => { defaults[c.key] = { in_app: true, email: false }; });
        return defaults;
    });
    const [notifPrefsSaved, setNotifPrefsSaved] = useState(false);

    const handleToggleNotifPref = (category, channel) => {
        setNotifPrefs(prev => ({
            ...prev,
            [category]: { ...prev[category], [channel]: !prev[category]?.[channel] }
        }));
        setNotifPrefsSaved(false);
    };

    const handleEnableAllNotifs = () => {
        const all = {};
        NOTIF_CATEGORIES.forEach(c => { all[c.key] = { in_app: true, email: true }; });
        setNotifPrefs(all);
        setNotifPrefsSaved(false);
    };

    const handleMuteAllNotifs = () => {
        const muted = {};
        NOTIF_CATEGORIES.forEach(c => { muted[c.key] = { in_app: false, email: false }; });
        setNotifPrefs(muted);
        setNotifPrefsSaved(false);
    };

    const handleSaveNotifPrefs = () => {
        // Save to localStorage (can be extended to backend later)
        localStorage.setItem('erp_notif_prefs', JSON.stringify(notifPrefs));
        setNotifPrefsSaved(true);
        setTimeout(() => setNotifPrefsSaved(false), 3000);
    };

    // Load saved notification preferences
    useEffect(() => {
        try {
            const saved = localStorage.getItem('erp_notif_prefs');
            if (saved) setNotifPrefs(JSON.parse(saved));
        } catch {}
    }, []);

    const tabs = useMemo(() => [
        { id: 'Profile', icon: User, label: 'Profile' },
        { id: 'Company Profile', icon: Building2, label: 'Company Profile' },
        { id: 'Notifications', icon: Bell, label: 'Notifications', alwaysShow: true },
        { id: 'Security', icon: Shield, label: 'Security' },
        { id: 'Cloudinary', icon: Cloud, label: 'Cloudinary' },
        { id: 'SMTP', icon: Mail, label: 'SMTP' },
    ].filter(tab => tab.alwaysShow || hasSubTabAccess(user, 'Settings', tab.id)), [user]);

    useEffect(() => {
        const fetchSettings = async () => {
            setLoading(true);
            try {
                const [companyRes, cloudinaryRes, smtpRes, profileRes] = await Promise.all([
                    settingsAPI.getCompany(),
                    settingsAPI.getCloudinary(),
                    settingsAPI.getSMTP(),
                    profileAPI.getProfile()
                ]);
                if (companyRes.data) setCompanyInfo(companyRes.data);
                if (cloudinaryRes.data) setCloudinaryConfig(cloudinaryRes.data);
                if (smtpRes.data) setSmtpConfig(smtpRes.data);
                if (profileRes.data) {
                    setProfile({
                        fullName: profileRes.data.fullName || user?.name || '',
                        email: profileRes.data.email || '',
                        phone: profileRes.data.phone || '',
                        designation: profileRes.data.designation || user?.role || '',
                        avatar: profileRes.data.avatar || ''
                    });
                    setAvatarPreview(profileRes.data.avatar || '');
                }
            } catch (err) {
                console.error("Failed to fetch settings:", err);
                // Set defaults from auth
                setProfile(prev => ({
                    ...prev,
                    fullName: prev.fullName || user?.name || '',
                    designation: prev.designation || user?.role || ''
                }));
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, []);

    useEffect(() => {
        if (urlTab && tabs.some(t => t.id === urlTab)) {
            setActiveTab(urlTab);
        }
    }, [urlTab, tabs]);

    // ── Profile Save ──────────────────────────────────────────────────────────
    const handleSaveProfile = async () => {
        setLoading(true);
        try {
            await profileAPI.updateProfile(profile);
            // Update the local auth context so header name updates immediately
            updateUser({ name: profile.fullName, avatar: profile.avatar });
            setProfileSaved(true);
            setTimeout(() => setProfileSaved(false), 3000);
        } catch (err) {
            console.error('Failed to save profile', err);
            alert('Failed to save profile changes.');
        } finally {
            setLoading(false);
        }
    };

    // ── Avatar Upload ─────────────────────────────────────────────────────────
    const handleAvatarChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        // Show preview immediately
        const reader = new FileReader();
        reader.onload = (ev) => setAvatarPreview(ev.target.result);
        reader.readAsDataURL(file);
        // Upload to server
        const formData = new FormData();
        formData.append('file', file);
        setLoading(true);
        try {
            const res = await profileAPI.uploadAvatar(formData);
            setProfile(prev => ({ ...prev, avatar: res.data.url }));
            setAvatarPreview(res.data.url);
            updateUser({ avatar: res.data.url });
        } catch (err) {
            console.error('Failed to upload avatar', err);
            alert('Failed to upload photo. Please check Cloudinary settings.');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveCompanyInfo = async () => {
        setLoading(true);
        try {
            await settingsAPI.updateCompany(companyInfo);
            alert("Company Information saved successfully!");
            window.dispatchEvent(new CustomEvent('companyInfoUpdated'));
        } catch (err) {
            alert("Failed to save company information");
        } finally {
            setLoading(false);
        }
    };

    const handleSaveCloudinary = async () => {
        setLoading(true);
        try {
            await settingsAPI.updateCloudinary(cloudinaryConfig);
            alert("Cloudinary settings saved successfully!");
        } catch (err) {
            alert("Failed to save Cloudinary settings");
        } finally {
            setLoading(false);
        }
    };

    const handleSaveSMTP = async () => {
        setLoading(true);
        try {
            await settingsAPI.updateSMTP(smtpConfig);
            alert("SMTP settings saved successfully!");
        } catch (err) {
            alert("Failed to save SMTP settings");
        } finally {
            setLoading(false);
        }
    };

    // Bug 45: Send test email handler
    const handleTestEmail = async () => {
        if (!testEmail) {
            setTestEmailMsg('Please enter an email address');
            return;
        }
        setLoading(true);
        setTestEmailMsg('');
        try {
            const res = await settingsAPI.testSMTP({ email: testEmail });
            setTestEmailMsg(res.data?.message || 'Test email sent successfully!');
        } catch (err) {
            setTestEmailMsg(err.response?.data?.detail || 'Failed to send test email. Check SMTP settings.');
        } finally {
            setLoading(false);
        }
    };

    const handleChangePassword = async () => {
        setPasswordMsg('');
        if (!passwordForm.currentPassword || !passwordForm.newPassword) {
            setPasswordMsg('Please fill in all fields');
            return;
        }
        if (passwordForm.newPassword.length < 6) {
            setPasswordMsg('New password must be at least 6 characters');
            return;
        }
        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            setPasswordMsg('New passwords do not match');
            return;
        }
        setLoading(true);
        try {
            await settingsAPI.changePassword({
                currentPassword: passwordForm.currentPassword,
                newPassword: passwordForm.newPassword
            });
            setPasswordMsg('Password updated! You will be logged out in 3 seconds...');
            setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
            // Force re-login after password change for security
            setTimeout(() => { logout(); }, 3000);
        } catch (err) {
            setPasswordMsg(err.response?.data?.detail || 'Failed to update password');
        } finally {
            setLoading(false);
        }
    };

    const handleTabChange = (tabId) => {
        setActiveTab(tabId);
        setSearchParams({ tab: tabId });
    };

    return (
        <div className="animate-fade-in" style={{ padding: '0 10px 40px 10px' }}>
            <div style={{ marginBottom: '32px' }}>
                <h1 style={{ fontSize: '32px', fontWeight: '800', color: 'var(--text-main)', marginBottom: '4px' }}>Settings</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '15px' }}>Manage your account and application preferences</p>
            </div>

            {/* Top Tabs */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '32px', backgroundColor: '#f1f5f9', padding: '6px', borderRadius: '8px', width: 'fit-content' }}>
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => handleTabChange(tab.id)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '10px 16px',
                                borderRadius: '6px',
                                border: 'none',
                                background: isActive ? 'white' : 'transparent',
                                color: isActive ? 'var(--text-main)' : 'var(--text-muted)',
                                fontWeight: isActive ? '700' : '600',
                                fontSize: '14px',
                                cursor: 'pointer',
                                boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                transition: 'all 0.2s'
                            }}
                        >
                            <tab.icon size={16} />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Content Area */}
            <div className="animate-fade-in">
                {activeTab === 'Profile' && (
                    <div className="card" style={{ padding: '32px' }}>
                        <h3 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '24px' }}>User Profile</h3>
                        <div style={{ display: 'flex', gap: '32px', alignItems: 'flex-start' }}>
                            {/* Avatar */}
                            <div style={{ textAlign: 'center', flexShrink: 0 }}>
                                <div
                                    style={{ width: '120px', height: '120px', borderRadius: '50%', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px', overflow: 'hidden', border: '3px solid var(--border)', position: 'relative', cursor: 'pointer' }}
                                    onClick={() => avatarInputRef.current?.click()}
                                    title="Click to change photo"
                                >
                                    {avatarPreview ? (
                                        <img src={avatarPreview} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                        <User size={64} color="var(--text-muted)" />
                                    )}
                                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px', gap: '4px' }}>
                                        <Camera size={13} color="white" />
                                        <span style={{ color: 'white', fontSize: '10px', fontWeight: '700' }}>CHANGE</span>
                                    </div>
                                </div>
                                <input
                                    ref={avatarInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={handleAvatarChange}
                                    style={{ display: 'none' }}
                                />
                                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>JPG, PNG — Max 2MB</p>
                            </div>

                            {/* Fields */}
                            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Full Name</label>
                                    <input
                                        type="text"
                                        value={profile.fullName}
                                        onChange={e => setProfile(prev => ({ ...prev, fullName: e.target.value }))}
                                        style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '14px' }}
                                        placeholder="Your full name"
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Email Address</label>
                                    <input
                                        type="email"
                                        value={profile.email}
                                        onChange={e => setProfile(prev => ({ ...prev, email: e.target.value }))}
                                        style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '14px' }}
                                        placeholder="you@example.com"
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Phone Number</label>
                                    <input
                                        type="text"
                                        value={profile.phone}
                                        onChange={e => setProfile(prev => ({ ...prev, phone: e.target.value }))}
                                        style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '14px' }}
                                        placeholder="+91 98765 43210"
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Designation</label>
                                    <input
                                        type="text"
                                        value={profile.designation}
                                        readOnly
                                        disabled
                                        style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '14px', backgroundColor: '#f1f5f9', color: 'var(--text-muted)', cursor: 'not-allowed' }}
                                        title="Designation is managed by your administrator"
                                    />
                                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Managed by your administrator</p>
                                </div>
                                <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: '16px' }}>
                                    <button
                                        className="btn btn-primary"
                                        disabled={loading}
                                        onClick={handleSaveProfile}
                                        style={{ fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}
                                    >
                                        {loading ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={18} />}
                                        SAVE CHANGES
                                    </button>
                                    {profileSaved && (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10B981', fontWeight: '700', fontSize: '14px' }}>
                                            <CheckCircle size={18} /> Profile saved successfully!
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
                    </div>
                )}

                {activeTab === 'Security' && (
                    <div className="card" style={{ padding: '32px' }}>
                        <h3 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '4px' }}>Security Settings</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '24px' }}>Update password and manage security access</p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '500px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Current Password</label>
                                <div style={{ position: 'relative' }}>
                                    <input type="password" value={passwordForm.currentPassword} onChange={e => setPasswordForm(p => ({...p, currentPassword: e.target.value}))} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }} />
                                    <Lock size={16} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                </div>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>New Password</label>
                                <input type="password" value={passwordForm.newPassword} onChange={e => setPasswordForm(p => ({...p, newPassword: e.target.value}))} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }} placeholder="Minimum 6 characters" />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Confirm New Password</label>
                                <input type="password" value={passwordForm.confirmPassword} onChange={e => setPasswordForm(p => ({...p, confirmPassword: e.target.value}))} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }} />
                            </div>
                            {passwordMsg && (
                                <p style={{ fontSize: '14px', fontWeight: '600', color: passwordMsg.includes('success') ? '#10B981' : '#EF4444' }}>{passwordMsg}</p>
                            )}
                            <div>
                                <button className="btn btn-primary" onClick={handleChangePassword} disabled={loading} style={{ fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {loading ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Shield size={18} />} UPDATE PASSWORD
                                </button>
                            </div>
                        </div>

                    </div>
                )}

                {activeTab === 'Company Profile' && (
                    <div className="card" style={{ padding: '32px' }}>
                        <div style={{ marginBottom: '24px' }}>
                            <h3 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '4px' }}>Company Profile</h3>
                            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Global details used for POs, Receipts, and Reports</p>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                            <div style={{ gridColumn: 'span 2' }}>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Company Registered Name</label>
                                <input
                                    type="text"
                                    value={companyInfo.companyName}
                                    onChange={(e) => setCompanyInfo({ ...companyInfo, companyName: e.target.value })}
                                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>GSTIN (Goods and Services Tax ID)</label>
                                <input
                                    type="text"
                                    value={companyInfo.gstin}
                                    onChange={(e) => setCompanyInfo({ ...companyInfo, gstin: e.target.value.toUpperCase() })}
                                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', textTransform: 'uppercase' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Registration Number / PAN</label>
                                <input
                                    type="text"
                                    value={companyInfo.registrationNumber}
                                    onChange={(e) => setCompanyInfo({ ...companyInfo, registrationNumber: e.target.value })}
                                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}
                                />
                            </div>
                            <div style={{ gridColumn: 'span 2' }}>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Registered Business Address</label>
                                <textarea
                                    rows="3"
                                    value={companyInfo.address}
                                    onChange={(e) => setCompanyInfo({ ...companyInfo, address: e.target.value })}
                                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', resize: 'none' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Company Contact Number</label>
                                <input
                                    type="text"
                                    value={companyInfo.contactNumber}
                                    onChange={(e) => setCompanyInfo({ ...companyInfo, contactNumber: e.target.value })}
                                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Company Official Email</label>
                                <input
                                    type="email"
                                    value={companyInfo.email}
                                    onChange={(e) => setCompanyInfo({ ...companyInfo, email: e.target.value })}
                                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Company Website</label>
                                <input
                                    type="text"
                                    value={companyInfo.website}
                                    onChange={(e) => setCompanyInfo({ ...companyInfo, website: e.target.value })}
                                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}
                                    placeholder="e.g. www.paarishivhomes.com"
                                />
                            </div>
                            <div style={{ gridColumn: 'span 2' }}>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Company Logo</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                                    {companyInfo.logo ? (
                                        <img
                                            src={companyInfo.logo.startsWith('http') || companyInfo.logo.startsWith('/static') || companyInfo.logo.startsWith('/api') ? companyInfo.logo : `/api${companyInfo.logo}`}
                                            alt="Company Logo"
                                            style={{ width: '60px', height: '60px', borderRadius: '8px', objectFit: 'contain', backgroundColor: '#f1f5f9', padding: '4px' }}
                                        />
                                    ) : (
                                        <div style={{ width: '60px', height: '60px', borderRadius: '8px', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>No Logo</div>
                                    )}
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={async (e) => {
                                            const file = e.target.files[0];
                                            if (!file) return;
                                            const formData = new FormData();
                                            formData.append('file', file);
                                            setLoading(true);
                                            try {
                                                const res = await settingsAPI.uploadLogo(formData);
                                                setCompanyInfo({ ...companyInfo, logo: res.data.url });
                                            } catch (err) {
                                                alert("Failed to upload logo");
                                            } finally {
                                                setLoading(false);
                                            }
                                        }}
                                        style={{ fontSize: '13px' }}
                                    />
                                </div>
                            </div>
                            <div style={{ gridColumn: 'span 2' }}>
                                {canEditSettings && <button
                                    className="btn btn-primary"
                                    disabled={loading}
                                    onClick={handleSaveCompanyInfo}
                                    style={{ fontWeight: '800' }}
                                >
                                    {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} SAVE COMPANY INFO
                                </button>}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'Cloudinary' && (
                    <div className="card" style={{ padding: '32px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                            <div>
                                <h3 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '4px' }}>Cloudinary API</h3>
                                <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Media storage for project site images and documents</p>
                            </div>
                            <span style={{ padding: '4px 12px', backgroundColor: '#e0f2fe', color: '#0369a1', borderRadius: '20px', fontSize: '11px', fontWeight: '700' }}>API CONNECTED</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Cloud Name</label>
                                <input
                                    type="text"
                                    value={cloudinaryConfig.cloudName}
                                    onChange={(e) => setCloudinaryConfig({ ...cloudinaryConfig, cloudName: e.target.value })}
                                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>API Key</label>
                                <input
                                    type="text"
                                    value={cloudinaryConfig.apiKey}
                                    onChange={(e) => setCloudinaryConfig({ ...cloudinaryConfig, apiKey: e.target.value })}
                                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', fontFamily: 'monospace' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>API Secret</label>
                                <input
                                    type="password"
                                    value={cloudinaryConfig.apiSecret}
                                    onChange={(e) => setCloudinaryConfig({ ...cloudinaryConfig, apiSecret: e.target.value })}
                                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                                {canEditSettings && <button
                                    className="btn btn-primary"
                                    disabled={loading}
                                    onClick={handleSaveCloudinary}
                                    style={{ fontWeight: '800' }}
                                >
                                    {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} SAVE API KEYS
                                </button>}
                                <button className="btn btn-outline"><Cloud size={16} /> TEST CONNECTION</button>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'SMTP' && (
                    <div className="card" style={{ padding: '32px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
                            <div>
                                <h3 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '4px' }}>SMTP Email Configuration</h3>
                                <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Configure outgoing email server for notifications and reports</p>
                            </div>
                            <span style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '6px 12px',
                                backgroundColor: '#ECFDF5',
                                color: '#059669',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: '700'
                            }}>
                                <CheckCircle2 size={14} />
                                Configured
                            </span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>SMTP Host *</label>
                                <input
                                    type="text"
                                    value={smtpConfig.host}
                                    onChange={(e) => setSmtpConfig({ ...smtpConfig, host: e.target.value })}
                                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '14px', fontFamily: 'monospace' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Port *</label>
                                <input
                                    type="text"
                                    value={smtpConfig.port}
                                    onChange={(e) => setSmtpConfig({ ...smtpConfig, port: e.target.value })}
                                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '14px', fontFamily: 'monospace' }}
                                />
                                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>TLS: 587 | SSL: 465 | Plain: 25</p>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Username *</label>
                                <input
                                    type="text"
                                    value={smtpConfig.username}
                                    onChange={(e) => setSmtpConfig({ ...smtpConfig, username: e.target.value })}
                                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '14px' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Password (leave blank to keep current)</label>
                                <input
                                    type="password"
                                    value={smtpConfig.password}
                                    onChange={(e) => setSmtpConfig({ ...smtpConfig, password: e.target.value })}
                                    placeholder="Leave blank to keep saved password"
                                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '14px' }}
                                />
                                <p style={{ fontSize: '11px', color: '#10B981', marginTop: '6px', fontWeight: '600' }}>✓ Password is saved — only fill this to change it</p>
                            </div>
                            <div style={{ gridColumn: 'span 2' }}>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>From Name</label>
                                <input
                                    type="text"
                                    value={smtpConfig.fromName}
                                    onChange={(e) => setSmtpConfig({ ...smtpConfig, fromName: e.target.value })}
                                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '14px' }}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
                            <div
                                onClick={() => setSmtpConfig({ ...smtpConfig, useTLS: !smtpConfig.useTLS })}
                                style={{
                                    width: '40px',
                                    height: '20px',
                                    borderRadius: '10px',
                                    backgroundColor: smtpConfig.useTLS ? 'var(--primary)' : '#cbd5e1',
                                    position: 'relative',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <div style={{
                                    width: '16px',
                                    height: '16px',
                                    borderRadius: '50%',
                                    backgroundColor: 'white',
                                    position: 'absolute',
                                    top: '2px',
                                    left: smtpConfig.useTLS ? '22px' : '2px',
                                    transition: 'all 0.2s'
                                }}></div>
                            </div>
                            <span style={{ fontSize: '14px', fontWeight: '600' }}>Use STARTTLS (recommended for port 587)</span>
                        </div>

                        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                <input
                                    type="email"
                                    placeholder="recipient@example.com"
                                    value={testEmail}
                                    onChange={e => { setTestEmail(e.target.value); setTestEmailMsg(''); }}
                                    style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '14px' }}
                                />
                                <button className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', fontWeight: '700', whiteSpace: 'nowrap' }} onClick={handleTestEmail} disabled={loading}>
                                    {loading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={16} />}
                                    Send Test Email
                                </button>
                                {canEditSettings && <button
                                    className="btn btn-primary"
                                    disabled={loading}
                                    onClick={handleSaveSMTP}
                                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px', fontWeight: '800', whiteSpace: 'nowrap' }}
                                >
                                    {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                                    Save Changes
                                </button>}
                            </div>
                            {testEmailMsg && (
                                <p style={{ fontSize: '13px', fontWeight: '600', color: testEmailMsg.includes('success') ? '#10B981' : '#EF4444' }}>{testEmailMsg}</p>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'Notifications' && (
                    <div className="card" style={{ padding: '32px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <div>
                                <h2 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '4px' }}>Notification Preferences</h2>
                                <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Control which notifications you receive</p>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={handleEnableAllNotifs} className="btn btn-outline" style={{ fontSize: '12px', padding: '6px 14px' }}>Enable All</button>
                                <button onClick={handleMuteAllNotifs} className="btn btn-outline" style={{ fontSize: '12px', padding: '6px 14px', color: '#EF4444', borderColor: '#FECACA' }}>Mute All</button>
                            </div>
                        </div>

                        <div style={{ border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
                            {/* Header */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px', padding: '12px 20px', backgroundColor: '#F8FAFC', borderBottom: '1px solid var(--border)', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                <span>Category</span>
                                <span style={{ textAlign: 'center' }}>In-App</span>
                                <span style={{ textAlign: 'center' }}>Email</span>
                            </div>

                            {/* Rows */}
                            {NOTIF_CATEGORIES.map((cat, idx) => (
                                <div key={cat.key} style={{
                                    display: 'grid', gridTemplateColumns: '1fr 100px 100px',
                                    padding: '16px 20px', alignItems: 'center',
                                    borderBottom: idx < NOTIF_CATEGORIES.length - 1 ? '1px solid var(--border)' : 'none'
                                }}>
                                    <div>
                                        <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-main)', marginBottom: '2px' }}>{cat.label}</div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{cat.desc}</div>
                                    </div>
                                    {/* In-App Toggle */}
                                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                                        <div
                                            onClick={() => handleToggleNotifPref(cat.key, 'in_app')}
                                            style={{
                                                width: '44px', height: '24px', borderRadius: '12px', cursor: 'pointer',
                                                backgroundColor: notifPrefs[cat.key]?.in_app ? 'var(--primary)' : '#E2E8F0',
                                                position: 'relative', transition: 'background 0.2s'
                                            }}
                                        >
                                            <div style={{
                                                width: '18px', height: '18px', borderRadius: '50%', backgroundColor: 'white',
                                                position: 'absolute', top: '3px',
                                                left: notifPrefs[cat.key]?.in_app ? '23px' : '3px',
                                                transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.15)'
                                            }}></div>
                                        </div>
                                    </div>
                                    {/* Email Toggle */}
                                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                                        <div
                                            onClick={() => handleToggleNotifPref(cat.key, 'email')}
                                            style={{
                                                width: '44px', height: '24px', borderRadius: '12px', cursor: 'pointer',
                                                backgroundColor: notifPrefs[cat.key]?.email ? '#10B981' : '#E2E8F0',
                                                position: 'relative', transition: 'background 0.2s'
                                            }}
                                        >
                                            <div style={{
                                                width: '18px', height: '18px', borderRadius: '50%', backgroundColor: 'white',
                                                position: 'absolute', top: '3px',
                                                left: notifPrefs[cat.key]?.email ? '23px' : '3px',
                                                transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.15)'
                                            }}></div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px', marginTop: '24px' }}>
                            {notifPrefsSaved && (
                                <span style={{ fontSize: '13px', color: '#10B981', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <CheckCircle size={16} /> Preferences saved
                                </span>
                            )}
                            <button className="btn btn-primary" onClick={handleSaveNotifPrefs}
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px', fontWeight: '800' }}>
                                <Save size={18} /> Save Preferences
                            </button>
                        </div>
                    </div>
                )}


            </div>
        </div>
    );
};

export default Settings;

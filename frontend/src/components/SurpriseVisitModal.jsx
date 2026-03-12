import React, { useState, useEffect } from 'react';
import { X, Camera, MapPin, Loader2, Save, Users, Calendar, Clock } from 'lucide-react';
import { projectAPI, employeeAPI, surpriseVisitAPI, labourAPI } from '../utils/api';

const SurpriseVisitModal = ({ isOpen, onClose, onSaved }) => {
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [projects, setProjects] = useState([]);
    const [allPotentialStaff, setAllPotentialStaff] = useState([]);

    const [selectedProject, setSelectedProject] = useState('');
    const [session, setSession] = useState('Morning');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [presentIds, setPresentIds] = useState([]);
    const [remarks, setRemarks] = useState('');
    const [photo, setPhoto] = useState(null);
    const [photoPreview, setPhotoPreview] = useState(null);
    const [location, setLocation] = useState(null);

    useEffect(() => {
        if (isOpen) {
            loadData();
            captureLocation();
        }
    }, [isOpen]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [projRes, empRes] = await Promise.all([
                projectAPI.getAll(),
                employeeAPI.getAll()
            ]);
            setProjects(projRes.data || []);
            // For staff, we include engineers (Role SITE_ENGINEER) and maybe others.
            // Requirement says "Engineer, Labour, Contractor"
            // We'll treat all active employees/labours as selectable for now
            setAllPotentialStaff(empRes.data || []);
        } catch (err) {
            console.error('Failed to load surprise visit data', err);
        } finally {
            setLoading(false);
        }
    };

    const captureLocation = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                (err) => console.warn('Location capture failed', err)
            );
        }
    };

    const handlePhotoChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setPhoto(file);
            const reader = new FileReader();
            reader.onloadend = () => setPhotoPreview(reader.result);
            reader.readAsDataURL(file);
        }
    };

    const togglePresence = (id) => {
        setPresentIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedProject) return alert('Please select a project');

        setSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('project_id', selectedProject);
            const proj = projects.find(p => p.id === selectedProject || p._id === selectedProject);
            formData.append('project_name', proj?.name || '');
            formData.append('session', session);
            formData.append('date', date);
            formData.append('location', JSON.stringify(location));

            const presentStaff = allPotentialStaff.filter(s => presentIds.includes(s.id || s._id));
            formData.append('present_employees', JSON.stringify(presentStaff.map(s => ({
                id: s.id || s._id,
                name: s.fullName || s.name,
                designation: s.designation || 'Staff'
            }))));

            formData.append('remarks', remarks);
            if (photo) formData.append('photo', photo);

            await surpriseVisitAPI.create(formData);
            alert('Surprise visit marked successfully!');
            onSaved();
            onClose();
        } catch (err) {
            console.error(err);
            alert(err.response?.data?.detail || 'Failed to save surprise visit');
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 1000,
            backdropFilter: 'blur(4px)'
        }}>
            <div className="modal-content animate-slide-up" style={{
                backgroundColor: 'white', borderRadius: '16px',
                width: '100%', maxWidth: '700px', maxHeight: '90vh',
                overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
            }}>
                <div style={{
                    padding: '20px 24px', borderBottom: '1px solid #e2e8f0',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 10
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Shield color="var(--primary)" size={24} />
                        <h2 style={{ fontSize: '20px', fontWeight: '800' }}>Mark Surprise Visit Attendance</h2>
                    </div>
                    <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b' }}>
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Project</label>
                            <select
                                value={selectedProject}
                                onChange={(e) => setSelectedProject(e.target.value)}
                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px solid #e2e8f0' }}
                                required
                            >
                                <option value="">Select Project</option>
                                {projects.map(p => (
                                    <option key={p.id || p._id} value={p.id || p._id}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Session</label>
                            <select
                                value={session}
                                onChange={(e) => setSession(e.target.value)}
                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px solid #e2e8f0' }}
                            >
                                <option value="Morning">Morning</option>
                                <option value="Evening">Evening</option>
                            </select>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Date</label>
                            <div style={{ position: 'relative' }}>
                                <Calendar size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                                <input
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    style={{ width: '100%', padding: '10px 12px 10px 40px', borderRadius: '8px', border: '1.5px solid #e2e8f0' }}
                                />
                            </div>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Auto-Capture</label>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', backgroundColor: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1.5px solid #e2e8f0' }}>
                                <MapPin size={18} color={location ? '#10B981' : '#64748b'} />
                                <span style={{ fontSize: '12px', fontWeight: '600' }}>
                                    {location ? `GPS: ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : 'Wait for GPS...'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div style={{ marginBottom: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <label style={{ fontSize: '14px', fontWeight: '800' }}>Mark Attendance (Select Present)</label>
                            <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--primary)', backgroundColor: 'var(--primary-bg)', padding: '2px 8px', borderRadius: '4px' }}>
                                {presentIds.length} Selected
                            </span>
                        </div>
                        <div style={{
                            border: '1.5px solid #e2e8f0', borderRadius: '12px', maxHeight: '300px',
                            overflowY: 'auto', padding: '12px', backgroundColor: '#fcfcfc'
                        }}>
                            {loading ? (
                                <div style={{ textAlign: 'center', padding: '20px' }}><Loader2 className="animate-spin" /></div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                    {allPotentialStaff.map(staff => (
                                        <div
                                            key={staff.id || staff._id}
                                            onClick={() => togglePresence(staff.id || staff._id)}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '10px', padding: '10px',
                                                borderRadius: '8px', border: '1.5px solid',
                                                borderColor: presentIds.includes(staff.id || staff._id) ? 'var(--primary)' : '#e2e8f0',
                                                backgroundColor: presentIds.includes(staff.id || staff._id) ? '#f0f7ff' : 'white',
                                                cursor: 'pointer', transition: 'all 0.2s'
                                            }}
                                        >
                                            <div style={{
                                                width: '18px', height: '18px', borderRadius: '4px', border: '2px solid',
                                                borderColor: presentIds.includes(staff.id || staff._id) ? 'var(--primary)' : '#cbd5e1',
                                                backgroundColor: presentIds.includes(staff.id || staff._id) ? 'var(--primary)' : 'transparent',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                                            }}>
                                                {presentIds.includes(staff.id || staff._id) && <Check size={12} color="white" />}
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '13px', fontWeight: '700' }}>{staff.fullName || staff.name}</div>
                                                <div style={{ fontSize: '11px', color: '#64748b' }}>{staff.designation || 'Staff'}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Inspection Photo (Optional)</label>
                        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                            <div
                                onClick={() => document.getElementById('visit-photo').click()}
                                style={{
                                    width: '100px', height: '100px', borderRadius: '12px', border: '2px dashed #e2e8f0',
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                    cursor: 'pointer', color: '#64748b', transition: 'all 0.2s'
                                }}
                            >
                                {photoPreview ? (
                                    <img src={photoPreview} style={{ width: '100%', height: '100%', borderRadius: '10px', objectFit: 'cover' }} alt="Preview" />
                                ) : (
                                    <>
                                        <Camera size={24} />
                                        <span style={{ fontSize: '10px', fontWeight: '700', marginTop: '4px' }}>UPLOAD</span>
                                    </>
                                )}
                            </div>
                            <input type="file" id="visit-photo" hidden onChange={handlePhotoChange} accept="image/*" />
                            <div style={{ flex: 1 }}>
                                <textarea
                                    placeholder="Add inspection notes or remarks..."
                                    value={remarks}
                                    onChange={(e) => setRemarks(e.target.value)}
                                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px solid #e2e8f0', minHeight: '100px', fontSize: '13px' }}
                                />
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
                        <button type="button" onClick={onClose} className="btn btn-outline" style={{ flex: 1 }}>CANCEL</button>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={submitting}
                            style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                        >
                            {submitting ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                            {submitting ? 'SAVING...' : 'MARK SURPRISE ATTENDANCE'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// Internal Shield icon for consistency
const Shield = ({ color, size }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
);

const Check = ({ color, size }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
    </svg>
);

export default SurpriseVisitModal;

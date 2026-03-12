import React, { useState } from 'react';
import { X, Camera, Loader2, CheckCircle } from 'lucide-react';
import { projectAPI, chatAPI } from '../utils/api';

const CompleteTaskModal = ({ isOpen, onClose, project, task, onCompleted }) => {
    const [loading, setLoading] = useState(false);
    const [photo, setPhoto] = useState(null);
    const [photoPreview, setPhotoPreview] = useState(null);
    const [remarks, setRemarks] = useState('');

    if (!isOpen) return null;

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setPhotoPreview(URL.createObjectURL(file));
        setPhoto(file);
    };

    const handleSubmit = async () => {
        setLoading(true);
        try {
            let photoUrl = null;
            if (photo) {
                // 1. Upload photo to Cloudinary
                const formData = new FormData();
                formData.append('file', photo);
                const uploadRes = await chatAPI.uploadFile(formData);
                photoUrl = uploadRes.data.url;
            }

            // 2. Update task status
            await projectAPI.updateTask(project._id || project.id, task.id, {
                status: 'Completed',
                completionPhoto: photoUrl,
                remarks: remarks
            });

            alert('Task marked as completed! Admin notified.');
            onCompleted?.();
            onClose();
        } catch (err) {
            console.error(err);
            alert('Failed to complete task. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 2000, backdropFilter: 'blur(4px)'
        }}>
            <div className="animate-fade-in" style={{
                backgroundColor: 'white', width: '100%', maxWidth: '440px',
                borderRadius: '16px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)'
            }}>
                {/* Header */}
                <div style={{ padding: '20px 24px', background: '#059669', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <CheckCircle size={20} />
                        <h3 style={{ fontSize: '18px', fontWeight: '700' }}>Complete Task</h3>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
                        <X size={22} />
                    </button>
                </div>

                <div style={{ padding: '24px' }}>
                    <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '20px' }}>
                        Task: <span style={{ fontWeight: '700', color: 'var(--text-main)' }}>{task?.name}</span>
                        <br />You can optionally upload a photo of the finished work to confirm completion.
                    </p>

                    {/* Photo Upload */}
                    <div style={{ marginBottom: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                Completion Photo (Optional)
                            </label>
                            {photoPreview && (
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setPhoto(null);
                                        setPhotoPreview(null);
                                        // Reset file input value so same file can be selected again if needed
                                        const fileInput = document.getElementById('task-photo');
                                        if (fileInput) fileInput.value = '';
                                    }}
                                    style={{
                                        background: 'none', border: 'none', color: '#ef4444', fontSize: '12px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', padding: 0
                                    }}
                                >
                                    <X size={14} /> Remove Photo
                                </button>
                            )}
                        </div>
                        <div
                            onClick={() => document.getElementById('task-photo').click()}
                            style={{
                                height: '200px', border: '2px dashed var(--border)', borderRadius: '12px',
                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer', backgroundColor: '#F8FAFC', overflow: 'hidden', position: 'relative'
                            }}
                        >
                            {photoPreview ? (
                                <img src={photoPreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <>
                                    <Camera size={40} color="var(--text-muted)" style={{ marginBottom: '12px' }} />
                                    <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)' }}>Click to Upload Photo</span>
                                </>
                            )}
                            <input id="task-photo" type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
                        </div>
                    </div>

                    {/* Remarks */}
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>
                            Remarks (Optional)
                        </label>
                        <textarea
                            value={remarks}
                            onChange={(e) => setRemarks(e.target.value)}
                            placeholder="Add any notes about the completion..."
                            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '14px', minHeight: '80px', resize: 'none' }}
                        />
                    </div>

                    <button
                        className="btn btn-primary"
                        onClick={handleSubmit}
                        disabled={loading}
                        style={{ width: '100%', padding: '14px', backgroundColor: '#059669', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '15px' }}
                    >
                        {loading ? <Loader2 className="animate-spin" size={18} /> : '✓ Complete & Notify Admin'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CompleteTaskModal;

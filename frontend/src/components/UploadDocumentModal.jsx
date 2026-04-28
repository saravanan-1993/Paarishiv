import React, { useState, useRef } from 'react';
import { X, Upload, File, Layers, Info, Loader2, AlertCircle } from 'lucide-react';
import PremiumSelect from './PremiumSelect';
import { projectAPI } from '../utils/api';

const UploadDocumentModal = ({ isOpen, onClose, project, onDocumentUploaded }) => {
    const [title, setTitle] = useState('');
    const [category, setCategory] = useState('Architectural Drawing');
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const fileInputRef = useRef(null);

    if (!isOpen) return null;

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            if (selectedFile.size > 10 * 1024 * 1024) {
                setError('File size too large. Max 10MB.');
                return;
            }
            setFile(selectedFile);
            setError('');
            if (!title) setTitle(selectedFile.name.split('.')[0]);
        }
    };

    const handleUpload = async () => {
        if (!title || !file) {
            setError('Please provide a title and select a file.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            // Upload file to Cloudinary first
            const formData = new FormData();
            formData.append('file', file);
            const uploadRes = await projectAPI.uploadPhoto(formData);
            const fileUrl = uploadRes.data?.url || '';

            const docMetadata = {
                title,
                category,
                fileName: file.name,
                fileSize: (file.size / 1024).toFixed(2) + ' KB',
                fileType: file.type || file.name.split('.').pop(),
                date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
                url: fileUrl
            };

            await projectAPI.addDocument(project._id, docMetadata);
            onDocumentUploaded && onDocumentUploaded();
            onClose();
            // Reset
            setTitle('');
            setFile(null);
        } catch (err) {
            console.error('Upload error:', err);
            setError('Failed to upload document. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <div className="modal-overlay" style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)'
            }}>
                <div className="card animate-fade-in" style={{
                    backgroundColor: 'white', width: '100%', maxWidth: '500px',
                    borderRadius: '12px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                    padding: '0', display: 'flex', flexDirection: 'column',
                    overflow: 'hidden'
                }}>
                    {/* Header */}
                    <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ padding: '10px', backgroundColor: '#EEF2FF', color: '#4F46E5', borderRadius: '8px' }}>
                                <Upload size={20} />
                            </div>
                            <div>
                                <h2 style={{ fontSize: '18px', fontWeight: '700' }}>Upload Document</h2>
                                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Store blue-prints, permits or contracts</p>
                            </div>
                        </div>
                        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                            <X size={24} />
                        </button>
                    </div>

                    {/* Body */}
                    <div style={{ padding: '24px' }}>
                        {error && (
                            <div style={{ padding: '10px 14px', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', marginBottom: '16px', display: 'flex', gap: '8px', alignItems: 'center', color: '#B91C1C', fontSize: '13px' }}>
                                <AlertCircle size={16} />
                                {error}
                            </div>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Document Title *</label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    placeholder="e.g. Architectural Plan - Ground Floor"
                                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '14px' }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Category</label>
                                <PremiumSelect
                                    options={[
                                        { value: 'Architectural Drawing', label: 'Architectural Drawing' },
                                        { value: 'Government Permit', label: 'Government Permit' },
                                        { value: 'Legal Contract', label: 'Legal Contract' },
                                        { value: 'Site Photo', label: 'Site Photo' },
                                        { value: 'Other', label: 'Other' }
                                    ]}
                                    value={category}
                                    onChange={setCategory}
                                    placeholder="Select Category"
                                    icon={Layers}
                                />
                            </div>

                            {/* File Upload Area */}
                            <div
                                onClick={() => fileInputRef.current.click()}
                                style={{
                                    border: '2px dashed #E2E8F0',
                                    borderRadius: '12px',
                                    padding: '30px 20px',
                                    textAlign: 'center',
                                    backgroundColor: file ? '#F0F9FF' : '#F8FAFC',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    borderColor: file ? 'var(--primary)' : '#E2E8F0'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
                                onMouseLeave={(e) => { if (!file) e.currentTarget.style.borderColor = '#E2E8F0' }}
                            >
                                <div style={{ width: '48px', height: '48px', backgroundColor: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: 'var(--shadow-sm)' }}>
                                    <File size={24} color="var(--primary)" />
                                </div>
                                {file ? (
                                    <>
                                        <h4 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '4px', color: 'var(--primary)' }}>{file.name}</h4>
                                        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{(file.size / 1024).toFixed(2)} KB • Click to change</p>
                                    </>
                                ) : (
                                    <>
                                        <h4 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '4px' }}>Click to upload or drag & drop</h4>
                                        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>PDF, JPG, PNG or DWG (Max 10MB)</p>
                                    </>
                                )}
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    style={{ display: 'none' }}
                                    accept=".pdf,.jpg,.jpeg,.png,.dwg"
                                />
                            </div>

                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px', backgroundColor: '#EFF6FF', borderRadius: '8px', color: '#1D4ED8', fontSize: '12px' }}>
                                <Info size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                                <span>This document will be visible to all Project Managers and Engineers assigned to this project.</span>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div style={{ padding: '20px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '12px', backgroundColor: '#f8fafc' }}>
                        <button className="btn btn-outline" onClick={onClose} style={{ padding: '10px 24px' }}>Cancel</button>
                        <button
                            className="btn btn-primary"
                            onClick={handleUpload}
                            disabled={loading || !file || !title}
                            style={{ padding: '10px 32px', display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                            {loading && <Loader2 size={16} className="animate-spin" />}
                            {loading ? 'Uploading...' : 'Upload Now'}
                        </button>
                    </div>
                </div>
            </div>
            <style>{`.animate-spin { animation: spin 1s linear infinite; } @keyframes spin { from {transform: rotate(0deg);} to {transform: rotate(360deg);} }`}</style>
        </>
    );
};

export default UploadDocumentModal;

import React, { useState, useEffect } from 'react';
import { projectAPI, employeeAPI, hrmsAPI } from '../utils/api';
import { X, UserPlus, Upload, Camera, FileText, Building2, Edit3, Briefcase } from 'lucide-react';
import CustomSelect from './CustomSelect';


const AddEmployeeModal = ({ isOpen, onClose, onEmployeeAdded, roles, employee = null }) => {
    const isEdit = !!employee;

    const [formData, setFormData] = useState({
        fullName: employee?.fullName || '',
        employeeCode: employee?.employeeCode || '',
        email: employee?.email || '',
        password: '', // Password not pre-filled for security
        phone: employee?.phone || '',
        designation: employee?.designation || '',
        department: employee?.department || '',
        joiningDate: employee?.joiningDate || '',
        basicSalary: employee?.basicSalary || '',
        hra: employee?.hra || '0',
        pfNumber: employee?.pfNumber || '',
        esiNumber: employee?.esiNumber || '',
        bankAccount: employee?.bankAccount || '',
        bankName: employee?.bankName || '',
        ifsc: employee?.ifsc || '',
        siteId: employee?.siteId || '',
        salaryType: employee?.salaryType || 'monthly',
        dailyWage: employee?.dailyWage || '0',
        dob: employee?.dob || ''
    });

    const [projects, setProjects] = React.useState([]);
    const [designationOptions, setDesignationOptions] = React.useState([]);
    const [departmentOptions, setDepartmentOptions] = React.useState([]);

    const refreshDesignations = async () => {
        try {
            const res = await hrmsAPI.getDesignations();
            setDesignationOptions((res.data || []).map(d => ({ value: d, label: d })));
        } catch { /* fallback handled below */ }
    };
    const refreshDepartments = async () => {
        try {
            const res = await hrmsAPI.getDepartments();
            setDepartmentOptions((res.data || []).map(d => ({ value: d, label: d })));
        } catch { /* fallback handled below */ }
    };

    React.useEffect(() => {
        const fetchData = async () => {
            try {
                const [projRes, desigRes, deptRes] = await Promise.allSettled([
                    projectAPI.getAll(),
                    hrmsAPI.getDesignations(),
                    hrmsAPI.getDepartments()
                ]);
                if (projRes.status === 'fulfilled') setProjects(projRes.value.data);
                if (desigRes.status === 'fulfilled') {
                    setDesignationOptions((desigRes.value.data || []).map(d => ({ value: d, label: d })));
                }
                if (deptRes.status === 'fulfilled') {
                    setDepartmentOptions((deptRes.value.data || []).map(d => ({ value: d, label: d })));
                }
            } catch (err) {
                console.error('Failed to fetch data', err);
            }
        };
        if (isOpen) fetchData();
    }, [isOpen]);

    const [selectedRole, setSelectedRole] = useState(employee?.roles?.[0] || '');

    // Update state when employee prop changes
    React.useEffect(() => {
        if (employee) {
            setFormData({
                fullName: employee.fullName || '',
                employeeCode: employee.employeeCode || '',
                email: employee.email || '',
                password: '',
                phone: employee.phone || '',
                designation: employee.designation || '',
                department: employee.department || '',
                joiningDate: employee.joiningDate || '',
                basicSalary: employee.basicSalary || '',
                hra: employee.hra || '0',
                pfNumber: employee.pfNumber || '',
                esiNumber: employee.esiNumber || '',
                bankAccount: employee.bankAccount || '',
                bankName: employee.bankName || '',
                ifsc: employee.ifsc || '',
                siteId: employee.siteId || '',
                salaryType: employee.salaryType || 'monthly',
                dailyWage: employee.dailyWage || '0',
                dob: employee.dob || ''
            });
            setSelectedRole(employee.roles?.[0] || '');
        } else {
            setFormData({
                fullName: '',
                employeeCode: '',
                email: '',
                password: '',
                phone: '',
                designation: '',
                department: '',
                joiningDate: '',
                basicSalary: '',
                hra: '0',
                pfNumber: '',
                esiNumber: '',
                bankAccount: '',
                bankName: '',
                ifsc: '',
                siteId: '',
                salaryType: 'monthly',
                dailyWage: '0',
                dob: ''
            });
            setSelectedRole('');
        }
    }, [employee, isOpen]);

    const [files, setFiles] = useState({
        photo: null,
        passbook: null,
        documents: null
    });

    if (!isOpen) return null;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleFileChange = (e) => {
        const { name, files: selectedFiles } = e.target;
        setFiles(prev => ({ ...prev, [name]: selectedFiles[0] }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedRole) {
            alert("Please select a role.");
            return;
        }

        try {
            const employeeData = {
                ...formData,
                roles: [selectedRole],
                basicSalary: parseFloat(formData.basicSalary) || 0,
                hra: parseFloat(formData.hra) || 0,
                dailyWage: parseFloat(formData.dailyWage) || 0,
                status: employee?.status || 'Active'
            };

            // If editing, don't update password if empty
            if (isEdit && !formData.password) {
                delete employeeData.password;
            }

            let empId;
            if (isEdit) {
                await employeeAPI.update(employee._id || employee.id, employeeData);
                empId = employee._id || employee.id;
            } else {
                const res = await employeeAPI.create(employeeData);
                empId = res.data?._id || res.data?.id;
            }

            // Upload documents if any files selected
            if (empId) {
                const uploadPromises = [];
                if (files.passbook) {
                    const fd = new FormData();
                    fd.append('file', files.passbook);
                    uploadPromises.push(employeeAPI.uploadDocument(empId, fd, 'passbook'));
                }
                if (files.documents) {
                    const fd = new FormData();
                    fd.append('file', files.documents);
                    uploadPromises.push(employeeAPI.uploadDocument(empId, fd, 'kyc'));
                }
                if (files.photo) {
                    const fd = new FormData();
                    fd.append('file', files.photo);
                    uploadPromises.push(employeeAPI.uploadDocument(empId, fd, 'photo'));
                }
                if (uploadPromises.length > 0) {
                    await Promise.allSettled(uploadPromises);
                }
            }

            onEmployeeAdded();
            onClose();
        } catch (err) {
            console.error(isEdit ? 'Failed to update employee' : 'Failed to create employee', err);
            alert(err.response?.data?.detail || `Failed to ${isEdit ? 'update' : 'create'} employee. Please check if the Employee Code or Email already exists.`);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '900px', width: '95%', maxHeight: '90vh', overflowY: 'auto' }}>
                <div className="modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', backgroundColor: '#f0f9ff', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0ea5e9' }}>
                            {isEdit ? <Edit3 size={20} /> : <UserPlus size={20} />}
                        </div>
                        <div>
                            <h3 style={{ fontSize: '18px', fontWeight: '800', textTransform: 'uppercase' }}>{isEdit ? 'Edit Employee' : 'Add Employee'}</h3>
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{isEdit ? 'Update details below' : 'Fill in the details and upload documents'}</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="modal-body" style={{ padding: '24px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: '32px', marginBottom: '32px' }}>
                        {/* Profile Photo Upload */}
                        <div style={{ textAlign: 'center' }}>
                            <div style={{
                                width: '200px', height: '200px', borderRadius: '12px', border: '2px dashed var(--border)',
                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                position: 'relative', overflow: 'hidden', backgroundColor: '#f8fafc', margin: '0 auto 16px'
                            }}>
                                {files.photo ? (
                                    <img src={URL.createObjectURL(files.photo)} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <>
                                        <Camera size={40} style={{ color: 'var(--text-muted)', marginBottom: '8px' }} />
                                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>UPLOAD PHOTO</span>
                                    </>
                                )}
                                <input type="file" name="photo" accept="image/*" onChange={handleFileChange} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
                            </div>
                            <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>JPG, PNG allowed. Max 2MB</p>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            <div className="form-group">
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Full Name *</label>
                                <input name="fullName" required value={formData.fullName} onChange={handleChange} type="text" placeholder="Enter Full Name" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }} />
                            </div>
                            <div className="form-group">
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Employee Code</label>
                                <input name="employeeCode" value={formData.employeeCode} onChange={handleChange} type="text" placeholder="Auto-generates if empty" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }} />
                                <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>Leave empty for auto-generation (e.g. EMP006)</p>
                            </div>
                            <div className="form-group">
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Email *</label>
                                <input name="email" required value={formData.email} onChange={handleChange} type="email" placeholder="email@example.com" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }} />
                            </div>
                            <div className="form-group">
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>{isEdit ? 'New Password' : 'Password *'}</label>
                                <input name="password" required={!isEdit} value={formData.password} onChange={handleChange} type="password" placeholder={isEdit ? 'Leave empty to keep current' : 'Set initial password'} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }} />
                                {isEdit && <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>Leave blank to keep existing password</p>}
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        <div className="form-group" style={{ gridColumn: 'span 2' }}>
                            <CustomSelect
                                label="Assign Role *"
                                options={roles.map(r => ({ value: r.name, label: r.name }))}
                                value={selectedRole}
                                onChange={(val) => setSelectedRole(val)}
                                placeholder="Select a role"
                                width="full"
                                searchable={false}
                            />
                        </div>
                        <div className="form-group">
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Phone *</label>
                            <input name="phone" required value={formData.phone} onChange={handleChange} type="text" placeholder="Phone number" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }} />
                        </div>
                        <div className="form-group">
                            <CustomSelect
                                label="Designation *"
                                options={designationOptions}
                                value={formData.designation}
                                onChange={(val) => setFormData(prev => ({ ...prev, designation: val }))}
                                onAdd={async (val) => {
                                    try { await hrmsAPI.addDesignation(val); await refreshDesignations(); } catch (e) { console.error(e); }
                                }}
                                placeholder="Select or type designation"
                                width="full"
                                creatable={true}
                            />
                        </div>
                        <div className="form-group">
                            <CustomSelect
                                label="Department *"
                                options={departmentOptions}
                                value={formData.department}
                                onChange={(val) => setFormData(prev => ({ ...prev, department: val }))}
                                onAdd={async (val) => {
                                    try { await hrmsAPI.addDepartment(val); await refreshDepartments(); } catch (e) { console.error(e); }
                                }}
                                placeholder="Select or type department"
                                width="full"
                                creatable={true}
                            />
                        </div>
                        <div className="form-group">
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Date of Joining *</label>
                            <input name="joiningDate" required value={formData.joiningDate} onChange={handleChange} type="date" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }} />
                        </div>
                        <div className="form-group">
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Date of Birth *</label>
                            <input name="dob" required value={formData.dob} onChange={handleChange} type="date" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }} />
                        </div>
                        <div className="form-group">
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Basic Salary *</label>
                            <input name="basicSalary" required value={formData.basicSalary} onChange={handleChange} type="number" placeholder="₹ per month" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }} />
                        </div>
                        <div className="form-group">
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>HRA</label>
                            <input name="hra" value={formData.hra} onChange={handleChange} type="number" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }} />
                        </div>
                        <div className="form-group">
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>PF Number</label>
                            <input name="pfNumber" value={formData.pfNumber} onChange={handleChange} type="text" placeholder="Enter PF account" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }} />
                        </div>
                        <div className="form-group">
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>ESI Number</label>
                            <input name="esiNumber" value={formData.esiNumber} onChange={handleChange} type="text" placeholder="Enter ESI number" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }} />
                        </div>
                        <div className="form-group">
                            <CustomSelect
                                label="Assign Site/Project"
                                options={projects.map(p => ({ value: p.id || p._id, label: p.name }))}
                                value={formData.siteId}
                                onChange={(val) => setFormData(prev => ({ ...prev, siteId: val }))}
                                placeholder="Select Project"
                                width="full"
                                icon={Briefcase}
                            />
                        </div>
                        <div className="form-group">
                            <CustomSelect
                                label="Salary Type"
                                options={[
                                    { value: 'monthly', label: 'Monthly Salary' },
                                    { value: 'daily', label: 'Daily Wage' }
                                ]}
                                value={formData.salaryType}
                                onChange={(val) => setFormData(prev => ({ ...prev, salaryType: val }))}
                                width="full"
                                searchable={false}
                            />
                        </div>
                    </div>

                    <div style={{ marginTop: '24px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
                        <div className="form-group">
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Bank Account</label>
                            <input name="bankAccount" value={formData.bankAccount} onChange={handleChange} type="text" placeholder="Account Number" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }} />
                        </div>
                        <div className="form-group">
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Bank Name</label>
                            <input name="bankName" value={formData.bankName} onChange={handleChange} type="text" placeholder="Branch Name" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }} />
                        </div>
                        <div className="form-group">
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>IFSC</label>
                            <input name="ifsc" value={formData.ifsc} onChange={handleChange} type="text" placeholder="IFSC Code" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }} />
                        </div>
                    </div>

                    {/* Document Uploads */}
                    <div style={{ marginTop: '32px', padding: '24px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid var(--border)' }}>
                        <h4 style={{ fontSize: '15px', fontWeight: '800', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <FileText size={18} style={{ color: 'var(--primary)' }} />
                            KYC & BANK DOCUMENTS
                        </h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                            <div className="form-group">
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Bank Passbook Copy</label>
                                <div style={{ position: 'relative' }}>
                                    <input type="file" name="passbook" onChange={handleFileChange} style={{
                                        width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'white'
                                    }} />
                                    <Upload size={18} style={{ position: 'absolute', right: '12px', top: '12px', color: 'var(--text-muted)' }} />
                                </div>
                            </div>
                            <div className="form-group">
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Other Documents (Aadhar/Pan)</label>
                                <div style={{ position: 'relative' }}>
                                    <input type="file" name="documents" onChange={handleFileChange} style={{
                                        width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'white'
                                    }} />
                                    <Upload size={18} style={{ position: 'absolute', right: '12px', top: '12px', color: 'var(--text-muted)' }} />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="modal-footer" style={{ borderTop: 'none', padding: '24px 0 0 0', gap: '12px', justifyContent: 'flex-end' }}>
                        <button type="button" className="btn btn-outline" onClick={onClose} style={{ padding: '12px 24px' }}>Cancel</button>
                        <button type="submit" className="btn btn-primary" style={{ padding: '12px 32px', fontWeight: '800' }}>{isEdit ? 'UPDATE EMPLOYEE' : 'CREATE EMPLOYEE'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddEmployeeModal;

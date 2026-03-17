import React, { useState, useEffect } from 'react';
import {
    X, Mail, Phone, MapPin, Briefcase, Calendar, Wallet,
    Landmark, Shield, FileText, Download, ExternalLink,
    Loader2, User, Building, Award, Clock, Cake
} from 'lucide-react';
import { settingsAPI } from '../utils/api';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const EmployeeDetailsModal = ({ isOpen, onClose, employee, onEdit }) => {
    const [attSummary, setAttSummary] = useState({ present_days: 0, absent_days: 0, total_hours: 0 });
    const [loading, setLoading] = useState(false);
    const [companyInfo, setCompanyInfo] = useState({
        companyName: 'CIVIL ERP',
        logo: ''
    });

    useEffect(() => {
        const fetchCompany = async () => {
            try {
                const res = await settingsAPI.getCompany();
                if (res.data) setCompanyInfo(res.data);
            } catch (err) {
                console.error("Failed to fetch company info", err);
            }
        };
        fetchCompany();
        window.addEventListener('companyInfoUpdated', fetchCompany);
        return () => window.removeEventListener('companyInfoUpdated', fetchCompany);
    }, []);

    useEffect(() => {
        if (isOpen && employee?.id) {
            const fetchAtt = async () => {
                setLoading(true);
                try {
                    const baseUrl = '/api';
                    const res = await fetch(`${baseUrl}/hrms/attendance/${employee.id}/summary`);
                    if (res.ok) {
                        const data = await res.json();
                        setAttSummary(data);
                    }
                } catch (err) {
                    console.error("Error fetching employee attendance:", err);
                } finally {
                    setLoading(false);
                }
            };
            fetchAtt();
        }
    }, [isOpen, employee]);

    const handleGeneratePayslip = () => {
        const doc = new jsPDF();
        const month = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

        doc.setFontSize(20);
        doc.setTextColor(47, 93, 138);
        doc.text(companyInfo.companyName || 'CIVIL ERP', 105, 20, { align: 'center' });

        doc.setFontSize(14);
        doc.setTextColor(100);
        doc.text(`Salary Slips for ${month}`, 105, 30, { align: 'center' });
        doc.line(20, 35, 190, 35);

        doc.setFontSize(11);
        doc.setTextColor(0);
        doc.text(`Employee Name: ${employee.name}`, 20, 50);
        doc.text(`Employee Code: ${employee.id}`, 20, 58);
        doc.text(`Designation: ${employee.designation || employee.role}`, 20, 66);
        doc.text(`Department: ${employee.dept}`, 20, 74);

        doc.text(`Days Present: ${attSummary.present_days}`, 130, 50);
        doc.text(`Days Absent: ${attSummary.absent_days}`, 130, 58);
        doc.text(`Bank A/c: ${employee.bankAccount || 'N/A'}`, 130, 66);

        const basic = parseFloat(employee.basicSalary) || 0;
        const hra = basic * 0.2;
        const pf = basic * 0.12;
        const tax = basic * 0.05;
        const netSalary = basic + hra - pf - tax;

        doc.autoTable({
            startY: 85,
            head: [['Description', 'Earnings (₹)', 'Deductions (₹)']],
            body: [
                ['Basic Salary', basic.toLocaleString(), ''],
                ['HRA', hra.toLocaleString(), ''],
                ['Provident Fund (PF)', '', pf.toLocaleString()],
                ['Professional Tax', '', tax.toLocaleString()],
                ['', '', ''],
                ['Total Earnings', (basic + hra).toLocaleString(), ''],
                ['Total Deductions', '', (pf + tax).toLocaleString()],
                ['NET SALARY', { content: `₹${netSalary.toLocaleString()}`, styles: { fontStyle: 'bold' } }, '']
            ],
            theme: 'grid',
            headStyles: { fillColor: [47, 93, 138] }
        });

        doc.save(`Payslip_${employee.id}_${month}.pdf`);
    };

    if (!isOpen || !employee) return null;

    const DetailItem = ({ icon: Icon, label, value, color = "var(--text-muted)" }) => (
        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', padding: '12px', background: '#f8fafc', borderRadius: '12px' }}>
            <div style={{ padding: '10px', background: 'white', borderRadius: '10px', color: 'var(--primary)', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                <Icon size={18} />
            </div>
            <div>
                <p style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>{label}</p>
                <p style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-main)' }}>{value || 'N/A'}</p>
            </div>
        </div>
    );

    return (
        <div className="modal-overlay" style={{ backdropFilter: 'blur(8px)', backgroundColor: 'rgba(15, 23, 42, 0.6)' }}>
            <div className="modal-content animate-slide-up" style={{
                maxWidth: '900px',
                width: '95%',
                maxHeight: '90vh',
                overflow: 'hidden',
                padding: 0,
                borderRadius: '24px',
                border: 'none',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
            }}>
                {/* Header Section */}
                <div style={{
                    background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
                    padding: '40px',
                    position: 'relative',
                    color: 'white'
                }}>
                    <button onClick={onClose} style={{
                        position: 'absolute', top: '24px', right: '24px',
                        background: 'rgba(255,255,255,0.1)', border: 'none',
                        borderRadius: 'full', padding: '10px', cursor: 'pointer',
                        color: 'white', transition: 'all 0.2s'
                    }}>
                        <X size={20} />
                    </button>

                    <div style={{ display: 'flex', gap: '30px', alignItems: 'center' }}>
                        <div style={{
                            width: '120px', height: '120px', borderRadius: '24px',
                            border: '4px solid rgba(255,255,255,0.2)',
                            overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.1)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            {employee.photo ? (
                                <img src={employee.photo} alt={employee.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <User size={48} color="white" />
                            )}
                        </div>
                        <div>
                            <span style={{
                                background: 'rgba(255,255,255,0.1)',
                                padding: '6px 12px',
                                borderRadius: '8px',
                                fontSize: '12px',
                                fontWeight: '700',
                                letterSpacing: '0.1em',
                                color: '#38bdf8',
                                marginBottom: '12px',
                                display: 'inline-block'
                            }}>
                                {employee.employeeCode || employee.id}
                            </span>
                            <h2 style={{ fontSize: '32px', fontWeight: '800', marginBottom: '8px' }}>{employee.name}</h2>
                            <p style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.8, fontWeight: '500' }}>
                                <Award size={18} /> {employee.designation || employee.role} • {employee.dept}
                            </p>
                        </div>
                        <div style={{ marginLeft: 'auto', display: 'flex', gap: '12px', alignItems: 'center' }}>
                            {onEdit && (
                                <button
                                    onClick={onEdit}
                                    style={{
                                        background: 'rgba(255,255,255,0.2)',
                                        border: '1px solid rgba(255,255,255,0.3)',
                                        borderRadius: '12px',
                                        padding: '10px 20px',
                                        color: 'white',
                                        fontWeight: '700',
                                        fontSize: '14px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <Shield size={18} /> EDIT PROFILE
                                </button>
                            )}
                            <div style={{
                                background: employee.status === 'Active' ? '#22c55e' : '#f43f5e',
                                padding: '10px 24px',
                                borderRadius: '12px',
                                fontWeight: '800',
                                fontSize: '14px',
                                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                            }}>
                                {employee.status?.toUpperCase()}
                            </div>
                        </div>
                    </div>
                </div>

                <div style={{ padding: '40px', overflowY: 'auto', maxHeight: 'calc(90vh - 200px)', background: 'white' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '40px' }}>
                        {/* Left Column */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                            <section>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                                    <div style={{ width: '4px', height: '20px', background: 'var(--primary)', borderRadius: '2px' }}></div>
                                    <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#1e293b' }}>Personal Information</h3>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <DetailItem icon={Mail} label="Email Address" value={employee.email} />
                                    <DetailItem icon={Phone} label="Phone Number" value={employee.mobile} />
                                    <DetailItem icon={Building} label="Department" value={employee.dept} />
                                    <DetailItem icon={Calendar} label="Joining Date" value={employee.joiningDate || '20 Feb 2024'} />
                                    <DetailItem icon={Cake} label="Date of Birth" value={employee.dob} />
                                </div>
                            </section>

                            <section>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                                    <div style={{ width: '4px', height: '20px', background: 'var(--primary)', borderRadius: '2px' }}></div>
                                    <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#1e293b' }}>Bank & Statutory</h3>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <DetailItem icon={Landmark} label="Bank Account" value={employee.bankAccount} />
                                    <DetailItem icon={Shield} label="PF Number" value={employee.pfNumber} />
                                    <DetailItem icon={FileText} label="ESI Number" value={employee.esiNumber} />
                                    <DetailItem icon={Wallet} label="Monthly CTC" value={`₹${(employee.basicSalary || 0).toLocaleString()}`} />
                                </div>
                            </section>
                        </div>

                        {/* Right Column */}
                        <div style={{ borderLeft: '1px solid #f1f5f9', paddingLeft: '40px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
                            <section>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                                    <div style={{ width: '4px', height: '20px', background: '#10b981', borderRadius: '2px' }}></div>
                                    <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#1e293b' }}>Attendance Overview</h3>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div style={{ background: '#f0fdf4', padding: '20px', borderRadius: '20px', textAlign: 'center', border: '1px solid #dcfce7' }}>
                                        <div style={{ fontSize: '28px', fontWeight: '900', color: '#16a34a', marginBottom: '4px' }}>{attSummary.present_days || '0'}</div>
                                        <p style={{ fontSize: '11px', fontWeight: '800', color: '#16a34a', textTransform: 'uppercase' }}>Present</p>
                                    </div>
                                    <div style={{ background: '#fef2f2', padding: '20px', borderRadius: '20px', textAlign: 'center', border: '1px solid #fee2e2' }}>
                                        <div style={{ fontSize: '28px', fontWeight: '900', color: '#dc2626', marginBottom: '4px' }}>{attSummary.absent_days || '0'}</div>
                                        <p style={{ fontSize: '11px', fontWeight: '800', color: '#dc2626', textTransform: 'uppercase' }}>Absent</p>
                                    </div>
                                </div>
                            </section>

                            <section style={{ marginTop: 'auto' }}>
                                <button
                                    onClick={handleGeneratePayslip}
                                    className="btn btn-primary"
                                    style={{
                                        width: '100%', marginBottom: '16px', padding: '16px',
                                        borderRadius: '16px', fontSize: '15px', fontWeight: '800',
                                        boxShadow: '0 10px 15px -3px rgba(37, 99, 235, 0.2)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'
                                    }}
                                >
                                    <Download size={20} /> GENERATE PAYSLIP
                                </button>
                                <button className="btn btn-outline" style={{
                                    width: '100%', padding: '16px', borderRadius: '16px',
                                    fontSize: '15px', fontWeight: '800', border: '2px solid #e2e8f0',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'
                                }}>
                                    <ExternalLink size={20} /> PERFORMANCE LOG
                                </button>
                            </section>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EmployeeDetailsModal;

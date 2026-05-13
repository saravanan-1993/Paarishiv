import React, { useState, useEffect } from 'react';
import {
    X, Mail, Phone, MapPin, Briefcase, Calendar, Wallet,
    Landmark, Shield, FileText, Download, ExternalLink,
    Loader2, User, Building, Award, Clock, Cake
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { settingsAPI, employeeAPI } from '../utils/api';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuth } from '../context/AuthContext';
import { hasPermission } from '../utils/rbac';

const EmployeeDetailsModal = ({ isOpen, onClose, employee, onEdit }) => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const canGeneratePayslip = hasPermission(user, 'HRMS', 'view');
    const [attSummary, setAttSummary] = useState({ present_days: 0, absent_days: 0, total_hours: 0 });
    const [documents, setDocuments] = useState([]);
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

            // Fetch employee documents
            const fetchDocs = async () => {
                try {
                    const empId = employee._id || employee.id;
                    const res = await employeeAPI.getDocuments(empId);
                    setDocuments(res.data || []);
                } catch (err) {
                    console.error("Error fetching employee documents:", err);
                    setDocuments([]);
                }
            };
            fetchDocs();
        }
    }, [isOpen, employee]);

    const handleGeneratePayslip = () => {
        const doc = new jsPDF();
        const now = new Date();
        const month = now.toLocaleString('default', { month: 'long' });
        const year = now.getFullYear();
        const monthYear = `${month} ${year}`;
        const empCode = employee.employeeCode || employee.code || 'N/A';
        const fmt = (n) => `Rs. ${parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

        const PRIMARY = [30, 64, 120];
        const LIGHT_BG = [235, 242, 255];
        const DARK_TEXT = [20, 20, 20];
        const MUTED = [100, 100, 100];

        const pageW = 210;

        // ── Header Band ──────────────────────────────────────────
        doc.setFillColor(...PRIMARY);
        doc.rect(0, 0, pageW, 38, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text(companyInfo.companyName || 'CIVIL ERP', pageW / 2, 16, { align: 'center' });

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('SALARY SLIP', pageW / 2, 24, { align: 'center' });
        doc.text(`For the month of ${monthYear}`, pageW / 2, 31, { align: 'center' });

        // ── Employee Info Box ─────────────────────────────────────
        doc.setFillColor(...LIGHT_BG);
        doc.roundedRect(14, 44, pageW - 28, 44, 3, 3, 'F');
        doc.setDrawColor(...PRIMARY);
        doc.setLineWidth(0.5);
        doc.roundedRect(14, 44, pageW - 28, 44, 3, 3, 'S');

        const col1x = 20, col2x = 110;
        const labelColor = MUTED, valueColor = DARK_TEXT;

        const field = (label, value, x, y) => {
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...labelColor);
            doc.text(label, x, y);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...valueColor);
            doc.text(String(value || 'N/A'), x, y + 5);
        };

        field('Employee Name', employee.name, col1x, 52);
        field('Employee Code', empCode, col1x, 64);
        field('Designation', employee.designation || employee.role || 'N/A', col1x, 76);

        field('Department', employee.dept || 'N/A', col2x, 52);
        field('Bank Account', employee.bankAccount || 'N/A', col2x, 64);
        field('Pay Period', monthYear, col2x, 76);

        // ── Attendance Summary ────────────────────────────────────
        doc.setFillColor(245, 247, 250);
        doc.roundedRect(14, 93, pageW - 28, 18, 2, 2, 'F');

        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...PRIMARY);
        doc.text('ATTENDANCE SUMMARY', 20, 100);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...MUTED);
        const attW = (pageW - 28) / 3;
        const attItems = [
            ['Days Present', attSummary.present_days || 0],
            ['Days Absent', attSummary.absent_days || 0],
            ['Total Hours', `${attSummary.total_hours || 0} hrs`],
        ];
        attItems.forEach(([label, value], i) => {
            const ax = 20 + i * attW;
            doc.setFontSize(8);
            doc.setTextColor(...MUTED);
            doc.text(label, ax, 106);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...DARK_TEXT);
            doc.text(String(value), ax, 111);
            doc.setFont('helvetica', 'normal');
        });

        // ── Earnings & Deductions Table ───────────────────────────
        const basic = parseFloat(employee.basicSalary) || 0;
        const hraVal = parseFloat(employee.hra) || basic * 0.2;
        const pf = basic * 0.12;
        const tax = basic * 0.05;
        const grossEarnings = basic + hraVal;
        const totalDeductions = pf + tax;
        const netSalary = grossEarnings - totalDeductions;

        autoTable(doc, {
            startY: 117,
            margin: { left: 14, right: 14 },
            head: [['EARNINGS', 'Amount (Rs.)', 'DEDUCTIONS', 'Amount (Rs.)']],
            body: [
                ['Basic Salary', fmt(basic), 'Provident Fund (PF)', fmt(pf)],
                ['House Rent Allowance (HRA)', fmt(hraVal), 'Professional Tax', fmt(tax)],
                ['', '', '', ''],
                [
                    { content: 'Gross Earnings', styles: { fontStyle: 'bold', fillColor: [220, 230, 255] } },
                    { content: fmt(grossEarnings), styles: { fontStyle: 'bold', fillColor: [220, 230, 255] } },
                    { content: 'Total Deductions', styles: { fontStyle: 'bold', fillColor: [255, 220, 220] } },
                    { content: fmt(totalDeductions), styles: { fontStyle: 'bold', fillColor: [255, 220, 220] } },
                ],
            ],
            theme: 'grid',
            headStyles: { fillColor: PRIMARY, textColor: 255, fontStyle: 'bold', fontSize: 9 },
            bodyStyles: { fontSize: 9, textColor: DARK_TEXT },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            columnStyles: {
                0: { cellWidth: 55 },
                1: { cellWidth: 40, halign: 'right' },
                2: { cellWidth: 55 },
                3: { cellWidth: 40, halign: 'right' },
            },
        });

        // ── Net Salary Band ───────────────────────────────────────
        const afterTable = doc.lastAutoTable.finalY + 6;
        doc.setFillColor(...PRIMARY);
        doc.roundedRect(14, afterTable, pageW - 28, 16, 2, 2, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('NET SALARY PAYABLE', 20, afterTable + 10);
        doc.text(fmt(netSalary), pageW - 14, afterTable + 10, { align: 'right' });

        // ── Signature Section ─────────────────────────────────────
        const sigY = afterTable + 36;
        doc.setDrawColor(180, 180, 180);
        doc.setLineWidth(0.3);

        doc.line(20, sigY, 75, sigY);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...MUTED);
        doc.text('Employee Signature', 20, sigY + 5);

        doc.line(135, sigY, 190, sigY);
        doc.text('Authorised Signatory', 135, sigY + 5);

        // ── Footer ────────────────────────────────────────────────
        doc.setFontSize(7);
        doc.setTextColor(160, 160, 160);
        doc.text('This is a system generated payslip and does not require a physical signature.', pageW / 2, 285, { align: 'center' });
        doc.text(`Generated on: ${now.toLocaleDateString('en-IN')}`, pageW / 2, 289, { align: 'center' });

        doc.save(`Payslip_${empCode}_${monthYear.replace(' ', '_')}.pdf`);
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
        <div className="modal-overlay">
            <div className="card animate-fade-in" style={{
                maxWidth: '900px',
                width: '95%',
                maxHeight: '90vh',
                padding: 0,
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

                            {/* Documents Section */}
                            {documents.length > 0 && (
                                <section>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                                        <div style={{ width: '4px', height: '20px', background: '#f59e0b', borderRadius: '2px' }}></div>
                                        <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#1e293b' }}>Documents</h3>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        {documents.map((doc, idx) => (
                                            <a
                                                key={idx}
                                                href={doc.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: '12px',
                                                    padding: '12px 16px', background: '#f8fafc', borderRadius: '12px',
                                                    border: '1px solid #e2e8f0', textDecoration: 'none', color: 'var(--text-main)',
                                                    transition: 'all 0.2s', cursor: 'pointer'
                                                }}
                                                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                                                onMouseLeave={e => e.currentTarget.style.borderColor = '#e2e8f0'}
                                            >
                                                <div style={{ padding: '8px', background: 'white', borderRadius: '8px', color: 'var(--primary)' }}>
                                                    <FileText size={16} />
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <p style={{ fontSize: '13px', fontWeight: '700' }}>{doc.filename}</p>
                                                    <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                                        {doc.type?.toUpperCase()} {doc.uploaded_at ? `• ${new Date(doc.uploaded_at).toLocaleDateString()}` : ''}
                                                    </p>
                                                </div>
                                                <ExternalLink size={14} style={{ color: 'var(--text-muted)' }} />
                                            </a>
                                        ))}
                                    </div>
                                </section>
                            )}
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
                                {canGeneratePayslip && (
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
                                )}
                                <button
                                    onClick={() => {
                                        onClose();
                                        // Navigate to HRMS Attendance tab; include employee id so HRMS can pre-select
                                        const empId = employee?._id || employee?.employeeCode || employee?.employee_code || '';
                                        navigate(`/hr?tab=Attendance${empId ? `&employee=${encodeURIComponent(empId)}` : ''}`);
                                    }}
                                    className="btn btn-outline" style={{
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

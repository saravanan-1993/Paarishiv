import React, { useState } from 'react';
import { X, ClipboardList, HardHat, Package, Truck, User, Calendar, Download, Loader2, Building2 } from 'lucide-react';
import { settingsAPI } from '../utils/api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
const DPRViewModal = ({ isOpen, onClose, dpr, projectName }) => {
    const [isDownloading, setIsDownloading] = useState(false);
    const [companyInfo, setCompanyInfo] = useState({
        companyName: 'CIVIL ERP',
        logo: ''
    });

    React.useEffect(() => {
        if (isOpen) {
            const fetchInfo = () => {
                settingsAPI.getCompany().then(res => {
                    if (res.data) setCompanyInfo(res.data);
                }).catch(err => console.error("Failed to fetch company info", err));
            };
            fetchInfo();
            window.addEventListener('companyInfoUpdated', fetchInfo);
            return () => window.removeEventListener('companyInfoUpdated', fetchInfo);
        }
    }, [isOpen]);

    if (!isOpen || !dpr) return null;

    const handleDownloadPDF = async () => {
        setIsDownloading(true);
        try {
            const doc = new jsPDF();

            const loadImage = (url) => {
                return new Promise((resolve, reject) => {
                    const img = new Image();
                    img.crossOrigin = 'Anonymous';
                    img.onload = () => resolve(img);
                    img.onerror = (e) => reject(e);
                    img.src = url;
                });
            };

        // Header
        doc.setFontSize(22);
        doc.setTextColor(30, 58, 95);
        doc.text(companyInfo.companyName || 'CIVIL ERP', 14, 20);

        doc.setFontSize(18);
        doc.setTextColor(59, 130, 246);
        doc.text('Daily Progress Report', 105, 30, { align: 'center' });

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`ID: ${dpr.id}`, 200, 10, { align: 'right' });

        // Project Info
        doc.setFontSize(12);
        doc.setTextColor(0);
        doc.text(`Project: ${projectName}`, 14, 45);
        doc.text(`Date: ${dpr.date}`, 14, 52);
        doc.text(`Submitted By: ${dpr.submitted_by}`, 14, 59);
        doc.text(`Status: ${dpr.status || 'Pending'}`, 200, 45, { align: 'right' });
        
        let finalY = 65;

        // Summary
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('WORK SUMMARY:', 14, finalY);
        doc.setFont('helvetica', 'normal');
        const summaryLines = doc.splitTextToSize(dpr.progress || 'No summary provided.', 180);
        doc.text(summaryLines, 14, finalY + 6);
        
        finalY = finalY + 6 + (summaryLines.length * 7);

        // Weather & Workforce
        if (dpr.weather || dpr.total_labour) {
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            if (dpr.weather) doc.text(`Weather: ${dpr.weather}`, 14, finalY);
            if (dpr.total_labour) doc.text(`Total Workforce: ${dpr.total_labour}`, 120, finalY);
            finalY += 8;
        }

        // Work Table
        if (dpr.work_rows?.length > 0) {
            autoTable(doc, {
                startY: finalY + 10,
                head: [['Activity / Task', 'Today\'s Progress', 'Overall %', 'Status', 'Remarks']],
                body: dpr.work_rows.map(r => [r.task, r.today, r.overall || r.total || '', r.status || '', r.remark || '—']),
                theme: 'grid',
                headStyles: { fillColor: [30, 58, 95] }
            });
            finalY = doc.lastAutoTable.finalY;
        }

        // Labour Table
        if (dpr.labour_rows?.length > 0) {
            autoTable(doc, {
                startY: finalY + 10,
                head: [['Contractor', 'Labour Type', 'Count', 'Shift', 'OT (hrs)']],
                body: dpr.labour_rows.map(r => [r.party, r.category || r.type || '', r.count, r.shift, r.ot || r.overtime || '0']),
                theme: 'grid',
                headStyles: { fillColor: [30, 58, 95] }
            });
            finalY = doc.lastAutoTable.finalY;
        }

        // Material Table
        if (dpr.material_rows?.length > 0) {
            autoTable(doc, {
                startY: finalY + 10,
                head: [['Material Name', 'UOM', 'Opening', 'Received', 'Used', 'Closing']],
                body: dpr.material_rows.map(r => [
                    r.name,
                    r.uom || r.unit || '-',
                    r.opening,
                    r.received,
                    r.used,
                    (Number(r.opening || 0) + Number(r.received || 0)) - Number(r.used || 0)
                ]),
                theme: 'grid',
                headStyles: { fillColor: [30, 58, 95] }
            });
            finalY = doc.lastAutoTable.finalY;
        }

        // Equipment Table
        if (dpr.equipment_rows?.length > 0) {
            autoTable(doc, {
                startY: finalY + 10,
                head: [['Equipment Name', 'Machine No.', 'Hours Used', 'Fuel (Ltr)', 'Rate/Hr', 'Amount']],
                body: dpr.equipment_rows.map(r => [r.name, r.no, r.hours, r.fuel, r.rate || '-', r.rate ? (Number(r.hours || 0) * Number(r.rate || 0)).toFixed(2) : '-']),
                theme: 'grid',
                headStyles: { fillColor: [30, 58, 95] }
            });
            finalY = doc.lastAutoTable.finalY;
        }

        // Contractor Summary Table
        if (dpr.contractor_rows?.length > 0 && dpr.contractor_rows.some(r => r.contractor)) {
            autoTable(doc, {
                startY: finalY + 10,
                head: [['Contractor Name', 'Work Title', 'Today\'s Progress', 'Total Overall']],
                body: dpr.contractor_rows.filter(r => r.contractor).map(r => [r.contractor, r.title || '', r.progress || '', r.overall || '']),
                theme: 'grid',
                headStyles: { fillColor: [30, 58, 95] }
            });
            finalY = doc.lastAutoTable.finalY;
        }

        // Issues & Notes
        if (dpr.issues || dpr.notes) {
            finalY += 10;
            if (finalY > 260) { doc.addPage(); finalY = 20; }
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            if (dpr.issues) {
                doc.text('ISSUES & DELAYS:', 14, finalY);
                doc.setFont('helvetica', 'normal');
                const issueLines = doc.splitTextToSize(dpr.issues, 180);
                doc.text(issueLines, 14, finalY + 6);
                finalY += 6 + (issueLines.length * 6);
            }
            if (dpr.notes) {
                finalY += 4;
                doc.setFont('helvetica', 'bold');
                doc.text('GENERAL NOTES:', 14, finalY);
                doc.setFont('helvetica', 'normal');
                const noteLines = doc.splitTextToSize(dpr.notes, 180);
                doc.text(noteLines, 14, finalY + 6);
                finalY += 6 + (noteLines.length * 6);
            }
        }

        // Next Day Requirements Header
        if (dpr.next_day_materials?.length > 0 || dpr.next_day_labour?.length > 0 || dpr.next_day_equipment?.length > 0) {
            doc.addPage();
            doc.setFontSize(16);
            doc.setTextColor(30, 58, 95);
            doc.text('NEXT DAY REQUIREMENTS', 105, 20, { align: 'center' });
            finalY = 30;

            if (dpr.next_day_materials?.length > 0) {
                autoTable(doc, {
                    startY: finalY,
                    head: [['Material Name', 'Unit', 'Qty Needed']],
                    body: dpr.next_day_materials.map(r => [r.material, r.unit, r.qty]),
                    theme: 'grid',
                    headStyles: { fillColor: [30, 58, 95] }
                });
                finalY = doc.lastAutoTable.finalY + 10;
            }

            if (dpr.next_day_labour?.length > 0) {
                autoTable(doc, {
                    startY: finalY,
                    head: [['Labour Category', 'Count Needed']],
                    body: dpr.next_day_labour.map(r => [r.category, r.count]),
                    theme: 'grid',
                    headStyles: { fillColor: [30, 58, 95] }
                });
                finalY = doc.lastAutoTable.finalY + 10;
            }

            if (dpr.next_day_equipment?.length > 0) {
                autoTable(doc, {
                    startY: finalY,
                    head: [['Equipment Type', 'Note / Reason']],
                    body: dpr.next_day_equipment.map(r => [r.equipment, r.note]),
                    theme: 'grid',
                    headStyles: { fillColor: [30, 58, 95] }
                });
                finalY = doc.lastAutoTable.finalY + 10;
            }
        }

        // Photos Section
        if (dpr.photos?.length > 0) {
            doc.addPage();
            doc.setFontSize(16);
            doc.setTextColor(30, 58, 95);
            doc.text('SITE PHOTOS', 105, 20, { align: 'center' });

            let currentX = 14;
            let currentY = 30;
            const imgWidth = 85;
            const imgHeight = 60;
            const gap = 10;

            for (let i = 0; i < dpr.photos.length; i++) {
                const url = dpr.photos[i];
                const fullUrl = url.startsWith('http') ? url : `${import.meta.env.VITE_API_URL || '/api'}${url}`;

                try {
                    const img = await loadImage(fullUrl);
                    doc.addImage(img, 'JPEG', currentX, currentY, imgWidth, imgHeight);

                    // Update positions for grid (2 columns)
                    if (i % 2 === 0) {
                        currentX += imgWidth + gap;
                    } else {
                        currentX = 14;
                        currentY += imgHeight + gap;
                    }

                    // Check if we need a new page
                    if (currentY + imgHeight > 280 && i < dpr.photos.length - 1) {
                        doc.addPage();
                        currentY = 20;
                        currentX = 14;
                        doc.setFontSize(16);
                        doc.setTextColor(30, 58, 95);
                        doc.text('SITE PHOTOS (Contd.)', 105, 10, { align: 'center' });
                    }
                } catch (err) {
                    console.error('Failed to load image for PDF:', fullUrl, err);
                }
            }
        }

            doc.save(`DPR_${projectName.replace(/\s+/g, '_')}_${dpr.date.replace(/\s+/g, '_')}.pdf`);
        } catch (err) {
            console.error('PDF generation crash:', err);
            alert('Failed to generate PDF. Some images might be blocking the request.');
        } finally {
            setIsDownloading(false);
        }
    };

    const TabSection = ({ title, icon: Icon, children, count }) => (
        <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1.5px solid #F1F5F9' }}>
                <div style={{ padding: '6px', borderRadius: '6px', backgroundColor: '#F1F5F9', color: 'var(--primary)' }}>
                    <Icon size={16} />
                </div>
                <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-main)' }}>{title} {count !== undefined && <span style={{ color: 'var(--text-muted)', fontWeight: '500', fontSize: '12px' }}>({count})</span>}</h3>
            </div>
            {children}
        </div>
    );

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            zIndex: 1100, backdropFilter: 'blur(6px)'
        }}>
            <div className="card animate-fade-in" style={{
                width: '95vw', maxWidth: '900px', maxHeight: '90vh',
                backgroundColor: 'white', display: 'flex', flexDirection: 'column',
                padding: '0', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
            }}>
                {/* Header */}
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg,#1e3a5f,#2F5D8A)' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px', flexWrap: 'wrap' }}>
                            <h2 style={{ fontSize: '18px', color: 'white', fontWeight: '700' }}>Report Details</h2>
                            <span style={{
                                padding: '4px 12px', borderRadius: '20px', fontSize: '10px', fontWeight: '800', textTransform: 'uppercase',
                                backgroundColor: dpr.status === 'Approved' ? '#ECFDF5' : dpr.status === 'Rejected' ? '#FEF2F2' : '#FFFBEB',
                                color: dpr.status === 'Approved' ? '#059669' : dpr.status === 'Rejected' ? '#EF4444' : '#D97706',
                                border: `1px solid ${dpr.status === 'Approved' ? '#A7F3D0' : dpr.status === 'Rejected' ? '#FECACA' : '#FDE68A'}`
                            }}>
                                {dpr.status || 'Pending'}
                            </span>
                        </div>
                        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            <span>Project: <b>{projectName || '—'}</b></span>
                            <span className="hide-mobile">|</span>
                            <span>Date: <b>{dpr.date}</b></span>
                        </p>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.8)', padding: '8px' }}><X size={24} /></button>
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }} className="custom-scrollbar">

                    {/* Summary Section */}
                    <div style={{ backgroundColor: '#F8FAFC', padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0', marginBottom: '24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                            <ClipboardList size={18} color="var(--primary)" />
                            <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Work Summary</span>
                        </div>
                        <p style={{ fontSize: '14px', color: 'var(--text-main)', lineHeight: '1.6', fontWeight: '500' }}>
                            {dpr.progress || 'No summary provided.'}
                        </p>
                    </div>

                    {/* Work Summary Table */}
                    <TabSection title="Work Execution" icon={ClipboardList} count={dpr.work_rows?.length}>
                        <div style={{ overflowX: 'auto' }}>
                            <table className="dt-view" style={{ width: '100%', marginBottom: '20px', borderCollapse: 'collapse', minWidth: '600px' }}>
                                <thead style={{ backgroundColor: '#f1f5f9' }}>
                                    <tr>
                                        <th style={{ textAlign: 'left', padding: '10px', fontSize: '12px', borderBottom: '1px solid #e2e8f0' }}>Activity</th>
                                        <th style={{ textAlign: 'left', padding: '10px', fontSize: '12px', borderBottom: '1px solid #e2e8f0' }}>Progress</th>
                                        <th style={{ textAlign: 'left', padding: '10px', fontSize: '12px', borderBottom: '1px solid #e2e8f0' }}>Overall %</th>
                                        <th style={{ textAlign: 'left', padding: '10px', fontSize: '12px', borderBottom: '1px solid #e2e8f0' }}>Remark</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {dpr.work_rows?.map((row, i) => (
                                        <tr key={i}>
                                            <td data-label="Activity" style={{ padding: '10px', borderBottom: '1px solid #f1f5f9', fontWeight: '600', fontSize: '13px' }}>{row.task}</td>
                                            <td data-label="Progress" style={{ padding: '10px', borderBottom: '1px solid #f1f5f9', fontSize: '13px' }}>{row.today}</td>
                                            <td data-label="Overall %" style={{ padding: '10px', borderBottom: '1px solid #f1f5f9', fontWeight: '700', color: 'var(--primary)', fontSize: '13px' }}>{row.total}</td>
                                            <td data-label="Remark" style={{ padding: '10px', borderBottom: '1px solid #f1f5f9', color: 'var(--text-muted)', fontSize: '12px' }}>{row.remark}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </TabSection>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
                        {/* Labour Table */}
                        <TabSection title="Labour Deployment" icon={HardHat} count={dpr.labour_rows?.length}>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '300px' }}>
                                    <thead style={{ backgroundColor: '#f1f5f9' }}>
                                        <tr>
                                            <th style={{ textAlign: 'left', padding: '8px', fontSize: '11px' }}>Contractor</th>
                                            <th style={{ textAlign: 'left', padding: '8px', fontSize: '11px' }}>Type</th>
                                            <th style={{ textAlign: 'center', padding: '8px', fontSize: '11px' }}>Qty</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {dpr.labour_rows?.map((row, i) => (
                                            <tr key={i}>
                                                <td data-label="Contractor" style={{ padding: '8px', borderBottom: '1px solid #f1f5f9', fontSize: '12px' }}>{row.party}</td>
                                                <td data-label="Type" style={{ padding: '8px', borderBottom: '1px solid #f1f5f9', fontSize: '12px' }}>{row.type}</td>
                                                <td data-label="Qty" style={{ padding: '8px', borderBottom: '1px solid #f1f5f9', fontSize: '12px', textAlign: 'center', fontWeight: '700' }}>{row.count}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </TabSection>

                        {/* Equipment Table */}
                        <TabSection title="Equipment Log" icon={Truck} count={dpr.equipment_rows?.length}>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '300px' }}>
                                    <thead style={{ backgroundColor: '#f1f5f9' }}>
                                        <tr>
                                            <th style={{ textAlign: 'left', padding: '8px', fontSize: '11px' }}>Machine</th>
                                            <th style={{ textAlign: 'center', padding: '8px', fontSize: '11px' }}>Hrs</th>
                                            <th style={{ textAlign: 'center', padding: '8px', fontSize: '11px' }}>Fuel</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {dpr.equipment_rows?.map((row, i) => (
                                            <tr key={i}>
                                                <td data-label="Machine" style={{ padding: '8px', borderBottom: '1px solid #f1f5f9', fontSize: '12px' }}>{row.name} <br /><small>{row.no}</small></td>
                                                <td data-label="Hrs" style={{ padding: '8px', borderBottom: '1px solid #f1f5f9', fontSize: '12px', textAlign: 'center', fontWeight: '700' }}>{row.hours}</td>
                                                <td data-label="Fuel" style={{ padding: '8px', borderBottom: '1px solid #f1f5f9', fontSize: '12px', textAlign: 'center' }}>{row.fuel}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </TabSection>
                    </div>

                    {/* Material Table */}
                    <TabSection title="Material Consumption" icon={Package} count={dpr.material_rows?.length}>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '500px' }}>
                                <thead style={{ backgroundColor: '#f1f5f9' }}>
                                    <tr>
                                        <th style={{ textAlign: 'left', padding: '10px', fontSize: '12px' }}>Material</th>
                                        <th style={{ textAlign: 'center', padding: '10px', fontSize: '12px' }}>Opening</th>
                                        <th style={{ textAlign: 'center', padding: '10px', fontSize: '12px' }}>Received</th>
                                        <th style={{ textAlign: 'center', padding: '10px', fontSize: '12px' }}>Used</th>
                                        <th style={{ textAlign: 'center', padding: '10px', fontSize: '12px' }}>Closing</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {dpr.material_rows?.map((row, i) => {
                                        const closing = (Number(row.opening) + Number(row.received)) - Number(row.used);
                                        return (
                                            <tr key={i}>
                                                <td data-label="Material" style={{ padding: '10px', borderBottom: '1px solid #f1f5f9', fontWeight: '600', fontSize: '13px' }}>{row.name}</td>
                                                <td data-label="Opening" style={{ padding: '10px', borderBottom: '1px solid #f1f5f9', textAlign: 'center' }}>{row.opening}</td>
                                                <td data-label="Received" style={{ padding: '10px', borderBottom: '1px solid #f1f5f9', textAlign: 'center', color: '#10B981' }}>{row.received}</td>
                                                <td data-label="Used" style={{ padding: '10px', borderBottom: '1px solid #f1f5f9', textAlign: 'center', color: '#EF4444' }}>{row.used}</td>
                                                <td data-label="Closing" style={{ padding: '10px', borderBottom: '1px solid #f1f5f9', textAlign: 'center', fontWeight: '700', color: 'var(--primary)' }}>{closing}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </TabSection>

                    {/* Next Day Requirements Section */}
                    {(dpr.next_day_materials?.length > 0 || dpr.next_day_labour?.length > 0 || dpr.next_day_equipment?.length > 0) && (
                        <div style={{ marginTop: '32px', padding: '24px', backgroundColor: '#F0F9FF', borderRadius: '16px', border: '1px solid #BAE6FD' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                                <Calendar size={20} color="#0369A1" />
                                <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0369A1', textTransform: 'uppercase' }}>Next Day Planning</h3>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
                                {dpr.next_day_materials?.length > 0 && (
                                    <div style={{ background: 'white', padding: '16px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                                        <h4 style={{ fontSize: '13px', fontWeight: '700', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}><Package size={14} /> Materials</h4>
                                        <table style={{ width: '100%', fontSize: '12px' }}>
                                            <tbody>
                                                {dpr.next_day_materials.map((m, i) => (
                                                    <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                                                        <td style={{ padding: '6px 0', fontWeight: '600' }}>{m.material}</td>
                                                        <td style={{ padding: '6px 0', textAlign: 'right', color: 'var(--primary)', fontWeight: '700' }}>{m.qty} <small style={{ fontWeight: 'normal' }}>{m.unit}</small></td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {dpr.next_day_labour?.length > 0 && (
                                    <div style={{ background: 'white', padding: '16px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                                        <h4 style={{ fontSize: '13px', fontWeight: '700', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}><HardHat size={14} /> Labour</h4>
                                        <table style={{ width: '100%', fontSize: '12px' }}>
                                            <tbody>
                                                {dpr.next_day_labour.map((l, i) => (
                                                    <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                                                        <td style={{ padding: '6px 0', fontWeight: '600' }}>{l.category}</td>
                                                        <td style={{ padding: '6px 0', textAlign: 'right', color: '#059669', fontWeight: '700' }}>{l.count} <small style={{ fontWeight: 'normal' }}>qty</small></td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {dpr.next_day_equipment?.length > 0 && (
                                    <div style={{ background: 'white', padding: '16px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                                        <h4 style={{ fontSize: '13px', fontWeight: '700', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}><Truck size={14} /> Equipment</h4>
                                        <table style={{ width: '100%', fontSize: '12px' }}>
                                            <tbody>
                                                {dpr.next_day_equipment.map((e, i) => (
                                                    <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                                                        <td style={{ padding: '6px 0', fontWeight: '600' }}>{e.equipment}</td>
                                                        <td style={{ padding: '6px 0', textAlign: 'right', color: '#6366F1', fontSize: '11px' }}>{e.note}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Photos Section */}
                    {dpr.photos?.length > 0 && (
                        <TabSection title="Site Photos" icon={Package} count={dpr.photos.length}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px' }}>
                                {dpr.photos.map((url, idx) => {
                                    const fullUrl = url.startsWith('http') ? url : `${import.meta.env.VITE_API_URL || '/api'}${url}`;
                                    return (
                                        <div key={idx} style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid #E2E8F0', height: '120px' }}>
                                            <img
                                                src={fullUrl}
                                                alt={`site-${idx}`}
                                                style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
                                                onClick={() => window.open(fullUrl, '_blank')}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        </TabSection>
                    )}

                    {/* Footer Info */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '32px', paddingTop: '20px', borderTop: '1px solid #F1F5F9', flexWrap: 'wrap', gap: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '13px' }}>
                            <User size={14} /> Submitted By: <b style={{ color: 'var(--text-main)' }}>{dpr.submitted_by}</b>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '13px' }}>
                            <Calendar size={14} /> Recorded At: <b>{new Date(dpr.created_at).toLocaleString('en-IN')}</b>
                        </div>
                    </div>
                </div>

                {/* Main Footer with Close button */}
                <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', backgroundColor: '#F8FAFC', display: 'flex', justifyContent: 'flex-end', gap: '12px', flexWrap: 'wrap' }}>
                    <button 
                        className="btn btn-outline" 
                        onClick={handleDownloadPDF} 
                        disabled={isDownloading}
                        style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', flex: '1 1 auto', justifyContent: 'center' }}
                    >
                        {isDownloading ? (
                            <><Loader2 size={16} className="animate-spin" /> Preparing...</>
                        ) : (
                            <><Download size={16} /> PDF</>
                        )}
                    </button>
                    <button className="btn btn-primary" onClick={onClose} style={{ padding: '10px 30px', fontSize: '14px', flex: '1 1 auto' }}>Close</button>
                </div>
            </div>

            <style>{`
                @media (max-width: 768px) {
                    .hide-mobile { display: none !important; }
                    thead { display: none; }
                    tr { display: block; background: #F8FAFC; margin-bottom: 12px; padding: 12px; border-radius: 8px; border: 1px solid #E2E8F0; }
                    td { display: block; border: none !important; padding: 6px 0 !important; text-align: left !important; }
                    td[data-label]::before {
                        content: attr(data-label);
                        display: block;
                        font-size: 10px;
                        font-weight: 700;
                        color: #64748B;
                        text-transform: uppercase;
                        margin-bottom: 2px;
                    }
                }
            `}</style>
        </div>
    );
};

export default DPRViewModal;

import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Camera, Save, HardHat, Package, Truck, ClipboardList, Loader2, Building2, Calendar, LayoutTemplate, AlertCircle, CheckSquare } from 'lucide-react';
import { projectAPI, vendorAPI, materialAPI, fleetAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import CustomSelect from './CustomSelect';

const DPRModal = ({ isOpen, onClose, project, onDprAdded }) => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('work');

    // Checklist data from 6 PDFs — all optional
    const CHECKLIST_DATA = {
        'Concrete Pouring (CPA)': [
            'Shuttering checked for line, level, plumb, dimensions, and stability',
            'Formwork surface cleaned and coated with release agent',
            'Adequate supports, bracing, and safety platforms provided',
            'Bar bending verified with approved BBS and drawings',
            'Cover blocks placed correctly and of approved quality',
            'Reinforcement free from rust, mud, and oil',
            'Proper spacing, laps, hooks, bends, and ties provided',
            'Electrical conduits, sleeves, inserts fixed as per drawing',
            'Opening, embedment, and sleeves verified',
            'Safety check (Scaffolding, Working Platform, PPE)',
            'Shoe Marking casted properly and Height of column as per plan',
            'Lintel, Sunshade casted as per drawings',
        ],
        'Brickwork (BWC)': [
            'Bricks: uniform size, no cracks, approved quality',
            'Bricks soaked 10-12 hrs, moist before use',
            'Cement & sand mix ratio as per drawing/spec',
            'Sand is clean, silt-free, medium grade',
            'Water is clean/potable',
            'Layout marked as per approved drawings',
            'Mortar mixed fresh, used within 30-45 mins',
            'First course laid true to line, level, and plumb',
            'Joint thickness 10 mm or less (horizontal & vertical)',
            'Proper bond maintained, no continuous vertical joints',
            'Queen closers at corners, no bats used',
            'Wall raised max 1 m height per day',
            'Joints raked 10-15 mm for plaster grip',
            'Verticality & alignment checked every 3-5 courses',
            'Cross walls properly toothed/bonded',
            'Lintel levels, door & window openings checked',
            'Service openings provided as per drawing',
            'Holes left for scaffolding filled with CC',
            'Stable scaffolding in place - tied and braced',
            'Wall surface cleaned of loose mortar',
            'Curing started after 24 hrs, continued 7 days',
            'No chasing/grooving before curing complete',
            'Final check: line, level, plumb, dimensions verified',
            'Wastage of Mortar controlled / Half Brick used properly',
        ],
        'Plastering': [
            'Surface cleaned of dust, loose mortar, and debris before plastering',
            'All holes, joints, and chases filled and cured before plastering',
            'Brick/block joints properly raked to receive plaster',
            'Masonry cured at least 7 days before plastering',
            'Scaffolding is stable and does not touch the wall surface',
            'Plaster mix prepared in correct ratio as per drawing/spec',
            'Sand used is clean, well-graded, and silt-free',
            'Water used is clean/potable',
            'Plaster thickness as per specification (12mm/15mm/20mm)',
            'Single coat thickness does not exceed 12 mm',
            'For double coat, second coat applied after proper curing of first coat',
            'Mortar used within 30 minutes of mixing',
            'Plaster surface kept rough for receiving second/finishing coat',
            'Levels, line, and plumb checked with straight edge & spirit level (Button Mark)',
            'Corners, edges, and junctions kept straight, neat, and true',
            'Curing of plaster started after 24 hours, continued for 7 days minimum',
            'No cracks, honeycombs, or hollow patches visible on plaster surface',
            'Electrical/Plumbing chase work completed before plastering',
            'Final surface smooth, even, and ready for painting/finishing',
            'Before ceiling and column plastering the surface should be Hacked',
            'Fiber mesh used among concrete, brick work and electrical point chasing areas',
        ],
        'Painting (PWC)': [
            'Surface cleaned of dust, grease, loose particles, and laitance',
            'All plastered surfaces cured and dried completely before painting',
            'Moisture content of wall checked - no dampness or leakage present',
            'Cracks and holes filled with approved filler/putty before primer',
            'Primer applied as per manufacturer specification',
            'Putty applied in required coats for smooth finish',
            'Surface rubbed down with sandpaper between coats',
            'Paint material approved make/brand as per project specification',
            'Shade, color, and texture of paint verified with approved sample',
            'Paint mixed/stirred properly before application',
            'Correct dilution of paint maintained as per manufacturer instructions',
            'Number of coats as specified in drawings/BOQ (min. 2 coats)',
            'Each coat allowed to dry completely before next coat applied',
            'Uniform shade, finish, and coverage checked across surface',
            'No brush marks, roller marks, or patchiness visible',
            'Edges, corners, and junctions neat and sharp',
            'Protection provided to floors, doors, and fixtures before painting',
            'Scaffolding stable and does not touch painted surface',
            'Final surface smooth, even, and as per approved finish',
            'Touch-ups done wherever required and surface cleaned after work',
            'Adjacent areas protected by Masking tape wherever needed',
        ],
        'Shuttering & Bar Bending (SBC)': [
            'Formwork material of approved quality (plywood/steel) used',
            'Formwork surface clean, free of rust, oil, and debris',
            'Formwork joints tight, no leakage of slurry',
            'Formwork aligned to line, level, plumb, and dimensions as per drawing',
            'Adequate bracing and supports provided to prevent bulging/displacement',
            'Shuttering coated with approved form oil/release agent before concreting',
            'Provision made for working platforms and safe access',
            'Formwork checked for embedded items (sleeves, inserts, pipes, conduits)',
            'Stability of shuttering checked before concreting',
            'Steel reinforcement of approved make and grade received with test certificate',
            'Bars free from rust, oil, mud, and dirt before use',
            'Cutting and bending of bars as per approved bar bending schedule',
            'Bar bends, hooks, and cranks as per IS specifications/drawings',
            'Correct bar diameter, spacing, and quantity verified with drawings',
            'Lapping length maintained as per IS codes/specifications',
            'Stirrups, ties, and spacers provided at correct intervals',
            'Cover blocks of correct thickness and grade provided',
            'Reinforcement placed as per drawing and fixed firmly to prevent displacement',
            'Chairs/spacers used for maintaining cover in slabs and beams',
            'No tack welding done unless approved in design',
            'Congestion of reinforcement avoided at beam-column junctions',
            'Embedded items and openings kept in position before concreting',
            'Wastage of nails and binding wire properly used',
        ],
        'End of Day (EDC)': [
            'Cement bags properly stacked on wooden planks',
            'Cement bags covered with tarpaulin',
            'Steel bars arranged size-wise',
            'Steel stored above ground level',
            'Sand protected from contamination',
            'Aggregates stored separately',
            'Area arranged for next day material dumping',
            'Paint buckets closed and stored safely',
            'Putty/chemical bags sealed',
            'Tiles stacked properly',
            'Electrical items stored in dry area',
            'Tools collected and stored',
            'Power tools switched off',
            'Mixer machine cleaned',
            'Equipment stored properly',
            'Scaffolding arranged',
            'Debris cleared',
            'No sharp objects on floor',
            'Pathways clear',
            'Excess mortar removed',
            'Site cleaned',
            'Electrical supply switched off',
            'Wiring safe',
            'Open pits covered',
            'Safety boards placed',
            'Fire extinguisher accessible',
            'Curing arranged',
            'Hoses stored properly',
            'No water leakage',
            'Gates closed',
            'Watchman deployed',
            'Materials secured',
            'Daily status recorded',
            'Overall site ready for next day',
        ],
    };

    const [checklist, setChecklist] = useState({});
    const [loading, setLoading] = useState(false);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [summary, setSummary] = useState('');

    const [weather, setWeather] = useState('Clear');
    const [totalLabour, setTotalLabour] = useState('0');
    const [issues, setIssues] = useState('');
    const [notes, setNotes] = useState('');

    const [workRows, setWorkRows] = useState([{ task: '', today: '', overall: '', status: 'Ongoing', remark: '' }]);
    const [labourRows, setLabourRows] = useState([{ party: '', category: '', count: '', shift: '1', ot: '0' }]);
    const [materialRows, setMaterialRows] = useState([{ name: '', opening: '', received: '', used: '' }]);
    const [equipmentRows, setEquipmentRows] = useState([{ name: '', no: '', hours: '', fuel: '' }]);
    const [nextDayMaterials, setNextDayMaterials] = useState([{ material: '', unit: '', qty: '' }]);
    const [nextDayEquipment, setNextDayEquipment] = useState([{ equipment: '', note: '' }]);
    const [nextDayLabour, setNextDayLabour] = useState([{ category: '', count: '' }]);
    const [contractorRows, setContractorRows] = useState([{ contractor: '', title: '', progress: '', overall: '' }]);
    const [contractors, setContractors] = useState([]);
    const [masterMaterials, setMasterMaterials] = useState([]);
    const [masterVehicles, setMasterVehicles] = useState([]);
    const [allVendors, setAllVendors] = useState([]);
    const [photos, setPhotos] = useState([]);

    // Derived unique labour roles from contractors' rate cards
    const allLabourRoles = React.useMemo(() => {
        const roles = new Set();
        contractors.forEach(c => {
            if (c.rate_card) {
                c.rate_card.forEach(rc => {
                    if (rc.role) roles.add(rc.role);
                });
            }
        });
        return Array.from(roles).sort();
    }, [contractors]);

    useEffect(() => {
        const fetchData = async () => {
            // Fetch each data source independently so one failure doesn't block others
            const results = await Promise.allSettled([
                vendorAPI.getAll(),
                materialAPI.getAll(),
                fleetAPI.getVehicles()
            ]);

            const contractorRes = results[0].status === 'fulfilled' ? results[0].value : { data: [] };
            const materialRes = results[1].status === 'fulfilled' ? results[1].value : { data: [] };
            const vehicleRes = results[2].status === 'fulfilled' ? results[2].value : { data: [] };

            if (results[0].status === 'rejected') console.warn('Failed to fetch vendors for DPR:', results[0].reason);
            if (results[1].status === 'rejected') console.warn('Failed to fetch materials for DPR:', results[1].reason);
            if (results[2].status === 'rejected') console.warn('Failed to fetch vehicles for DPR:', results[2].reason);

            // Filter for labour contractors (case-insensitive)
            const labourContractors = (contractorRes.data || []).filter(v => {
                const cat = (v.category || '').toLowerCase();
                const type = (v.type || '').toLowerCase();
                return cat.includes('labor') || cat.includes('labour') || cat.includes('contractor') ||
                       type.includes('labor') || type.includes('labour') || type.includes('contractor');
            });
            setContractors(labourContractors.length > 0 ? labourContractors : contractorRes.data || []);
            setAllVendors(contractorRes.data || []);
            setMasterMaterials(materialRes.data || []);
            setMasterVehicles(vehicleRes.data || []);
        };
        if (isOpen) fetchData();
    }, [isOpen]);

    if (!isOpen) return null;

    const addRow = (type) => {
        // Check for empty rows before adding new ones to prevent duplicates
        if (type === 'material') {
            const hasEmpty = materialRows.some(r => !r.name || r.name.trim() === '');
            if (hasEmpty) { alert('Please fill in the existing empty material row before adding a new one.'); return; }
        }
        if (type === 'equipment') {
            const hasEmpty = equipmentRows.some(r => !r.name || r.name.trim() === '');
            if (hasEmpty) { alert('Please fill in the existing empty machinery row before adding a new one.'); return; }
        }
        if (type === 'nd_material') {
            const hasEmpty = nextDayMaterials.some(r => !r.material || r.material.trim() === '');
            if (hasEmpty) { alert('Please fill in the existing empty material row before adding a new one.'); return; }
        }
        if (type === 'nd_equipment') {
            const hasEmpty = nextDayEquipment.some(r => !r.equipment || r.equipment.trim() === '');
            if (hasEmpty) { alert('Please fill in the existing empty equipment row before adding a new one.'); return; }
        }
        if (type === 'work') setWorkRows([...workRows, { task: '', today: '', overall: '', status: 'Ongoing', remark: '' }]);
        if (type === 'labour') setLabourRows([...labourRows, { party: '', category: '', count: '', shift: '1', ot: '0' }]);
        if (type === 'material') setMaterialRows([...materialRows, { name: '', opening: '', received: '', used: '' }]);
        if (type === 'equipment') setEquipmentRows([...equipmentRows, { name: '', no: '', hours: '', fuel: '' }]);
        if (type === 'nd_material') setNextDayMaterials([...nextDayMaterials, { material: '', unit: '', qty: '' }]);
        if (type === 'nd_equipment') setNextDayEquipment([...nextDayEquipment, { equipment: '', note: '' }]);
        if (type === 'nd_labour') setNextDayLabour([...nextDayLabour, { category: '', count: '' }]);
        if (type === 'contractor') setContractorRows([...contractorRows, { contractor: '', title: '', progress: '', overall: '' }]);
    };

    const removeRow = (type, index) => {
        if (type === 'work') setWorkRows(workRows.filter((_, i) => i !== index));
        if (type === 'labour') setLabourRows(labourRows.filter((_, i) => i !== index));
        if (type === 'material') setMaterialRows(materialRows.filter((_, i) => i !== index));
        if (type === 'equipment') setEquipmentRows(equipmentRows.filter((_, i) => i !== index));
        if (type === 'nd_material') setNextDayMaterials(nextDayMaterials.filter((_, i) => i !== index));
        if (type === 'nd_equipment') setNextDayEquipment(nextDayEquipment.filter((_, i) => i !== index));
        if (type === 'nd_labour') setNextDayLabour(nextDayLabour.filter((_, i) => i !== index));
        if (type === 'contractor') setContractorRows(contractorRows.filter((_, i) => i !== index));
    };

    const updateRow = (type, index, field, value) => {
        // Bug 4.3/4.4 - Prevent duplicate material names
        if (type === 'material' && field === 'name' && value) {
            const isDuplicate = materialRows.some((r, i) => i !== index && r.name && r.name.toLowerCase() === value.toLowerCase());
            if (isDuplicate) { alert(`Material "${value}" is already added. Please select a different material.`); return; }
        }
        if (type === 'nd_material' && field === 'material' && value) {
            const isDuplicate = nextDayMaterials.some((r, i) => i !== index && r.material && r.material.toLowerCase() === value.toLowerCase());
            if (isDuplicate) { alert(`Material "${value}" is already added. Please select a different material.`); return; }
        }
        if (type === 'equipment' && field === 'name' && value) {
            const isDuplicate = equipmentRows.some((r, i) => i !== index && r.name && r.name.toLowerCase() === value.toLowerCase());
            if (isDuplicate) { alert(`Machinery "${value}" is already added. Please select a different one.`); return; }
        }
        if (type === 'equipment' && field === 'no' && value) {
            const isDuplicate = equipmentRows.some((r, i) => i !== index && r.no && r.no === value);
            if (isDuplicate) { alert(`Machinery number "${value}" is already added. Please select a different one.`); return; }
        }
        if (type === 'nd_equipment' && field === 'equipment' && value) {
            const isDuplicate = nextDayEquipment.some((r, i) => i !== index && r.equipment && r.equipment.toLowerCase() === value.toLowerCase());
            if (isDuplicate) { alert(`Equipment "${value}" is already added. Please select a different one.`); return; }
        }

        const setRows = {
            work: setWorkRows,
            labour: setLabourRows,
            material: setMaterialRows,
            equipment: setEquipmentRows,
            nd_material: setNextDayMaterials,
            nd_equipment: setNextDayEquipment,
            nd_labour: setNextDayLabour,
            contractor: setContractorRows,
        }[type];

        if (setRows) {
            setRows(prev => {
                const updated = [...prev];
                updated[index] = { ...updated[index], [field]: value };
                return updated;
            });
        }
    };

    const handlePhotoUpload = (e) => {
        const files = Array.from(e.target.files);
        const newPhotos = files.map(file => ({
            file,
            preview: URL.createObjectURL(file)
        }));
        setPhotos([...photos, ...newPhotos]);
    };

    const removePhoto = (index) => {
        const newPhotos = [...photos];
        URL.revokeObjectURL(newPhotos[index].preview);
        newPhotos.splice(index, 1);
        setPhotos(newPhotos);
    };

    const handleSubmit = async () => {
        const projectId = project?._id || project?.id;
        if (!projectId) {
            alert('Project not found. Please close and try again.');
            return;
        }
        setLoading(true);
        try {
            // 1. Upload Photos first
            const uploadedPhotoUrls = [];
            for (const item of photos) {
                if (item.file) {
                    const formData = new FormData();
                    formData.append('file', item.file);
                    const res = await projectAPI.uploadPhoto(formData);
                    if (res.data?.url) {
                        uploadedPhotoUrls.push(res.data.url);
                    }
                }
            }

            // 2. Submit DPR
            const fmtDate = new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
            await projectAPI.addDpr(projectId, {
                date: fmtDate,
                weather,
                total_labour: totalLabour,
                progress: summary || workRows.map(r => r.task).filter(Boolean).join(', ') || 'Daily site work',
                status: 'Pending',
                work_rows: workRows,
                labour_rows: labourRows,
                material_rows: materialRows,
                equipment_rows: equipmentRows,
                next_day_materials: nextDayMaterials,
                next_day_equipment: nextDayEquipment,
                next_day_labour: nextDayLabour,
                contractor_rows: contractorRows,
                issues,
                notes,
                photos: uploadedPhotoUrls,
                checklist: Object.keys(checklist).length > 0 ? checklist : undefined,
                submitted_by: user?.fullName || user?.username || (project?.engineer_id && typeof project.engineer_id === 'object' 
                                ? (project.engineer_id.username || project.engineer_id.employeeCode || project.engineer_id._id) 
                                : project?.engineer_id) || 'Site Engineer',
            });
            // Reset
            setActiveTab('work');
            setDate(new Date().toISOString().split('T')[0]);
            setWeather('Clear');
            setTotalLabour('0');
            setSummary('');
            setIssues('');
            setNotes('');
            setChecklist({});
            setWorkRows([{ task: '', today: '', overall: '', status: 'Ongoing', remark: '' }]);
            setLabourRows([{ party: '', category: '', count: '', shift: '1', ot: '0' }]);
            setMaterialRows([{ name: '', opening: '', received: '', used: '' }]);
            setEquipmentRows([{ name: '', no: '', hours: '', fuel: '' }]);
            setNextDayMaterials([{ material: '', unit: '', qty: '' }]);
            setNextDayEquipment([{ equipment: '', note: '' }]);
            setNextDayLabour([{ category: '', count: '' }]);
            setContractorRows([{ contractor: '', title: '', progress: '', overall: '' }]);
            setPhotos([]);
            onDprAdded?.();
            onClose();
        } catch (err) {
            console.error('DPR submit failed:', err);
            alert(err?.response?.data?.detail || 'Failed to submit DPR. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const TabButton = ({ id, label, icon: Icon }) => (
        <button onClick={() => setActiveTab(id)} style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '14px 20px', border: 'none', borderRadius: '12px',
            backgroundColor: activeTab === id ? 'var(--primary)' : 'transparent',
            color: activeTab === id ? 'white' : 'var(--text-muted)',
            fontWeight: activeTab === id ? '700' : '600', cursor: 'pointer', fontSize: '14px',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', textAlign: 'left', width: '100%',
            boxShadow: activeTab === id ? '0 8px 16px rgba(47, 93, 138, 0.2)' : 'none',
            transform: activeTab === id ? 'translateY(-1px)' : 'none'
        }}>
            <Icon size={18} /> {label}
        </button>
    );

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.7)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, backdropFilter: 'blur(8px)'
        }}>
            <div className="animate-fade-in dpr-modal-main" style={{
                width: '95vw', maxWidth: '1280px', height: '90vh',
                backgroundColor: '#F8FAFC', display: 'flex', flexDirection: 'column',
                padding: '0', overflow: 'hidden', borderRadius: '24px',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.4)'
            }}>
                {/* Header Section */}
                <div style={{ padding: '16px 20px', backgroundColor: 'white', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
                    <div>
                        <h2 style={{ fontSize: '20px', color: '#1E293B', fontWeight: '800', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <LayoutTemplate size={22} color="var(--primary)" />
                            <span className="dpr-header-title">Daily Progress Report</span>
                        </h2>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '13px', color: '#64748B', fontWeight: '500' }}>Project: <b style={{ color: 'var(--primary)' }}>{project?.name || '—'}</b></span>
                            <span style={{ color: '#CBD5E1' }} className="hide-mobile">|</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Calendar size={14} color="#64748B" />
                                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                                    style={{ border: 'none', background: 'transparent', fontSize: '13px', cursor: 'pointer', outline: 'none', fontWeight: '600', color: '#334155', padding: '0' }} />
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} style={{
                        background: '#F1F5F9', border: 'none', cursor: 'pointer', color: '#64748B',
                        width: '44px', height: '44px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.2s'
                    }} onMouseEnter={e => { e.currentTarget.style.background = '#E2E8F0'; e.currentTarget.style.color = '#0F172A' }} onMouseLeave={e => { e.currentTarget.style.background = '#F1F5F9'; e.currentTarget.style.color = '#64748B' }}>
                        <X size={22} />
                    </button>
                </div>

                {/* Main Body with Sidebar Layout */}
                <div className="dpr-modal-body" style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

                    {/* Sidebar / Top Tabs on Mobile */}
                    <div className="dpr-sidebar custom-scrollbar" style={{
                        width: '280px', backgroundColor: 'white', borderRight: '1px solid #E2E8F0',
                        padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: '8px', zIndex: 5, 
                        boxShadow: '2px 0 10px rgba(0,0,0,0.02)', overflowY: 'auto'
                    }}>
                        <TabButton id="work" label="Work" icon={ClipboardList} />
                        <TabButton id="labour" label="Labour" icon={HardHat} />
                        <TabButton id="equipment" label="Machinery" icon={Truck} />
                        <TabButton id="next_day" label="Next Day" icon={Plus} />
                        <TabButton id="contractor" label="Contractors" icon={Building2} />
                        <TabButton id="checklist" label="Checklist" icon={CheckSquare} />
                        <TabButton id="photos" label="Photos" icon={Camera} />
                    </div>

                    {/* Content Area */}
                    <div className="custom-scrollbar dpr-content-area" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '32px 40px', backgroundColor: '#F8FAFC', display: 'flex', flexDirection: 'column' }}>

                        {/* ── Work Tab ── */}
                        {activeTab === 'work' && (
                            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

                                <div style={{ background: 'white', padding: '24px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #E2E8F0' }}>
                                    <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '20px', color: '#1E293B', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <AlertCircle size={18} color="var(--primary)" /> Daily Brief
                                    </h3>
                                    <div className="dpr-grid-3" style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr) minmax(150px, 1fr) 2fr', gap: '20px' }}>
                                        <div>
                                            <CustomSelect
                                                label="Weather Condition"
                                                options={[
                                                    { value: 'Clear', label: 'Clear / Sunny' },
                                                    { value: 'Cloudy', label: 'Cloudy' },
                                                    { value: 'Rainy', label: 'Rainy' },
                                                    { value: 'Heavy Rain', label: 'Heavy Rain' }
                                                ]}
                                                value={weather}
                                                onChange={setWeather}
                                                width="full"
                                                searchable={false}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#64748B', marginBottom: '8px', textTransform: 'uppercase' }}>Total Workforce</label>
                                            <input value={totalLabour} onChange={e => setTotalLabour(e.target.value)} placeholder="0" className="modern-input" />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#64748B', marginBottom: '8px', textTransform: 'uppercase' }}>Overall Summary</label>
                                            <textarea value={summary} onChange={e => setSummary(e.target.value)} placeholder="Highlight of today's work..." className="modern-input" style={{ height: '44px', minHeight: '44px', resize: 'vertical', paddingTop: '10px' }} />
                                        </div>
                                    </div>
                                </div>

                                <div style={{ background: 'white', padding: '24px', paddingBottom: '120px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #E2E8F0', position: 'relative' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                                        <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1E293B' }}>Work Execution Log</h3>
                                        <button className="btn-modern outline" onClick={() => addRow('work')}><Plus size={16} /> Add Task</button>
                                    </div>
                                    <div className="mobile-table-scroll">
                                        <table className="modern-table">
                                            <thead><tr>
                                                <th>Task / Activity</th>
                                                <th style={{ width: '130px' }}>Today's Progress</th>
                                                <th style={{ width: '130px' }}>Overall Progress</th>
                                                <th style={{ width: '130px' }}>Status</th>
                                                <th>Remark</th>
                                                <th style={{ width: '40px' }}></th>
                                            </tr></thead>
                                            <tbody>{workRows.map((row, i) => (
                                                <tr key={i} style={{ position: 'relative', zIndex: workRows.length - i }}>
                                                    <td data-label="Task / Activity"><input value={row.task} onChange={e => updateRow('work', i, 'task', e.target.value)} placeholder="e.g. Wall Plastering" className="table-input-clean" /></td>
                                                    <td data-label="Today"><input value={row.today} onChange={e => updateRow('work', i, 'today', e.target.value)} placeholder="e.g. 50 Sq m" className="table-input-clean" /></td>
                                                    <td data-label="Overall"><input value={row.overall} onChange={e => updateRow('work', i, 'overall', e.target.value)} placeholder="300/400" className="table-input-clean" /></td>
                                                    <td data-label="Status">
                                                        <CustomSelect
                                                            options={[
                                                                { value: 'Ongoing', label: 'Ongoing' },
                                                                { value: 'Completed', label: 'Completed' },
                                                                { value: 'On Hold', label: 'On Hold' }
                                                            ]}
                                                            value={row.status}
                                                            onChange={val => updateRow('work', i, 'status', val)}
                                                            width="120px"
                                                            searchable={false}
                                                            style={{ border: 'none', background: 'transparent' }}
                                                        />
                                                    </td>
                                                    <td data-label="Remark"><textarea value={row.remark} onChange={e => updateRow('work', i, 'remark', e.target.value)} placeholder="Optional note..." className="table-input-clean" style={{ minHeight: '40px', resize: 'vertical', paddingTop: '8px' }} /></td>
                                                    <td className="action-cell"><button onClick={() => removeRow('work', i)} className="action-btn delete"><Trash2 size={16} /></button></td>
                                                </tr>
                                            ))}</tbody>
                                        </table>
                                    </div>
                                </div>

                                <div className="dpr-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                                    <div style={{ background: 'white', padding: '24px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #E2E8F0' }}>
                                        <label style={{ display: 'block', fontSize: '14px', fontWeight: '700', color: '#1E293B', marginBottom: '12px' }}>Issues & Delays</label>
                                        <textarea value={issues} onChange={e => setIssues(e.target.value)} placeholder="Record any site issues, breakdowns or heavy rains..." className="modern-input" style={{ height: '100px', resize: 'none' }} />
                                    </div>
                                    <div style={{ background: 'white', padding: '24px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #E2E8F0' }}>
                                        <label style={{ display: 'block', fontSize: '14px', fontWeight: '700', color: '#1E293B', marginBottom: '12px' }}>General Notes</label>
                                        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="General observations or instructions given today..." className="modern-input" style={{ height: '100px', resize: 'none' }} />
                                    </div>
                                </div>

                            </div>
                        )}

                        {/* ── Labour Tab ── */}
                        {activeTab === 'labour' && (
                            <div className="animate-fade-in" style={{ background: 'white', padding: '24px', paddingBottom: '120px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #E2E8F0', position: 'relative' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
                                    <div>
                                        <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1E293B' }}>Workforce Deployment</h3>
                                        <p style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>Log details of contractors and daily counts.</p>
                                    </div>
                                    <button className="btn-modern outline" onClick={() => addRow('labour')}><Plus size={16} /> Add Entry</button>
                                </div>
                                <div className="mobile-table-scroll">
                                    <table className="modern-table">
                                        <thead><tr>
                                            <th>Party / Contractor</th>
                                            <th>Workforce Category</th>
                                            <th style={{ width: '120px' }}>Count</th>
                                            <th style={{ width: '120px' }}>Shift</th>
                                            <th style={{ width: '120px' }}>OT (hr)</th>
                                            <th style={{ width: '40px' }}></th>
                                        </tr></thead>
                                        <tbody>{labourRows.map((row, i) => {
                                            const selectedContractor = contractors.find(c => c.name === row.party);
                                            const rateCard = selectedContractor?.rate_card || [];

                                            return (
                                                <tr key={i}>
                                                    <td data-label="Party / Contractor">
                                                        <CustomSelect
                                                            options={[
                                                                { value: '', label: 'Select Contractor' },
                                                                ...contractors.map(c => ({ value: c.name, label: c.name }))
                                                            ]}
                                                            value={row.party}
                                                            onChange={val => {
                                                                setLabourRows(prev => {
                                                                    const updated = [...prev];
                                                                    updated[i] = { ...updated[i], party: val, category: '' };
                                                                    return updated;
                                                                });
                                                            }}
                                                            placeholder="Select Contractor"
                                                            width="full"
                                                        />
                                                    </td>
                                                    <td data-label="Category">
                                                        <CustomSelect
                                                            options={[
                                                                { value: '', label: 'Select Category' },
                                                                ...rateCard.map(rc => ({ value: rc.role, label: `${rc.role} (₹${rc.rate})` })),
                                                                ...(rateCard.length === 0 && row.party ? [{ value: 'General', label: 'General' }] : [])
                                                            ]}
                                                            value={row.category}
                                                            onChange={val => updateRow('labour', i, 'category', val)}
                                                            placeholder="Select Category"
                                                            width="full"
                                                            disabled={!row.party}
                                                        />
                                                    </td>
                                                    <td data-label="Count"><input type="number" value={row.count} onChange={e => updateRow('labour', i, 'count', e.target.value)} placeholder="0" className="table-input-clean" /></td>
                                                    <td data-label="Shift"><input value={row.shift} onChange={e => updateRow('labour', i, 'shift', e.target.value)} placeholder="1" className="table-input-clean" /></td>
                                                    <td data-label="OT (hr)"><input value={row.ot} onChange={e => updateRow('labour', i, 'ot', e.target.value)} placeholder="0" className="table-input-clean" /></td>
                                                    <td className="action-cell"><button onClick={() => removeRow('labour', i)} className="action-btn delete"><Trash2 size={16} /></button></td>
                                                </tr>
                                            );
                                        })}</tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* ── Next Day Req Tab ── */}
                        {activeTab === 'next_day' && (
                            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                                {/* Materials */}
                                <div style={{ background: 'white', padding: '24px', paddingBottom: '120px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #E2E8F0', position: 'relative' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
                                        <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1E293B' }}>Next Day Material Requests</h3>
                                        <button className="btn-modern outline" onClick={() => addRow('nd_material')}><Plus size={16} /> Add Material</button>
                                    </div>
                                    <div className="mobile-table-scroll">
                                        <table className="modern-table">
                                            <thead><tr>
                                                <th>Material Name</th>
                                                <th style={{ width: '150px' }}>Unit</th>
                                                <th style={{ width: '150px' }}>Qty Needed</th>
                                                <th style={{ width: '40px' }}></th>
                                            </tr></thead>
                                            <tbody>{nextDayMaterials.map((row, i) => (
                                                <tr key={i}>
                                                    <td data-label="Material Name">
                                                        <CustomSelect
                                                            options={[
                                                                { value: '', label: 'Select Material' },
                                                                ...masterMaterials.map(m => ({ value: m.name, label: m.name }))
                                                            ]}
                                                            value={row.material}
                                                            onChange={val => {
                                                                const mat = masterMaterials.find(m => m.name === val);
                                                                setNextDayMaterials(prev => {
                                                                    const updated = [...prev];
                                                                    updated[i] = { ...updated[i], material: val, unit: mat?.unit || '' };
                                                                    return updated;
                                                                });
                                                            }}
                                                            placeholder="Select Material"
                                                            width="full"
                                                            searchable={true}
                                                            style={{ border: 'none', background: 'transparent' }}
                                                        />
                                                    </td>
                                                    <td data-label="Unit"><input value={row.unit} readOnly placeholder="Auto-filled" className="table-input-clean" style={{ backgroundColor: row.unit ? '#F1F5F9' : 'transparent', color: '#64748B' }} /></td>
                                                    <td data-label="Qty Needed"><input value={row.qty} onChange={e => updateRow('nd_material', i, 'qty', e.target.value)} placeholder="0" className="table-input-clean" /></td>
                                                    <td className="action-cell"><button onClick={() => removeRow('nd_material', i)} className="action-btn delete"><Trash2 size={16} /></button></td>
                                                </tr>
                                            ))}</tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Labour */}
                                <div style={{ background: 'white', padding: '24px', paddingBottom: '120px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #E2E8F0', position: 'relative' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
                                        <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1E293B' }}>Next Day Labour Requirements</h3>
                                        <button className="btn-modern outline" onClick={() => addRow('nd_labour')}><Plus size={16} /> Add Role</button>
                                    </div>
                                    <div className="mobile-table-scroll">
                                        <table className="modern-table">
                                            <thead><tr>
                                                <th>Worker Category / Role</th>
                                                <th style={{ width: '200px' }}>No. of Labours Needed</th>
                                                <th style={{ width: '40px' }}></th>
                                            </tr></thead>
                                            <tbody>{nextDayLabour.map((row, i) => (
                                                <tr key={i}>
                                                    <td data-label="Category">
                                                        <CustomSelect
                                                            options={[
                                                                { value: '', label: 'Select Category' },
                                                                ...allLabourRoles.map(role => ({ value: role, label: role }))
                                                            ]}
                                                            value={row.category}
                                                            onChange={val => updateRow('nd_labour', i, 'category', val)}
                                                            placeholder="Select Category"
                                                            width="full"
                                                            searchable={true}
                                                            style={{ border: 'none', background: 'transparent' }}
                                                        />
                                                    </td>
                                                    <td data-label="Count"><input value={row.count} onChange={e => updateRow('nd_labour', i, 'count', e.target.value)} placeholder="0" className="table-input-clean" /></td>
                                                    <td className="action-cell"><button onClick={() => removeRow('nd_labour', i)} className="action-btn delete"><Trash2 size={16} /></button></td>
                                                </tr>
                                            ))}</tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Equipment */}
                                <div style={{ background: 'white', padding: '24px', paddingBottom: '120px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #E2E8F0', position: 'relative' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
                                        <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1E293B' }}>Next Day Equipment Requests</h3>
                                        <button className="btn-modern outline" onClick={() => addRow('nd_equipment')}><Plus size={16} /> Add Equipment</button>
                                    </div>
                                    <div className="mobile-table-scroll">
                                        <table className="modern-table">
                                            <thead><tr>
                                                <th>Equipment Type</th>
                                                <th>Note / Reason</th>
                                                <th style={{ width: '40px' }}></th>
                                            </tr></thead>
                                            <tbody>{nextDayEquipment.map((row, i) => (
                                                <tr key={i}>
                                                    <td data-label="Equipment Type">
                                                        <CustomSelect
                                                            options={[
                                                                { value: '', label: 'Select Equipment' },
                                                                ...masterVehicles.map(v => ({
                                                                    value: v.name || v.vehicle_name || v.registrationNo || `${v.make || ''} ${v.model || ''}`.trim(),
                                                                    label: v.name || v.vehicle_name || v.registrationNo || `${v.make || ''} ${v.model || ''}`.trim()
                                                                }))
                                                            ]}
                                                            value={row.equipment}
                                                            onChange={val => updateRow('nd_equipment', i, 'equipment', val)}
                                                            placeholder="Select Equipment"
                                                            width="full"
                                                            searchable={true}
                                                            style={{ border: 'none', background: 'transparent' }}
                                                        />
                                                    </td>
                                                    <td data-label="Note / Reason"><input value={row.note} onChange={e => updateRow('nd_equipment', i, 'note', e.target.value)} placeholder="Reason for request..." className="table-input-clean" /></td>
                                                    <td className="action-cell"><button onClick={() => removeRow('nd_equipment', i)} className="action-btn delete"><Trash2 size={16} /></button></td>
                                                </tr>
                                            ))}</tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ── Contractor Summary Tab ── */}
                        {activeTab === 'contractor' && (
                            <div className="animate-fade-in" style={{ background: 'white', padding: '24px', paddingBottom: '120px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #E2E8F0', position: 'relative' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
                                    <div>
                                        <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1E293B' }}>Subcontractor Work Summary</h3>
                                        <p style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>Log progress updates for specialized contractors.</p>
                                    </div>
                                    <button className="btn-modern outline" onClick={() => addRow('contractor')}><Plus size={16} /> Add Row</button>
                                </div>
                                <div className="mobile-table-scroll">
                                    <table className="modern-table">
                                        <thead><tr>
                                            <th>Contractor Name</th>
                                            <th>Work Title</th>
                                            <th style={{ width: '150px' }}>Today's Progress</th>
                                            <th style={{ width: '150px' }}>Total Overall</th>
                                            <th style={{ width: '40px' }}></th>
                                        </tr></thead>
                                        <tbody>{contractorRows.map((row, i) => (
                                            <tr key={i}>
                                                <td data-label="Contractor Name">
                                                    <CustomSelect
                                                        options={[
                                                            { value: '', label: 'Select Vendor' },
                                                            ...allVendors.map(v => ({ value: v.name, label: v.name }))
                                                        ]}
                                                        value={row.contractor}
                                                        onChange={val => updateRow('contractor', i, 'contractor', val)}
                                                        placeholder="Select Vendor"
                                                        width="full"
                                                        searchable={true}
                                                        style={{ border: 'none', background: 'transparent' }}
                                                    />
                                                </td>
                                                <td data-label="Work Title"><input value={row.title} onChange={e => updateRow('contractor', i, 'title', e.target.value)} placeholder="e.g. PvP Piping" className="table-input-clean" /></td>
                                                <td data-label="Today"><input value={row.progress} onChange={e => updateRow('contractor', i, 'progress', e.target.value)} placeholder="e.g. 80 Rmt" className="table-input-clean" /></td>
                                                <td data-label="Overall"><input value={row.overall} onChange={e => updateRow('contractor', i, 'overall', e.target.value)} placeholder="e.g. 1500 Rmt" className="table-input-clean" /></td>
                                                <td className="action-cell"><button onClick={() => removeRow('contractor', i)} className="action-btn delete"><Trash2 size={16} /></button></td>
                                            </tr>
                                        ))}</tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* ── Photos Tab ── */}
                        {/* ── Checklist Tab ── */}
                        {activeTab === 'checklist' && (
                            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                <div style={{ background: 'white', padding: '20px 24px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #E2E8F0' }}>
                                    <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '6px', color: '#1E293B', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <CheckSquare size={18} color="var(--primary)" /> Quality Checklists
                                    </h3>
                                    <p style={{ fontSize: '12px', color: '#64748B', margin: 0 }}>All items are optional. Check only the items applicable to today's work.</p>
                                </div>

                                {Object.entries(CHECKLIST_DATA).map(([category, items]) => {
                                    const catKey = category;
                                    const getStatus = (i) => { const e = checklist[`${catKey}::${i}`]; return typeof e === 'string' ? e : (e?.status || ''); };
                                    const checked = items.filter((_, i) => getStatus(i) === 'OK').length;
                                    const notOk = items.filter((_, i) => getStatus(i) === 'NOT_OK').length;
                                    const total = items.length;
                                    const hasAny = checked + notOk > 0;

                                    return (
                                        <div key={category} style={{ background: 'white', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                                            <div style={{
                                                padding: '14px 20px', backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0',
                                                display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer'
                                            }}
                                            onClick={() => {
                                                const el = document.getElementById(`cl-${catKey}`);
                                                if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                    <span style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>{category}</span>
                                                    <span style={{ fontSize: '11px', color: '#64748B' }}>({total} items)</span>
                                                </div>
                                                {hasAny && (
                                                    <div style={{ display: 'flex', gap: 8 }}>
                                                        {checked > 0 && <span style={{ padding: '2px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, backgroundColor: '#DCFCE7', color: '#15803D' }}>OK: {checked}</span>}
                                                        {notOk > 0 && <span style={{ padding: '2px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, backgroundColor: '#FEE2E2', color: '#B91C1C' }}>Not OK: {notOk}</span>}
                                                    </div>
                                                )}
                                            </div>
                                            <div id={`cl-${catKey}`} style={{ display: 'none' }}>
                                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                                    <thead>
                                                        <tr style={{ backgroundColor: '#F1F5F9' }}>
                                                            <th style={{ padding: '8px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748B', width: 30 }}>#</th>
                                                            <th style={{ padding: '8px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748B' }}>Check Point</th>
                                                            <th style={{ padding: '8px 16px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#64748B', width: 120 }}>Status</th>
                                                            <th style={{ padding: '8px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748B', width: 160 }}>Remarks</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {items.map((item, idx) => {
                                                            const key = `${catKey}::${idx}`;
                                                            const entry = checklist[key] || {};
                                                            const val = typeof entry === 'string' ? entry : (entry.status || '');
                                                            const rem = typeof entry === 'string' ? '' : (entry.remarks || '');
                                                            const setStatus = (s) => setChecklist(prev => ({ ...prev, [key]: { status: val === s ? '' : s, remarks: rem } }));
                                                            const setRemarks = (r) => setChecklist(prev => ({ ...prev, [key]: { status: val, remarks: r } }));
                                                            return (
                                                                <tr key={idx} style={{ borderTop: '1px solid #F1F5F9' }}>
                                                                    <td style={{ padding: '8px 16px', color: '#94A3B8', fontSize: 12 }}>{idx + 1}</td>
                                                                    <td style={{ padding: '8px 16px', fontSize: 13, color: '#334155' }}>{item}</td>
                                                                    <td style={{ padding: '8px 16px', textAlign: 'center' }}>
                                                                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                                                                            <button type="button" onClick={() => setStatus('OK')}
                                                                                style={{ padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: '1px solid',
                                                                                    backgroundColor: val === 'OK' ? '#DCFCE7' : 'white',
                                                                                    borderColor: val === 'OK' ? '#10B981' : '#E2E8F0',
                                                                                    color: val === 'OK' ? '#15803D' : '#94A3B8',
                                                                                }}>OK</button>
                                                                            <button type="button" onClick={() => setStatus('NOT_OK')}
                                                                                style={{ padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: '1px solid',
                                                                                    backgroundColor: val === 'NOT_OK' ? '#FEE2E2' : 'white',
                                                                                    borderColor: val === 'NOT_OK' ? '#EF4444' : '#E2E8F0',
                                                                                    color: val === 'NOT_OK' ? '#B91C1C' : '#94A3B8',
                                                                                }}>Not OK</button>
                                                                        </div>
                                                                    </td>
                                                                    <td style={{ padding: '6px 10px' }}>
                                                                        <input value={rem} onChange={e => setRemarks(e.target.value)}
                                                                            placeholder="..." style={{ width: '100%', padding: '4px 8px', borderRadius: 4, border: '1px solid #E2E8F0', fontSize: 11, outline: 'none', color: '#475569' }} />
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {activeTab === 'photos' && (
                            <div className="animate-fade-in" style={{ background: 'white', padding: '24px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #E2E8F0', minHeight: '400px' }}>
                                <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1E293B', marginBottom: '24px' }}>Verification Photos</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '20px' }}>
                                    <label style={{
                                        border: '2px dashed #CBD5E1', borderRadius: '16px', background: '#F8FAFC',
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                        height: '180px', cursor: 'pointer', transition: 'all 0.2s', padding: '20px', textAlign: 'center'
                                    }} onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.background = '#F1F5F9' }} onMouseLeave={e => { e.currentTarget.style.borderColor = '#CBD5E1'; e.currentTarget.style.background = '#F8FAFC' }}>
                                        <div style={{ background: 'white', padding: '12px', borderRadius: '50%', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', marginBottom: '16px' }}>
                                            <Camera size={28} color="var(--primary)" />
                                        </div>
                                        <span style={{ fontSize: '14px', fontWeight: '600', color: '#475569' }}>Upload Photos</span>
                                        <span style={{ fontSize: '12px', color: '#94A3B8', marginTop: '4px' }}>PNG, JPG up to 5MB</span>
                                        <input type="file" multiple accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} />
                                    </label>

                                    {photos.map((photo, i) => (
                                        <div key={i} className="photo-preview" style={{ position: 'relative', height: '180px', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                                            <img src={photo.preview} alt={`upload-${i}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, transparent 40%)' }}></div>
                                            <button onClick={() => removePhoto(i)} style={{
                                                position: 'absolute', top: '12px', right: '12px', backgroundColor: 'rgba(255, 255, 255, 0.9)',
                                                color: '#EF4444', border: 'none', borderRadius: '50%', width: '32px', height: '32px',
                                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                boxShadow: '0 2px 4px rgba(0,0,0,0.2)', transition: 'all 0.2s'
                                            }} onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ── Equipment Tab ── */}
                        {activeTab === 'equipment' && (
                            <div className="animate-fade-in" style={{ background: 'white', padding: '24px', paddingBottom: '120px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #E2E8F0', position: 'relative' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
                                    <div>
                                        <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1E293B' }}>Machinery & Equipment Log</h3>
                                        <p style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>Track daily usage hours and fuel consumption.</p>
                                    </div>
                                    <button className="btn-modern outline" onClick={() => addRow('equipment')}><Plus size={16} /> Add Equipment</button>
                                </div>
                                <div className="mobile-table-scroll">
                                    <table className="modern-table">
                                        <thead><tr>
                                            <th>Equipment Name</th>
                                            <th>Machine No.</th>
                                            <th style={{ width: '150px' }}>Hours Used</th>
                                            <th style={{ width: '150px' }}>Fuel Added (Ltr)</th>
                                            <th style={{ width: '40px' }}></th>
                                        </tr></thead>
                                        <tbody>{equipmentRows.map((row, i) => (
                                            <tr key={i}>
                                                <td data-label="Equipment Name">
                                                    <CustomSelect
                                                        options={[
                                                            { value: '', label: 'Select Machinery' },
                                                            ...masterVehicles.map(v => ({ 
                                                                value: v.vehicleNumber, 
                                                                label: `${v.vehicleType} - ${v.vehicleNumber}` 
                                                            }))
                                                        ]}
                                                        value={row.no}
                                                        onChange={val => {
                                                            const selected = masterVehicles.find(v => v.vehicleNumber === val);
                                                            setEquipmentRows(prev => {
                                                                const updated = [...prev];
                                                                updated[i] = { 
                                                                    ...updated[i], 
                                                                    no: val, 
                                                                    name: selected?.vehicleType || '' 
                                                                };
                                                                return updated;
                                                            });
                                                        }}
                                                        placeholder="Select Machinery"
                                                        width="full"
                                                        searchable={true}
                                                        style={{ border: 'none', background: 'transparent' }}
                                                    />
                                                </td>
                                                <td data-label="Machine No.">
                                                    <input 
                                                        value={row.no} 
                                                        readOnly 
                                                        placeholder="Auto-filled" 
                                                        className="table-input-clean" 
                                                        style={{ backgroundColor: '#F1F5F9', color: '#64748B' }}
                                                    />
                                                </td>
                                                <td data-label="Hours Used"><input type="number" value={row.hours} onChange={e => updateRow('equipment', i, 'hours', e.target.value)} placeholder="0" className="table-input-clean" /></td>
                                                <td data-label="Fuel (Ltr)"><input type="number" value={row.fuel} onChange={e => updateRow('equipment', i, 'fuel', e.target.value)} placeholder="0" className="table-input-clean" /></td>
                                                <td className="action-cell"><button onClick={() => removeRow('equipment', i)} className="action-btn delete"><Trash2 size={16} /></button></td>
                                            </tr>
                                        ))}</tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                        <div style={{ height: '300px' }} />
                    </div>
                </div>

                {/* Footer */}
                <div style={{ padding: '16px 24px', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end', gap: '12px', backgroundColor: 'white', zIndex: 10 }}>
                    <button onClick={onClose} disabled={loading} style={{
                        padding: '10px 20px', borderRadius: '12px', background: '#F1F5F9', color: '#475569',
                        fontWeight: '600', fontSize: '14px', border: 'none', cursor: 'pointer', transition: 'all 0.2s'
                    }} onMouseEnter={e => e.currentTarget.style.background = '#E2E8F0'} onMouseLeave={e => e.currentTarget.style.background = '#F1F5F9'}>
                        Discard
                    </button>
                    {activeTab !== 'photos' ? (
                        <button onClick={() => {
                            const tabOrder = ['work', 'labour', 'equipment', 'next_day', 'contractor', 'checklist', 'photos'];
                            const nextIdx = tabOrder.indexOf(activeTab) + 1;
                            if (nextIdx < tabOrder.length) setActiveTab(tabOrder[nextIdx]);
                        }} style={{
                            padding: '10px 24px', borderRadius: '12px', background: 'var(--primary)', color: 'white',
                            fontWeight: '600', fontSize: '14px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                            boxShadow: '0 4px 12px rgba(47, 93, 138, 0.3)', transition: 'all 0.2s', transform: 'translateY(-1px)'
                        }} className="btn-modern-primary">
                            Next →
                        </button>
                    ) : (
                        <button onClick={handleSubmit} disabled={loading} style={{
                            padding: '10px 24px', borderRadius: '12px', background: 'var(--primary)', color: 'white',
                            fontWeight: '600', fontSize: '14px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                            boxShadow: '0 4px 12px rgba(47, 93, 138, 0.3)', transition: 'all 0.2s', transform: loading ? 'none' : 'translateY(-1px)'
                        }} className="btn-modern-primary">
                            {loading ? <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Submitting...</> : <><Save size={18} /> Submit DPR</>}
                        </button>
                    )}
                </div>
            </div>

            <style>{`
                .modern-input { width: 100%; padding: 12px 16px; border-radius: 10px; border: 1px solid #E2E8F0; background-color: #F8FAFC; outline: none; font-size: 14px; color: #1E293B; transition: all 0.2s; }
                .modern-input:focus { border-color: var(--primary); background-color: white; box-shadow: 0 0 0 3px rgba(47, 93, 138, 0.1); }
                .modern-input::placeholder { color: #94A3B8; }
                
                .modern-table { width: 100%; border-collapse: separate; border-spacing: 0 8px; margin-top: 10px; min-width: 600px; margin-bottom: 150px; }
                .modern-table th { text-align: left; padding: 0 16px 8px 16px; color: #64748B; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #E2E8F0; white-space: nowrap; }
                .modern-table td { padding: 4px; background: white; }
                .modern-table tbody tr { transition: all 0.2s; }
                .modern-table tbody tr:hover td { background: #F8FAFC; }
                .modern-table td:first-child { border-top-left-radius: 10px; border-bottom-left-radius: 10px; }
                .modern-table td:last-child { border-top-right-radius: 10px; border-bottom-right-radius: 10px; }

                .table-input-clean { width: 100%; padding: 10px 14px; border: 1px solid transparent; border-radius: 8px; background: transparent; outline: none; font-size: 14px; color: #1E293B; transition: all 0.2s; font-family: inherit; }
                .table-input-clean:hover { background: #F8FAFC; border-color: #E2E8F0; }
                .table-input-clean:focus { background: white; border-color: var(--primary); box-shadow: 0 0 0 3px rgba(47, 93, 138, 0.1); }

                .btn-modern { padding: 8px 16px; border-radius: 8px; font-weight: 600; font-size: 13px; display: inline-flex; alignItems: center; gap: 8px; cursor: pointer; transition: all 0.2s; }
                .btn-modern.outline { background: white; border: 1px solid #E2E8F0; color: #475569; }
                .btn-modern.outline:hover { border-color: var(--primary); color: var(--primary); background: #F8FAFC; }

                .btn-modern-primary:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(47, 93, 138, 0.4); }

                .action-btn { background: none; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 8px; transition: all 0.2s; }
                .action-btn.delete { color: #94A3B8; }
                .action-btn.delete:hover { background: #FEE2E2; color: #EF4444; }

                .custom-scrollbar::-webkit-scrollbar { width: 8px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #A0AEC0; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #A0AEC0; }
                
                .mobile-table-scroll { overflow: visible; }
                @media (max-width: 1024px) {
                    .mobile-table-scroll { overflow-x: auto; margin: 0 -8px; padding: 0 8px; }
                }
                
                @media (max-width: 768px) {
                    .dpr-modal-main { width: 100vw !important; height: 100vh !important; border-radius: 0 !important; max-width: none !important; }
                    .dpr-modal-body { flex-direction: column !important; }
                    .dpr-sidebar { 
                        width: 100% !important; 
                        flex-direction: row !important; 
                        overflow-x: auto !important; 
                        border-right: none !important; 
                        border-bottom: 1px solid #E2E8F0 !important;
                        padding: 12px 16px !important;
                        white-space: nowrap;
                    }
                    .dpr-sidebar > button { 
                        width: auto !important; 
                        padding: 8px 16px !important;
                        font-size: 13px !important;
                    }
                    .dpr-content-area { padding: 16px !important; }
                    .dpr-grid-3, .dpr-grid-2 { grid-template-columns: 1fr !important; }
                    .dpr-header-title { font-size: 18px !important; }
                    .hide-mobile { display: none !important; }
                    .mobile-table-scroll { overflow: visible !important; }
                    
                    /* Modern Responsive Table to Cards */
                    .modern-table thead { display: none; }
                    .modern-table, .modern-table tbody, .modern-table tr, .modern-table td { display: block; width: 100%; }
                    .modern-table tr { 
                        background: white; 
                        margin-bottom: 20px; 
                        padding: 16px; 
                        border-radius: 12px; 
                        border: 1px solid #E2E8F0; 
                        box-shadow: 0 2px 4px rgba(0,0,0,0.02);
                        position: relative;
                    }
                    .modern-table td { 
                        padding: 8px 0 !important; 
                        border: none !important; 
                        white-space: normal !important;
                    }
                    .modern-table td [data-label]::before {
                        content: attr(data-label);
                        display: block;
                        font-size: 10px;
                        font-weight: 700;
                        color: #64748B;
                        text-transform: uppercase;
                        margin-bottom: 4px;
                        letter-spacing: 0.025em;
                    }
                    /* Support for direct data-label on td */
                    .modern-table td[data-label]::before {
                        content: attr(data-label);
                        display: block;
                        font-size: 10px;
                        font-weight: 700;
                        color: #64748B;
                        text-transform: uppercase;
                        margin-bottom: 4px;
                    }
                    .action-cell {
                        border-top: 1px solid #F1F5F9 !important;
                        margin-top: 8px !important;
                        padding-top: 12px !important;
                        display: flex !important;
                        justify-content: flex-end;
                    }
                }

                @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
            `}</style>
        </div>
    );
};

export default DPRModal;

import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import Finance from './pages/Finance';
import Budget from './pages/Budget';
import Workflow from './pages/Workflow';
import HRMS from './pages/HRMS';
import Materials from './pages/Materials';
import Reports from './pages/Reports';
// Users page removed - functionality moved to HRMS module
import Logs from './pages/Logs';
import Tasks from './pages/Tasks/Tasks';
import Settings from './pages/Settings';
import Assets from './pages/Assets';
import Fleet from './pages/Fleet';
import Chat from './pages/Chat';
import ProjectDetails from './pages/ProjectDetails';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import Login from './pages/Login';
import Approvals from './pages/Approvals';
import SiteReports from './pages/SiteReports';
import Quotations from './pages/Quotations';
import LabourWages from './pages/LabourWages';
import { fetchAndSyncRoles, hasPermission } from './utils/rbac';
import { profileAPI } from './utils/api';
import { ShieldOff } from 'lucide-react';

// Route-level RBAC guard
const ProtectedRoute = ({ module, children }) => {
    const { user } = useAuth();
    const navigate = useNavigate();

    if (!module) return children;
    if (hasPermission(user, module, 'view')) return children;

    return (
        <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            height: '60vh', textAlign: 'center', padding: '40px'
        }}>
            <div style={{
                width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#FEF2F2',
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px'
            }}>
                <ShieldOff size={36} color="#EF4444" />
            </div>
            <h2 style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-main)', marginBottom: '8px' }}>
                Access Denied
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '15px', maxWidth: '400px', marginBottom: '24px' }}>
                You do not have permission to access <strong>{module}</strong>. Contact your administrator to request access.
            </p>
            <button
                className="btn btn-primary"
                onClick={() => navigate('/')}
                style={{ padding: '10px 28px' }}
            >
                Go to Dashboard
            </button>
        </div>
    );
};

const MainLayout = () => {
    const { user, loading, updateUser } = useAuth();
    const [activeTab, setActiveTab] = useState('/');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    useEffect(() => {
        if (user) {
            fetchAndSyncRoles();
            // Sync profile avatar on app load
            if (!user.avatar) {
                profileAPI.getProfile().then(res => {
                    if (res.data?.avatar) updateUser({ avatar: res.data.avatar });
                }).catch(() => {});
            }
        }
    }, [user?.username]);

    // Close sidebar when route changes on mobile
    useEffect(() => {
        setIsSidebarOpen(false);
    }, [window.location.pathname]);

    if (loading) {
        return (
            <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F6F9' }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ width: '40px', height: '40px', border: '3px solid #E2E8F0', borderTop: '3px solid var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }}></div>
                    <p style={{ color: 'var(--text-muted)', fontWeight: '600' }}>Loading Civil ERP...</p>
                    <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                </div>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    return (
        <div className={`app-container ${isSidebarOpen ? 'sidebar-open' : ''}`}>
            <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
            <div className="main-content">
                <Header setIsSidebarOpen={setIsSidebarOpen} isSidebarOpen={isSidebarOpen} />
                <main className="content-area">
                    <Routes>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/projects/:id" element={<ProtectedRoute module="Projects"><ProjectDetails /></ProtectedRoute>} />
                        <Route path="/projects" element={<ProtectedRoute module="Projects"><Projects /></ProtectedRoute>} />
                        <Route path="/budget" element={<ProtectedRoute module="Accounts"><Budget /></ProtectedRoute>} />
                        <Route path="/finance" element={<ProtectedRoute module="Accounts"><Finance /></ProtectedRoute>} />
                        <Route path="/quotations" element={<ProtectedRoute module="Accounts"><Quotations /></ProtectedRoute>} />
                        <Route path="/labour-wages" element={<ProtectedRoute module="Accounts"><LabourWages /></ProtectedRoute>} />
                        <Route path="/tasks" element={<ProtectedRoute module="Tasks"><Tasks /></ProtectedRoute>} />
                        <Route path="/workflow" element={<ProtectedRoute module="Procurement"><Workflow /></ProtectedRoute>} />
                        <Route path="/hr" element={<ProtectedRoute module="HRMS"><HRMS /></ProtectedRoute>} />
                        <Route path="/materials" element={<ProtectedRoute module="Inventory Management"><Materials /></ProtectedRoute>} />
                        <Route path="/fleet" element={<ProtectedRoute module="Fleet Management"><Fleet /></ProtectedRoute>} />
                        <Route path="/assets" element={<ProtectedRoute module="Inventory Management"><Assets /></ProtectedRoute>} />
                        <Route path="/chat" element={<ProtectedRoute module="Team Chat"><Chat /></ProtectedRoute>} />
                        <Route path="/reports" element={<ProtectedRoute module="Reports"><Reports /></ProtectedRoute>} />
                        <Route path="/users" element={<Navigate to="/hr?tab=Authorized+Users" replace />} />
                        <Route path="/logs" element={<ProtectedRoute module="System Logs"><Logs /></ProtectedRoute>} />
                        <Route path="/settings" element={<Settings />} />
                        <Route path="/approvals" element={<ProtectedRoute module="Approvals"><Approvals /></ProtectedRoute>} />
                        <Route path="/site-reports" element={<ProtectedRoute module="Site Reports"><SiteReports /></ProtectedRoute>} />
                        <Route path="/profile" element={<Navigate to="/settings?tab=Profile" replace />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </main>
            </div>
        </div>
    );
};

function App() {
    return (
        <Router>
            <AuthProvider>
                <NotificationProvider>
                    <Routes>
                        <Route path="/login" element={<Login />} />
                        <Route path="/*" element={<MainLayout />} />
                    </Routes>
                </NotificationProvider>
            </AuthProvider>
        </Router>
    );
}

export default App;

import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
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
import Users from './pages/Users';
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
import { fetchAndSyncRoles } from './utils/rbac';

const MainLayout = () => {
    const { user, loading } = useAuth();
    const [activeTab, setActiveTab] = useState('/');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    useEffect(() => {
        if (user) {
            fetchAndSyncRoles();
        }
    }, [user]);

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
                        <Route path="/projects/:id" element={<ProjectDetails />} />
                        <Route path="/projects" element={<Projects />} />
                        <Route path="/budget" element={<Budget />} />
                        <Route path="/finance" element={<Finance />} />
                        <Route path="/tasks" element={<Tasks />} />
                        <Route path="/workflow" element={<Workflow />} />
                        <Route path="/hr" element={<HRMS />} />
                        <Route path="/materials" element={<Materials />} />
                        <Route path="/fleet" element={<Fleet />} />
                        <Route path="/assets" element={<Assets />} />
                        <Route path="/chat" element={<Chat />} />
                        <Route path="/reports" element={<Reports />} />
                        <Route path="/users" element={<Users />} />
                        <Route path="/logs" element={<Logs />} />
                        <Route path="/settings" element={<Settings />} />
                        <Route path="/approvals" element={<Approvals />} />
                        <Route path="/site-reports" element={<SiteReports />} />
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

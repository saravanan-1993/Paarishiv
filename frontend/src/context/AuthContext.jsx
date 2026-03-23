import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Failsafe to ensure loading is eventually set to false
        const timer = setTimeout(() => {
            if (loading) setLoading(false);
        }, 3000);

        // Check local storage for token/user
        try {
            const savedUser = localStorage.getItem('erp_user');
            if (savedUser) {
                setUser(JSON.parse(savedUser));
            }
        } catch (error) {
            console.error("Failed to parse saved user:", error);
            localStorage.removeItem('erp_user');
        } finally {
            setLoading(false);
            clearTimeout(timer);
        }
    }, []);

    const login = async (username, password) => {
        const cleanUsername = username.trim();
        const cleanPassword = password.trim();

        try {
            const baseUrl = '/api';
            const params = new URLSearchParams();
            params.append('username', cleanUsername);
            params.append('password', cleanPassword);

            const response = await fetch(`${baseUrl}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: params
            });

            if (response.ok) {
                const data = await response.json();
                const userData = {
                    ...data.user,
                    token: data.access_token
                };
                setUser(userData);
                localStorage.setItem('erp_user', JSON.stringify(userData));
                localStorage.setItem('erp_token', data.access_token);
                localStorage.setItem('erp_login_time', String(Date.now()));
                return true;
            }

            // Bug 1.2 - Return specific error message from backend (e.g. inactive account)
            if (response.status === 403 || response.status === 401) {
                const errorData = await response.json().catch(() => ({}));
                const errorMsg = errorData.detail || 'Invalid username or password';
                throw new Error(errorMsg);
            }
        } catch (error) {
            if (error.message && error.message !== 'Failed to fetch') {
                throw error; // Re-throw for Login.jsx to display
            }
            console.error("Login API error:", error);
        }

        return false;
    };

    const quickLogin = async (role) => {
        try {
            const baseUrl = '/api';
            const response = await fetch(`${baseUrl}/auth/quick-login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role })
            });

            if (response.ok) {
                const data = await response.json();
                const userData = {
                    ...data.user,
                    token: data.access_token
                };
                setUser(userData);
                localStorage.setItem('erp_user', JSON.stringify(userData));
                localStorage.setItem('erp_token', data.access_token);
                localStorage.setItem('erp_login_time', String(Date.now()));
                return true;
            }

            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || 'Quick login failed');
        } catch (error) {
            if (error.message && error.message !== 'Failed to fetch') {
                throw error;
            }
            console.error("Quick login error:", error);
        }
        return false;
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('erp_user');
    };

    const updateUser = (newData) => {
        const updatedUser = { ...user, ...newData };
        setUser(updatedUser);
        localStorage.setItem('erp_user', JSON.stringify(updatedUser));
    };

    return (
        <AuthContext.Provider value={{ user, login, quickLogin, logout, updateUser, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);

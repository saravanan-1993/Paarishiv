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
        const cleanUsername = username.trim().toLowerCase();
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
                return true;
            }
        } catch (error) {
            console.error("Login API error:", error);
        }

        // Fallback for demo or if backend is offline/unreachable
        if (cleanUsername === 'admin' && cleanPassword === 'password') {
            const userData = { username: 'admin', role: 'Super Admin', name: 'Super Admin User' };
            setUser(userData);
            localStorage.setItem('erp_user', JSON.stringify(userData));
            return true;
        } else if (cleanUsername === 'engineer' && cleanPassword === 'password') {
            const userData = { username: 'engineer', role: 'Site Engineer', name: 'Suki Engineer' };
            setUser(userData);
            localStorage.setItem('erp_user', JSON.stringify(userData));
            return true;
        } else if (cleanUsername === 'coordinator' && cleanPassword === 'password') {
            const userData = { username: 'coordinator', role: 'Project Coordinator', name: 'Project Coordinator' };
            setUser(userData);
            localStorage.setItem('erp_user', JSON.stringify(userData));
            return true;
        } else if (cleanUsername === 'purchase' && cleanPassword === 'password') {
            const userData = { username: 'purchase', role: 'Purchase Officer', name: 'Purchase Officer' };
            setUser(userData);
            localStorage.setItem('erp_user', JSON.stringify(userData));
            return true;
        } else if (cleanUsername === 'accountant' && cleanPassword === 'password') {
            const userData = { username: 'accountant', role: 'Accountant', name: 'Accountant' };
            setUser(userData);
            localStorage.setItem('erp_user', JSON.stringify(userData));
            return true;
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
        <AuthContext.Provider value={{ user, login, logout, updateUser, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);

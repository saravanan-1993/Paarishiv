import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { notificationAPI } from '../utils/api';

const NotificationContext = createContext(null);

const EVENT_CONFIG = {
    approval: { title: 'Approval Update', emoji: '' },
    workflow: { title: 'Workflow Update', emoji: '' },
    material: { title: 'Material Update', emoji: '' },
    finance: { title: 'Finance Update', emoji: '' },
    hr: { title: 'HR Update', emoji: '' },
    task: { title: 'Task Update', emoji: '' },
    fleet: { title: 'Fleet Update', emoji: '' },
    project: { title: 'Project Update', emoji: '' },
    system: { title: 'System Notification', emoji: '' },
};

export const NotificationProvider = ({ children }) => {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const socketRef = useRef(null);
    const pollRef = useRef(null);

    // Fetch unread count from API
    const refreshCount = useCallback(async () => {
        if (!user) return;
        try {
            const res = await notificationAPI.getUnreadCount();
            setUnreadCount(res.data.unread_count || 0);
        } catch (err) {
            // silent
        }
    }, [user]);

    // Fetch recent notifications for header dropdown
    const fetchRecent = useCallback(async () => {
        if (!user) return;
        try {
            const res = await notificationAPI.getAll({ page: 1, limit: 15 });
            const data = res.data.notifications || [];
            setNotifications(data);
            setUnreadCount(res.data.unread_count || 0);
        } catch (err) {
            console.error('Failed to fetch notifications', err);
        }
    }, [user]);

    // WebSocket connection for real-time notifications
    const connectSocket = useCallback(() => {
        if (!user || socketRef.current) return;

        const token = (() => {
            try {
                const stored = localStorage.getItem('erp_user');
                if (stored) return JSON.parse(stored).token;
            } catch { return null; }
        })();

        const WS_URL = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/api/chat/ws/${user.username}${token ? `?token=${token}` : ''}`;

        const ws = new WebSocket(WS_URL);
        socketRef.current = ws;

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                // Handle new notification system messages (notif_*)
                if (data.message_type?.startsWith('notif_') && data.notification) {
                    const notif = data.notification;
                    // Add to top of list
                    setNotifications(prev => [{
                        _id: notif.id,
                        ...notif,
                        is_read: false,
                    }, ...prev].slice(0, 15));
                    setUnreadCount(prev => prev + 1);

                    // Browser notification
                    if (Notification.permission === 'granted') {
                        new Notification(notif.title || 'Civil ERP', {
                            body: notif.content,
                            icon: '/favicon.ico',
                            tag: notif.id,
                        });
                    }
                    return;
                }

                // Legacy: handle old system messages (task_alert, task_update from scheduler)
                if (data.sender === 'System' || data.message_type === 'task_alert' || data.message_type === 'task_update') {
                    // Refresh from API to get proper format
                    fetchRecent();

                    if (Notification.permission === 'granted') {
                        new Notification(data.message_type === 'task_alert' ? 'Overdue Alert' : 'Task Update', {
                            body: data.content,
                        });
                    }
                }
            } catch (e) {
                // ignore parse errors
            }
        };

        ws.onclose = () => {
            socketRef.current = null;
            setTimeout(connectSocket, 5000);
        };

        ws.onerror = () => {
            ws.close();
        };
    }, [user, fetchRecent]);

    useEffect(() => {
        if (user) {
            // Request browser notification permission
            if (Notification.permission === 'default') {
                Notification.requestPermission();
            }

            connectSocket();
            fetchRecent();

            // Poll every 30s as fallback
            pollRef.current = setInterval(refreshCount, 30000);
        } else {
            if (socketRef.current) {
                socketRef.current.close();
                socketRef.current = null;
            }
            if (pollRef.current) {
                clearInterval(pollRef.current);
                pollRef.current = null;
            }
            setNotifications([]);
            setUnreadCount(0);
        }

        return () => {
            if (socketRef.current) socketRef.current.close();
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, [user]);

    const markAllAsRead = async () => {
        try {
            await notificationAPI.markAllAsRead();
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            setUnreadCount(0);
        } catch (err) {
            // Fallback: just update local state
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            setUnreadCount(0);
        }
    };

    const markOneAsRead = async (id) => {
        try {
            await notificationAPI.markAsRead(id);
            setNotifications(prev => prev.map(n => n._id === id ? { ...n, is_read: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (err) { /* silent */ }
    };

    return (
        <NotificationContext.Provider value={{
            notifications,
            unreadCount,
            markAllAsRead,
            markOneAsRead,
            refreshCount,
            fetchRecent,
        }}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotifications = () => useContext(NotificationContext);

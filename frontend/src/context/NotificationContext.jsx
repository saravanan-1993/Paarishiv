import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const socketRef = useRef(null);

    const connectSocket = () => {
        if (!user || socketRef.current) return;

        const host = window.location.hostname;
        const WS_URL = `ws://${host}:8000/chat/ws/${user.username}`;

        const ws = new WebSocket(WS_URL);
        socketRef.current = ws;

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);

            // Only show alerts for specific types or from System
            if (data.sender === 'System' || data.message_type === 'task_alert' || data.message_type === 'task_update') {
                addNotification(data);
            }
        };

        ws.onclose = () => {
            socketRef.current = null;
            // Try to reconnect after 5 seconds
            setTimeout(connectSocket, 5000);
        };

        ws.onerror = (err) => {
            console.error('WebSocket Error:', err);
            ws.close();
        };
    };

    const addNotification = (data) => {
        const newNotif = {
            id: data._id || Date.now(),
            title: data.message_type === 'task_alert' ? '🚨 Overdue Alert' : '📢 Task Update',
            message: data.content,
            time: 'Just now',
            unread: true,
            type: data.message_type,
            bg: data.message_type === 'task_alert' ? '#FEF2F2' : '#EFF6FF',
            color: data.message_type === 'task_alert' ? '#EF4444' : '#3B82F6',
            icon: () => null // We'll handle icons in UI
        };

        setNotifications(prev => [newNotif, ...prev]);
        setUnreadCount(prev => prev + 1);

        // Browser Notification (optional)
        if (Notification.permission === 'granted') {
            new Notification(newNotif.title, { body: newNotif.message });
        }
    };

    useEffect(() => {
        const fetchInitial = async () => {
            if (!user) return;
            try {
                // Fetch recent system messages from anyone (e.g. from System to me)
                // We'll use a hack of fetching chat history with 'System' if it exists,
                // or just getting unread count.
                const res = await fetch(`http://${window.location.hostname}:8000/chat/history/System/${user.username}`);
                if (res.ok) {
                    const history = await res.json();
                    const formatted = history.filter(m => m.sender === 'System').slice(-10).map(m => ({
                        id: m._id,
                        title: m.message_type === 'task_alert' ? '🚨 Overdue Alert' : '📢 Task Update',
                        message: m.content,
                        time: new Date(m.timestamp).toLocaleTimeString(),
                        unread: !m.is_read,
                        type: m.message_type,
                        bg: m.message_type === 'task_alert' ? '#FEF2F2' : '#EFF6FF',
                        color: m.message_type === 'task_alert' ? '#EF4444' : '#3B82F6'
                    }));
                    setNotifications(formatted);
                    setUnreadCount(formatted.filter(n => n.unread).length);
                }
            } catch (err) {
                console.error('Failed to fetch notifications', err);
            }
        };

        if (user) {
            connectSocket();
            fetchInitial();
        } else {
            if (socketRef.current) {
                socketRef.current.close();
                socketRef.current = null;
            }
        }
        return () => {
            if (socketRef.current) socketRef.current.close();
        };
    }, [user]);

    const markAllAsRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
        setUnreadCount(0);
    };

    return (
        <NotificationContext.Provider value={{ notifications, unreadCount, markAllAsRead }}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotifications = () => useContext(NotificationContext);

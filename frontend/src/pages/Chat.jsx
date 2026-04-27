import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Send, User, MessageSquare, Search, Paperclip, FileIcon, Download, Loader2, X, Bell, BellOff, Info, UserPlus } from 'lucide-react';
import { chatAPI } from '../utils/api';

const Chat = () => {
    const { user } = useAuth();
    const [users, setUsers] = useState([]);
    const [groups, setGroups] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [isCreatingGroup, setIsCreatingGroup] = useState(false);
    const [groupName, setGroupName] = useState('');
    const [selectedMembers, setSelectedMembers] = useState([]);
    const [showMembers, setShowMembers] = useState(false);
    const socketRef = useRef(null);
    const [mutedChats, setMutedChats] = useState({});
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [showAddMembers, setShowAddMembers] = useState(false);
    const [newGroupMembers, setNewGroupMembers] = useState([]);
    const [addingMembers, setAddingMembers] = useState(false);
    const messagesEndRef = useRef(null);

    const host = window.location.hostname;
    const API_BASE = '/api';
    const WS_BASE = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/api`;

    useEffect(() => {
        if (user) {
            fetchUsers();
            fetchGroups();
        }
    }, [user]);

    const selectedUserRef = useRef(null);

    useEffect(() => {
        selectedUserRef.current = selectedUser;
    }, [selectedUser]);

    useEffect(() => {
        if (!user) return;
        let reconnectTimer = null;
        let isUnmounted = false;

        const connectWS = () => {
            if (isUnmounted) return;
            const token = (() => { try { const s = localStorage.getItem('erp_user'); return s ? JSON.parse(s).token : ''; } catch { return ''; } })();
            const ws = new WebSocket(`${WS_BASE}/chat/ws/${user.username}${token ? `?token=${token}` : ''}`);
            socketRef.current = ws;

            ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    // Skip notification-type messages (handled by NotificationContext)
                    if (message.message_type?.startsWith('notif_')) return;

                    const currentSelected = selectedUserRef.current;
                    const isFromSelected = currentSelected && (
                        (message.group_id && message.group_id === currentSelected._id) ||
                        (!message.group_id && (message.sender === currentSelected.username || message.receiver === currentSelected.username))
                    );

                    if (isFromSelected) {
                        setMessages(prev => {
                            // Deduplicate: skip if message with same _id already exists
                            if (message._id && prev.some(m => m._id === message._id)) return prev;
                            return [...prev, message];
                        });
                        chatAPI.markAsRead(user.username, message.sender, message.group_id);
                    }

                    fetchUsers();
                    fetchGroups();
                } catch {}
            };

            ws.onclose = () => {
                socketRef.current = null;
                if (!isUnmounted) {
                    reconnectTimer = setTimeout(connectWS, 3000);
                }
            };

            ws.onerror = () => { ws.close(); };
        };

        connectWS();

        return () => {
            isUnmounted = true;
            if (reconnectTimer) clearTimeout(reconnectTimer);
            if (socketRef.current) socketRef.current.close();
        };
    }, [user]); // Only reconnect if the logged-in user changes

    useEffect(() => {
        if (selectedUser) {
            if (selectedUser.isGroup) {
                fetchGroupHistory(selectedUser._id);
                chatAPI.markAsRead(user.username, 'any', selectedUser._id);
            } else {
                fetchHistory(selectedUser.username);
                chatAPI.markAsRead(user.username, selectedUser.username);
            }
        }
    }, [selectedUser]);

    // Bug 10.4 - Periodic sync to ensure messages stay in sync
    useEffect(() => {
        const interval = setInterval(() => {
            const current = selectedUserRef.current;
            if (current) {
                if (current.isGroup) {
                    fetchGroupHistory(current._id);
                } else {
                    fetchHistory(current.username);
                }
            }
            fetchUsers();
            fetchGroups();
        }, 30000); // Sync every 30 seconds (WebSocket handles real-time)
        return () => clearInterval(interval);
    }, [user]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const fetchUsers = async () => {
        if (!user) return;
        try {
            const res = await chatAPI.getUsersWithUnread(user.username);
            setUsers(res.data.filter(u => u.username !== user.username));
        } catch (err) {
            console.error('Failed to fetch users', err);
        }
    };

    const fetchGroups = async () => {
        if (!user) return;
        try {
            const res = await chatAPI.getGroups(user.username);
            setGroups(res.data.map(g => ({ ...g, isGroup: true, full_name: g.name })));
        } catch (err) {
            console.error('Failed to fetch groups', err);
        }
    };

    const fetchHistory = async (otherUser) => {
        try {
            const res = await chatAPI.getHistory(user.username, otherUser);
            setMessages(res.data);
        } catch (err) {
            console.error('Failed to fetch history', err);
        }
    };

    const fetchGroupHistory = async (groupId) => {
        try {
            const res = await chatAPI.getHistoryGroup(groupId);
            setMessages(res.data);
        } catch (err) {
            console.error('Failed to fetch group history', err);
        }
    };


    const [uploading, setUploading] = useState(false);

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file || !selectedUser) return;

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);

            const res = await chatAPI.uploadFile(formData);
            const { url, type, name } = res.data;

            const messageData = {
                content: `Shared a ${type === 'image' ? 'photo' : 'file'}: ${name}`,
                attachments: [{ name, url, type }],
                timestamp: new Date().toISOString(),
                message_type: 'attachment',
                group_id: selectedUser.isGroup ? selectedUser._id : null,
                receiver: selectedUser.isGroup ? null : selectedUser.username
            };

            socketRef.current.send(JSON.stringify(messageData));
        } catch (err) {
            console.error('Upload failed', err);
            alert('File upload failed. Please check your connection.');
        } finally {
            setUploading(false);
            e.target.value = ''; // Reset input
        }
    };

    const getFileUrl = (url) => {
        if (!url) return '';
        if (url.startsWith('http')) return url;
        if (url.startsWith('data:')) return url;
        // Bug 10.2 - Local static files should not be prefixed with API_BASE
        if (url.startsWith('/static/')) return url;
        return `${API_BASE}${url}`;
    };

    const handleSendMessage = (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !selectedUser || !socketRef.current) return;

        const messageData = {
            group_id: selectedUser.isGroup ? selectedUser._id : null,
            receiver: selectedUser.isGroup ? null : selectedUser.username,
            content: newMessage,
            timestamp: new Date().toISOString(),
            message_type: 'text'
        };

        socketRef.current.send(JSON.stringify(messageData));
        setNewMessage('');
    };

    const handleCreateGroup = async () => {
        if (!groupName || selectedMembers.length === 0) return;
        try {
            await chatAPI.createGroup({
                name: groupName,
                members: [...selectedMembers, user.username],
                created_by: user.username
            });
            setIsCreatingGroup(false);
            setGroupName('');
            setSelectedMembers([]);
            fetchGroups();
        } catch (err) {
            console.error('Group creation failed', err);
        }
    };

    const handleAddMembers = async () => {
        if (!selectedUser?.isGroup || newGroupMembers.length === 0) return;
        setAddingMembers(true);
        try {
            const res = await chatAPI.addGroupMembers(selectedUser._id, newGroupMembers);
            // Update selectedUser with new members
            setSelectedUser(prev => ({ ...prev, members: res.data.members }));
            setNewGroupMembers([]);
            setShowAddMembers(false);
            fetchGroups();
        } catch (err) {
            console.error('Failed to add members', err);
            alert(err?.response?.data?.detail || 'Failed to add members.');
        } finally {
            setAddingMembers(false);
        }
    };

    const getMemberNames = (memberUsernames) => {
        if (!memberUsernames) return '';
        return memberUsernames.map(username => {
            if (username === user.username) return "You";
            const found = users.find(u => u.username === username);
            return found ? found.full_name : username;
        }).join(', ');
    };

    const isOfficeRole = (role) => {
        if (!role) return false;
        const excluded = ['driver', 'labourer', 'laborer', 'labour', 'contractor'];
        return !excluded.some(ex => role.toLowerCase().includes(ex));
    };

    const filteredUsers = users.filter(u =>
        u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.role.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredGroups = groups.filter(g =>
        g.name.toLowerCase().includes(searchQuery.toLowerCase())
    );


    return (
        <div style={{
            display: 'flex',
            height: 'calc(100vh - var(--header-height) - 40px)',
            backgroundColor: 'white',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-sm)',
            border: '1px solid var(--border)'
        }}>
            {/* Users Sidebar */}
            <div style={{
                width: '300px',
                borderRight: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: '#f9fafb'
            }}>
                <div style={{ padding: '20px', borderBottom: '1px solid var(--border)' }}>
                    <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px' }}>Messages</h2>
                    <div style={{ position: 'relative' }}>
                        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            type="text"
                            placeholder="Locate teammate..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '10px 12px 10px 36px',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--border)',
                                fontSize: '14px',
                                outline: 'none'
                            }}
                        />
                    </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto' }}>
                    <div style={{ padding: '8px 20px', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Groups</span>
                        <button
                            onClick={() => setIsCreatingGroup(true)}
                            style={{ border: 'none', background: 'transparent', color: 'var(--primary)', cursor: 'pointer', fontSize: '10px', fontWeight: '800' }}
                        >
                            + NEW GROUP
                        </button>
                    </div>
                    {filteredGroups.map(g => (
                        <div
                            key={g._id}
                            onClick={() => setSelectedUser(g)}
                            style={{
                                padding: '12px 20px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                backgroundColor: selectedUser?._id === g._id ? 'white' : 'transparent',
                                borderLeft: selectedUser?._id === g._id ? '4px solid var(--primary)' : '4px solid transparent',
                            }}
                        >
                            <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4A5568' }}>
                                <MessageSquare size={20} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ fontWeight: '600', fontSize: '14px' }}>{g.name}</div>
                                    {g.unread_count > 0 && (
                                        <span style={{
                                            backgroundColor: '#EF4444',
                                            color: 'white',
                                            fontSize: '10px',
                                            padding: '2px 6px',
                                            borderRadius: '10px',
                                            fontWeight: '700'
                                        }}>
                                            {g.unread_count}
                                        </span>
                                    )}
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{g.members.length} members</div>
                            </div>
                        </div>
                    ))}

                    <div style={{ marginTop: '20px', padding: '8px 20px', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Individuals
                    </div>
                    {filteredUsers.map(u => (
                        <div
                            key={u.username}
                            onClick={() => setSelectedUser(u)}
                            style={{
                                padding: '12px 20px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                backgroundColor: (!selectedUser?.isGroup && selectedUser?.username === u.username) ? 'white' : 'transparent',
                                borderLeft: (!selectedUser?.isGroup && selectedUser?.username === u.username) ? '4px solid var(--primary)' : '4px solid transparent',
                            }}
                        >
                            <div style={{ position: 'relative' }}>
                                <div style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '50%',
                                    backgroundColor: 'var(--primary-light)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'var(--primary)',
                                    fontWeight: '600'
                                }}>
                                    {u.full_name.charAt(0)}
                                </div>
                                {u.is_online && (
                                    <div style={{
                                        position: 'absolute',
                                        bottom: '2px',
                                        right: '2px',
                                        width: '10px',
                                        height: '10px',
                                        backgroundColor: '#10B981',
                                        border: '2px solid white',
                                        borderRadius: '50%'
                                    }}></div>
                                )}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontWeight: '600', fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {u.full_name}
                                    </span>
                                    {u.unread_count > 0 && (
                                        <span style={{
                                            backgroundColor: 'var(--primary)',
                                            color: 'white',
                                            fontSize: '10px',
                                            padding: '2px 6px',
                                            borderRadius: '10px',
                                            fontWeight: '700'
                                        }}>
                                            {u.unread_count}
                                        </span>
                                    )}
                                </div>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{u.role}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Chat Window */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'white' }}>
                {selectedUser ? (
                    <>
                        {/* Chat Header */}
                        <div style={{
                            padding: '16px 24px',
                            borderBottom: '1px solid var(--border)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: selectedUser.isGroup ? '12px' : '50%',
                                    backgroundColor: selectedUser.isGroup ? '#E2E8F0' : 'var(--primary-light)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: selectedUser.isGroup ? '#4A5568' : 'var(--primary)',
                                    fontWeight: '600'
                                }}>
                                    {selectedUser.isGroup ? <MessageSquare size={20} /> : selectedUser.full_name.charAt(0)}
                                </div>
                                <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => setShowProfileModal(true)}>
                                    <div style={{ fontWeight: '700', fontSize: '16px' }}>{selectedUser.full_name || selectedUser.name}</div>
                                    <div
                                        style={{
                                            fontSize: '12px',
                                            color: selectedUser.is_online ? '#10B981' : '#64748B',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px'
                                        }}
                                    >
                                        {selectedUser.isGroup ? (
                                            <>
                                                <span>{selectedUser.members.length} members</span>
                                                <span style={{ opacity: 0.6, fontSize: '11px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    ({getMemberNames(selectedUser.members)})
                                                </span>
                                            </>
                                        ) : (selectedUser.is_online ? 'Online' : 'Offline')}
                                    </div>
                                </div>
                            </div>

                            {/* Header Actions */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <button
                                    onClick={() => setShowProfileModal(true)}
                                    style={{
                                        width: '36px', height: '36px', borderRadius: '50%',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        border: 'none', background: 'transparent', cursor: 'pointer',
                                        color: 'var(--text-muted)'
                                    }}
                                    className="hover-bg"
                                    title="Contact Info"
                                >
                                    <Info size={18} />
                                </button>
                            </div>
                            <style>{`.hover-bg:hover { background-color: #f1f5f9; }`}</style>
                        </div>

                        {/* Messages Area */}
                        <div style={{
                            flex: 1,
                            padding: '24px',
                            overflowY: 'auto',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '16px',
                            backgroundColor: '#f8fafc'
                        }}>
                            {messages.map((msg, idx) => {
                                const isMe = msg.sender === user.username;
                                const isSystem = msg.sender === 'System' || msg.message_type === 'system' || msg.message_type === 'task_update';

                                if (isSystem) {
                                    return (
                                        <div key={idx} style={{ display: 'flex', justifyContent: 'center', margin: '8px 0' }}>
                                            <div style={{
                                                padding: '6px 16px',
                                                borderRadius: '20px',
                                                backgroundColor: '#FEF3C7',
                                                color: '#92400E',
                                                fontSize: '12px',
                                                fontWeight: '600',
                                                border: '1px solid #FDE68A',
                                                textAlign: 'center',
                                                maxWidth: '90%'
                                            }}>
                                                {msg.content}
                                            </div>
                                        </div>
                                    );
                                }

                                return (
                                    <div key={idx} style={{
                                        display: 'flex',
                                        justifyContent: isMe ? 'flex-end' : 'flex-start',
                                        maxWidth: '85%',
                                        alignSelf: isMe ? 'flex-end' : 'flex-start'
                                    }}>
                                        <div style={{
                                            padding: '12px 16px',
                                            borderRadius: isMe ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                                            backgroundColor: isMe ? 'var(--primary)' : 'white',
                                            color: isMe ? 'white' : 'var(--text-main)',
                                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                            border: isMe ? 'none' : '1px solid var(--border)',
                                            width: '100%'
                                        }}>
                                            {selectedUser.isGroup && !isMe && (
                                                <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--primary)', marginBottom: '4px' }}>
                                                    {msg.sender_name || msg.sender}
                                                </div>
                                            )}
                                            {/* Only show text content if there are no attachments, or if content is not just a file share message */}
                                            {(!msg.attachments || msg.attachments.length === 0 || (msg.content && !msg.content.startsWith('Shared a '))) && (
                                                <div style={{ fontSize: '14px', lineHeight: '1.5' }}>{msg.content}</div>
                                            )}

                                            {/* Render Attachments */}
                                            {msg.attachments && msg.attachments.length > 0 && (
                                                <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                    {msg.attachments.map((at, i) => (
                                                        <div key={i} style={{ borderRadius: '8px', overflow: 'hidden', border: isMe ? '1px solid rgba(255,255,255,0.2)' : '1px solid var(--border)' }}>
                                                            {at.type === 'image' ? (
                                                                <img src={getFileUrl(at.url)} alt={at.name} style={{ maxWidth: '100%', display: 'block' }} />
                                                            ) : (
                                                                <a href={getFileUrl(at.url)} download={at.name} target="_blank" rel="noreferrer" style={{
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '8px',
                                                                    padding: '8px',
                                                                    backgroundColor: isMe ? 'rgba(255,255,255,0.1)' : '#f8fafc',
                                                                    color: isMe ? 'white' : 'var(--primary)',
                                                                    textDecoration: 'none',
                                                                    fontSize: '13px'
                                                                }}>
                                                                    <FileIcon size={16} />
                                                                    <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{at.name}</span>
                                                                    <Download size={14} />
                                                                </a>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            <div style={{
                                                fontSize: '10px',
                                                marginTop: '4px',
                                                textAlign: 'right',
                                                opacity: 0.7
                                            }}>
                                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div style={{ padding: '20px', borderTop: '1px solid var(--border)' }}>
                            <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                <input
                                    type="file"
                                    id="file-upload"
                                    hidden
                                    onChange={handleFileUpload}
                                />
                                <label
                                    htmlFor="file-upload"
                                    style={{
                                        padding: '10px',
                                        borderRadius: 'var(--radius-md)',
                                        backgroundColor: uploading ? '#f8fafc' : '#f1f5f9',
                                        color: 'var(--text-muted)',
                                        cursor: uploading ? 'default' : 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'all 0.2s',
                                        border: '1px solid var(--border)',
                                        opacity: uploading ? 0.6 : 1
                                    }}
                                    onMouseEnter={(e) => { if (!uploading) e.currentTarget.style.backgroundColor = '#e2e8f0'; }}
                                    onMouseLeave={(e) => { if (!uploading) e.currentTarget.style.backgroundColor = '#f1f5f9'; }}
                                    title="Attach image or file"
                                >
                                    {uploading ? <Loader2 size={20} className="animate-spin" /> : <Paperclip size={20} />}
                                </label>
                                <input
                                    type="text"
                                    placeholder="Type a message..."
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    style={{
                                        flex: 1,
                                        padding: '12px 16px',
                                        borderRadius: 'var(--radius-md)',
                                        border: '1px solid var(--border)',
                                        outline: 'none',
                                        fontSize: '14px'
                                    }}
                                />
                                <button
                                    type="submit"
                                    disabled={!newMessage.trim()}
                                    style={{
                                        padding: '12px 20px',
                                        backgroundColor: 'var(--primary)',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: 'var(--radius-md)',
                                        cursor: newMessage.trim() ? 'pointer' : 'default',
                                        opacity: newMessage.trim() ? 1 : 0.6,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        fontWeight: '600'
                                    }}
                                >
                                    <Send size={18} />
                                    <span>Send</span>
                                </button>
                            </form>
                        </div>
                    </>
                ) : (
                    <div style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-muted)',
                        padding: '40px'
                    }}>
                        <div style={{
                            width: '80px',
                            height: '80px',
                            borderRadius: '50%',
                            backgroundColor: '#f1f5f9',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: '20px'
                        }}>
                            <MessageSquare size={40} />
                        </div>
                        <h3 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '8px', color: 'var(--text-main)' }}>Your Messages</h3>
                        <p style={{ textAlign: 'center', maxWidth: '300px' }}>Select a teammate from the list to start a conversation.</p>
                    </div>
                )}
            </div>
            {/* Group Creation Modal */}
            {isCreatingGroup && (
                <div className="modal-overlay" style={{ zIndex: 1000 }}>
                    <div className="modal-content" style={{
                        width: '500px',
                        padding: '0',
                        overflow: 'hidden',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                        border: 'none'
                    }}>
                        <div className="modal-header" style={{
                            padding: '24px',
                            background: 'white',
                            borderBottom: '1px solid #f1f5f9'
                        }}>
                            <div>
                                <h2 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-main)', marginBottom: '4px' }}>Create New Group</h2>
                                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>Collaborate with your office team members</p>
                            </div>
                            <button
                                onClick={() => setIsCreatingGroup(false)}
                                style={{
                                    padding: '8px',
                                    borderRadius: '50%',
                                    border: 'none',
                                    background: '#f1f5f9',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#e2e8f0'}
                                onMouseLeave={(e) => e.currentTarget.style.background = '#f1f5f9'}
                            >
                                <X size={20} color="var(--text-main)" />
                            </button>
                        </div>

                        <div className="modal-body" style={{ padding: '24px' }}>
                            <div style={{ marginBottom: '24px' }}>
                                <label style={{
                                    display: 'block',
                                    fontSize: '12px',
                                    fontWeight: '700',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                    color: 'var(--text-muted)',
                                    marginBottom: '8px'
                                }}>Group Name</label>
                                <div style={{ position: 'relative' }}>
                                    <MessageSquare size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--primary)' }} />
                                    <input
                                        value={groupName}
                                        onChange={(e) => setGroupName(e.target.value)}
                                        placeholder="e.g. Site Engineers, Admin Team..."
                                        style={{
                                            width: '100%',
                                            padding: '12px 16px 12px 48px',
                                            borderRadius: 'var(--radius-md)',
                                            border: '2px solid #e2e8f0',
                                            fontSize: '15px',
                                            outline: 'none',
                                            transition: 'border-color 0.2s',
                                        }}
                                        onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                                        onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                                    />
                                </div>
                            </div>

                            <label style={{
                                display: 'block',
                                fontSize: '12px',
                                fontWeight: '700',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                color: 'var(--text-muted)',
                                marginBottom: '12px'
                            }}>
                                Add Members <span style={{ color: 'var(--primary)' }}>({selectedMembers.length} selected)</span>
                            </label>
                            <div style={{
                                maxHeight: '300px',
                                overflowY: 'auto',
                                border: '1px solid #f1f5f9',
                                borderRadius: 'var(--radius-lg)',
                                backgroundColor: '#f8fafc'
                            }}>
                                {users.filter(u => isOfficeRole(u.role)).map(u => {
                                    const isSelected = selectedMembers.includes(u.username);
                                    return (
                                        <div
                                            key={u.username}
                                            onClick={() => {
                                                if (isSelected) setSelectedMembers(selectedMembers.filter(m => m !== u.username));
                                                else setSelectedMembers([...selectedMembers, u.username]);
                                            }}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '12px',
                                                padding: '12px 16px',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                                borderBottom: '1px solid #f1f5f9',
                                                backgroundColor: isSelected ? 'white' : 'transparent',
                                                boxShadow: isSelected ? 'inset 0 0 0 1px var(--primary)' : 'none'
                                            }}
                                            onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = '#f1f5f9'; }}
                                            onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'; }}
                                        >
                                            <div style={{
                                                width: '20px',
                                                height: '20px',
                                                border: isSelected ? 'none' : '2px solid #cbd5e1',
                                                borderRadius: '6px',
                                                backgroundColor: isSelected ? 'var(--primary)' : 'white',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}>
                                                {isSelected && <div style={{ width: '10px', height: '5px', borderLeft: '2px solid white', borderBottom: '2px solid white', transform: 'rotate(-45deg) translateY(-1px)' }}></div>}
                                            </div>
                                            <div style={{
                                                width: '36px',
                                                height: '36px',
                                                borderRadius: '50%',
                                                backgroundColor: 'var(--primary-light)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: 'var(--primary)',
                                                fontWeight: '700',
                                                fontSize: '13px'
                                            }}>
                                                {u.full_name.charAt(0)}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-main)' }}>{u.full_name}</div>
                                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{u.role}</div>
                                            </div>
                                            {u.is_online && (
                                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10B981' }}></div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="modal-footer" style={{
                            padding: '20px 24px',
                            borderTop: '1px solid #f1f5f9',
                            backgroundColor: '#f9fafb',
                            display: 'flex',
                            gap: '12px'
                        }}>
                            <button
                                className="btn"
                                onClick={() => setIsCreatingGroup(false)}
                                style={{
                                    flex: 1,
                                    padding: '12px',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid #e2e8f0',
                                    background: 'white',
                                    fontWeight: '600',
                                    fontSize: '14px',
                                    cursor: 'pointer'
                                }}
                            >Cancel</button>
                            <button
                                className="btn btn-primary"
                                onClick={handleCreateGroup}
                                disabled={!groupName.trim() || selectedMembers.length === 0}
                                style={{
                                    flex: 2,
                                    padding: '12px',
                                    borderRadius: 'var(--radius-md)',
                                    border: 'none',
                                    background: (!groupName.trim() || selectedMembers.length === 0) ? '#cbd5e1' : 'var(--primary)',
                                    color: 'white',
                                    fontWeight: '700',
                                    fontSize: '14px',
                                    cursor: (!groupName.trim() || selectedMembers.length === 0) ? 'default' : 'pointer',
                                    boxShadow: (!groupName.trim() || selectedMembers.length === 0) ? 'none' : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                                }}
                            >Create Team Group</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Profile Info Sidebar (WhatsApp Style) */}
            {showProfileModal && selectedUser && (
                <div style={{
                    width: '350px',
                    borderLeft: '1px solid var(--border)',
                    backgroundColor: '#f0f2f5',
                    display: 'flex',
                    flexDirection: 'column',
                    animation: 'slideInRight 0.3s ease',
                    zIndex: 10
                }}>
                    {/* WhatsApp style header */}
                    <div style={{ padding: '20px', backgroundColor: '#f0f2f5', display: 'flex', alignItems: 'center', gap: '20px', borderBottom: '1px solid var(--border)' }}>
                        <button onClick={() => setShowProfileModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}>
                            <X size={20} color="#54656f" />
                        </button>
                        <span style={{ fontSize: '16px', color: '#111b21', fontWeight: '500' }}>Contact info</span>
                    </div>

                    <style>{`.hover-bg-f5:hover { background-color: #f5f6f6; }`}</style>
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                        {/* Profile Pic & Name */}
                        <div style={{ padding: '32px 20px', backgroundColor: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: '10px' }}>
                            <div style={{
                                width: '200px', height: '200px', borderRadius: '50%', backgroundColor: selectedUser.isGroup ? '#E2E8F0' : 'var(--primary-light)',
                                color: selectedUser.isGroup ? '#4A5568' : 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '80px', fontWeight: '400', marginBottom: '20px'
                            }}>
                                {selectedUser.isGroup ? <MessageSquare size={80} /> : selectedUser.full_name.charAt(0)}
                            </div>
                            <h2 style={{ fontSize: '24px', color: '#111b21', margin: '0 0 4px 0', fontWeight: '400' }}>{selectedUser.full_name || selectedUser.name}</h2>
                            <div style={{ fontSize: '16px', color: '#667781' }}>{selectedUser.isGroup ? `Group · ${selectedUser.members.length} members` : `@${selectedUser.username}`}</div>
                        </div>

                        {/* About/Details (WhatsApp style) */}
                        {!selectedUser.isGroup && (
                            <div style={{ padding: '20px', backgroundColor: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: '10px' }}>
                                <div style={{ fontSize: '14px', color: '#8696a0', marginBottom: '8px' }}>About</div>
                                <div style={{ fontSize: '16px', color: '#111b21', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <User size={18} /> {selectedUser.role}
                                </div>
                            </div>
                        )}

                        {/* Mute Section */}
                        <div style={{ padding: '20px', backgroundColor: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                            onClick={() => setMutedChats(prev => ({ ...prev, [selectedUser.username || selectedUser._id]: !prev[selectedUser.username || selectedUser._id] }))}
                        >
                            <div style={{ fontSize: '16px', color: '#111b21', display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <Bell size={20} color="#8696a0" />
                                <span>Mute notifications</span>
                            </div>

                            {/* Modern Toggle */}
                            <label style={{ position: 'relative', display: 'inline-block', width: '40px', height: '24px' }}>
                                <input
                                    type="checkbox"
                                    checked={mutedChats[selectedUser.username || selectedUser._id] || false}
                                    readOnly
                                    style={{ opacity: 0, width: 0, height: 0 }}
                                />
                                <span style={{
                                    position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                                    backgroundColor: mutedChats[selectedUser.username || selectedUser._id] ? '#00a884' : '#E2E8F0',
                                    transition: '.4s', borderRadius: '34px'
                                }}>
                                    <span style={{
                                        position: 'absolute', content: '""', height: '18px', width: '18px',
                                        left: mutedChats[selectedUser.username || selectedUser._id] ? '19px' : '3px', bottom: '3px',
                                        backgroundColor: 'white', transition: '.4s', borderRadius: '50%'
                                    }}></span>
                                </span>
                            </label>
                        </div>

                        {/* Group Members (if group, WhatsApp style) */}
                        {selectedUser.isGroup && (
                            <div style={{ padding: '0', backgroundColor: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: '10px' }}>
                                <div style={{ padding: '20px', fontSize: '14px', color: '#8696a0', borderBottom: '1px solid #f0f2f5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span>{selectedUser.members.length} members</span>
                                    <button
                                        onClick={() => { setShowAddMembers(!showAddMembers); setNewGroupMembers([]); }}
                                        style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: '700' }}
                                    >
                                        <UserPlus size={16} /> Add
                                    </button>
                                </div>

                                {/* Add Members Panel */}
                                {showAddMembers && (
                                    <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f2f5', backgroundColor: '#f8fafc' }}>
                                        <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '8px' }}>
                                            {users.filter(u => isOfficeRole(u.role) && !selectedUser.members.includes(u.username)).map(u => {
                                                const isSelected = newGroupMembers.includes(u.username);
                                                return (
                                                    <div
                                                        key={u.username}
                                                        onClick={() => {
                                                            if (isSelected) setNewGroupMembers(newGroupMembers.filter(m => m !== u.username));
                                                            else setNewGroupMembers([...newGroupMembers, u.username]);
                                                        }}
                                                        style={{
                                                            display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px',
                                                            cursor: 'pointer', borderRadius: '8px',
                                                            backgroundColor: isSelected ? 'white' : 'transparent',
                                                            border: isSelected ? '1px solid var(--primary)' : '1px solid transparent',
                                                            marginBottom: '4px', transition: 'all 0.2s'
                                                        }}
                                                    >
                                                        <div style={{
                                                            width: '16px', height: '16px', borderRadius: '4px',
                                                            border: isSelected ? 'none' : '2px solid #cbd5e1',
                                                            backgroundColor: isSelected ? 'var(--primary)' : 'white',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                        }}>
                                                            {isSelected && <div style={{ width: '8px', height: '4px', borderLeft: '2px solid white', borderBottom: '2px solid white', transform: 'rotate(-45deg) translateY(-1px)' }}></div>}
                                                        </div>
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ fontSize: '13px', fontWeight: '600' }}>{u.full_name}</div>
                                                            <div style={{ fontSize: '11px', color: '#667781' }}>{u.role}</div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            {users.filter(u => isOfficeRole(u.role) && !selectedUser.members.includes(u.username)).length === 0 && (
                                                <p style={{ fontSize: '13px', color: '#667781', textAlign: 'center', padding: '12px' }}>All users are already in this group</p>
                                            )}
                                        </div>
                                        {newGroupMembers.length > 0 && (
                                            <button
                                                onClick={handleAddMembers}
                                                disabled={addingMembers}
                                                style={{
                                                    width: '100%', padding: '8px', borderRadius: '8px', border: 'none',
                                                    background: 'var(--primary)', color: 'white', fontWeight: '700',
                                                    fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center',
                                                    justifyContent: 'center', gap: '6px'
                                                }}
                                            >
                                                {addingMembers ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                                                Add {newGroupMembers.length} Member{newGroupMembers.length > 1 ? 's' : ''}
                                            </button>
                                        )}
                                    </div>
                                )}

                                {selectedUser.members.map(username => {
                                    const uInfo = users.find(u => u.username === username);
                                    const isYou = username === user.username;
                                    return (
                                        <div key={username} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 20px', cursor: 'pointer' }} className="hover-bg-f5">
                                            <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', fontWeight: '600' }}>
                                                {isYou ? 'Y' : (uInfo ? uInfo.full_name.charAt(0) : '?')}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: '16px', color: '#111b21' }}>{isYou ? 'You' : (uInfo ? uInfo.full_name : username)}</div>
                                                <div style={{ fontSize: '13px', color: '#667781' }}>{isYou ? 'Admin' : (uInfo ? uInfo.role : '')}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Chat;

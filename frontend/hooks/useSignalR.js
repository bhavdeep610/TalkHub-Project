import { useState, useEffect, useCallback } from 'react';
import signalRService from '../services/signalRService';

export function useSignalR(token) {
    const [isConnected, setIsConnected] = useState(false);
    const [messages, setMessages] = useState([]);
    const [typingUsers, setTypingUsers] = useState(new Map());
    const [onlineUsers, setOnlineUsers] = useState(new Map());

    // Connect to SignalR hub
    useEffect(() => {
        if (!token) return;

        const connect = async () => {
            const success = await signalRService.startConnection(token);
            setIsConnected(success);
        };

        connect();

        // Cleanup on unmount
        return () => {
            signalRService.stopConnection();
        };
    }, [token]);

    // Message handling
    useEffect(() => {
        const unsubscribe = signalRService.onReceiveMessage((message) => {
            setMessages(prev => [...prev, message]);
        });

        return () => unsubscribe();
    }, []);

    const sendMessage = useCallback(async (receiverId, content) => {
        if (!isConnected) throw new Error('Not connected to chat');
        await signalRService.sendMessage(receiverId, content);
    }, [isConnected]);

    // Typing notifications
    useEffect(() => {
        const unsubscribe = signalRService.onTypingNotification(({ userId, username, isTyping }) => {
            setTypingUsers(prev => {
                const newMap = new Map(prev);
                if (isTyping) {
                    newMap.set(userId, { username, timestamp: Date.now() });
                } else {
                    newMap.delete(userId);
                }
                return newMap;
            });
        });

        return () => unsubscribe();
    }, []);

    const sendTypingNotification = useCallback(async (receiverId, isTyping) => {
        if (!isConnected) return;
        await signalRService.sendTypingNotification(receiverId, isTyping);
    }, [isConnected]);

    // User status handling
    useEffect(() => {
        const unsubscribe = signalRService.onUserStatusChange((user) => {
            setOnlineUsers(prev => {
                const newMap = new Map(prev);
                if (user.status === 'online') {
                    newMap.set(user.userId, {
                        username: user.username,
                        lastSeen: new Date()
                    });
                } else {
                    newMap.set(user.userId, {
                        username: user.username,
                        lastSeen: user.lastSeen
                    });
                }
                return newMap;
            });
        });

        return () => unsubscribe();
    }, []);

    // Clean up typing indicators after timeout
    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            setTypingUsers(prev => {
                const newMap = new Map(prev);
                for (const [userId, data] of newMap) {
                    if (now - data.timestamp > 5000) { // 5 seconds timeout
                        newMap.delete(userId);
                    }
                }
                return newMap;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    return {
        isConnected,
        messages,
        sendMessage,
        typingUsers: Array.from(typingUsers.entries()),
        sendTypingNotification,
        onlineUsers: Array.from(onlineUsers.entries())
    };
}    
import { useState, useEffect, useCallback, useRef } from 'react';
import signalRService from '../services/signalRService';

export function useSignalR(token) {
    const [isConnected, setIsConnected] = useState(false);
    const [messages, setMessages] = useState([]);
    const messagesRef = useRef(messages);
    const [typingUsers, setTypingUsers] = useState(new Map());
    const [onlineUsers, setOnlineUsers] = useState(new Map());
    const connectionRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);

    // Update messages ref when messages change
    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);

    // Connect to SignalR hub with reconnection logic
    useEffect(() => {
        if (!token) return;

        const connect = async () => {
            try {
                const success = await signalRService.startConnection(token);
                setIsConnected(success);
                if (success) {
                    connectionRef.current = Date.now();
                }
            } catch (error) {
                console.error('SignalR connection error:', error);
                setIsConnected(false);
                
                // Attempt to reconnect after a delay
                if (reconnectTimeoutRef.current) {
                    clearTimeout(reconnectTimeoutRef.current);
                }
                reconnectTimeoutRef.current = setTimeout(connect, 5000);
            }
        };

        connect();

        // Cleanup on unmount
        return () => {
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            signalRService.stopConnection();
        };
    }, [token]);

    // Message handling with deduplication
    useEffect(() => {
        const messageIds = new Set();

        const unsubscribe = signalRService.onReceiveMessage((message) => {
            // Deduplicate messages
            if (messageIds.has(message.id)) {
                return;
            }
            messageIds.add(message.id);

            setMessages(prev => {
                // Check if message already exists
                if (prev.some(m => m.id === message.id)) {
                    return prev;
                }

                // Sort messages by timestamp
                const newMessages = [...prev, message].sort((a, b) => 
                    new Date(a.timestamp) - new Date(b.timestamp)
                );

                // Limit the number of messages in memory
                if (newMessages.length > 200) {
                    return newMessages.slice(-200);
                }

                return newMessages;
            });
        });

        return () => unsubscribe();
    }, []);

    const sendMessage = useCallback(async (receiverId, content) => {
        if (!isConnected) throw new Error('Not connected to chat');
        
        try {
            const tempId = Date.now().toString();
            const tempMessage = {
                id: tempId,
                senderId: 'local',
                receiverId,
                content,
                timestamp: new Date().toISOString(),
                pending: true
            };

            // Optimistically add message
            setMessages(prev => [...prev, tempMessage]);

            // Send the actual message
            await signalRService.sendMessage(receiverId, content);

            // Remove the temporary message (it will be replaced by the real one from the server)
            setMessages(prev => prev.filter(m => m.id !== tempId));
        } catch (error) {
            console.error('Failed to send message:', error);
            throw error;
        }
    }, [isConnected]);

    // Typing notifications with debouncing
    useEffect(() => {
        const typingTimeouts = new Map();

        const unsubscribe = signalRService.onTypingNotification(({ userId, username, isTyping }) => {
            setTypingUsers(prev => {
                const newMap = new Map(prev);
                
                // Clear existing timeout
                if (typingTimeouts.has(userId)) {
                    clearTimeout(typingTimeouts.get(userId));
                }

                if (isTyping) {
                    newMap.set(userId, { username, timestamp: Date.now() });
                    // Auto-clear typing indicator after 5 seconds
                    typingTimeouts.set(userId, setTimeout(() => {
                        setTypingUsers(current => {
                            const updatedMap = new Map(current);
                            updatedMap.delete(userId);
                            return updatedMap;
                        });
                        typingTimeouts.delete(userId);
                    }, 5000));
                } else {
                    newMap.delete(userId);
                }
                
                return newMap;
            });
        });

        return () => {
            // Clear all timeouts on cleanup
            typingTimeouts.forEach(timeout => clearTimeout(timeout));
            unsubscribe();
        };
    }, []);

    const sendTypingNotification = useCallback(async (receiverId, isTyping) => {
        if (!isConnected) return;
        try {
            await signalRService.sendTypingNotification(receiverId, isTyping);
        } catch (error) {
            console.error('Failed to send typing notification:', error);
        }
    }, [isConnected]);

    // User status handling with timestamp updates
    useEffect(() => {
        const unsubscribe = signalRService.onUserStatusChange((user) => {
            setOnlineUsers(prev => {
                const newMap = new Map(prev);
                const timestamp = new Date();
                
                if (user.status === 'online') {
                    newMap.set(user.userId, {
                        username: user.username,
                        lastSeen: timestamp,
                        status: 'online'
                    });
                } else {
                    const existing = newMap.get(user.userId);
                    newMap.set(user.userId, {
                        username: user.username,
                        lastSeen: timestamp,
                        status: 'offline',
                        previousStatus: existing?.status
                    });
                }
                return newMap;
            });
        });

        return () => unsubscribe();
    }, []);

    // Memoize return values to prevent unnecessary re-renders
    const returnValue = {
        isConnected,
        messages,
        sendMessage,
        typingUsers: Array.from(typingUsers.entries()),
        sendTypingNotification,
        onlineUsers: Array.from(onlineUsers.entries())
    };

    return returnValue;
}    
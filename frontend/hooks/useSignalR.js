import { useState, useEffect, useCallback, useRef } from 'react';
import signalRService from '../src/services/signalRService';

export function useSignalR(token) {
    // Initialize all state first
    const [isConnected, setIsConnected] = useState(false);
    const [messages, setMessages] = useState([]);
    const [conversations, setConversations] = useState([]);
    const [typingUsers, setTypingUsers] = useState(new Map());
    const [onlineUsers, setOnlineUsers] = useState([]);
    
    // Initialize all refs
    const messagesRef = useRef(messages);
    const connectionRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);
    const messageQueueRef = useRef([]);
    const processingQueueRef = useRef(false);
    const typingTimeoutsRef = useRef(new Map());
    const mountedRef = useRef(true);
    const initializingRef = useRef(false);

    // Update messages ref when messages change
    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);

    // Initialize callbacks
    const processMessageQueue = useCallback(async () => {
        if (processingQueueRef.current || messageQueueRef.current.length === 0 || !mountedRef.current) return;

        processingQueueRef.current = true;
        try {
            const batch = messageQueueRef.current.splice(0, 10);
            const uniqueMessages = new Map();

            batch.forEach(msg => {
                const key = msg.id || `${msg.senderId}-${msg.timestamp}-${msg.content}`;
                if (!uniqueMessages.has(key) || msg.id) {
                    uniqueMessages.set(key, msg);
                }
            });

            if (mountedRef.current) {
                setMessages(prev => {
                    const newMessages = [...prev];
                    uniqueMessages.forEach(msg => {
                        if (!newMessages.some(m => m.id === msg.id)) {
                            newMessages.push(msg);
                        }
                    });
                    return newMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                });
            }
        } finally {
            processingQueueRef.current = false;
            if (messageQueueRef.current.length > 0 && mountedRef.current) {
                setTimeout(processMessageQueue, 100);
            }
        }
    }, []);

    // Setup connection
    useEffect(() => {
        mountedRef.current = true;

        const connect = async () => {
            if (!token || !mountedRef.current || initializingRef.current) return;

            try {
                initializingRef.current = true;
                await signalRService.start();
                if (mountedRef.current) {
                    setIsConnected(signalRService.isConnected());
                    if (signalRService.isConnected()) {
                        connectionRef.current = Date.now();
                    }
                }
            } catch (error) {
                console.error('SignalR connection error:', error);
                if (mountedRef.current) {
                    setIsConnected(false);
                    if (reconnectTimeoutRef.current) {
                        clearTimeout(reconnectTimeoutRef.current);
                    }
                    reconnectTimeoutRef.current = setTimeout(connect, 5000);
                }
            } finally {
                initializingRef.current = false;
            }
        };

        connect();

        return () => {
            mountedRef.current = false;
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            signalRService.stop();
        };
    }, [token]);

    // Message handling
    useEffect(() => {
        if (!mountedRef.current) return;

        const unsubscribe = signalRService.onReceiveMessage((message) => {
            if (mountedRef.current) {
                messageQueueRef.current.push(message);
                processMessageQueue();
            }
        });

        return () => {
            if (unsubscribe) {
                unsubscribe();
            }
        };
    }, [processMessageQueue]);

    useEffect(() => {
        if (!mountedRef.current) return;

        const unsubscribe = signalRService.onConversationUpdate((conversation) => {
            if (!mountedRef.current) return;
            
            setConversations(prev => {
                const newConversations = [...prev];
                const index = newConversations.findIndex(c => c.user.id === conversation.userId);
                
                if (index !== -1) {
                    newConversations[index] = {
                        ...newConversations[index],
                        lastMessage: conversation.lastMessage
                    };
                }
                
                return newConversations;
            });
        });

        return () => {
            if (unsubscribe) {
                unsubscribe();
            }
        };
    }, []);

    // Return the hook interface
    return {
        isConnected,
        messages,
        conversations,
        typingUsers: Array.from(typingUsers.entries()),
        onlineUsers: Array.from(onlineUsers.entries()),
        sendMessage: useCallback(async (receiverId, content) => {
            if (!isConnected) throw new Error('Not connected to chat');
            return await signalRService.sendMessage(receiverId, content);
        }, [isConnected]),
        sendTypingNotification: useCallback(async (receiverId, isTyping) => {
            if (!isConnected || !mountedRef.current) return;
            try {
                await signalRService.sendTypingIndicator(receiverId);
            } catch (error) {
                console.error('Failed to send typing notification:', error);
            }
        }, [isConnected])
    };
}    
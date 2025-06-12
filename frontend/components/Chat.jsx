import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useSignalR } from '../hooks/useSignalR';

const Chat = ({ token, currentUser, selectedUser, onConversationUpdate }) => {
    const [messageInput, setMessageInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [localMessages, setLocalMessages] = useState([]);
    const [shouldScrollToBottom, setShouldScrollToBottom] = useState(true);
    const typingTimeoutRef = useRef(null);
    const messagesEndRef = useRef(null);
    const scrollTimeoutRef = useRef(null);
    const previousMessagesLengthRef = useRef(0);
    const messageMapRef = useRef(new Map());
    const containerRef = useRef(null);

    const {
        isConnected,
        messages,
        sendMessage,
        typingUsers,
        sendTypingNotification,
        onlineUsers
    } = useSignalR(token);

    // Memoize filtered messages with improved ordering
    const chatMessages = useMemo(() => {
        // Create a map for deduplication while preserving order
        const messageMap = new Map();
        
        // Combine and sort all messages
        const allMessages = [...messages, ...localMessages]
            .filter(msg => 
                (msg.senderId === currentUser?.id && msg.receiverId === selectedUser?.id) ||
                (msg.senderId === selectedUser?.id && msg.receiverId === currentUser?.id)
            )
            .map(msg => {
                // Ensure consistent timestamp handling
                const timestamp = msg.timestamp || msg.created;
                const sortTime = new Date(timestamp).getTime();
                
                return {
                    ...msg,
                    sortTime,
                    // Ensure consistent key generation
                    key: msg.id || `${msg.senderId}-${sortTime}-${msg.content}`
                };
            });

        // First pass: deduplicate messages while preserving order
        allMessages.forEach(msg => {
            const existing = messageMap.get(msg.key);
            // Only replace if:
            // 1. Message doesn't exist, or
            // 2. New message has an ID and old one doesn't, or
            // 3. Both have IDs but new one is more recent
            if (!existing || 
                (msg.id && !existing.id) || 
                (msg.id && existing.id && msg.sortTime > existing.sortTime)) {
                messageMap.set(msg.key, msg);
            }
        });

        // Convert back to array and ensure strict chronological sorting
        return Array.from(messageMap.values())
            .sort((a, b) => {
                // Primary sort by timestamp
                const timeDiff = a.sortTime - b.sortTime;
                if (timeDiff !== 0) {
                    return timeDiff;
                }
                
                // If timestamps are exactly equal (rare but possible)
                // Use message ID or creation order as tiebreaker
                if (a.id && b.id) {
                    return a.id.localeCompare(b.id);
                }
                
                // For messages without IDs, maintain stable order
                return allMessages.findIndex(m => m.key === a.key) - 
                       allMessages.findIndex(m => m.key === b.key);
            });
    }, [messages, localMessages, currentUser?.id, selectedUser?.id]);

    // Update message map for optimistic updates
    useEffect(() => {
        messageMapRef.current = new Map(
            chatMessages.map(msg => [msg.id || `${msg.senderId}-${msg.timestamp}-${msg.content}`, msg])
        );
    }, [chatMessages]);

    // Memoize user status
    const { isUserOnline, lastSeen } = useMemo(() => {
        const selectedUserStatus = onlineUsers.find(([userId]) => userId === selectedUser?.id);
        return {
            isUserOnline: !!selectedUserStatus,
            lastSeen: selectedUserStatus ? selectedUserStatus[1].lastSeen : null
        };
    }, [onlineUsers, selectedUser?.id]);

    // Memoize selected user typing status
    const isSelectedUserTyping = useMemo(() => 
        typingUsers.some(([userId]) => userId === selectedUser?.id),
        [typingUsers, selectedUser?.id]
    );

    // Improved scroll position management
    const handleScroll = useCallback(() => {
        if (!containerRef.current) return;
        
        const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
        
        setShouldScrollToBottom(isNearBottom);
    }, []);

    // Enhanced scroll to bottom with position preservation
    const scrollToBottom = useCallback((force = false) => {
        if (!messagesEndRef.current || !containerRef.current) return;

        // Clear any pending scroll timeouts
        if (scrollTimeoutRef.current) {
            clearTimeout(scrollTimeoutRef.current);
        }

        const performScroll = () => {
            if (!messagesEndRef.current || !containerRef.current) return;

            const { scrollHeight, scrollTop, clientHeight } = containerRef.current;
            const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;

            if (force || shouldScrollToBottom || isNearBottom) {
                messagesEndRef.current.scrollIntoView({
                    behavior: force ? 'auto' : 'smooth',
                    block: 'end'
                });
            }
        };

        // Delay scroll to ensure DOM is updated
        scrollTimeoutRef.current = setTimeout(performScroll, 100);
    }, [shouldScrollToBottom]);

    // Initialize scroll listener
    useEffect(() => {
        const container = containerRef.current;
        if (container) {
            container.addEventListener('scroll', handleScroll);
            return () => container.removeEventListener('scroll', handleScroll);
        }
    }, [handleScroll]);

    // Handle new messages with improved scroll behavior
    useEffect(() => {
        const hasNewMessages = chatMessages.length > previousMessagesLengthRef.current;
        const isNewMessage = hasNewMessages && previousMessagesLengthRef.current > 0;
        previousMessagesLengthRef.current = chatMessages.length;
        
        if (hasNewMessages) {
            // For new conversations or initial load, force scroll
            if (!isNewMessage) {
                scrollToBottom(true);
            } else {
                // For new messages, respect scroll position
                scrollToBottom(false);
            }
        }
    }, [chatMessages.length, scrollToBottom]);

    // Cleanup scroll timeout
    useEffect(() => {
        return () => {
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
            }
        };
    }, []);

    // Optimize typing handler with debouncing
    const handleTyping = useCallback(() => {
        if (!isTyping && selectedUser?.id) {
            setIsTyping(true);
            sendTypingNotification(selectedUser.id, true);
        }

        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        typingTimeoutRef.current = setTimeout(() => {
            setIsTyping(false);
            if (selectedUser?.id) {
                sendTypingNotification(selectedUser.id, false);
            }
        }, 2000);
    }, [isTyping, selectedUser?.id, sendTypingNotification]);

    // Handle sending messages with improved timestamp handling
    const handleSendMessage = useCallback(async (e) => {
        e.preventDefault();
        if (!messageInput.trim() || !selectedUser?.id || !isConnected) return;

        const now = new Date();
        const timestamp = now.toISOString();
        const sortTime = now.getTime();
        
        const optimisticMessage = {
            senderId: currentUser.id,
            receiverId: selectedUser.id,
            content: messageInput.trim(),
            timestamp,
            created: timestamp,
            sortTime,
            isOptimistic: true,
            // Add a temporary ID that includes timestamp for proper ordering
            tempId: `temp-${sortTime}-${Math.random().toString(36).substr(2, 9)}`
        };

        // Add optimistic message to local state
        setLocalMessages(prev => [...prev, optimisticMessage]);
        setMessageInput('');

        try {
            const result = await sendMessage(messageInput.trim(), selectedUser.id);
            
            if (result) {
                // Remove optimistic message and add confirmed message atomically
                setLocalMessages(prev => {
                    const filtered = prev.filter(msg => msg.tempId !== optimisticMessage.tempId);
                    const confirmedMessage = {
                        ...result,
                        timestamp: result.created,
                        sortTime: new Date(result.created).getTime(),
                        isOptimistic: false
                    };
                    return [...filtered, confirmedMessage];
                });
            } else {
                // Remove optimistic message if no result
                setLocalMessages(prev => 
                    prev.filter(msg => msg.tempId !== optimisticMessage.tempId)
                );
            }
        } catch (error) {
            console.error('Failed to send message:', error);
            // Remove failed optimistic message
            setLocalMessages(prev => 
                prev.filter(msg => msg.tempId !== optimisticMessage.tempId)
            );
        }
    }, [messageInput, selectedUser?.id, isConnected, sendMessage, currentUser?.id]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
        };
    }, []);

    // Memoize message input handler
    const handleMessageInputChange = useCallback((e) => {
        setMessageInput(e.target.value);
        handleTyping();
    }, [handleTyping]);

    if (!selectedUser || !currentUser) {
        return null;
    }

    return (
        <div className="flex flex-col h-full">
            {/* Chat Header */}
            <div className="bg-white border-b p-4 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                    <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center">
                            {selectedUser.username[0].toUpperCase()}
                        </div>
                        {isUserOnline && (
                            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                        )}
                    </div>
                    <div>
                        <h2 className="font-semibold">{selectedUser.username}</h2>
                        <p className="text-sm text-gray-500">
                            {isUserOnline ? 'Online' : lastSeen ? `Last seen ${new Date(lastSeen).toLocaleString()}` : 'Offline'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Messages Area */}
            <div 
                ref={containerRef}
                className="flex-1 overflow-y-auto p-4 scroll-smooth"
            >
                <div className="flex flex-col space-y-6">
                    {chatMessages.map((message) => (
                        <div
                            key={message.key || message.id || `${message.senderId}-${message.timestamp}`}
                            className={`flex ${message.senderId === currentUser.id ? 'justify-end' : 'justify-start'} items-end space-x-2`}
                        >
                            {message.senderId !== currentUser.id && (
                                <div className="flex-shrink-0">
                                    {selectedUser.profilePicture ? (
                                        <img 
                                            src={selectedUser.profilePicture} 
                                            alt={selectedUser.username}
                                            className="w-8 h-8 rounded-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white">
                                            {selectedUser.username[0].toUpperCase()}
                                        </div>
                                    )}
                                </div>
                            )}
                            <div
                                className={`max-w-[70%] rounded-lg px-4 py-2 ${
                                    message.senderId === currentUser.id
                                        ? 'bg-purple-600 text-white rounded-br-none'
                                        : 'bg-white text-gray-800 rounded-bl-none shadow-sm'
                                }`}
                            >
                                <p className="break-words text-sm">{message.content}</p>
                                <p className={`text-xs mt-1 ${
                                    message.senderId === currentUser.id ? 'text-purple-200' : 'text-gray-500'
                                }`}>
                                    {new Date(message.timestamp).toLocaleTimeString([], { 
                                        hour: '2-digit', 
                                        minute: '2-digit',
                                        hour12: true 
                                    })}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
                {isSelectedUserTyping && (
                    <div className="flex justify-start mt-2">
                        <div className="bg-gray-100 rounded-lg p-3">
                            <p className="text-gray-500 text-sm">Typing...</p>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} className="h-0" />
            </div>

            {/* Message Input */}
            <form onSubmit={handleSendMessage} className="border-t p-4">
                <div className="flex items-center space-x-2">
                    <input
                        type="text"
                        value={messageInput}
                        onChange={handleMessageInputChange}
                        placeholder="Type a message..."
                        className="flex-1 rounded-full border border-gray-300 px-4 py-2 focus:outline-none focus:border-blue-500"
                        disabled={!isConnected || !selectedUser}
                    />
                    <button
                        type="submit"
                        disabled={!isConnected || !messageInput.trim() || !selectedUser}
                        className="bg-blue-500 text-white rounded-full p-2 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            className="w-6 h-6"
                        >
                            <path d="M3.478 2.404a.75.75 0 00-.926.941l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.404z" />
                        </svg>
                    </button>
                </div>
                {!isConnected && (
                    <p className="text-red-500 text-sm mt-2">
                        Not connected to chat. Please check your connection.
                    </p>
                )}
            </form>
        </div>
    );
};

// Prevent unnecessary re-renders
export default React.memo(Chat, (prevProps, nextProps) => {
    return (
        prevProps.token === nextProps.token &&
        prevProps.currentUser?.id === nextProps.currentUser?.id &&
        prevProps.selectedUser?.id === nextProps.selectedUser?.id
    );
}); 
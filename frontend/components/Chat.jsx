import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useSignalR } from '../hooks/useSignalR';

const Chat = ({ token, currentUser, selectedUser, onConversationUpdate }) => {
    const [messageInput, setMessageInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [localMessages, setLocalMessages] = useState([]);
    const typingTimeoutRef = useRef(null);
    const messagesEndRef = useRef(null);
    const previousMessagesLengthRef = useRef(0);
    const messageMapRef = useRef(new Map());

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
            .map(msg => ({
                ...msg,
                // Ensure consistent timestamp format
                sortTime: new Date(msg.timestamp || msg.created).getTime(),
                // Generate unique key that includes sender and time for proper ordering
                key: msg.id || `${msg.senderId}-${msg.timestamp || msg.created}-${msg.content}`
            }));

        // First pass: deduplicate messages while preserving order
        allMessages.forEach(msg => {
            const existing = messageMap.get(msg.key);
            // Only replace if the new message has an ID and the existing one doesn't
            if (!existing || (msg.id && !existing.id)) {
                messageMap.set(msg.key, msg);
            }
        });

        // Convert back to array and sort
        return Array.from(messageMap.values())
            .sort((a, b) => {
                // Primary sort by timestamp
                if (a.sortTime !== b.sortTime) {
                    return a.sortTime - b.sortTime;
                }
                // Secondary sort by sender ID to maintain conversation flow
                if (a.senderId !== b.senderId) {
                    return a.senderId.localeCompare(b.senderId);
                }
                // Final sort by content to maintain stable order
                return a.content.localeCompare(b.content);
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

    // Optimize scroll behavior with debouncing
    const scrollToBottom = useCallback((force = false) => {
        if (!messagesEndRef.current) return;

        const container = messagesEndRef.current.parentElement;
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;

        if (force || isNearBottom) {
            requestAnimationFrame(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: force ? 'auto' : 'smooth' });
            });
        }
    }, []);

    // Handle new messages with optimistic updates
    useEffect(() => {
        const hasNewMessages = chatMessages.length > previousMessagesLengthRef.current;
        previousMessagesLengthRef.current = chatMessages.length;
        
        if (hasNewMessages) {
            scrollToBottom(true);
        }
    }, [chatMessages.length, scrollToBottom]);

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

    // Handle sending messages
    const handleSendMessage = useCallback(async (e) => {
        e.preventDefault();
        if (!messageInput.trim() || !selectedUser?.id || !isConnected) return;

        const timestamp = new Date().toISOString();
        const optimisticMessage = {
            senderId: currentUser.id,
            receiverId: selectedUser.id,
            content: messageInput.trim(),
            timestamp,
            created: timestamp,
            isOptimistic: true,
            // Add a temporary ID for proper ordering
            tempId: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
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
            <div className="flex-1 overflow-y-auto p-4">
                <div className="flex flex-col space-y-6">
                    {chatMessages.map((message) => (
                        <div
                            key={message.id || `${message.senderId}-${message.timestamp}`}
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
                <div ref={messagesEndRef} />
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

export default React.memo(Chat); 
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

    // Memoize filtered messages with deduplication
    const chatMessages = useMemo(() => {
        const messageMap = new Map();
        const allMessages = [...messages, ...localMessages];
        
        // First pass: Store messages with IDs
        allMessages.forEach(msg => {
            if (msg.id) {
                messageMap.set(msg.id, msg);
            }
        });
        
        // Second pass: Add messages without IDs only if they don't exist
        allMessages.forEach(msg => {
            if (!msg.id) {
                const key = `${msg.senderId}-${msg.timestamp}-${msg.content}`;
                if (!messageMap.has(key)) {
                    messageMap.set(key, msg);
                }
            }
        });

        // Filter messages for current chat
        const filteredMessages = Array.from(messageMap.values()).filter(msg =>
            (msg.senderId === currentUser?.id && msg.receiverId === selectedUser?.id) ||
            (msg.senderId === selectedUser?.id && msg.receiverId === currentUser?.id)
        );

        // Sort by timestamp, ensuring proper order
        return filteredMessages.sort((a, b) => {
            const timeA = new Date(a.timestamp).getTime();
            const timeB = new Date(b.timestamp).getTime();
            return timeA - timeB;
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

    // Optimize message sending with optimistic updates
    const handleSendMessage = useCallback(async (e) => {
        e.preventDefault();
        if (!messageInput.trim() || !selectedUser?.id || !isConnected) return;

        const optimisticMessage = {
            id: null,
            senderId: currentUser.id,
            receiverId: selectedUser.id,
            content: messageInput.trim(),
            timestamp: new Date().toISOString(),
            isOptimistic: true
        };

        try {
            setLocalMessages(prev => [...prev, optimisticMessage]);
            setMessageInput('');
            
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
                setIsTyping(false);
                sendTypingNotification(selectedUser.id, false);
            }

            const result = await sendMessage(selectedUser.id, optimisticMessage.content);
            
            // Update conversation
            if (result && onConversationUpdate) {
                onConversationUpdate({
                    userId: selectedUser.id,
                    lastMessage: result
                });
            }

            // Remove optimistic message once confirmed
            setLocalMessages(prev => prev.filter(msg => msg !== optimisticMessage));
        } catch (error) {
            console.error('Failed to send message:', error);
            // Remove failed optimistic message
            setLocalMessages(prev => prev.filter(msg => msg !== optimisticMessage));
        }
    }, [messageInput, selectedUser?.id, isConnected, sendMessage, sendTypingNotification, currentUser?.id, onConversationUpdate]);

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
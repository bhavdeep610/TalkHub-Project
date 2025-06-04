import React, { useState, useEffect, useRef } from 'react';
import { useSignalR } from '../hooks/useSignalR';

const Chat = ({ token, currentUser, selectedUser }) => {
    const [messageInput, setMessageInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const typingTimeoutRef = useRef(null);
    const messagesEndRef = useRef(null);

    const {
        isConnected,
        messages,
        sendMessage,
        typingUsers,
        sendTypingNotification,
        onlineUsers
    } = useSignalR(token);

    // Scroll to bottom when new messages arrive
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Handle typing indicator
    const handleTyping = () => {
        if (!isTyping) {
            setIsTyping(true);
            sendTypingNotification(selectedUser.id, true);
        }

        // Clear existing timeout
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        // Set new timeout
        typingTimeoutRef.current = setTimeout(() => {
            setIsTyping(false);
            sendTypingNotification(selectedUser.id, false);
        }, 2000);
    };

    // Handle message sending
    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!messageInput.trim() || !selectedUser) return;

        try {
            await sendMessage(selectedUser.id, messageInput.trim());
            setMessageInput('');
            // Clear typing indicator
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
                setIsTyping(false);
                sendTypingNotification(selectedUser.id, false);
            }
        } catch (error) {
            console.error('Failed to send message:', error);
            // Handle error (show notification, etc.)
        }
    };

    // Filter messages for current chat
    const chatMessages = messages.filter(msg => 
        (msg.senderId === currentUser.id && msg.receiverId === selectedUser.id) ||
        (msg.senderId === selectedUser.id && msg.receiverId === currentUser.id)
    );

    // Check if selected user is typing
    const isSelectedUserTyping = typingUsers.some(([userId]) => userId === selectedUser.id);

    // Get selected user's online status
    const selectedUserStatus = onlineUsers.find(([userId]) => userId === selectedUser.id);
    const isUserOnline = selectedUserStatus ? true : false;
    const lastSeen = selectedUserStatus ? selectedUserStatus[1].lastSeen : null;

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
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {chatMessages.map((message, index) => (
                    <div
                        key={index}
                        className={`flex ${message.senderId === currentUser.id ? 'justify-end' : 'justify-start'}`}
                    >
                        <div
                            className={`max-w-[70%] rounded-lg p-3 ${
                                message.senderId === currentUser.id
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-gray-200 text-gray-800'
                            }`}
                        >
                            <p>{message.content}</p>
                            <p className="text-xs mt-1 opacity-70">
                                {new Date(message.timestamp).toLocaleTimeString()}
                            </p>
                        </div>
                    </div>
                ))}
                {isSelectedUserTyping && (
                    <div className="flex justify-start">
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
                        onChange={(e) => {
                            setMessageInput(e.target.value);
                            handleTyping();
                        }}
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

export default Chat; 
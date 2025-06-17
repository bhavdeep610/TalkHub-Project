import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import API from '../src/services/api';
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import ChatSidebar from '../components/ChatSidebar';
import ChatWindow from '../components/chatWindow';
import Header from '../components/Header';
import { useAuth } from '../hooks/useAuth';
import { useChatAPI } from '../hooks/useChatAPI';
import { motion } from 'framer-motion';

/**
 * Main chat page component
 * @returns {JSX.Element} Chat page component
 */
const ChatPage = () => {
  const navigate = useNavigate();
  const { currentUser, isLoading: authLoading, isAuthenticated, getToken } = useAuth();
  const { 
    selectedUser,
    registeredUsers,
    conversations,
    messages,
    isLoadingMessages,
    isLoadingUsers,
    error,
    setSelectedUser,
    fetchRegisteredUsers,
    sendMessage,
    updateMessages
  } = useChatAPI();

  // Add state for new chat dialog
  const [showNewChatDialog, setShowNewChatDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter users for new chat
  const filteredUsers = useMemo(() => {
    if (!searchQuery) return registeredUsers.filter(u => u.id !== currentUser?.id);
    const query = searchQuery.toLowerCase();
    return registeredUsers.filter(
      u => u.id !== currentUser?.id && u.username.toLowerCase().includes(query)
    );
  }, [registeredUsers, searchQuery, currentUser?.id]);

  // Format time helper
  const formatTime = useCallback((timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, []);

  // Format date helper
  const formatDate = useCallback((timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleDateString();
  }, []);

  // Handle message deletion
  const handleMessageDeleted = useCallback((messageId) => {
    updateMessages(prev => prev.filter(m => (m.id || m.Id) !== messageId));
  }, [updateMessages]);

  // Check authentication on mount and token changes
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login');
    }
  }, [authLoading, isAuthenticated, navigate]);

  // Fetch users on mount
  useEffect(() => {
    if (isAuthenticated) {
      fetchRegisteredUsers();
    }
  }, [isAuthenticated, fetchRegisteredUsers]);

  // If still loading auth or not authenticated, show loading or redirect
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will be redirected by the useEffect
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <Header />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="flex-1 flex overflow-hidden"
        style={{ height: 'calc(100vh - 64px)' }}
      >
        <div className="flex w-full h-full">
          {/* Sidebar - Always visible */}
          <div className="w-80 flex-shrink-0 bg-white border-r border-gray-200">
            <div className="flex flex-col h-full">
              <div className="h-12 min-h-[48px] flex-shrink-0 flex items-center justify-end px-6 border-b border-gray-200">
                <button
                  onClick={() => setShowNewChatDialog(true)}
                  className="text-purple-600 hover:text-purple-700 font-medium text-sm transition-colors duration-200"
                >
                  New Chat
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <ChatSidebar
                  currentUser={currentUser}
                  users={registeredUsers}
                  conversations={conversations}
                  selectedUser={selectedUser}
                  onSelectUser={setSelectedUser}
                  isLoadingUsers={isLoadingUsers}
                  newChatUserOptions={[]}
                  onStartNewChat={() => {}}
                  onRefreshUsers={fetchRegisteredUsers}
                  formatDate={formatDate}
                  hideHeader={false}
                />
              </div>
            </div>
          </div>

          {/* Main Chat Area - Always visible with consistent white background */}
          <div className="flex-1 flex flex-col overflow-hidden bg-white">
            {selectedUser ? (
              <ChatWindow
                currentUser={currentUser}
                selectedUser={selectedUser}
                messages={messages}
                onSendMessage={sendMessage}
                isLoadingMessages={isLoadingMessages}
                hasNewMessages={false}
                formatTime={formatTime}
                formatDate={formatDate}
                setHasNewMessages={() => {}}
                onMessageDeleted={handleMessageDeleted}
                token={getToken()}
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center bg-white">
                <div className="text-center max-w-md px-4">
                  <h2 className="text-2xl font-semibold mb-4 text-gray-800">Welcome to TalkHub!</h2>
                  <p className="text-lg mb-2 text-gray-600">Start chatting with your team members</p>
                  
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* New Chat Dialog */}
      {showNewChatDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-96 max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-800">New Chat</h3>
                <button
                  onClick={() => setShowNewChatDialog(false)}
                  className="text-gray-500 hover:text-gray-700 transition-colors duration-200"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="mt-4">
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors duration-200"
                />
              </div>
            </div>
            <div className="overflow-y-auto flex-1 p-2">
              {isLoadingUsers ? (
                <div className="flex justify-center items-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-purple-500"></div>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-4 text-gray-500">
                  No users found
                </div>
              ) : (
                filteredUsers.map(user => (
                  <div
                    key={user.id}
                    onClick={() => {
                      setSelectedUser(user);
                      setShowNewChatDialog(false);
                    }}
                    className="flex items-center p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors duration-200"
                  >
                    <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-semibold">
                      {user.username[0].toUpperCase()}
                    </div>
                    <div className="ml-3">
                      <p className="font-medium text-gray-900">{user.username}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Wrap with React.memo to prevent unnecessary re-renders
export default React.memo(ChatPage);

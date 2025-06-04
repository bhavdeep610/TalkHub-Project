import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import API from '../src/services/api';
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import ChatSidebar from '../components/ChatSidebar';
import ChatWindow from '../components/chatWindow';
import Navbar from '../components/Navbar';
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

  // Format date for display
  const formatDate = useMemo(() => {
    const dateCache = new Map();
    
    return (timestamp) => {
      if (!timestamp) return '';
      
      const cacheKey = String(timestamp);
      if (dateCache.has(cacheKey)) {
        return dateCache.get(cacheKey);
      }
      
      try {
        const date = new Date(timestamp);
        const formatted = date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
        });
        dateCache.set(cacheKey, formatted);
        return formatted;
      } catch (error) {
        console.error('Error formatting date:', error);
        return '';
      }
    };
  }, []); // Empty dependency array since this is a stable function

  // Format time for messages
  const formatTime = (date) => {
    try {
      if (!date) return '';
      
      // Convert the date to IST by adding 5 hours and 30 minutes offset
      const istDate = new Date(date);
      istDate.setMinutes(istDate.getMinutes() + 330); // Add 5 hours 30 minutes for IST offset
      
      const options = {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      };
      
      return istDate.toLocaleTimeString('en-IN', options);
    } catch (error) {
      console.error('Error formatting time:', error);
      return '';
    }
  };

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

  // Handle message deletion
  const handleMessageDeleted = async (messageId) => {
    try {
      // Update the messages state in useChatAPI hook
      const updatedMessages = messages.filter(msg => (msg.id || msg.Id) !== messageId);
      // You'll need to add this function to your useChatAPI hook
      updateMessages(updatedMessages);
    } catch (error) {
      console.error('Error handling message deletion:', error);
    }
  };

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
      <Navbar currentUser={currentUser} />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="flex-1 flex overflow-hidden"
        style={{ height: 'calc(100vh - 48px)' }}
      >
        <div className="flex w-full h-full">
          <div className="w-80 flex-shrink-0 bg-white border-r border-gray-200">
            <div className="flex flex-col h-full">
              <div className="h-12 min-h-[48px] flex-shrink-0 flex items-center justify-between px-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-800">Chats</h2>
                <button
                  onClick={() => setShowNewChatDialog(true)}
                  className="text-purple-600 hover:text-purple-700 font-medium text-sm"
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
                  newChatUserOptions={registeredUsers.filter(u => u.id !== currentUser?.id)}
                  onStartNewChat={(userId) => {
                    const user = registeredUsers.find(u => u.id === userId);
                    if (user) {
                      setSelectedUser(user);
                      setShowNewChatDialog(false);
                      return true;
                    }
                    return false;
                  }}
                  onRefreshUsers={fetchRegisteredUsers}
                  formatDate={formatDate}
                />
              </div>
            </div>
          </div>
          
          {/* New Chat Dialog */}
          {showNewChatDialog && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg shadow-xl w-96 max-h-[80vh] flex flex-col">
                <div className="p-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-800">New Chat</h3>
                    <button
                      onClick={() => setShowNewChatDialog(false)}
                      className="text-gray-500 hover:text-gray-700"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div className="overflow-y-auto flex-1 p-2">
                  {filteredUsers.length === 0 ? (
                    <p className="text-center text-gray-500 py-4">No users found</p>
                  ) : (
                    <div className="space-y-1">
                      {filteredUsers.map(user => (
                        <button
                          key={user.id}
                          onClick={() => {
                            setSelectedUser(user);
                            setShowNewChatDialog(false);
                            setSearchQuery('');
                          }}
                          className="w-full px-4 py-2 text-left hover:bg-gray-100 rounded-lg transition-colors duration-150"
                        >
                          <div className="flex items-center">
                            <div className="h-8 w-8 rounded-full bg-purple-600 flex items-center justify-center text-white font-semibold">
                              {user.username[0].toUpperCase()}
                            </div>
                            <span className="ml-3 text-gray-800">{user.username}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          
          <div className="flex-1 flex flex-col overflow-hidden">
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
                error={error}
                onMessageDeleted={handleMessageDeleted}
                token={getToken()}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center bg-gray-50">
                <div className="text-center">
                  <h3 className="text-xl font-semibold mb-2 text-gray-800">Welcome to Chat</h3>
                  <p className="text-gray-600 text-sm">Select a conversation or start a new one</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// Wrap with React.memo to prevent unnecessary re-renders
export default React.memo(ChatPage);

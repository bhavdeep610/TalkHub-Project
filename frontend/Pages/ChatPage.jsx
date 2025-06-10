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

const CACHE_EXPIRY = 30 * 60 * 1000; // 30 minutes in milliseconds

/**
 * Main chat page component
 * @returns {JSX.Element} Chat page component
 */
const ChatPage = () => {
  const navigate = useNavigate();
  const { currentUser, isLoading: authLoading, isAuthenticated, error: authError } = useAuth();
  const { 
    selectedUser,
    registeredUsers,
    conversations,
    messages,
    isLoadingMessages,
    isLoadingUsers,
    setSelectedUser,
    fetchRegisteredUsers,
    sendMessage,
    updateMessages,
    startNewConversation
  } = useChatAPI();

  // Add state for new chat dialog
  const [showNewChatDialog, setShowNewChatDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [userProfilePictures, setUserProfilePictures] = useState(() => {
    // Initialize from cache if available
    try {
      const cached = localStorage.getItem('profilePictureCache');
      if (cached) {
        const { pictures, timestamp } = JSON.parse(cached);
        // Check if cache is still valid
        if (Date.now() - timestamp < CACHE_EXPIRY) {
          return pictures;
        }
      }
    } catch (error) {
      console.error('Error reading from cache:', error);
    }
    return {};
  });
  const [loadingPictures, setLoadingPictures] = useState(false);

  // Update cache whenever userProfilePictures changes
  useEffect(() => {
    try {
      localStorage.setItem('profilePictureCache', JSON.stringify({
        pictures: userProfilePictures,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('Error updating cache:', error);
    }
  }, [userProfilePictures]);

  // Fetch profile pictures for users
  const fetchProfilePictures = async (users) => {
    setLoadingPictures(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('No authentication token found');
        return;
      }

      // Filter out users whose pictures we already have in cache
      const usersToFetch = users.filter(user => !userProfilePictures[user.id]);
      
      if (usersToFetch.length === 0) {
        console.log('All profile pictures found in cache');
        setLoadingPictures(false);
        return;
      }

      console.log('Fetching profile pictures for users:', usersToFetch.length);
      const fetchPromises = usersToFetch.map(async (user) => {
        try {
          const response = await API.get(`/ProfilePicture/${user.id}`);
          
          if (response.data) {
            let imageUrl = null;

            if (typeof response.data === 'string') {
              imageUrl = response.data;
            } else if (response.data.imageUrl) {
              imageUrl = response.data.imageUrl;
            } else if (response.data.filePath) {
              imageUrl = response.data.filePath;
            }

            if (imageUrl) {
              if (!imageUrl.startsWith('http')) {
                imageUrl = imageUrl.startsWith('/')
                  ? `http://localhost:5211${imageUrl}`
                  : `http://localhost:5211/${imageUrl}`;
              }
              return { userId: user.id, imageUrl };
            }
          }
          return { userId: user.id, imageUrl: null };
        } catch (error) {
          console.error(`Error fetching profile picture for user ${user.id}:`, error);
          return { userId: user.id, imageUrl: null };
        }
      });

      const results = await Promise.all(fetchPromises);
      const newProfilePictures = results.reduce((acc, { userId, imageUrl }) => {
        if (imageUrl) {
          acc[userId] = imageUrl;
        }
        return acc;
      }, {});

      setUserProfilePictures(prev => ({
        ...prev,
        ...newProfilePictures
      }));
    } catch (error) {
      console.error('Error in fetchProfilePictures:', error);
    } finally {
      setLoadingPictures(false);
    }
  };

  // Memoize filtered users
  const filteredUsers = useMemo(() => {
    return registeredUsers.filter(u => u.id !== currentUser?.id);
  }, [registeredUsers, currentUser]);

  // Memoize the new chat handler
  const handleStartNewChat = useCallback((userId) => {
    return startNewConversation(userId);
  }, [startNewConversation]);

  // Fetch profile pictures when users list changes and not in cache
  useEffect(() => {
    if (showNewChatDialog && filteredUsers.length > 0) {
      const usersWithoutPictures = filteredUsers.filter(user => !userProfilePictures[user.id]);
      if (usersWithoutPictures.length > 0) {
        fetchProfilePictures(usersWithoutPictures);
      }
    }
  }, [showNewChatDialog, filteredUsers]);

  // Clear cache when it expires
  useEffect(() => {
    const clearExpiredCache = () => {
      try {
        const cached = localStorage.getItem('profilePictureCache');
        if (cached) {
          const { timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp >= CACHE_EXPIRY) {
            localStorage.removeItem('profilePictureCache');
            setUserProfilePictures({});
          }
        }
      } catch (error) {
        console.error('Error clearing cache:', error);
      }
    };

    const interval = setInterval(clearExpiredCache, CACHE_EXPIRY);
    return () => clearInterval(interval);
  }, []);

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

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login');
    }
  }, [authLoading, isAuthenticated, navigate]);

  if (authLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  // If there's an auth error, show error message
  if (authError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <h2 className="text-2xl font-semibold text-red-600 mb-4">Authentication Error</h2>
          <p className="text-gray-600">{authError}</p>
          <button
            onClick={() => navigate('/login')}
            className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
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
              <div className="h-12 min-h-[48px] flex-shrink-0 flex items-center justify-between px-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-800">Chats</h2>
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
                  newChatUserOptions={filteredUsers}
                  onStartNewChat={handleStartNewChat}
                  onRefreshUsers={fetchRegisteredUsers}
                  formatDate={formatDate}
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
                token={localStorage.getItem('token')}
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
              {isLoadingUsers || loadingPictures ? (
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
                    <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-purple-600 flex-shrink-0 transform hover:scale-105 transition-transform duration-200">
                      {loadingPictures ? (
                        <div className="w-full h-full bg-gray-100 animate-pulse flex items-center justify-center">
                          <div className="w-5 h-5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      ) : userProfilePictures[user.id] ? (
                        <img 
                          src={userProfilePictures[user.id]}
                          alt={`${user.username}'s profile`}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            console.error(`Error loading image for user ${user.username}:`, e);
                            e.target.onerror = null;
                            setUserProfilePictures(prev => ({
                              ...prev,
                              [user.id]: null
                            }));
                          }}
                        />
                      ) : (
                        <div className="w-full h-full bg-purple-100 flex items-center justify-center">
                          <span className="text-sm font-medium text-purple-600">
                      {user.username[0].toUpperCase()}
                          </span>
                        </div>
                      )}
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

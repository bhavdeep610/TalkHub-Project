import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import API from '../src/services/api';
import { useNavigate } from 'react-router-dom';
import ChatSidebar from '../components/ChatSidebar';
import ChatWindow from '../components/chatWindow';
import Header from '../components/Header';
import { useAuth } from '../hooks/useAuth';
import { useChatAPI } from '../hooks/useChatAPI';
import { motion } from 'framer-motion';

const CACHE_EXPIRY = 30 * 60 * 1000; 

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
    updateMessages
  } = useChatAPI();

  const [showNewChatDialog, setShowNewChatDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [userProfilePictures, setUserProfilePictures] = useState(() => {
    try {
      const cached = localStorage.getItem('profilePictureCache');
      if (cached) {
        const { pictures, timestamp } = JSON.parse(cached);
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
  const profilePictureFetchTimeoutRef = useRef(null);
  const [dialogLoading, setDialogLoading] = useState(false);
  const [hasInitiallyFetched, setHasInitiallyFetched] = useState(false);
  const initialFetchRef = useRef(false);

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

  const fetchProfilePictures = async (users) => {
    if (!users || users.length === 0) return;
    
    setLoadingPictures(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('No authentication token found');
        return;
      }

      const usersToFetch = users.filter(user => !userProfilePictures[user.id]);
      
      if (usersToFetch.length === 0) {
        console.log('All profile pictures found in cache');
        return;
      }

      const results = await Promise.allSettled(
        usersToFetch.map(async (user) => {
          try {
            const response = await API.get(`/ProfilePicture/${user.id}`);
            let imageUrl = null;

            if (response.data) {
              if (typeof response.data === 'string') {
                imageUrl = response.data;
              } else if (response.data.imageUrl) {
                imageUrl = response.data.imageUrl;
              } else if (response.data.filePath) {
                imageUrl = response.data.filePath;
              }

              if (imageUrl && !imageUrl.startsWith('http')) {
                imageUrl = imageUrl.startsWith('/')
                  ? `${window.location.origin}${imageUrl}`
                  : `${window.location.origin}/${imageUrl}`;
              }
            }
            return { userId: user.id, imageUrl };
          } catch (error) {
            console.error(`Error fetching profile picture for user ${user.id}:`, error);
            return { userId: user.id, imageUrl: null };
          }
        })
      );

      const newProfilePictures = results.reduce((acc, result) => {
        if (result.status === 'fulfilled' && result.value.imageUrl) {
          acc[result.value.userId] = result.value.imageUrl;
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

  const filteredUsers = useMemo(() => {
    if (!registeredUsers || !currentUser) return [];
    const users = searchQuery 
      ? registeredUsers.filter(u => 
          u.id !== currentUser.id && 
          u.username.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : registeredUsers.filter(u => u.id !== currentUser.id);
    return users;
  }, [registeredUsers, searchQuery, currentUser?.id]);

  const debouncedFetchProfilePictures = useCallback((users) => {
    if (profilePictureFetchTimeoutRef.current) {
      clearTimeout(profilePictureFetchTimeoutRef.current);
    }
    
    profilePictureFetchTimeoutRef.current = setTimeout(() => {
      fetchProfilePictures(users);
    }, 1000); // 1 second debounce
  }, []);

  useEffect(() => {
    if (showNewChatDialog && filteredUsers.length > 0) {
      const usersWithoutPictures = filteredUsers.filter(user => !userProfilePictures[user.id]);
      if (usersWithoutPictures.length > 0) {
        debouncedFetchProfilePictures(usersWithoutPictures);
      }
    }

    return () => {
      if (profilePictureFetchTimeoutRef.current) {
        clearTimeout(profilePictureFetchTimeoutRef.current);
      }
    };
  }, [showNewChatDialog, filteredUsers, userProfilePictures, debouncedFetchProfilePictures]);

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

  const formatTime = useCallback((timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, []);

  const formatDate = useCallback((timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleDateString();
  }, []);

  const handleMessageDeleted = useCallback((messageId) => {
    updateMessages(prev => prev.filter(m => (m.id || m.Id) !== messageId));
  }, [updateMessages]);

  const handleUserSelect = useCallback((user) => {
    if (user) {
      setSelectedUser(user);
      setShowNewChatDialog(false);
    }
  }, [setSelectedUser]);

  useEffect(() => {
    let mounted = true;

    const checkAuth = async () => {
      if (!authLoading && mounted) {
        if (!isAuthenticated) {
          console.log('Not authenticated, redirecting to login...');
          navigate('/login', { replace: true });
          return;
        }

        if (isAuthenticated && currentUser) {
          await fetchRegisteredUsers();
        }
      }
    };

    checkAuth();

    return () => {
      mounted = false;
    };
  }, [authLoading, isAuthenticated, currentUser, navigate, fetchRegisteredUsers]);

  useEffect(() => {
    if (conversations.length > 0) {
      const users = conversations.map(conv => conv.user);
      fetchProfilePictures(users);
    }
  }, [conversations]);

  useEffect(() => {
    if (showNewChatDialog && !initialFetchRef.current) {
      const fetchUsers = async () => {
        setDialogLoading(true);
        try {
          await fetchRegisteredUsers();
          initialFetchRef.current = true;
          setHasInitiallyFetched(true);
        } finally {
          setDialogLoading(false);
        }
      };
      fetchUsers();
    }

    if (!showNewChatDialog) {
      initialFetchRef.current = false;
    }
  }, [showNewChatDialog, fetchRegisteredUsers]);

  const NewChatDialog = useMemo(() => {
    if (!showNewChatDialog) return null;

    const isLoading = dialogLoading && !hasInitiallyFetched;
    const showEmptyState = !isLoading && filteredUsers.length === 0;
    const showUserList = !isLoading && filteredUsers.length > 0;

    return (
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
                disabled={isLoading}
              />
            </div>
          </div>
          <div className="overflow-y-auto flex-1 p-2">
            {isLoading ? (
              <div className="flex justify-center items-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-purple-500"></div>
              </div>
            ) : showEmptyState ? (
              <div className="text-center py-4 text-gray-500">
                {searchQuery ? 'No users found' : 'Start typing to search users'}
              </div>
            ) : showUserList && (
              <div className="space-y-2">
                {filteredUsers.map(user => (
                  <div
                    key={user.id}
                    onClick={() => handleUserSelect(user)}
                    className="flex items-center p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors duration-200"
                  >
                    <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-purple-600 flex-shrink-0 transform hover:scale-105 transition-transform duration-200">
                      {userProfilePictures[user.id] ? (
                        <img 
                          src={userProfilePictures[user.id]}
                          alt={`${user.username}'s profile`}
                          className="w-full h-full object-cover"
                          loading="lazy"
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
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }, [
    showNewChatDialog,
    dialogLoading,
    hasInitiallyFetched,
    searchQuery,
    filteredUsers,
    userProfilePictures,
    handleUserSelect
  ]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (!isAuthenticated || !currentUser) {
    return null;
  }

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
          <div className="w-80 flex-shrink-0 bg-white border-r border-gray-200">
            <div className="flex flex-col h-full">
              <div className="flex-1 overflow-hidden">
                <ChatSidebar
                  currentUser={currentUser}
                  users={registeredUsers}
                  conversations={conversations}
                  selectedUser={selectedUser}
                  onSelectUser={handleUserSelect}
                  isLoadingUsers={isLoadingUsers}
                  newChatUserOptions={filteredUsers}
                  onStartNewChat={() => setShowNewChatDialog(true)}
                  onRefreshUsers={fetchRegisteredUsers}
                  formatDate={formatDate}
                  hideHeader={false}
                  userProfilePictures={userProfilePictures}
                  loadingPictures={loadingPictures}
                />
              </div>
            </div>
          </div>

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
        {NewChatDialog}
      </motion.div>
    </div>
  );
};

export default React.memo(ChatPage);


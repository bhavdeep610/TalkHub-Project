import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import API from '../src/services/api';
import { profilePictureService } from '../src/services/profilePictureService';
import signalRService from '../src/services/signalRService';

/**
 * ChatSidebar component for displaying and managing conversations
 * @param {Object} props - Component props
 * @returns {JSX.Element} ChatSidebar component
 */
const ChatSidebar = ({ 
  conversations = [], 
  selectedUser, 
  registeredUsers = [], 
  newChatUserOptions = [],
  isLoadingUsers = false,
  onSelectUser, 
  onStartNewChat = () => {},
  onRefreshUsers = () => {},
  formatDate = (date) => new Date(date).toLocaleDateString(),
  onConversationUpdate = () => {} // Add callback for conversation updates
}) => {
  const [showUserList, setShowUserList] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [userProfilePictures, setUserProfilePictures] = useState({});
  const [loadingPictures, setLoadingPictures] = useState(false);
  const [error, setError] = useState(null);
  const retryTimeoutRef = useRef(null);
  const lastFetchTimeRef = useRef(0);
  const FETCH_COOLDOWN = 60000; // 1 minute cooldown between fetches

  // Subscribe to SignalR conversation updates
  useEffect(() => {
    const unsubscribe = signalRService.onConversationUpdate((updatedConversation) => {
      onConversationUpdate(updatedConversation);
    });

    return () => unsubscribe();
  }, [onConversationUpdate]);

  // Fetch profile pictures with retry logic and cooldown
  const fetchProfilePictures = useCallback(async (retryCount = 0) => {
    const now = Date.now();
    if (now - lastFetchTimeRef.current < FETCH_COOLDOWN) {
      return; // Skip if within cooldown period
    }

    if (retryCount > 3) {
      setError('Failed to load profile pictures. Please try again later.');
      return;
    }

    setLoadingPictures(true);
    try {
      const userIds = [
        ...conversations.map(c => c.user.id),
        ...(newChatUserOptions || []).map(u => u.id)
      ];
      const uniqueUserIds = [...new Set(userIds)];
      
      // Only fetch for users whose pictures are not in cache
      const uncachedUserIds = uniqueUserIds.filter(id => !userProfilePictures[id]);
      
      if (uncachedUserIds.length === 0) {
        setLoadingPictures(false);
        return;
      }

      const pictures = await profilePictureService.getProfilePictures(uncachedUserIds);
      setUserProfilePictures(prev => ({
        ...prev,
        ...pictures
      }));
      setError(null);
      lastFetchTimeRef.current = now;
    } catch (error) {
      console.error('Error in fetchProfilePictures:', error);
      
      if (error.isNetworkError || error.isTimeout) {
        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current);
        }
        retryTimeoutRef.current = setTimeout(() => {
          fetchProfilePictures(retryCount + 1);
        }, 2000 * (retryCount + 1));
      } else {
        setError('Failed to load profile pictures. Please try again later.');
      }
    } finally {
      setLoadingPictures(false);
    }
  }, [conversations, newChatUserOptions, userProfilePictures]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  // Only fetch profile pictures when user list changes or cache is empty
  useEffect(() => {
    const userIds = [
      ...conversations.map(c => c.user.id),
      ...(newChatUserOptions || []).map(u => u.id)
    ];
    const uniqueUserIds = [...new Set(userIds)];
    const hasUncachedUsers = uniqueUserIds.some(id => !userProfilePictures[id]);

    if (hasUncachedUsers) {
      fetchProfilePictures();
    }
  }, [conversations, newChatUserOptions, userProfilePictures, fetchProfilePictures]);

  // Memoize conversation list to prevent unnecessary re-renders
  const conversationList = useMemo(() => {
    return conversations.map(conversation => {
      const user = conversation.user;
      const lastMessage = conversation.lastMessage;
      const hasMessages = conversation.hasMessages;
      const isSelected = selectedUser && selectedUser.id === user.id;
      const profilePicture = userProfilePictures[user.id];
      
      return (
        <div 
          key={user.id} 
          className={`flex items-center px-6 py-3 cursor-pointer ${
            isSelected ? 'bg-purple-50' : 'hover:bg-gray-50'
          } transition-colors duration-200`}
          onClick={() => handleSelectConversation(conversation)}
        >
          <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-purple-600 flex-shrink-0">
            {loadingPictures && !profilePicture ? (
              <div className="w-full h-full bg-gray-100 animate-pulse flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : profilePicture ? (
              <img 
                src={profilePicture}
                alt={`${user.username}'s profile`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full bg-purple-100 flex items-center justify-center">
                <span className="text-sm font-medium text-purple-600">
                  {user.username.substring(0, 1).toUpperCase()}
                </span>
              </div>
            )}
          </div>
          <div className="ml-3 flex-grow min-w-0">
            <p className="font-medium text-gray-900 truncate">{user.username}</p>
            <div className="h-5"> {/* Fixed height container for message preview */}
              {hasMessages && lastMessage ? (
                <p className="text-sm text-gray-500 truncate">
                  {lastMessage.content || lastMessage.Content}
                </p>
              ) : (
                <p className="text-xs text-gray-400">No messages yet</p>
              )}
            </div>
          </div>
        </div>
      );
    });
  }, [conversations, selectedUser, userProfilePictures, loadingPictures]);

  // Memoize user list to prevent unnecessary re-renders
  const userList = useMemo(() => {
    return (newChatUserOptions || []).map(user => {
      const profilePicture = userProfilePictures[user.id];
      
      return (
        <div 
          key={user.id} 
          className="flex items-center px-6 py-3 cursor-pointer hover:bg-gray-50 transition-colors duration-200"
          onClick={() => handleStartChat(user.id)}
        >
          <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-purple-600 flex-shrink-0">
            {loadingPictures && !profilePicture ? (
              <div className="w-full h-full bg-gray-100 animate-pulse flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : profilePicture ? (
              <img 
                src={profilePicture}
                alt={`${user.username}'s profile`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full bg-purple-100 flex items-center justify-center">
                <span className="text-sm font-medium text-purple-600">
                  {user.username.substring(0, 1).toUpperCase()}
                </span>
              </div>
            )}
          </div>
          <div className="ml-3">
            <p className="font-medium text-gray-900">{user.username}</p>
          </div>
        </div>
      );
    });
  }, [newChatUserOptions, userProfilePictures, loadingPictures]);

  // Select a conversation
  const handleSelectConversation = useCallback((conversation) => {
    if (!selectedUser || conversation.user.id !== selectedUser.id) {
      setSelectedConversation(conversation);
      onSelectUser(conversation.user);
    }
  }, [selectedUser, onSelectUser]);

  // Start a new chat with a user
  const handleStartChat = useCallback((userId) => {
    if (onStartNewChat(userId)) {
      setShowUserList(false);
    }
  }, [onStartNewChat]);

  // Memoize the refresh handler to prevent unnecessary re-renders
  const handleRefresh = useCallback(() => {
    onRefreshUsers();
    const now = Date.now();
    if (now - lastFetchTimeRef.current >= FETCH_COOLDOWN) {
      fetchProfilePictures();
    }
  }, [onRefreshUsers, fetchProfilePictures]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">
      {error && (
        <div className="bg-red-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
            <div className="ml-auto pl-3">
              <div className="-mx-1.5 -my-1.5">
                <button
                  onClick={() => {
                    setError(null);
                    fetchProfilePictures();
                  }}
                  className="inline-flex rounded-md p-1.5 text-red-500 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  <span className="sr-only">Retry</span>
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showUserList ? (
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 hover:scrollbar-thumb-gray-500 scrollbar-track-gray-100">
          <div className="py-2">
            <div className="flex items-center justify-between px-6 mb-2">
              <button
                onClick={() => setShowUserList(false)}
                className="text-gray-600 hover:text-gray-900 transition-colors duration-200"
              >
                ← Back
              </button>
              <button
                onClick={handleRefresh}
                className="text-sm text-purple-600 hover:text-purple-700 transition-colors duration-200 flex items-center gap-2"
                disabled={isLoadingUsers || loadingPictures}
              >
                {(isLoadingUsers || loadingPictures) && (
                  <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                )}
                {isLoadingUsers || loadingPictures ? 'Loading...' : 'Refresh'}
              </button>
            </div>
            <div className="max-h-[calc(100vh-120px)] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 hover:scrollbar-thumb-gray-500 scrollbar-track-gray-100">
              {isLoadingUsers ? (
                <div className="px-6 py-4 text-center text-gray-500">Loading users...</div>
              ) : (
                userList.length > 0 ? userList : (
                  <div className="px-6 py-4 text-center text-gray-500">No users found</div>
                )
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 hover:scrollbar-thumb-gray-500 scrollbar-track-gray-100">
          <div className="py-2">
            <button
              onClick={() => setShowUserList(true)}
              className="w-full px-6 py-3 text-left text-purple-600 hover:text-purple-700 transition-colors duration-200"
            >
              Start a new conversation
            </button>
            {conversationList.length > 0 ? (
              <div className="py-2">
                {conversationList}
              </div>
            ) : (
              <div className="px-6 py-4 text-center text-gray-500">
                <p>No conversations yet</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

ChatSidebar.propTypes = {
  conversations: PropTypes.array,
  selectedUser: PropTypes.object,
  registeredUsers: PropTypes.array,
  newChatUserOptions: PropTypes.array,
  isLoadingUsers: PropTypes.bool,
  onSelectUser: PropTypes.func.isRequired,
  onStartNewChat: PropTypes.func,
  onRefreshUsers: PropTypes.func,
  formatDate: PropTypes.func,
  onConversationUpdate: PropTypes.func
};

// Wrap with React.memo to prevent unnecessary re-renders
export default React.memo(ChatSidebar); 
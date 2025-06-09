import React, { useState, useCallback, useMemo, useEffect } from 'react';
import PropTypes from 'prop-types';
import API from '../src/services/api';
import { profilePictureService } from '../src/services/profilePictureService';

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
  formatDate = (date) => new Date(date).toLocaleDateString() 
}) => {
  const [showUserList, setShowUserList] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [userProfilePictures, setUserProfilePictures] = useState({});
  const [loadingPictures, setLoadingPictures] = useState(false);

  // Fetch profile pictures for all users
  const fetchProfilePictures = async () => {
    setLoadingPictures(true);
    try {
      const userIds = [
        ...conversations.map(c => c.user.id),
        ...(newChatUserOptions || []).map(u => u.id)
      ];
      const uniqueUserIds = [...new Set(userIds)];
      
      const pictures = await profilePictureService.getProfilePictures(uniqueUserIds);
      setUserProfilePictures(pictures);
    } catch (error) {
      console.error('Error in fetchProfilePictures:', error);
    } finally {
      setLoadingPictures(false);
    }
  };

  useEffect(() => {
    if (conversations.length > 0 || newChatUserOptions.length > 0) {
      fetchProfilePictures();
    }
  }, [conversations, newChatUserOptions]);

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
          <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-purple-600 flex-shrink-0 transform hover:scale-105 transition-transform duration-200">
            {profilePicture ? (
              <img 
                src={profilePicture} 
                alt={`${user.username}'s profile`}
                className="w-full h-full object-cover"
                onError={(e) => {
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
  }, [conversations, selectedUser, userProfilePictures]);

  // Memoize user list to prevent unnecessary re-renders
  const userList = useMemo(() => {
    return (newChatUserOptions || []).map(user => {
      const profilePicture = userProfilePictures[user.id];
      console.log(`User ${user.username} (${user.id}) profile picture:`, profilePicture);
      
      return (
        <div 
          key={user.id} 
          className="flex items-center px-6 py-3 cursor-pointer hover:bg-gray-50 transition-colors duration-200"
          onClick={() => handleStartChat(user.id)}
        >
          <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-purple-600 flex-shrink-0 transform hover:scale-105 transition-transform duration-200">
            {loadingPictures ? (
              <div className="w-full h-full bg-gray-100 animate-pulse flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : profilePicture ? (
              <img 
                src={profilePicture}
                alt={`${user.username}'s profile`}
                className="w-full h-full object-cover"
                onLoad={() => console.log(`Image loaded successfully for user ${user.username}`)}
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

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">
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
                onClick={() => {
                  onRefreshUsers();
                  fetchProfilePictures();
                }}
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
          {conversationList.length > 0 ? (
            <div className="py-2">
              {conversationList}
            </div>
          ) : (
            <div className="px-6 py-4 text-center text-gray-500">
              <p>No conversations yet</p>
              <button 
                onClick={() => setShowUserList(true)}
                className="mt-2 text-sm text-purple-600 hover:text-purple-700 transition-colors duration-200"
              >
                Start a conversation
              </button>
            </div>
          )}
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
  formatDate: PropTypes.func
};

// Wrap with React.memo to prevent unnecessary re-renders
export default React.memo(ChatSidebar); 
import React, { useState, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';

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

  // Memoize conversation list to prevent unnecessary re-renders
  const conversationList = useMemo(() => {
    return conversations.map(conversation => {
      const user = conversation.user;
      const lastMessage = conversation.lastMessage;
      const hasMessages = conversation.hasMessages;
      const isSelected = selectedUser && selectedUser.id === user.id;
      
      return (
        <div 
          key={user.id} 
          className={`flex items-center px-6 py-3 cursor-pointer ${
            isSelected ? 'bg-purple-50' : 'hover:bg-gray-50'
          }`}
          onClick={() => handleSelectConversation(conversation)}
        >
          <div className="h-10 w-10 rounded-full bg-purple-600 flex-shrink-0 flex items-center justify-center text-white font-semibold">
            {user.username.substring(0, 1).toUpperCase()}
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
  }, [conversations, selectedUser]);

  // Memoize user list to prevent unnecessary re-renders
  const userList = useMemo(() => {
    return (newChatUserOptions || []).map(user => (
      <div 
        key={user.id} 
        className="flex items-center px-6 py-3 cursor-pointer hover:bg-gray-50"
        onClick={() => handleStartChat(user.id)}
      >
        <div className="h-10 w-10 rounded-full bg-purple-600 flex items-center justify-center text-white font-semibold">
          {user.username.substring(0, 1).toUpperCase()}
        </div>
        <div className="ml-3">
          <p className="font-medium text-gray-900">{user.username}</p>
        </div>
      </div>
    ));
  }, [newChatUserOptions]);

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
    <div className="flex-1 flex flex-col overflow-hidden">
      {showUserList ? (
        <div className="flex-1 overflow-y-auto">
          <div className="py-2">
            <div className="flex items-center justify-between px-6 mb-2">
              <button
                onClick={() => setShowUserList(false)}
                className="text-gray-600 hover:text-gray-900"
              >
                ← Back
              </button>
              <button
                onClick={onRefreshUsers}
                className="text-sm text-purple-600 hover:text-purple-700"
                disabled={isLoadingUsers}
              >
                {isLoadingUsers ? 'Loading...' : 'Refresh'}
              </button>
            </div>
            {isLoadingUsers ? (
              <div className="px-6 py-4 text-center text-gray-500">Loading users...</div>
            ) : (
              userList.length > 0 ? userList : (
                <div className="px-6 py-4 text-center text-gray-500">No users found</div>
              )
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {conversationList.length > 0 ? (
            <div className="py-2">
              {conversationList}
            </div>
          ) : (
            <div className="px-6 py-4 text-center text-gray-500">
              <p>No conversations yet</p>
              <button 
                onClick={() => setShowUserList(true)}
                className="mt-2 text-sm text-purple-600 hover:text-purple-700"
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
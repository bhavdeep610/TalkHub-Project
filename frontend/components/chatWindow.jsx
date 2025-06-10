import React, { useState, useRef, useEffect, useMemo, memo, useCallback } from 'react';
import PropTypes from 'prop-types';
import API from '../src/services/api';
import { toast, Toaster } from 'react-hot-toast';
import { useSignalR } from '../src/hooks/useSignalR';
import signalRService from '../src/services/signalRService';
import { profilePictureService } from '../src/services/profilePictureService';

// Create a stable time formatter
const createTimeFormatter = () => {
  const cache = new Map();
  const formatter = new Intl.DateTimeFormat('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  return (timestamp) => {
    if (!timestamp) return '';
    const cacheKey = String(timestamp);
    
    if (cache.has(cacheKey)) {
      return cache.get(cacheKey);
    }

    try {
      const date = new Date(timestamp);
      // Add IST offset (5 hours and 30 minutes)
      date.setMinutes(date.getMinutes() + 330);
      const formatted = formatter.format(date);
      cache.set(cacheKey, formatted);
      return formatted;
    } catch (error) {
      console.error('Error formatting time:', error);
      return '';
    }
  };
};

// Memoized Message Timestamp component
const MessageTimestamp = memo(({ timestamp, isCurrentUser }) => {
  const timeFormatter = useMemo(() => createTimeFormatter(), []);
  const formattedTime = useMemo(() => {
    return timeFormatter(timestamp);
  }, [timestamp, timeFormatter]);

  return (
    <p
      className={`text-[10px] mt-0.5 ${
        isCurrentUser ? 'text-purple-200' : 'text-gray-500'
      }`}
    >
      {formattedTime}
    </p>
  );
});

MessageTimestamp.displayName = 'MessageTimestamp';

// Memoized Message Content component
const MessageContent = memo(({ content }) => (
  <p className="break-words text-sm">{content}</p>
));

MessageContent.displayName = 'MessageContent';

// Memoized Message Bubble component
const MessageBubble = memo(({
  messageId,
  content,
  timestamp,
  isCurrentUser,
  isEditing,
  editMessageContent,
  setEditMessageContent,
  handleEditMessage,
  startEditing,
  cancelEditing,
  handleDeleteMessage,
  editInputRef,
  selectedUser,
  profilePicture
}) => {
  return (
    <div className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'} items-end space-x-2`}>
      {!isCurrentUser && (
        profilePicture ? (
          <img 
            src={profilePicture} 
            alt={`${selectedUser.username}'s profile`}
            className="h-6 w-6 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div className="h-6 w-6 rounded-full bg-purple-600 flex-shrink-0 flex items-center justify-center text-white text-xs">
            {selectedUser.username[0].toUpperCase()}
          </div>
        )
      )}
      
      <div className="group relative">
        <div
          className={`max-w-[180%] rounded-xl px-3 py-1.5 ${
            isCurrentUser
              ? 'bg-purple-600 text-white rounded-br-none'
              : 'bg-white text-gray-800 rounded-bl-none shadow-sm'
          }`}
        >
          {isEditing ? (
            <div className="flex flex-col space-y-2">
              <input
                ref={editInputRef}
                type="text"
                value={editMessageContent}
                onChange={(e) => setEditMessageContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleEditMessage(messageId);
                  } else if (e.key === 'Escape') {
                    cancelEditing();
                  }
                }}
                className="w-full px-2 py-1 text-sm text-gray-800 bg-white rounded border border-gray-300 focus:outline-none focus:border-purple-500"
              />
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => handleEditMessage(messageId)}
                  className="text-xs text-green-500 hover:text-green-600"
                >
                  Save
                </button>
                <button
                  onClick={cancelEditing}
                  className="text-xs text-gray-500 hover:text-gray-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <MessageContent content={content} />
              <MessageTimestamp timestamp={timestamp} isCurrentUser={isCurrentUser} />
            </>
          )}
        </div>

        {/* Message Actions */}
        {isCurrentUser && !isEditing && (
          <div className="absolute bottom-full right-0 mb-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex space-x-2">
            <button
              onClick={() => startEditing(messageId, content)}
              className="text-xs bg-white text-gray-600 hover:text-blue-500 px-2 py-1 rounded shadow-sm transition-colors duration-200"
            >
              Edit
            </button>
            <button
              onClick={() => handleDeleteMessage(messageId)}
              className="text-xs bg-white text-gray-600 hover:text-red-500 px-2 py-1 rounded shadow-sm transition-colors duration-200"
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

MessageBubble.displayName = 'MessageBubble';

// Memoized Message List component to prevent unnecessary re-renders
const MessageList = memo(({ messages, currentUser, selectedUser, editingMessageId, editMessageContent, setEditMessageContent, handleEditMessage, startEditing, cancelEditing, handleDeleteMessage, editInputRef, selectedUserProfilePicture, currentUserProfilePicture }) => {
  const stableMessages = useMemo(() => messages, [messages]);

  return (
    <>
      {stableMessages.map((message) => (
        <MessageBubble
          key={`${message.id}-${message.timestamp}`}
          messageId={message.id}
          content={message.content}
          timestamp={message.timestamp}
          isCurrentUser={message.senderId === currentUser?.id}
          isEditing={message.id === editingMessageId}
          editMessageContent={editMessageContent}
          setEditMessageContent={setEditMessageContent}
          handleEditMessage={handleEditMessage}
          startEditing={(messageId, content) => {
            setEditingMessageId(messageId);
            setEditMessageContent(content);
          }}
          cancelEditing={() => {
            setEditingMessageId(null);
            setEditMessageContent('');
          }}
          handleDeleteMessage={handleDeleteMessage}
          editInputRef={editInputRef}
          selectedUser={selectedUser}
          profilePicture={message.senderId === currentUser?.id ? currentUserProfilePicture : selectedUserProfilePicture}
        />
      ))}
    </>
  );
});

MessageList.displayName = 'MessageList';

const ChatWindow = ({
  selectedUser,
  messages,
  currentUser,
  isLoadingMessages,
  hasNewMessages,
  status,
  onSendMessage,
  formatTime,
  formatDate,
  setHasNewMessages,
  onMessageDeleted,
  token
}) => {
  const [newMessage, setNewMessage] = useState('');
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editMessageContent, setEditMessageContent] = useState('');
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [selectedUserProfilePicture, setSelectedUserProfilePicture] = useState(null);
  const [currentUserProfilePicture, setCurrentUserProfilePicture] = useState(null);
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const editInputRef = useRef(null);
  const scrollTimeoutRef = useRef(null);
  const previousMessagesRef = useRef(messages);
  const messageUpdateTimeoutRef = useRef(null);

  // Fetch profile pictures when users change
  useEffect(() => {
    const fetchProfilePictures = async () => {
      if (!selectedUser || !currentUser) return;

      const pictures = await profilePictureService.getProfilePictures([selectedUser.id, currentUser.id]);
      setSelectedUserProfilePicture(pictures[selectedUser.id]);
      setCurrentUserProfilePicture(pictures[currentUser.id]);
    };

    fetchProfilePictures();
  }, [selectedUser?.id, currentUser?.id]);

  // Initialize SignalR with proper connection handling
  const { sendMessage, connectionState, connectionError, isConnecting } = useSignalR(token, (message) => {
    // Handle incoming messages
    if (message.senderId === selectedUser?.id || message.senderId === currentUser?.id) {
      onSendMessage(message);
      if (!shouldAutoScroll) {
        setHasNewMessages(true);
      }
    }
  });

  // Monitor SignalR connection status
  useEffect(() => {
    let mounted = true;

    const handleConnectionChange = ({ status, error }) => {
      if (!mounted) return;
      
      console.log('[ChatWindow] SignalR connection status changed:', status);
      
      setConnectionStatus(status);
      if (status === 'error' && error) {
        toast.error(`Connection error: ${error?.message || 'Unknown error'}`, {
          duration: 3000,
          position: 'top-center',
        });
      } else if (status === 'disconnecting') {
        toast('Disconnecting from chat...', {
          duration: 1500,
          position: 'top-center',
          icon: '🔄'
        });
      } else if (status === 'reconnecting') {
        toast('Reconnecting to chat...', {
          duration: 2000,
          position: 'top-center',
          icon: '🔄'
        });
      } else if (status === 'connected') {
        toast.success('Connected to chat', {
          duration: 2000,
          position: 'top-center',
          icon: '✅'
        });
      }
    };

    const unsubscribe = signalRService.onConnectionChange(handleConnectionChange);

    // Set initial connection status
    if (signalRService.connection?.connectionStarted) {
      setConnectionStatus('connected');
    } else {
      setConnectionStatus('connecting');
    }

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  // Memoize the grouped messages
  const groupedMessages = useMemo(() => {
    const groups = new Map();
    
    messages.forEach(message => {
      const date = new Date(message.timestamp || message.created || message.Created);
      date.setHours(0, 0, 0, 0);
      const dateKey = date.getTime();
      
      if (!groups.has(dateKey)) {
        groups.set(dateKey, []);
      }
      groups.get(dateKey).push(message);
    });
    
    return Array.from(groups.entries()).sort((a, b) => a[0] - b[0]);
  }, [messages]);

  // Memoize the time formatter
  const getFormattedTime = useMemo(() => {
    const timeCache = new Map();
    
    return (timestamp) => {
      if (!timestamp) return '';
      
      const cacheKey = String(timestamp);
      if (timeCache.has(cacheKey)) {
        return timeCache.get(cacheKey);
      }
      
      try {
        const formatted = formatTime(new Date(timestamp));
        timeCache.set(cacheKey, formatted);
        return formatted;
      } catch (error) {
        console.error('Error formatting time:', error);
        return '';
      }
    };
  }, [formatTime]);

  // Stable message handlers
  const handleEditMessage = useCallback(async (messageId) => {
    if (!editMessageContent.trim()) return;
    try {
      // Optimistic update
      const messageToUpdate = messages.find(m => m.id === messageId);
      if (!messageToUpdate) return;

      const updatedMessage = { ...messageToUpdate, content: editMessageContent };
      const updatedMessages = messages.map(m => m.id === messageId ? updatedMessage : m);
      onSendMessage(updatedMessages);

      await API.put(`/api/chat/messages/${messageId}`, { content: editMessageContent });
      setEditingMessageId(null);
      setEditMessageContent('');
    } catch (error) {
      console.error('Failed to edit message:', error);
      toast.error('Failed to edit message');
    }
  }, [editMessageContent, messages, onSendMessage]);

  const handleDeleteMessage = useCallback(async (messageId) => {
    try {
      // Optimistic update
      const updatedMessages = messages.filter(m => m.id !== messageId);
      onMessageDeleted(updatedMessages);

      await API.delete(`/api/chat/messages/${messageId}`);
    } catch (error) {
      console.error('Failed to delete message:', error);
      toast.error('Failed to delete message');
    }
  }, [messages, onMessageDeleted]);

  // Optimized scroll handling
  const scrollToBottom = useCallback((force = false) => {
    if (!messagesEndRef.current || !chatContainerRef.current) return;

    const container = chatContainerRef.current;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;

    if (force || isNearBottom || !isUserScrolling) {
      if (messageUpdateTimeoutRef.current) {
        clearTimeout(messageUpdateTimeoutRef.current);
      }

      messageUpdateTimeoutRef.current = setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({
          behavior: force ? 'auto' : 'smooth',
          block: 'end'
        });
      }, 50);
    }
  }, [isUserScrolling]);

  // Handle message updates with debouncing
  useEffect(() => {
    if (messages !== previousMessagesRef.current) {
      previousMessagesRef.current = messages;
      if (messageUpdateTimeoutRef.current) {
        clearTimeout(messageUpdateTimeoutRef.current);
      }
      messageUpdateTimeoutRef.current = setTimeout(() => {
        scrollToBottom(true);
      }, 50);
    }
  }, [messages, scrollToBottom]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (messageUpdateTimeoutRef.current) {
        clearTimeout(messageUpdateTimeoutRef.current);
      }
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  const handleScroll = useCallback(() => {
    if (!chatContainerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;

    setIsUserScrolling(!isAtBottom);
    setShouldAutoScroll(isAtBottom);

    if (isAtBottom) {
      setHasNewMessages(false);
    }
  }, [setHasNewMessages]);

  if (!selectedUser) {
    return null;
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Chat Header */}
      <div className="flex items-center px-6 py-3 border-b border-gray-200 bg-white">
        <div className="flex items-center flex-1">
          {selectedUser.profilePicture || selectedUserProfilePicture ? (
            <img 
              src={selectedUser.profilePicture || selectedUserProfilePicture} 
              alt={selectedUser.username}
              className="w-10 h-10 rounded-full object-cover border-2 border-purple-500"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white font-semibold border-2 border-purple-500">
              {selectedUser.username[0].toUpperCase()}
            </div>
          )}
          <div className="ml-3">
            <h2 className="text-lg font-semibold text-gray-900">{selectedUser.username}</h2>
            <p className="text-sm text-gray-500">
              {connectionStatus === 'connected' ? 'Online' : 'Connecting...'}
            </p>
          </div>
        </div>
      </div>

      {/* Chat Messages */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 bg-white scrollbar-thin scrollbar-thumb-purple-500 scrollbar-track-gray-100"
        onScroll={handleScroll}
      >
        {isLoadingMessages ? (
          <div className="flex justify-center items-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        ) : (
          <MessageList
            messages={messages}
            currentUser={currentUser}
            selectedUser={selectedUser}
            editingMessageId={editingMessageId}
            editMessageContent={editMessageContent}
            setEditMessageContent={setEditMessageContent}
            handleEditMessage={handleEditMessage}
            startEditing={(messageId, content) => {
              setEditingMessageId(messageId);
              setEditMessageContent(content);
            }}
            cancelEditing={() => {
              setEditingMessageId(null);
              setEditMessageContent('');
            }}
            handleDeleteMessage={handleDeleteMessage}
            editInputRef={editInputRef}
            selectedUserProfilePicture={selectedUserProfilePicture}
            currentUserProfilePicture={currentUserProfilePicture}
          />
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="px-4 py-3 border-t border-gray-200 bg-white">
        <form onSubmit={async (e) => {
          e.preventDefault();
          if (!newMessage.trim()) return;

          try {
            await sendMessage(selectedUser.id, newMessage.trim());
            setNewMessage('');
            scrollToBottom(true);
          } catch (error) {
            console.error('Failed to send message:', error);
            toast.error('Failed to send message');
          }
        }}>
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 rounded-full border border-gray-300 px-4 py-2 focus:outline-none focus:border-purple-500"
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || connectionStatus !== 'connected'}
              className="bg-purple-600 text-white rounded-full p-2 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                <path d="M3.478 2.404a.75.75 0 00-.926.941l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.404z" />
              </svg>
            </button>
          </div>
        </form>
      </div>

      {/* New Messages Notification */}
      {hasNewMessages && !shouldAutoScroll && (
        <button
          onClick={() => {
            scrollToBottom(true);
            setHasNewMessages(false);
          }}
          className="absolute bottom-20 left-1/2 transform -translate-x-1/2 bg-purple-600 text-white px-4 py-2 rounded-full shadow-lg hover:bg-purple-700 transition-colors duration-200"
        >
          New Messages ↓
        </button>
      )}

      <Toaster position="top-center" />
    </div>
  );
};

ChatWindow.propTypes = {
  selectedUser: PropTypes.object,
  messages: PropTypes.array.isRequired,
  currentUser: PropTypes.object.isRequired,
  isLoadingMessages: PropTypes.bool.isRequired,
  hasNewMessages: PropTypes.bool.isRequired,
  status: PropTypes.string,
  onSendMessage: PropTypes.func.isRequired,
  formatTime: PropTypes.func.isRequired,
  formatDate: PropTypes.func.isRequired,
  setHasNewMessages: PropTypes.func.isRequired,
  onMessageDeleted: PropTypes.func,
  token: PropTypes.string.isRequired
};

export default React.memo(ChatWindow); 
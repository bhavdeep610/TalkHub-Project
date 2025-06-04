import React, { useState, useRef, useEffect, useMemo, memo } from 'react';
import PropTypes from 'prop-types';
import API from '../src/services/api';
import { toast, Toaster } from 'react-hot-toast';
import { useSignalR } from '../src/hooks/useSignalR';
import signalRService from '../src/services/signalRService';

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
  message, 
  isCurrentUser, 
  selectedUser, 
  isEditing, 
  editMessageContent,
  editInputRef,
  handleEditMessage,
  startEditing,
  cancelEditing,
  handleDeleteMessage 
}) => {
  const messageId = message.id || message.Id;
  const content = message.content || message.Content;
  const timestamp = message.timestamp || message.created || message.Created;

  return (
    <div
      className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'} items-end space-x-2`}
    >
      {!isCurrentUser && (
        <div className="h-6 w-6 rounded-full bg-purple-600 flex-shrink-0 flex items-center justify-center text-white text-xs">
          {selectedUser.username[0].toUpperCase()}
        </div>
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
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const editInputRef = useRef(null);
  const scrollTimeoutRef = useRef(null);

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

  // Scroll to bottom when new messages arrive
  const scrollToBottom = (force = false) => {
    if (messagesEndRef.current && (shouldAutoScroll || force)) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  };

  // Handle scroll events
  const handleScroll = () => {
    if (!chatContainerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const isAtBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 30;
    
    // Clear any existing scroll timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    if (isAtBottom) {
      setShouldAutoScroll(true);
      setHasNewMessages(false);
    } else {
      setShouldAutoScroll(false);
    }

    setIsUserScrolling(true);
    
    // Reset user scrolling flag after 100ms of no scroll events
    scrollTimeoutRef.current = setTimeout(() => {
      setIsUserScrolling(false);
    }, 100);
  };

  // Cleanup scroll timeout
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);
  // Add scroll event listener
  useEffect(() => {
    const container = chatContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, []);

  // Scroll to bottom only for new messages and initial load
  useEffect(() => {
    if (!isUserScrolling) {
      scrollToBottom();
    }
  }, [messages]);

  // Handle message submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmedMessage = newMessage.trim();
    
    if (!trimmedMessage) return;
  
    try {
      setNewMessage('');
      
      // Optimistically add message to UI
      const optimisticMessage = {
        id: `temp-${Date.now()}`,
        senderId: currentUser.id,
        senderName: currentUser.username,
        receiverId: selectedUser.id,
        receiverName: selectedUser.username,
        content: trimmedMessage,
        timestamp: new Date().toISOString(),
        pending: true
      };
  
      // Add optimistic message to UI
      onSendMessage(optimisticMessage);
      
      // Attempt to send message through SignalR
      try {
        const result = await sendMessage(selectedUser.id.toString(), trimmedMessage);
        
        if (result?.queued) {
          toast('Message queued - Will be sent when connection is restored', {
            duration: 3000,
            position: 'top-center',
            icon: '🕒'
          });
        }
      } catch (sendError) {
        console.error('Failed to send via SignalR:', sendError);
        // The optimistic message will remain in the UI as "pending"
        toast.error('Message will be sent when connection is restored', {
          duration: 3000,
          position: 'top-center'
        });
      }
      
      // Scroll to bottom after sending
      scrollToBottom(true);
    } catch (error) {
      console.error('Failed to process message:', error);
      toast.error('Failed to send message. Please try again.', {
        duration: 3000,
        position: 'top-center'
      });
      setNewMessage(trimmedMessage); // Restore message on failure
    }
  };
  const handleEditMessage = async (messageId) => {
    const updatedContent = editMessageContent.trim();
    
    // Optimistically update the UI
    const updatedMessages = messages.map(msg => {
      if ((msg.id || msg.Id) === messageId) {
        return {
          ...msg,
          content: updatedContent,
          Content: updatedContent
        };
      }
      return msg;
    });
    
    setEditingMessageId(null);
    setEditMessageContent('');
    
    if (onMessageDeleted) {
      onMessageDeleted(messageId, updatedMessages);
    }

    try {
      await API.put(`/Chat/update/${messageId}`, {
        newContent: updatedContent
      });
      
      toast.success('Message updated successfully', {
        duration: 2000,
        position: 'top-center',
        style: {
          background: '#10B981',
          color: '#fff',
          padding: '12px',
          borderRadius: '8px',
        },
      });
    } catch (error) {
      console.error('Error updating message:', error);
      if (onMessageDeleted) {
        onMessageDeleted(messageId, messages); // Revert to original messages
      }
      toast.error('Failed to update message', {
        duration: 2000,
        position: 'top-center',
        style: {
          background: '#EF4444',
          color: '#fff',
          padding: '12px',
          borderRadius: '8px',
        },
      });
    }
  };

  const handleDeleteMessage = async (messageId) => {
    try {
      await API.delete(`/Chat/delete/${messageId}`);
      if (onMessageDeleted) {
        onMessageDeleted(messageId);
      }
      toast.success('Message deleted successfully', {
        duration: 2000,
        position: 'top-center',
        style: {
          background: '#10B981',
          color: '#fff',
          padding: '12px',
          borderRadius: '8px',
        },
      });
    } catch (error) {
      console.error('Error deleting message:', error);
      toast.error('Failed to delete message', {
        duration: 2000,
        position: 'top-center',
        style: {
          background: '#EF4444',
          color: '#fff',
          padding: '12px',
          borderRadius: '8px',
        },
      });
    }
  };

  const startEditing = (messageId, content) => {
    setEditingMessageId(messageId);
    setEditMessageContent(content);
    setTimeout(() => {
      if (editInputRef.current) {
        editInputRef.current.focus();
      }
    }, 0);
  };

  const cancelEditing = () => {
    setEditingMessageId(null);
    setEditMessageContent('');
  };

  if (!selectedUser) {
    return null;
  }

  return (
    <div className="flex flex-col h-full w-full bg-gray-50">
      <Toaster />
      {/* Chat Header */}
      <div className="bg-white h-12 min-h-[48px] px-6 flex-shrink-0 border-b border-gray-200 flex items-center justify-between z-10">
        <div className="flex items-center">
          <div className="h-8 w-8 rounded-full bg-purple-600 flex items-center justify-center text-white font-semibold text-sm">
            {selectedUser.username[0].toUpperCase()}
          </div>
          <div className="ml-3">
            <h2 className="text-base font-semibold text-gray-800">
              {selectedUser.username}
            </h2>
            {/* Connection Status Indicator */}
            <div className="flex items-center">
              <div
                className={`w-2 h-2 rounded-full mr-2 ${
                  connectionStatus === 'connected'
                    ? 'bg-green-500'
                    : connectionStatus === 'reconnecting'
                    ? 'bg-yellow-500 animate-pulse'
                    : connectionStatus === 'disconnecting'
                    ? 'bg-blue-500 animate-pulse'
                    : 'bg-red-500'
                }`}
              />
              <span className="text-sm text-gray-500">
                {connectionStatus === 'connected'
                  ? 'Connected'
                  : connectionStatus === 'reconnecting'
                  ? 'Reconnecting...'
                  : connectionStatus === 'disconnecting'
                  ? 'Disconnecting...'
                  : connectionStatus === 'connecting'
                  ? 'Connecting...'
                  : 'Disconnected'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Messages */}
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent px-6 py-4"
        style={{ 
          height: 'calc(100vh - 128px)', // Subtract navbar (48px) + chat header (48px) + input area (32px)
          overscrollBehavior: 'contain'
        }}
        onScroll={handleScroll}
      >
        <div className="space-y-6">
          {isLoadingMessages ? (
            <div className="flex justify-center items-center h-full">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex justify-center items-center h-full text-gray-500 text-sm">
              No messages yet. Start a conversation!
            </div>
          ) : (
            <>
              {groupedMessages.map(([dateKey, dateMessages]) => (
                <div key={dateKey} className="space-y-3">
                  <div className="flex justify-center sticky top-2 z-10">
                    <div className="bg-white/80 backdrop-blur-sm text-gray-600 text-xs px-3 py-1 rounded-full shadow-sm border border-gray-100">
                      {formatDate(dateKey)}
                    </div>
                  </div>
                  {dateMessages.map((message) => (
                    <MessageBubble
                      key={message.id || message.Id}
                      message={message}
                      isCurrentUser={message.senderId === currentUser?.id}
                      selectedUser={selectedUser}
                      isEditing={editingMessageId === (message.id || message.Id)}
                      editMessageContent={editMessageContent}
                      editInputRef={editInputRef}
                      handleEditMessage={handleEditMessage}
                      startEditing={startEditing}
                      cancelEditing={cancelEditing}
                      handleDeleteMessage={handleDeleteMessage}
                    />
                  ))}
                </div>
              ))}
              <div ref={messagesEndRef} className="h-3" />
            </>
          )}
        </div>
      </div>

      {/* New Message Indicator */}
      {hasNewMessages && !shouldAutoScroll && (
        <button
          onClick={() => {
            setShouldAutoScroll(true);
            scrollToBottom(true);
          }}
          className="fixed bottom-24 left-1/2 transform -translate-x-1/2 bg-purple-600 text-white px-4 py-2 rounded-full shadow-lg hover:bg-purple-700 transition-colors z-10"
        >
          New messages ↓
        </button>
      )}

      {/* Message Input */}
      <div className="bg-white border-t border-gray-200 px-4 py-2 h-16 min-h-[64px] flex-shrink-0">
        <form onSubmit={handleSubmit} className="flex items-center space-x-3 h-full">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder={
              connectionStatus !== 'connected'
                ? 'Connecting to chat...'
                : 'Type a message...'
            }
            disabled={connectionStatus !== 'connected'}
            className="flex-1 bg-gray-50 rounded-full border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || connectionStatus !== 'connected'}
            className="bg-purple-600 text-white px-4 py-2 rounded-full text-sm hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            Send
          </button>
        </form>
      </div>

      {/* Status Message */}
      {status && (
        <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-10">
          <div className="bg-gray-800 text-white px-3 py-1.5 rounded-lg shadow-lg text-sm">
            {status}
          </div>
        </div>
      )}
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
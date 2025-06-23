import { useState, useRef, useEffect, useMemo, memo, useCallback } from 'react';
import PropTypes from 'prop-types';
import API from '../src/services/api';
import { toast, Toaster } from 'react-hot-toast';
import { useSignalR } from '../hooks/useSignalR';
import signalRService from '../src/services/signalRService';
import { profilePictureService } from '../src/services/profilePictureService';
import { messageService } from '../src/services/messageService';

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

const MessageTimestamp = memo(({ timestamp, isCurrentUser }) => {
  const timeFormatter = useMemo(() => createTimeFormatter(), []);
  const formattedTime = useMemo(() => timeFormatter(timestamp), [timestamp, timeFormatter]);

  return (
    <p className={`text-[10px] mt-0.5 ${isCurrentUser ? 'text-purple-200' : 'text-gray-500'}`}>
      {formattedTime}
    </p>
  );
});

MessageTimestamp.displayName = 'MessageTimestamp';

const MessageContent = memo(({ content }) => (
  <p className="break-words text-sm">{content}</p>
));

MessageContent.displayName = 'MessageContent';

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
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleEditMessage(messageId);
    } else if (e.key === 'Escape') {
      cancelEditing();
    }
  }, [handleEditMessage, messageId, cancelEditing]);

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
        <div className={`max-w-[180%] rounded-xl px-3 py-1.5 ${
          isCurrentUser
            ? 'bg-purple-600 text-white rounded-br-none'
            : 'bg-white text-gray-800 rounded-bl-none shadow-sm'
        }`}>
          {isEditing ? (
            <div className="flex flex-col space-y-2">
              <input
                ref={editInputRef}
                type="text"
                value={editMessageContent}
                onChange={(e) => setEditMessageContent(e.target.value)}
                onKeyDown={handleKeyDown}
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
  
  onSendMessage,
  formatTime,
  
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
  const [localMessages, setLocalMessages] = useState([]);
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const editInputRef = useRef(null);
  const scrollTimeoutRef = useRef(null);
  const mountedRef = useRef(true);

  const { isConnected } = useSignalR(token);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (mountedRef.current) {
      setLocalMessages(messages || []);
    }
  }, [selectedUser, messages]);

  useEffect(() => {
    const fetchProfilePictures = async () => {
      if (!selectedUser || !currentUser) return;

      const pictures = await profilePictureService.getProfilePictures([selectedUser.id, currentUser.id]);
      setSelectedUserProfilePicture(pictures[selectedUser.id]);
      setCurrentUserProfilePicture(pictures[currentUser.id]);
    };

    fetchProfilePictures();
  }, [selectedUser?.id, currentUser?.id]);

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

  useMemo(() => {
    const groups = new Map();
    
    localMessages.forEach(message => {
      const date = new Date(message.timestamp || message.created || message.Created);
      date.setHours(0, 0, 0, 0);
      const dateKey = date.getTime();
      
      if (!groups.has(dateKey)) {
        groups.set(dateKey, []);
      }
      groups.get(dateKey).push(message);
    });
    
    return Array.from(groups.entries()).sort((a, b) => a[0] - b[0]);
  }, [localMessages]);

   useMemo(() => {
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

  const scrollToBottom = (force = false) => {
    if (messagesEndRef.current && (shouldAutoScroll || force)) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  };

  const handleScroll = () => {
    if (!chatContainerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const isAtBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 30;
    
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
    
    scrollTimeoutRef.current = setTimeout(() => {
      setIsUserScrolling(false);
    }, 100);
  };

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);
  useEffect(() => {
    const container = chatContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, []);

  useEffect(() => {
    if (!isUserScrolling) {
      scrollToBottom();
    }
  }, [localMessages]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmedMessage = newMessage.trim();
    
    if (!trimmedMessage) return;
  
    try {
      setNewMessage('');
      
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
  
      onSendMessage(optimisticMessage);
      
      try {
        const result = await signalRService.sendMessage(selectedUser.id.toString(), trimmedMessage);
        
        if (result?.queued) {
          toast('Message queued - Will be sent when connection is restored', {
            duration: 3000,
            position: 'top-center',
            icon: '🕒'
          });
        }
      } catch (sendError) {
        console.error('Failed to send via SignalR:', sendError);
        toast.error('Message will be sent when connection is restored', {
          duration: 3000,
          position: 'top-center'
        });
      }
      
      scrollToBottom(true);
    } catch (error) {
      console.error('Failed to process message:', error);
      toast.error('Failed to send message. Please try again.', {
        duration: 3000,
        position: 'top-center'
      });
      setNewMessage(trimmedMessage); 
    }
  };
  const handleEditMessage = async (messageId) => {
    if (!editMessageContent.trim()) {
      cancelEditing();
      return;
    }

    const originalMessage = localMessages.find(m => m.id === messageId);
    if (!originalMessage) return;

    const optimisticMessage = {
      ...originalMessage,
      content: editMessageContent,
      isOptimistic: true
    };

    // Optimistically update the UI
    setLocalMessages(messages => 
      messages.map(m => m.id === messageId ? optimisticMessage : m)
    );

    try {
      const updatedMessage = await messageService.updateMessage(messageId, editMessageContent.trim());
      
      // Update with the server response
      setLocalMessages(messages =>
        messages.map(m => m.id === messageId ? updatedMessage : m)
      );
      
      cancelEditing();
      toast.success('Message updated successfully');
    } catch (error) {
      console.error('Message update failed:', error);
      toast.error('Failed to update message');
      
      // Revert to original message
      setLocalMessages(messages =>
        messages.map(m => m.id === messageId ? originalMessage : m)
      );
    }
  };

  const handleDeleteMessage = async (messageId) => {
    const originalMessages = [...localMessages];
    
    // Optimistically remove the message
    setLocalMessages(messages => messages.filter(m => m.id !== messageId));

    try {
      await messageService.deleteMessage(messageId);
      if (onMessageDeleted) {
        onMessageDeleted(messageId);
      }
      toast.success('Message deleted successfully');
    } catch (error) {
      console.error('Message deletion failed:', error);
      toast.error('Failed to delete message');
      
      // Revert to original messages
      setLocalMessages(originalMessages);
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
    <div className="flex flex-col h-full bg-white">
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

      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 bg-white scrollbar-thin scrollbar-thumb-purple-500 scrollbar-track-gray-100"
        onScroll={handleScroll}
      >
        {isLoadingMessages && localMessages.length === 0 ? (
          <div className="flex justify-center items-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
          </div>
        ) : localMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <p>No messages yet</p>
            <p className="text-sm">Send a message to start the conversation!</p>
          </div>
        ) : (
          localMessages.map((message) => (
            <MessageBubble
              key={message.id || message.Id || `temp-${message.timestamp}`}
              messageId={message.id || message.Id}
              content={message.content || message.Content}
              timestamp={message.timestamp || message.created || message.Created}
              isCurrentUser={message.senderId === currentUser?.id}
              isEditing={editingMessageId === (message.id || message.Id)}
              editMessageContent={editMessageContent}
              setEditMessageContent={setEditMessageContent}
              handleEditMessage={handleEditMessage}
              startEditing={startEditing}
              cancelEditing={cancelEditing}
              handleDeleteMessage={handleDeleteMessage}
              editInputRef={editInputRef}
              selectedUser={selectedUser}
              profilePicture={message.senderId === currentUser?.id ? currentUserProfilePicture : selectedUserProfilePicture}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="px-4 py-3 border-t border-gray-200 bg-white">
        <form onSubmit={handleSubmit} className="flex items-center space-x-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors duration-200"
          />
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className={`px-4 py-2 rounded-lg font-medium transition-colors duration-200 ${
              newMessage.trim()
                ? 'bg-purple-600 text-white hover:bg-purple-700'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            Send
          </button>
        </form>
      </div>

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
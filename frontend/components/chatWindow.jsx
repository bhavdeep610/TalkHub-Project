import { useState, useRef, useEffect, useMemo, memo, useCallback } from 'react';
import PropTypes from 'prop-types';
import API from '../src/services/api';
import { toast, Toaster } from 'react-hot-toast';
import { useSignalR } from '../hooks/useSignalR';
import signalRService from '../src/services/signalRService';
import { profilePictureService } from '../src/services/profilePictureService';
import { messageService } from '../src/services/messageService';
import MessageBubble from './MessageBubble';

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

  useEffect(() => {
    const handleMessageUpdate = (data) => {
      if (data.type === 'update' && data.message) {
        setLocalMessages(prevMessages => 
          prevMessages.map(msg => 
            (msg.id === data.message.id || msg.Id === data.message.id) 
              ? {
                  ...msg,
                  content: data.message.content,
                  updated: data.message.updated || new Date().toISOString(),
                  updatedAt: data.message.updatedAt || new Date().toISOString()
                }
              : msg
          )
        );
      }
    };

    const unsubscribe = signalRService.onReceiveMessage(handleMessageUpdate);
    return () => unsubscribe();
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

    const originalMessage = localMessages.find(m => 
      m.id === messageId || m.Id === messageId || 
      m.id === parseInt(messageId) || m.Id === parseInt(messageId)
    );

    if (!originalMessage) {
      toast.error('Message not found');
      return;
    }

    // Log the edit attempt
    console.log('Attempting to edit message:', {
      messageId,
      originalContent: originalMessage.content,
      newContent: editMessageContent
    });

    // Create optimistic update
    const optimisticMessage = {
      ...originalMessage,
      content: editMessageContent,
      updated: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isOptimistic: true
    };

    // Optimistically update the UI
    setLocalMessages(messages => 
      messages.map(m => (
        (m.id === messageId || m.Id === messageId || 
         m.id === parseInt(messageId) || m.Id === parseInt(messageId))
          ? optimisticMessage 
          : m
      ))
    );

    try {
      // Try SignalR update first for real-time update
      try {
        await signalRService.updateMessage(messageId, editMessageContent.trim());
        console.log('SignalR update successful');
      } catch (signalRError) {
        console.warn('SignalR update failed, falling back to REST:', signalRError);
        
        // If SignalR fails, try REST API
        const updatedMessage = await messageService.updateMessage(messageId, editMessageContent.trim());
        console.log('REST update successful:', updatedMessage);

        // Update with the server response
        setLocalMessages(messages =>
          messages.map(m => (
            (m.id === messageId || m.Id === messageId || 
             m.id === parseInt(messageId) || m.Id === parseInt(messageId))
              ? {
                  ...updatedMessage,
                  updated: updatedMessage.updated || new Date().toISOString(),
                  updatedAt: updatedMessage.updatedAt || new Date().toISOString()
                }
              : m
          ))
        );
      }
      
      cancelEditing();
      toast.success('Message updated successfully');
    } catch (error) {
      console.error('Failed to update message:', {
        messageId,
        error: error.message,
        response: error.response
      });
      
      // Revert to original message
      setLocalMessages(messages =>
        messages.map(m => (
          (m.id === messageId || m.Id === messageId || 
           m.id === parseInt(messageId) || m.Id === parseInt(messageId))
            ? originalMessage 
            : m
        ))
      );
      
      // Show appropriate error message
      if (error.message?.includes('Message not found')) {
        toast.error('Message was already deleted or not found');
      } else if (error.message?.includes('Not authorized')) {
        toast.error('You are not authorized to edit this message');
      } else {
        toast.error('Failed to update message. Please try again.');
      }
    }
  };

  const handleDeleteMessage = async (messageId) => {
    if (!messageId) {
      toast.error('Invalid message ID');
      return;
    }

    const originalMessages = [...localMessages];
    
    // Find the message to be deleted
    const messageToDelete = localMessages.find(m => 
      (m.id === messageId || m.Id === messageId || 
       m.id === parseInt(messageId) || m.Id === parseInt(messageId))
    );

    if (!messageToDelete) {
      toast.error('Message not found');
      return;
    }

    // Log the message being deleted
    console.log('Attempting to delete message:', {
      messageId,
      message: messageToDelete
    });

    // Optimistically remove the message
    setLocalMessages(messages => messages.filter(m => {
      const mId = m.id || m.Id;
      return mId !== messageId && mId !== parseInt(messageId);
    }));

    try {
      // Try SignalR delete first for real-time update
      try {
        await signalRService.deleteMessage(messageId);
        console.log('SignalR delete successful');
      } catch (signalRError) {
        console.warn('SignalR delete failed, falling back to REST:', signalRError);
        
        // If SignalR fails, try REST API
        await messageService.deleteMessage(messageId);
        console.log('REST delete successful');
      }

      toast.success('Message deleted successfully');
    } catch (error) {
      console.error('Failed to delete message:', {
        messageId,
        error: error.message,
        response: error.response
      });

      // Revert to original messages on error
      setLocalMessages(originalMessages);
      
      // Show appropriate error message
      if (error.message?.includes('Message not found')) {
        toast.error('Message was already deleted or not found');
      } else if (error.message?.includes('Not authorized')) {
        toast.error('You are not authorized to delete this message');
      } else {
        toast.error('Failed to delete message. Please try again.');
      }
    }
  };

  const startEditing = (messageId, content) => {
    try {
      console.log('Starting edit for message:', { 
        messageId, 
        content,
        currentEditingId: editingMessageId,
        currentEditContent: editMessageContent 
      });

      // Validate inputs
      if (!messageId) {
        console.error('Invalid messageId in startEditing');
        return;
      }

      if (content === undefined || content === null) {
        console.warn('Empty content in startEditing, using empty string');
        content = '';
      }

      // Update state
      setEditingMessageId(messageId);
      setEditMessageContent(content);

      // Focus input after a short delay to ensure the component has rendered
      setTimeout(() => {
        if (editInputRef.current) {
          console.log('Focusing edit input');
          editInputRef.current.focus();
          editInputRef.current.select();
        } else {
          console.warn('Edit input ref not available');
        }
      }, 50);
    } catch (error) {
      console.error('Error in startEditing:', error);
      toast.error('Failed to start editing. Please try again.');
    }
  };

  const cancelEditing = () => {
    try {
      console.log('Canceling edit:', {
        currentEditingId: editingMessageId,
        currentEditContent: editMessageContent
      });
      
      setEditingMessageId(null);
      setEditMessageContent('');
    } catch (error) {
      console.error('Error in cancelEditing:', error);
      toast.error('Failed to cancel editing. Please refresh the page.');
    }
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
          localMessages.map((message) => {
            // Normalize message data
            const normalizedMessage = {
              ...message,
              id: message.id || message.Id,
              content: message.content || message.Content,
              timestamp: message.timestamp || message.created || message.Created,
              updated: message.updated || message.Updated,
              updatedAt: message.updatedAt,
              senderName: message.senderName || message.SenderName || 
                (message.senderId === currentUser?.id ? currentUser.username : selectedUser.username),
              senderId: message.senderId,
              receiverId: message.receiverId
            };

            const isMessageBeingEdited = editingMessageId === (message.id || message.Id);

            return (
              <MessageBubble
                key={normalizedMessage.id || `temp-${normalizedMessage.timestamp}`}
                message={normalizedMessage}
                isCurrentUser={normalizedMessage.senderId === currentUser?.id}
                formatTime={formatTime}
                onEdit={startEditing}
                onDelete={handleDeleteMessage}
                isEditing={isMessageBeingEdited}
                editMessageContent={editMessageContent}
                setEditMessageContent={setEditMessageContent}
                handleEditMessage={handleEditMessage}
                editInputRef={editInputRef}
                onCancelEdit={cancelEditing}
              />
            );
          })
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
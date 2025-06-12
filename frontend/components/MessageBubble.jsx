import React, { memo, useCallback } from 'react';
import PropTypes from 'prop-types';

/**
 * Individual message bubble component
 * @param {Object} props - Component props
 * @returns {JSX.Element} Message bubble component
 */
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
  profilePicture,
  isOptimistic
}) => {
  // Memoize handlers
  const onEditSubmit = useCallback(() => {
    handleEditMessage(messageId);
  }, [handleEditMessage, messageId]);

  const onStartEditing = useCallback(() => {
    startEditing(messageId, content);
  }, [startEditing, messageId, content]);

  const onDeleteMessage = useCallback(() => {
    handleDeleteMessage(messageId);
  }, [handleDeleteMessage, messageId]);

  const onInputChange = useCallback((e) => {
    setEditMessageContent(e.target.value);
  }, [setEditMessageContent]);

  const onKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleEditMessage(messageId);
    } else if (e.key === 'Escape') {
      cancelEditing();
    }
  }, [handleEditMessage, messageId, cancelEditing]);

  // Format timestamp
  const formattedTime = React.useMemo(() => {
    if (!timestamp) return '';
    try {
      const date = new Date(timestamp);
      // Use local time without adding any offset
      return new Intl.DateTimeFormat('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }).format(date);
    } catch (error) {
      console.error('Error formatting time:', error);
      return '';
    }
  }, [timestamp]);

  return (
    <div 
      className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'} items-end space-x-2 ${isOptimistic ? 'opacity-70' : ''}`}
      data-message-id={messageId}
    >
      {!isCurrentUser && (
        <div className="flex-shrink-0">
          {profilePicture ? (
            <img 
              src={profilePicture} 
              alt={`${selectedUser.username}'s profile`}
              className="h-6 w-6 rounded-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="h-6 w-6 rounded-full bg-purple-600 flex items-center justify-center text-white text-xs">
              {selectedUser.username[0].toUpperCase()}
            </div>
          )}
        </div>
      )}
      
      <div className="group relative max-w-[70%]">
        <div
          className={`rounded-xl px-4 py-2 ${
            isCurrentUser
              ? 'bg-purple-600 text-white rounded-br-none'
              : 'bg-white text-gray-800 rounded-bl-none shadow-sm'
          }`}
        >
          {isEditing ? (
            <div className="flex flex-col space-y-2 min-w-[200px]">
              <input
                ref={editInputRef}
                type="text"
                value={editMessageContent}
                onChange={onInputChange}
                onKeyDown={onKeyDown}
                className="w-full px-2 py-1 text-sm text-gray-800 bg-white rounded border border-gray-300 focus:outline-none focus:border-purple-500"
                autoFocus
              />
              <div className="flex justify-end space-x-2">
                <button
                  onClick={onEditSubmit}
                  className="text-xs text-green-500 hover:text-green-600 transition-colors px-2 py-1 rounded"
                >
                  Save
                </button>
                <button
                  onClick={cancelEditing}
                  className="text-xs text-gray-500 hover:text-gray-600 transition-colors px-2 py-1 rounded"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-base break-words whitespace-pre-wrap leading-relaxed">{content}</p>
              <p
                className={`text-xs mt-1 ${
                  isCurrentUser ? 'text-purple-100' : 'text-gray-500'
                }`}
              >
                {formattedTime}
              </p>
            </>
          )}
        </div>

        {/* Message Actions */}
        {isCurrentUser && !isEditing && !isOptimistic && (
          <div className="absolute bottom-full right-0 mb-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex space-x-2">
            <button
              onClick={onStartEditing}
              className="text-xs bg-white text-gray-600 hover:text-blue-500 px-2 py-1 rounded shadow-sm transition-colors duration-200"
            >
              Edit
            </button>
            <button
              onClick={onDeleteMessage}
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

MessageBubble.propTypes = {
  messageId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  content: PropTypes.string.isRequired,
  timestamp: PropTypes.string,
  isCurrentUser: PropTypes.bool.isRequired,
  isEditing: PropTypes.bool,
  editMessageContent: PropTypes.string,
  setEditMessageContent: PropTypes.func,
  handleEditMessage: PropTypes.func,
  startEditing: PropTypes.func,
  cancelEditing: PropTypes.func,
  handleDeleteMessage: PropTypes.func,
  editInputRef: PropTypes.object,
  selectedUser: PropTypes.object.isRequired,
  profilePicture: PropTypes.string,
  isOptimistic: PropTypes.bool
};

export default MessageBubble; 
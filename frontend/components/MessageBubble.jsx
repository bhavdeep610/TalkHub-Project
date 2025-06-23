import React, { useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';

/**
 * Individual message bubble component
 * @param {Object} props - Component props
 * @returns {JSX.Element} Message bubble component
 */
const MessageBubble = ({ 
  message, 
  isCurrentUser,
  formatTime,
  onEdit,
  onDelete,
  isEditing,
  editMessageContent,
  setEditMessageContent,
  handleEditMessage,
  editInputRef,
  onCancelEdit
}) => {
  const formattedTime = useMemo(() => {
    const timestamp = message.timestamp || message.created || message.Created || message.updatedAt;
    return formatTime(timestamp);
  }, [message, formatTime]);

  const content = useMemo(() => {
    return message.content || message.Content;
  }, [message]);

  const isEdited = message.updated || message.Updated || message.updatedAt;
  const senderName = message.senderName || message.SenderName || 
    (isCurrentUser ? "You" : "Unknown User");

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleEditMessage(message.id || message.Id);
    } else if (e.key === 'Escape') {
      onCancelEdit();
    }
  }, [handleEditMessage, message, onCancelEdit]);
  
  return (
    <div 
      className={`my-2 flex message-enter message-bubble ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
      style={{ 
        transform: 'translate3d(0,0,0)', 
        willChange: 'transform', 
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
        perspective: '1000px',
        position: 'relative',
        transformStyle: 'preserve-3d',
        minHeight: '52px',
        width: '100%'
      }}
    >
      {!isCurrentUser && (
        <div className="flex flex-col items-center mr-2 flex-shrink-0" style={{ position: 'relative', zIndex: 1 }}>
          <div className="w-8 h-8 rounded-full bg-gray-400 flex items-center justify-center text-white font-bold text-xs">
            {senderName.substring(0, 1).toUpperCase()}
          </div>
          <span className="text-xs text-gray-500 mt-1">{senderName}</span>
        </div>
      )}
      
      <div 
        className={`relative group max-w-xs lg:max-w-md px-4 py-2 rounded-lg transition-all duration-200 ease-in-out ${
          isCurrentUser 
            ? 'bg-purple-600 text-white rounded-br-none hover:bg-purple-700' 
            : 'bg-white text-gray-800 rounded-bl-none shadow'
        }`}
        style={{ 
          transformOrigin: isCurrentUser ? 'right center' : 'left center',
          transform: 'translate3d(0,0,0)',
          position: 'relative',
          zIndex: 2,
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden'
        }}
      >
        {isEditing ? (
          <div className="flex flex-col space-y-2">
            <textarea
              ref={editInputRef}
              value={editMessageContent}
              onChange={(e) => setEditMessageContent(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full px-2 py-1 text-sm text-gray-800 bg-white rounded border border-gray-300 focus:outline-none focus:border-purple-500 resize-none"
              autoFocus
              rows={Math.min(4, (editMessageContent.match(/\n/g) || []).length + 1)}
              style={{ minHeight: '2.5rem' }}
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => handleEditMessage(message.id || message.Id)}
                className="text-xs bg-green-500 text-white hover:bg-green-600 px-2 py-1 rounded transition-colors duration-200"
              >
                Save
              </button>
              <button
                onClick={onCancelEdit}
                className="text-xs bg-gray-500 text-white hover:bg-gray-600 px-2 py-1 rounded transition-colors duration-200"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="whitespace-pre-wrap break-words">{content}</p>
            <div className="flex justify-between items-center mt-1">
              <div className="flex items-center gap-1">
                <p className={`text-xs ${isCurrentUser ? 'text-purple-200' : 'text-gray-500'}`}>
                  {formattedTime}
                </p>
                {isEdited && (
                  <span className={`text-xs ${isCurrentUser ? 'text-purple-200' : 'text-gray-500'}`}>
                    (edited)
                  </span>
                )}
              </div>
            </div>
          </>
        )}

        {isCurrentUser && !isEditing && (
          <div className="absolute top-0 right-0 mt-1 mr-1 opacity-100 flex space-x-1">
            <button
              onClick={() => onEdit(message.id || message.Id, content)}
              className="text-xs bg-white text-gray-600 hover:text-blue-500 hover:bg-blue-50 px-2 py-1 rounded shadow-sm transition-all duration-200"
              title="Edit message"
            >
              <span role="img" aria-label="Edit">✎</span>
            </button>
            <button
              onClick={() => {
                if (window.confirm('Are you sure you want to delete this message?')) {
                  onDelete(message.id || message.Id);
                }
              }}
              className="text-xs bg-white text-gray-600 hover:text-red-500 hover:bg-red-50 px-2 py-1 rounded shadow-sm transition-all duration-200"
              title="Delete message"
            >
              <span role="img" aria-label="Delete">×</span>
            </button>
          </div>
        )}
      </div>
      
      {isCurrentUser && (
        <div className="flex flex-col items-center ml-2 flex-shrink-0" style={{ position: 'relative', zIndex: 1 }}>
          <div className="w-8 h-8 rounded-full bg-purple-700 flex items-center justify-center text-white font-bold text-xs">
            {senderName.substring(0, 1).toUpperCase()}
          </div>
          <span className="text-xs text-gray-500 mt-1">You</span>
        </div>
      )}
    </div>
  );
};

MessageBubble.propTypes = {
  message: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    Id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    content: PropTypes.string,
    Content: PropTypes.string,
    created: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    Created: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    updated: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    Updated: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    updatedAt: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    timestamp: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    senderName: PropTypes.string,
    SenderName: PropTypes.string
  }).isRequired,
  isCurrentUser: PropTypes.bool.isRequired,
  formatTime: PropTypes.func.isRequired,
  onEdit: PropTypes.func,
  onDelete: PropTypes.func,
  isEditing: PropTypes.bool,
  editMessageContent: PropTypes.string,
  setEditMessageContent: PropTypes.func,
  handleEditMessage: PropTypes.func,
  editInputRef: PropTypes.object,
  onCancelEdit: PropTypes.func
};

export default React.memo(MessageBubble, (prevProps, nextProps) => {
  if (prevProps.isCurrentUser !== nextProps.isCurrentUser) return false;
  if (prevProps.isEditing !== nextProps.isEditing) return false;
  if (prevProps.editMessageContent !== nextProps.editMessageContent) return false;
  
  const prevContent = prevProps.message.content || prevProps.message.Content;
  const nextContent = nextProps.message.content || nextProps.message.Content;
  if (prevContent !== nextContent) return false;
  
  const prevUpdated = prevProps.message.updated || prevProps.message.Updated || prevProps.message.updatedAt;
  const nextUpdated = nextProps.message.updated || nextProps.message.Updated || nextProps.message.updatedAt;
  if (prevUpdated !== nextUpdated) return false;
  
  return true;
}); 
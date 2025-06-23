import { useMemo, useCallback } from 'react';
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
    <div className={`my-2 flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
      {!isCurrentUser && (
        <div className="flex flex-col items-center mr-2">
          <div className="w-8 h-8 rounded-full bg-gray-400 flex items-center justify-center text-white font-bold text-sm">
            {senderName.substring(0, 1).toUpperCase()}
          </div>
          <span className="text-xs text-gray-500 mt-1">{senderName}</span>
        </div>
      )}
      
      <div className="flex flex-col max-w-[45%]">
        {isCurrentUser && !isEditing && (
          <div className="flex justify-end mb-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <button
              onClick={() => onEdit(message.id || message.Id, content)}
              className="text-xs bg-white border border-gray-200 text-gray-600 hover:text-blue-500 hover:border-blue-500 px-3 py-1 rounded-full shadow-sm transition-all duration-200 mr-2"
              title="Edit message"
            >
              Edit
            </button>
            <button
              onClick={() => {
                if (window.confirm('Are you sure you want to delete this message?')) {
                  onDelete(message.id || message.Id);
                }
              }}
              className="text-xs bg-white border border-gray-200 text-gray-600 hover:text-red-500 hover:border-red-500 px-3 py-1 rounded-full shadow-sm transition-all duration-200"
              title="Delete message"
            >
              Delete
            </button>
          </div>
        )}
        
        <div 
          className={`relative group px-4 py-2 rounded-lg ${
            isCurrentUser 
              ? 'bg-purple-600 text-white rounded-br-none' 
              : 'bg-gray-100 text-gray-800 rounded-bl-none'
          }`}
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
              <p className="whitespace-pre-wrap break-words text-sm">{content}</p>
              <div className="flex items-center mt-1 gap-2">
                <span className={`text-[11px] ${isCurrentUser ? 'text-purple-200' : 'text-gray-500'}`}>
                  {formattedTime}
                </span>
                {isEdited && (
                  <span className={`text-[11px] ${isCurrentUser ? 'text-purple-200' : 'text-gray-500'}`}>
                    (edited)
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      
      {isCurrentUser && (
        <div className="flex flex-col items-center ml-2">
          <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold text-sm">
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

export default MessageBubble; 
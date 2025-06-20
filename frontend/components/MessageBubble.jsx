import React, { useMemo } from 'react';
import PropTypes from 'prop-types';

/**
 * Individual message bubble component
 * @param {Object} props - Component props
 * @returns {JSX.Element} Message bubble component
 */
const MessageBubble = ({ 
  message, 
  isCurrentUser,
  formatTime 
}) => {
  const formattedTime = useMemo(() => {
    return formatTime(message.created || message.Created);
  }, [message.created, message.Created, formatTime]);

  const content = useMemo(() => {
    return message.content || message.Content;
  }, [message.content, message.Content]);

  const senderName = message.senderName || message.SenderName || 
    (isCurrentUser ? "You" : "Unknown User");
  
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
        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg transition-all duration-200 ease-in-out ${
          isCurrentUser 
            ? 'bg-purple-600 text-white rounded-br-none' 
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
        <p>{content}</p>
        <div className="flex justify-between items-center mt-1">
          <p className={`text-xs ${isCurrentUser ? 'text-purple-200' : 'text-gray-500'}`}>
            {formattedTime}
          </p>
        </div>
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
    content: PropTypes.string,
    Content: PropTypes.string,
    created: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    Created: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
  }).isRequired,
  isCurrentUser: PropTypes.bool.isRequired,
  formatTime: PropTypes.func.isRequired
};

export default React.memo(MessageBubble, (prevProps, nextProps) => {
  if (prevProps.isCurrentUser !== nextProps.isCurrentUser) return false;
  
  const prevContent = prevProps.message.content || prevProps.message.Content;
  const nextContent = nextProps.message.content || nextProps.message.Content;
  if (prevContent !== nextContent) return false;
  
  const prevCreated = prevProps.message.created || prevProps.message.Created;
  const nextCreated = nextProps.message.created || nextProps.message.Created;
  if (prevCreated !== nextCreated) return false;
  
  return true;
}); 
import React from 'react';
import PropTypes from 'prop-types';

const ChatSidebar = ({ 
  conversations, 
  selectedUser, 
  onSelectUser,
  onNewChat 
}) => {
  return (
    <div className="w-80 border-r border-gray-200 flex flex-col bg-white">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold">Chats</h2>
        <button
          onClick={onNewChat}
          className="mt-2 w-full bg-purple-100 text-purple-600 px-4 py-2 rounded-lg hover:bg-purple-200"
        >
          New Chat
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {conversations.map((conv) => (
          <div
            key={conv.user.id}
            onClick={() => onSelectUser(conv.user)}
            className={`p-4 cursor-pointer hover:bg-gray-50 ${
              selectedUser?.id === conv.user.id ? 'bg-purple-50' : ''
            }`}
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white">
                {conv.user.username[0].toUpperCase()}
              </div>
              <div className="flex-1">
                <h3 className="font-medium">{conv.user.username}</h3>
                <p className="text-sm text-gray-500 truncate">
                  {conv.lastMessage?.content || 'No messages yet'}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

ChatSidebar.propTypes = {
  conversations: PropTypes.arrayOf(
    PropTypes.shape({
      user: PropTypes.shape({
        id: PropTypes.number.isRequired,
        username: PropTypes.string.isRequired
      }),
      lastMessage: PropTypes.shape({
        content: PropTypes.string
      })
    })
  ).isRequired,
  selectedUser: PropTypes.shape({
    id: PropTypes.number.isRequired,
    username: PropTypes.string.isRequired
  }),
  onSelectUser: PropTypes.func.isRequired,
  onNewChat: PropTypes.func.isRequired
};

ChatSidebar.defaultProps = {
  conversations: [],
  selectedUser: null
};

export default ChatSidebar; 
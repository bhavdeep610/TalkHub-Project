import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '@services/api';
import ChatSidebar from '@components/ChatSidebar';

const Chat = () => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [conversations, setConversations] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const currentUser = {
    username: localStorage.getItem('username'),
    id: localStorage.getItem('userId')
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    fetchConversations();
  }, [navigate]);

  const fetchConversations = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await API.get('/Chat/conversations');
      
      if (response.data) {
        setConversations(response.data);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
      setError(error.message || 'Failed to load conversations');
      if (error.status === 401) {
        navigate('/login');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMessages = async (userId) => {
    if (!userId) return;
    try {
      setIsLoading(true);
      setError(null);
      const response = await API.get(`/Chat/get/${userId}`);
      
      if (response.data) {
        setMessages(response.data);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
      setError(error.message || 'Failed to load messages');
      if (error.status === 401) {
        navigate('/login');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedUser) return;

    try {
      setIsLoading(true);
      setError(null);
      const response = await API.post(`/Chat/send/${selectedUser.id}`, {
        content: newMessage.trim()
      });

      if (response.data) {
        setMessages(prev => [...prev, response.data]);
        setNewMessage('');
        fetchConversations(); // Refresh conversations to update last message
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setError(error.message || 'Failed to send message');
      if (error.status === 401) {
        navigate('/login');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleUserSelect = (user) => {
    setSelectedUser(user);
    fetchMessages(user.id);
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  const handleNewChat = () => {
    // TODO: Implement new chat functionality
    console.log('New chat clicked');
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 py-4 px-6 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <h1 className="text-xl font-bold text-purple-600">TalkHub</h1>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white">
              {currentUser.username?.[0]?.toUpperCase()}
            </div>
            <span>{currentUser.username}</span>
          </div>
          <button
            onClick={() => navigate('/profile')}
            className="text-purple-600 hover:text-purple-700"
          >
            Profile
          </button>
          <button
            onClick={handleLogout}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main Chat Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <ChatSidebar
          conversations={conversations}
          selectedUser={selectedUser}
          onSelectUser={handleUserSelect}
          onNewChat={handleNewChat}
        />

        {/* Chat Messages */}
        <div className="flex-1 flex flex-col bg-gray-50">
          {selectedUser ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-gray-200 bg-white">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white">
                    {selectedUser.username[0].toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-medium">{selectedUser.username}</h3>
                    <p className="text-sm text-green-500">Online</p>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${
                      message.senderId === currentUser.id ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-[70%] rounded-lg px-4 py-2 ${
                        message.senderId === currentUser.id
                          ? 'bg-purple-600 text-white'
                          : 'bg-white'
                      }`}
                    >
                      <p>{message.content}</p>
                      <span className="text-xs opacity-75 mt-1 block">
                        {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Message Input */}
              <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-gray-200">
                <div className="flex space-x-4">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim() || isLoading}
                    className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50"
                  >
                    Send
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              Select a conversation to start chatting
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Chat; 
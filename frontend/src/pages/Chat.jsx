import React, { useState, useEffect, useRef } from 'react';
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

  // Add message caching
  const messageCache = useRef(new Map());
  
  useEffect(() => {
    if (selectedUser) {
      // Check cache first
      const cachedMessages = messageCache.current.get(selectedUser.id);
      if (cachedMessages) {
        setMessages(cachedMessages);
      }
      fetchMessages(selectedUser.id);
    }
  }, [selectedUser?.id]);

  // Update cache when messages change
  useEffect(() => {
    if (selectedUser && messages.length > 0) {
      messageCache.current.set(selectedUser.id, messages);
    }
  }, [selectedUser?.id, messages]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    let isSubscribed = true; // For cleanup

    const loadConversations = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await API.get('/Chat/conversations');
        
        if (isSubscribed && response.data) {
          setConversations(response.data);
        }
      } catch (error) {
        if (isSubscribed) {
          console.error('Error fetching conversations:', error);
          setError(error.message || 'Failed to load conversations');
          if (error.status === 401) {
            navigate('/login');
          }
        }
      } finally {
        if (isSubscribed) {
          setIsLoading(false);
        }
      }
    };

    loadConversations();

    // Cleanup function
    return () => {
      isSubscribed = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array - only run on mount

  const fetchMessages = async (userId) => {
    if (!userId) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      // Keep existing messages while loading new ones
      const response = await API.get(`/Chat/get/${userId}`);
      
      if (response.data) {
        // Ensure we have unique messages
        const uniqueMessages = response.data.reduce((acc, message) => {
          acc[message.id] = message;
          return acc;
        }, {});
        
        setMessages(Object.values(uniqueMessages));
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

    const messageContent = newMessage.trim();
    setNewMessage(''); // Clear input immediately for better UX

    // Create optimistic message
    const optimisticMessage = {
      id: `temp-${Date.now()}`,
      content: messageContent,
      senderId: currentUser.id,
      receiverId: selectedUser.id,
      timestamp: new Date().toISOString()
    };

    // Optimistically update messages
    setMessages(prev => [...prev, optimisticMessage]);

    // Optimistically update conversations
    setConversations(prev => {
      const updatedConversations = [...prev];
      const conversationIndex = updatedConversations.findIndex(
        conv => conv.user.id === selectedUser.id
      );

      if (conversationIndex !== -1) {
        updatedConversations[conversationIndex] = {
          ...updatedConversations[conversationIndex],
          lastMessage: optimisticMessage
        };
      }

      return updatedConversations;
    });

    try {
      setIsLoading(true);
      setError(null);
      const response = await API.post(`/Chat/send/${selectedUser.id}`, {
        content: messageContent
      });

      if (response.data) {
        // Replace optimistic message with real one
        setMessages(prev => 
          prev.map(msg => msg.id === optimisticMessage.id ? response.data : msg)
        );
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setError(error.message || 'Failed to send message');
      
      // Remove optimistic message on error
      setMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id));
      
      if (error.status === 401) {
        navigate('/login');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleUserSelect = (user) => {
    if (user.id === selectedUser?.id) return; // Don't reload if same user
    
    setSelectedUser(user);
    setMessages([]); // Clear messages only when explicitly changing users
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
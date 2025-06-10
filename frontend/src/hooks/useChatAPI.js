import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import API from '../api';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './useAuth';
import { signalRService } from '../services/signalRService';

/**
 * Custom hook to handle chat API interactions
 * @returns {Object} Chat API methods and state
 */
export const useChatAPI = () => {
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [registeredUsers, setRegisteredUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [error, setError] = useState(null);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const navigate = useNavigate();
  const { currentUser, getToken } = useAuth();
  
  // Add refs for tracking state
  const isMountedRef = useRef(true);
  const lastFetchTimeRef = useRef(0);
  const lastUsersFetchTimeRef = useRef(0);
  const FETCH_COOLDOWN = 5000; // 5 seconds cooldown

  // Memoize registered users to prevent unnecessary updates
  const memoizedRegisteredUsers = useMemo(() => registeredUsers, [registeredUsers]);

  // Custom setSelectedUser function to prevent unnecessary re-renders
  const setSelectedUserSafely = useCallback((user) => {
    if (!user) return;
    
    setSelectedUser(prev => {
      if (prev?.id === user.id) return prev;
      setMessages([]); // Clear messages only when switching users
      return user;
    });
  }, []);

  // Fetch registered users with cooldown
  const fetchRegisteredUsers = useCallback(async () => {
    const now = Date.now();
    if (now - lastUsersFetchTimeRef.current < FETCH_COOLDOWN) {
      return; // Skip if within cooldown period
    }

    if (!currentUser || isLoadingUsers) return;
    
    setIsLoadingUsers(true);
    try {
      const response = await API.get('/Chat/users');
      if (!isMountedRef.current) return;

      if (response.data) {
        const users = response.data
          .filter(u => u.id !== currentUser.id)
          .map(u => ({
            id: u.id || u.Id,
            username: u.username || u.Username || u.userName || u.UserName
          }));
        
        setRegisteredUsers(users);
        lastUsersFetchTimeRef.current = now;
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      setError('Failed to load users');
    } finally {
      if (isMountedRef.current) {
        setIsLoadingUsers(false);
      }
    }
  }, [currentUser, isLoadingUsers]);

  // Initialize SignalR connection and subscribe to updates
  useEffect(() => {
    if (!currentUser) return;

    const handleNewMessage = (message) => {
      if (!isMountedRef.current) return;

      setMessages(prev => {
        if (message.senderId === selectedUser?.id || message.receiverId === selectedUser?.id) {
          return [...prev, message];
        }
        return prev;
      });

      setConversations(prev => {
        const updatedConversations = [...prev];
        const conversationIndex = updatedConversations.findIndex(
          c => c.user.id === (message.senderId === currentUser.id ? message.receiverId : message.senderId)
        );

        if (conversationIndex !== -1) {
          updatedConversations[conversationIndex] = {
            ...updatedConversations[conversationIndex],
            lastMessage: message,
            hasMessages: true
          };
        }

        return updatedConversations;
      });
    };

    const handleConversationUpdate = (conversation) => {
      if (!isMountedRef.current) return;

      setConversations(prev => {
        const index = prev.findIndex(c => c.user.id === conversation.user.id);
        if (index === -1) {
          return [...prev, conversation];
        }
        const updated = [...prev];
        updated[index] = conversation;
        return updated;
      });
    };

    // Subscribe to SignalR events
    const unsubscribeMessage = signalRService.onReceiveMessage(handleNewMessage);
    const unsubscribeConversation = signalRService.onConversationUpdate(handleConversationUpdate);

    // Initial data fetch
    const fetchInitialData = async () => {
      try {
        setIsLoadingConversations(true);
        const [conversationsRes, usersRes] = await Promise.all([
          API.get('/Chat/conversations'),
          API.get('/Chat/users')
        ]);

        if (!isMountedRef.current) return;

        if (conversationsRes.data) {
          const formattedConversations = conversationsRes.data.map(conv => ({
            user: {
              id: conv.user.id || conv.user.Id,
              username: conv.user.username || conv.user.Username || conv.user.userName || conv.user.UserName
            },
            lastMessage: conv.lastMessage,
            messages: conv.messages || [],
            hasMessages: Boolean(conv.messages?.length)
          }));
          setConversations(formattedConversations);
        }

        if (usersRes.data) {
          const users = usersRes.data
            .filter(u => u.id !== currentUser.id)
            .map(u => ({
              id: u.id || u.Id,
              username: u.username || u.Username || u.userName || u.UserName
            }));
          setRegisteredUsers(users);
        }
      } catch (error) {
        console.error('Error fetching initial data:', error);
        setError('Failed to load initial data');
      } finally {
        if (isMountedRef.current) {
          setIsLoadingConversations(false);
        }
      }
    };

    fetchInitialData();

    return () => {
      isMountedRef.current = false;
      unsubscribeMessage();
      unsubscribeConversation();
    };
  }, [currentUser]);

  // Start a new conversation
  const startNewConversation = useCallback((selectedUserId) => {
    if (!selectedUserId || !currentUser) {
      setError("Please select a user");
      return false;
    }
    
    const userToChat = registeredUsers.find(user => user.id === selectedUserId);
    
    if (!userToChat) {
      setError("Selected user not found");
      return false;
    }
    
    const existingConv = conversations.find(conv => conv.user.id === selectedUserId);
    
    if (existingConv) {
      setSelectedUserSafely(existingConv.user);
    } else {
      setSelectedUserSafely(userToChat);
      setConversations(prev => [{
        user: userToChat,
        lastMessage: null,
        hasMessages: false
      }, ...prev]);
    }
    
    return true;
  }, [currentUser, registeredUsers, conversations, setSelectedUserSafely]);

  // Send message with optimistic update
  const sendMessage = useCallback(async (content) => {
    if (!selectedUser || !currentUser || !content.trim()) {
      return false;
    }

    const tempId = `temp-${Date.now()}`;
    const optimisticMessage = {
      id: tempId,
      senderId: currentUser.id,
      senderName: currentUser.username,
      receiverId: selectedUser.id,
      receiverName: selectedUser.username,
      content: content.trim(),
      timestamp: new Date().toISOString()
    };

    // Optimistic update
    setMessages(prev => [...prev, optimisticMessage]);

    try {
      const response = await API.post('/Chat/send', {
        receiverId: selectedUser.id,
        content: content.trim()
      });

      if (response.data) {
        // Replace optimistic message with real one
        setMessages(prev => 
          prev.map(msg => msg.id === tempId ? response.data : msg)
        );
        return true;
      }
      return false;
    } catch (error) {
      // Remove optimistic message on error
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
      console.error('Error sending message:', error);
      setError('Failed to send message');
      return false;
    }
  }, [currentUser, selectedUser]);

  return {
    conversations,
    messages,
    selectedUser,
    registeredUsers: memoizedRegisteredUsers,
    isLoadingMessages,
    isLoadingConversations,
    isLoadingUsers,
    error,
    hasNewMessages,
    setSelectedUser: setSelectedUserSafely,
    sendMessage,
    startNewConversation,
    fetchRegisteredUsers
  };
}; 
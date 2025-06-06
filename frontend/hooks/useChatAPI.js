import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import API from '../src/services/api';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './useAuth';

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
  
  // Add refs for debouncing API calls
  const fetchMessagesTimerRef = useRef(null);
  const fetchConversationsTimerRef = useRef(null);
  const fetchUsersTimerRef = useRef(null);
  const lastFetchTimeRef = useRef(0);
  const lastUsersFetchTimeRef = useRef(0);
  const userOrderRef = useRef(new Map()); // Store user order

  // Cache refs
  const messageCache = useRef(new Map());
  const conversationCache = useRef(new Map());
  const lastFetchTimes = useRef({
    messages: 0,
    conversations: 0
  });

  // Constants for polling intervals and cache invalidation
  const POLLING_INTERVALS = {
    messages: 3000,      // 3 seconds
    conversations: 5000,  // 5 seconds
    typing: 1000         // 1 second
  };

  const CACHE_INVALIDATION = {
    messages: 2000,      // 2 seconds
    conversations: 4000  // 4 seconds
  };

  // Create a debounce function to prevent excessive API calls
  const debounce = useCallback((func, delay) => {
    return (...args) => {
      const currentTime = Date.now();
      const timeSinceLastCall = currentTime - lastFetchTimeRef.current;
      
      // If called too frequently, increase the delay
      const actualDelay = timeSinceLastCall < 500 ? delay * 2 : delay;
      
      if (fetchMessagesTimerRef.current) {
        clearTimeout(fetchMessagesTimerRef.current);
      }
      
      fetchMessagesTimerRef.current = setTimeout(() => {
        lastFetchTimeRef.current = Date.now();
        func(...args);
      }, actualDelay);
    };
  }, []);

  // Debounced version of fetchRegisteredUsers with stable ordering
  const debouncedFetchUsers = useCallback(async () => {
    if (!currentUser) return;
    
    const now = Date.now();
    if (now - lastUsersFetchTimeRef.current < 5000) {
      return; // Prevent fetching more often than every 5 seconds
    }

    if (isLoadingUsers) return;

    setIsLoadingUsers(true);
    setError(null);
    
    try {
      const response = await API.get('/Chat/users');
      
      if (response.data && Array.isArray(response.data)) {
        const filteredUsers = response.data.map(user => ({
          id: user.id || user.Id,
          username: user.username || user.userName || user.UserName || user.Username || 
                   `User ${String(user.id || user.Id).charAt(0).toUpperCase()}`
        }));
        
        if (filteredUsers.length > 0) {
          setRegisteredUsers(prevUsers => {
            // Maintain existing order for current users
            const newUserMap = new Map();
            const currentOrder = new Map(prevUsers.map((user, index) => [user.id, index]));
            
            // Assign order to new users
            let maxOrder = currentOrder.size > 0 
              ? Math.max(...Array.from(currentOrder.values())) + 1 
              : 0;
            
            filteredUsers.forEach(user => {
              if (!currentOrder.has(user.id)) {
                currentOrder.set(user.id, maxOrder++);
              }
            });
            
            // Sort users based on their original order
            const sortedUsers = filteredUsers.sort((a, b) => {
              const orderA = currentOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER;
              const orderB = currentOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER;
              return orderA - orderB;
            });
            
            // Update the order reference
            userOrderRef.current = currentOrder;
            
            return sortedUsers;
          });
          lastUsersFetchTimeRef.current = now;
        }
      }
    } catch (error) {
      console.error("Failed to fetch users:", error);
      setError("Failed to load users. Please try again later.");
    } finally {
      setIsLoadingUsers(false);
    }
  }, [currentUser, isLoadingUsers]);

  // Replace the old fetchRegisteredUsers with the debounced version
  const fetchRegisteredUsers = useCallback(() => {
    if (fetchUsersTimerRef.current) {
      clearTimeout(fetchUsersTimerRef.current);
    }
    fetchUsersTimerRef.current = setTimeout(debouncedFetchUsers, 1000); // Increased debounce time
  }, [debouncedFetchUsers]);

  // Fetch messages with debouncing
  const debouncedFetchMessages = useCallback(
    debounce((userId) => {
      fetchMessages(userId);
    }, 300),
    [currentUser] // Recreate when current user changes
  );

  // Extract unique users from messages
  const extractUniqueUsersFromMessages = (messagesArray, currentUserId) => {
    const userMap = new Map();
    
    if (!Array.isArray(messagesArray)) {
      console.error("Expected messages array, got:", messagesArray);
      return [];
    }
    
    messagesArray.forEach(message => {
      if (!message) return; // Skip null/undefined messages
      
      // Add sender if it's not the current user
      if (message.senderId !== currentUserId) {
        if (!userMap.has(message.senderId)) {
          // Try to get the actual name, use first letter of sender ID as fallback
          const senderName = message.senderName || message.SenderName;
          const firstInitial = String(message.senderId || '').charAt(0).toUpperCase();
          
          userMap.set(message.senderId, {
            id: message.senderId,
            username: senderName || `User ${firstInitial}`
          });
        }
      }
      
      // Add receiver if it's not the current user
      if (message.receiverId !== currentUserId) {
        if (!userMap.has(message.receiverId)) {
          // Try to get the actual name, use first letter of receiver ID as fallback
          const receiverName = message.receiverName || message.ReceiverName;
          const firstInitial = String(message.receiverId || '').charAt(0).toUpperCase();
          
          userMap.set(message.receiverId, {
            id: message.receiverId,
            username: receiverName || `User ${firstInitial}`
          });
        }
      }
    });
    
    return Array.from(userMap.values());
  };

  // Custom setSelectedUser function to prevent unnecessary re-renders
  const setSelectedUserSafely = useCallback((user) => {
    if (user) {
      setSelectedUser(user);
      messageCache.current.delete(`messages-${user.id}`);
      lastFetchTimes.current.messages = 0;
    }
  }, []);

  // Start a new conversation with selected user
  const startNewConversation = (selectedUserId) => {
    if (!selectedUserId || !currentUser) {
      setError("Please select a user");
      return false;
    }
    
    // Find the selected user in the registeredUsers list
    const userToChat = registeredUsers.find(user => 
      (user.id === selectedUserId || user.Id === selectedUserId)
    );
    
    if (!userToChat) {
      setError("Selected user not found");
      return false;
    }
    
    // Check if already in conversations
    const existingConv = conversations.find(conv => 
      conv.user.id === selectedUserId || 
      conv.user.Id === selectedUserId
    );
    
    if (existingConv) {
      setSelectedUserSafely(existingConv.user);
    } else {
      // Use first initial of ID as fallback
      const firstInitial = String(userToChat.id || userToChat.Id).charAt(0).toUpperCase();
      
      const newUser = {
        id: userToChat.id || userToChat.Id,
        username: userToChat.username || userToChat.Username || `User ${firstInitial}`
      };
      
      setSelectedUserSafely(newUser);
      
      // Add to conversations list
      setConversations(prev => [{
        user: newUser,
        lastMessage: null,
        hasMessages: false
      }, ...prev]);
    }
    
    return true;
  };

  // Add retry mechanism for API calls
  const retryWithDelay = async (fn, retries = 3, delay = 1000) => {
    try {
      return await fn();
    } catch (error) {
      if (retries === 0) throw error;
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryWithDelay(fn, retries - 1, delay * 1.5);
    }
  };

  const fetchMessages = async (userId) => {
    if (!currentUser || !userId) return;
    
    // Don't set loading state immediately to prevent flickering on fast responses
    const loadingTimeout = setTimeout(() => {
      setIsLoadingMessages(true);
    }, 300);
    
    setError(null);

    try {
      const response = await retryWithDelay(async () => {
        const res = await API.get(`/Chat/get/${userId}`);
        if (!res.data) throw new Error('No data received');
        return res;
      });
      
      if (response.data && Array.isArray(response.data)) {
        const formattedMessages = response.data.map(msg => ({
          id: msg.id || msg.Id,
          senderId: msg.senderId || msg.SenderId,
          senderName: msg.senderName || msg.SenderName,
          receiverId: msg.receiverId || msg.ReceiverId,
          receiverName: msg.receiverName || msg.ReceiverName,
          content: msg.content || msg.Content,
          timestamp: msg.created || msg.Created
        }));

        // Batch state updates
        const updates = () => {
          setMessages(formattedMessages);
          
          if (formattedMessages.length > 0) {
            setConversations(prevConversations => {
              const existingConvIndex = prevConversations.findIndex(
                conv => conv.user.id === userId
              );
              
              if (existingConvIndex !== -1) {
                const newConversations = [...prevConversations];
                newConversations[existingConvIndex] = {
                  ...newConversations[existingConvIndex],
                  messages: formattedMessages,
                  lastMessage: formattedMessages[formattedMessages.length - 1]
                };
                return newConversations;
              }
              return prevConversations;
            });
          }
        };
        
        // Use requestAnimationFrame for smoother UI updates
        requestAnimationFrame(updates);
        return formattedMessages;
      }
      return [];
    } catch (error) {
      console.error("Error fetching messages:", error);
      setError(error.message || "Failed to load messages");
      return [];
    } finally {
      clearTimeout(loadingTimeout);
      setIsLoadingMessages(false);
    }
  };

  // Fetch conversations with proper state management
  const fetchConversations = async () => {
    if (!currentUser) return;
    
    setIsLoadingConversations(true);
    setError(null);

    try {
      const response = await API.get('/Chat/conversations');
      
      if (response.data && Array.isArray(response.data)) {
        const formattedConversations = response.data.map(conv => {
          const userId = conv.user.id;
          const existingUser = registeredUsers.find(u => u.id === userId);
          
          return {
            user: existingUser || {
              id: userId,
              username: conv.user.username || `User ${userId}`
            },
            lastMessage: conv.lastMessage,
            messages: conv.messages || []
          };
        });

        setConversations(formattedConversations);
        
        // Update registeredUsers with any new users from conversations
        setRegisteredUsers(prevUsers => {
          const userMap = new Map(prevUsers.map(u => [u.id, u]));
          formattedConversations.forEach(conv => {
            if (!userMap.has(conv.user.id)) {
              userMap.set(conv.user.id, conv.user);
            }
          });
          return Array.from(userMap.values());
        });
        
        return formattedConversations;
      }
      return [];
    } catch (error) {
      console.error("Error fetching conversations:", error);
      setError("Failed to load conversations");
      return [];
    } finally {
      setIsLoadingConversations(false);
    }
  };

  // Add a new function to fetch a single user's data
  const fetchUserById = async (userId) => {
    try {
      // Try the main endpoint first
      const response = await API.get(`/Chat/user/${userId}`);
      if (response?.data) {
        return {
          id: response.data.id || response.data.Id,
          username: response.data.username || response.data.Username || response.data.userName || response.data.UserName
        };
      }
      
      // Try fallback endpoint if main fails
      const fallbackResponse = await API.get(`/users/${userId}`);
      if (fallbackResponse?.data) {
        return {
          id: fallbackResponse.data.id || fallbackResponse.data.Id,
          username: fallbackResponse.data.username || fallbackResponse.data.Username || 
                   fallbackResponse.data.userName || fallbackResponse.data.UserName
        };
      }
    } catch (error) {
      console.error(`Failed to fetch user ${userId}:`, error);
    }
    return null;
  };

  // Update effect to manage conversation fetching based on user data
  useEffect(() => {
    let mounted = true;
    let timeoutId = null;
    
    const initializeConversations = async () => {
      if (registeredUsers.length > 0 && currentUser && mounted) {
        // Add a small delay to prevent rapid re-fetches
        timeoutId = setTimeout(async () => {
          const conversations = await fetchConversations();
          
          // Update registered users with conversation data
          if (mounted && conversations.length > 0) {
            setRegisteredUsers(prevUsers => {
              const userMap = new Map(prevUsers.map(u => [u.id, u]));
              conversations.forEach(conv => {
                if (!userMap.has(conv.user.id) || !userMap.get(conv.user.id).username) {
                  userMap.set(conv.user.id, conv.user);
                }
              });
              return Array.from(userMap.values());
            });
          }
        }, 300);
      }
    };
    
    initializeConversations();
    
    return () => {
      mounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [registeredUsers.length, currentUser?.id]);

  // Add cleanup for all timeouts on unmount
  useEffect(() => {
    return () => {
      if (fetchMessagesTimerRef.current) {
        clearTimeout(fetchMessagesTimerRef.current);
      }
      if (fetchConversationsTimerRef.current) {
        clearTimeout(fetchConversationsTimerRef.current);
      }
      if (fetchUsersTimerRef.current) {
        clearTimeout(fetchUsersTimerRef.current);
      }
    };
  }, []);

  // Consolidated fetch function with caching
  const fetchWithCache = useCallback(async (type, userId = null) => {
    const now = Date.now();
    const cacheKey = userId ? `${type}-${userId}` : type;
    const cache = type === 'messages' ? messageCache.current : conversationCache.current;
    const lastFetchTime = lastFetchTimes.current[type] || 0;

    // Check cache and throttle
    if (now - lastFetchTime < CACHE_INVALIDATION[type]) {
      const cachedData = cache.get(cacheKey);
      if (cachedData) return cachedData;
    }

    try {
      const endpoint = userId ? `/Chat/get/${userId}` : '/Chat/conversations';
      const response = await API.get(endpoint);
      
      if (!response.data) return null;

      const formattedData = type === 'messages' 
        ? formatMessages(response.data)
        : formatConversations(response.data);

      // Update cache
      cache.set(cacheKey, formattedData);
      lastFetchTimes.current[type] = now;

      return formattedData;
    } catch (error) {
      console.error(`Error fetching ${type}:`, error);
      return null;
    }
  }, []);

  // Format helpers
  const formatMessages = useCallback((data) => {
    if (!Array.isArray(data)) return [];
    return data.map(msg => ({
      id: msg.id || msg.Id,
      senderId: msg.senderId || msg.SenderId,
      senderName: msg.senderName || msg.SenderName,
      receiverId: msg.receiverId || msg.ReceiverId,
      receiverName: msg.receiverName || msg.ReceiverName,
      content: msg.content || msg.Content,
      timestamp: msg.created || msg.Created
    }));
  }, []);

  const formatConversations = useCallback((data) => {
    if (!Array.isArray(data)) return [];
    return data.map(conv => ({
      user: {
        id: conv.user.id || conv.user.Id,
        username: conv.user.username || conv.user.Username || 
                 conv.user.userName || conv.user.UserName
      },
      lastMessage: conv.lastMessage,
      messages: conv.messages || [],
      hasMessages: Boolean(conv.messages?.length)
    }));
  }, []);

  // Single consolidated polling effect
  useEffect(() => {
    if (!currentUser) return;

    let mounted = true;
    let messagesPollInterval;
    let conversationsPollInterval;

    const pollMessages = async () => {
      if (!mounted || !selectedUser) return;

      const newMessages = await fetchWithCache('messages', selectedUser.id);
      if (!mounted || !newMessages) return;

      const currentCount = messages.length;
      if (newMessages.length > currentCount) {
        setMessages(newMessages);
        setHasNewMessages(true);
      }
    };

    const pollConversations = async () => {
      if (!mounted) return;

      const newConversations = await fetchWithCache('conversations');
      if (!mounted || !newConversations) return;

      setConversations(prev => {
        // Only update if there are actual changes
        const hasChanges = newConversations.some((conv, index) => {
          const prevConv = prev[index];
          return !prevConv || 
                 prevConv.user.id !== conv.user.id ||
                 prevConv.lastMessage?.id !== conv.lastMessage?.id;
        });

        return hasChanges ? newConversations : prev;
      });
    };

    // Initial fetches
    pollMessages();
    pollConversations();

    // Set up polling with different intervals
    messagesPollInterval = setInterval(pollMessages, POLLING_INTERVALS.messages);
    conversationsPollInterval = setInterval(pollConversations, POLLING_INTERVALS.conversations);

    return () => {
      mounted = false;
      clearInterval(messagesPollInterval);
      clearInterval(conversationsPollInterval);
      messageCache.current.clear();
      conversationCache.current.clear();
    };
  }, [currentUser, selectedUser, messages.length, fetchWithCache]);

  // Memoized conversation list
  const usersWithChatHistory = useMemo(() => {
    if (!currentUser) return [];
    const ids = new Set(conversations.map(conv => conv.user.id));
    return registeredUsers.filter(u => ids.has(u.id));
  }, [conversations, registeredUsers, currentUser]);

  // Message sending with optimistic updates
  const sendMessage = useCallback(async (receiverId, content) => {
    try {
      const response = await API.post('/Chat/send', { receiverId, content });
      
      if (response.data) {
        const newMessage = formatMessages([response.data])[0];
        setMessages(prev => [...prev, newMessage]);
        
        // Update conversation
        setConversations(prev => {
          const updated = [...prev];
          const index = updated.findIndex(c => c.user.id === receiverId);
          if (index !== -1) {
            updated[index] = {
              ...updated[index],
              lastMessage: newMessage
            };
          }
          return updated;
        });

        return { success: true, message: newMessage };
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message');
      return { success: false, error };
    }
  }, [formatMessages]);

  return {
    conversations,
    messages,
    registeredUsers,
    usersWithChatHistory,
    selectedUser,
    isLoadingMessages,
    isLoadingConversations,
    isLoadingUsers,
    error,
    hasNewMessages,
    setHasNewMessages,
    setSelectedUser: setSelectedUserSafely,
    fetchRegisteredUsers,
    startNewConversation,
    fetchConversations,
    fetchMessages,
    debouncedFetchMessages,
    sendMessage,
    setError
  };
}; 
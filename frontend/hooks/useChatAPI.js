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
  const { currentUser } = useAuth();
  
  const fetchMessagesTimerRef = useRef(null);
  const fetchConversationsTimerRef = useRef(null);
  const fetchUsersTimerRef = useRef(null);
  const lastFetchTimeRef = useRef(0);
  const lastUsersFetchTimeRef = useRef(0);
  const userOrderRef = useRef(new Map());

  const processMessages = useCallback((messagesArray, currentUserId) => {
    const userMap = new Map();
    
    if (!Array.isArray(messagesArray)) {
      console.error("Expected messages array, got:", messagesArray);
      return [];
    }
    
    messagesArray.forEach(message => {
      if (!message) return; 
      if (message.senderId !== currentUserId) {
        if (!userMap.has(message.senderId)) {
          const senderName = message.senderName || message.SenderName;
          const firstInitial = String(message.senderId || '').charAt(0).toUpperCase();
          
          userMap.set(message.senderId, {
            id: message.senderId,
            username: senderName || `User ${firstInitial}`
          });
        }
      }
      
      if (message.receiverId !== currentUserId) {
        if (!userMap.has(message.receiverId)) {
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
  }, []);

  const debounce = useCallback((func, delay) => {
    return (...args) => {
      const currentTime = Date.now();
      const timeSinceLastCall = currentTime - lastFetchTimeRef.current;
      
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

  const fetchRegisteredUsers = useCallback(async () => {
    if (!currentUser || isLoadingUsers) return;

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
            // Deep comparison of users to prevent unnecessary updates
            const prevUsersStr = JSON.stringify(prevUsers);
            const newUsersStr = JSON.stringify(filteredUsers);
            
            if (prevUsersStr === newUsersStr) {
              return prevUsers;
            }

            return filteredUsers;
          });
        }
      }
    } catch (error) {
      console.error("Failed to fetch users:", error);
      setError("Failed to load users. Please try again later.");
      throw error; // Re-throw to handle in the component
    } finally {
      setIsLoadingUsers(false);
    }
  }, [currentUser, isLoadingUsers]);

  const debouncedFetchMessages = useCallback(
    debounce((userId) => {
      fetchMessages(userId);
    }, 300),
    [currentUser] 
  );

  const setSelectedUserSafely = useCallback((user) => {
    if (!user) return;
    
    const existingUser = registeredUsers.find(u => u.id === user.id);
    const fullUserData = existingUser || user;
    
    setSelectedUser(prev => {
      if (prev?.id === fullUserData.id) return prev;
      setMessages([]); 
      return fullUserData;
    });
  }, [registeredUsers]);

  const startNewConversation = (selectedUserId) => {
    if (!selectedUserId || !currentUser) {
      setError("Please select a user");
      return false;
    }
    
    const userToChat = registeredUsers.find(user => 
      (user.id === selectedUserId || user.Id === selectedUserId)
    );
    
    if (!userToChat) {
      setError("Selected user not found");
      return false;
    }
    
    const existingConv = conversations.find(conv => 
      conv.user.id === selectedUserId || 
      conv.user.Id === selectedUserId
    );
    
    if (existingConv) {
      setSelectedUserSafely(existingConv.user);
    } else {
      const firstInitial = String(userToChat.id || userToChat.Id).charAt(0).toUpperCase();
      
      const newUser = {
        id: userToChat.id || userToChat.Id,
        username: userToChat.username || userToChat.Username || `User ${firstInitial}`
      };
      
      setSelectedUserSafely(newUser);
      
      setConversations(prev => [{
        user: newUser,
        lastMessage: null,
        hasMessages: false
      }, ...prev]);
    }
    
    return true;
  };

   async (fn, retries = 3, delay = 1000) => {
    try {
      return await fn();
    } catch (error) {
      if (retries === 0) throw error;
      await new Promise(resolve => setTimeout(resolve, delay));
      return (fn, retries - 1, delay * 1.5);
    }
  };

  const fetchMessages = async (userId) => {
    if (!userId) return [];
    
    const loadingTimeout = setTimeout(() => setIsLoadingMessages(true), 500);
    
    try {
      const response = await API.get(`/Chat/get/${userId}`);
      
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

        const sortedMessages = formattedMessages.sort((a, b) => {
          const timeA = new Date(a.timestamp).getTime();
          const timeB = new Date(b.timestamp).getTime();
          if (timeA === timeB) {
            return (a.id || '').localeCompare(b.id || '');
          }
          return timeA - timeB;
        });

        setMessages(prevMessages => {
          const messageMap = new Map();
          
          [...prevMessages, ...sortedMessages].forEach(msg => {
            if (msg.id) {
              messageMap.set(msg.id, msg);
            }
          });
          
          [...prevMessages, ...sortedMessages].forEach(msg => {
            if (!msg.id) {
              const key = `${msg.senderId}-${msg.timestamp}-${msg.content}`;
              if (!messageMap.has(key)) {
                messageMap.set(key, msg);
              }
            }
          });
          
          return Array.from(messageMap.values())
            .sort((a, b) => {
              const timeA = new Date(a.timestamp).getTime();
              const timeB = new Date(b.timestamp).getTime();
              if (timeA === timeB) {
                return (a.id || '').localeCompare(b.id || '');
              }
              return timeA - timeB;
            });
        });
        
        return sortedMessages;
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

   async (userId) => {
    try {
      const response = await API.get(`/Chat/user/${userId}`);
      if (response?.data) {
        return {
          id: response.data.id || response.data.Id,
          username: response.data.username || response.data.Username || response.data.userName || response.data.UserName
        };
      }
      
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

  useEffect(() => {
    let mounted = true;
    let timeoutId = null;
    
    const initializeConversations = async () => {
      if (registeredUsers.length > 0 && currentUser && mounted) {
        timeoutId = setTimeout(async () => {
          const conversations = await fetchConversations();
          
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

  const sendMessage = async (receiverId, content) => {
    if (!currentUser || !receiverId || !content) {
      setError("Missing required information");
      return false;
    }

    try {
      const response = await API.post('/Chat/send', {
        receiverID: receiverId,
        content: content.trim()
      });

      if (response.data) {
        const newMessage = {
          id: response.data.id,
          senderId: currentUser.id,
          senderName: currentUser.username,
          receiverId: receiverId,
          receiverName: selectedUser?.username,
          content: response.data.content,
          timestamp: response.data.created
        };

        setMessages(prevMessages => [...prevMessages, newMessage]);
        
        updateConversationWithNewMessage(receiverId, newMessage);
        
        storeRecentPartner(receiverId);
        
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error sending message:", error);
      setError("Failed to send message");
      return false;
    }
  };

  const updateConversationWithNewMessage = (receiverId, message) => {
    setConversations(prevConversations => {
      const conversationIndex = prevConversations.findIndex(
        conv => conv.user.id === receiverId
      );

      if (conversationIndex === -1) {
        const user = registeredUsers.find(u => u.id === receiverId);
        if (!user) return prevConversations;

        return [{
          user,
          lastMessage: message,
          messages: [message],
          hasMessages: true
        }, ...prevConversations];
      }

      const updatedConversations = [...prevConversations];
      const conversation = { ...updatedConversations[conversationIndex] };
      conversation.lastMessage = message;
      conversation.hasMessages = true;
      conversation.messages = [...(conversation.messages || []), message];

      updatedConversations.splice(conversationIndex, 1);
      updatedConversations.unshift(conversation);

      return updatedConversations;
    });
  };

  const storeRecentPartner = (partnerId) => {
    const recentPartners = sessionStorage.getItem('recentChatPartners');
    let partnerIds = [];
    
    try {
      partnerIds = recentPartners ? JSON.parse(recentPartners) : [];
    } catch (e) {
      partnerIds = [];
    }
    
    if (!partnerIds.includes(partnerId)) {
      partnerIds.unshift(partnerId);
    } else {
      partnerIds = partnerIds.filter(id => id !== partnerId);
      partnerIds.unshift(partnerId);
    }
    
    partnerIds = partnerIds.slice(0, 10);
    sessionStorage.setItem('recentChatPartners', JSON.stringify(partnerIds));
  };

  const usersWithChatHistory = useMemo(() => {
    if (!currentUser) return [];
    const ids = new Set(conversations.map(conv => conv.user.id));
    return registeredUsers.filter(u => ids.has(u.id));
  }, [conversations, registeredUsers, currentUser]);

  useEffect(() => {
    if (!selectedUser || !currentUser) return;

    let isMounted = true;
    let pollTimeoutId = null;
    let lastMessageCount = messages.length;
    let lastPollTime = Date.now();
    let consecutiveEmptyPolls = 0;

    const pollMessages = async () => {
      if (!isMounted) return;

      const now = Date.now();
      const timeSinceLastPoll = now - lastPollTime;
      
      
      const minPollInterval = consecutiveEmptyPolls > 5 ? 5000 : 2000;
      
      if (timeSinceLastPoll < minPollInterval) {
        pollTimeoutId = setTimeout(pollMessages, minPollInterval - timeSinceLastPoll);
        return;
      }

      try {
        const response = await API.get(`/Chat/get/${selectedUser.id}`);
        if (!isMounted) return;

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

          if (formattedMessages.length !== lastMessageCount) {
            lastMessageCount = formattedMessages.length;
            consecutiveEmptyPolls = 0;

            setMessages(prevMessages => {
              const messageMap = new Map();
              
              prevMessages.forEach(msg => {
                const key = msg.id || `${msg.senderId}-${msg.timestamp}-${msg.content}`;
                messageMap.set(key, msg);
              });

              formattedMessages.forEach(msg => {
                const key = msg.id || `${msg.senderId}-${msg.timestamp}-${msg.content}`;
                if (!messageMap.has(key)) {
                  messageMap.set(key, msg);
                }
              });

              return Array.from(messageMap.values())
                .sort((a, b) => {
                  const timeA = new Date(a.timestamp).getTime();
                  const timeB = new Date(b.timestamp).getTime();
                  return timeA - timeB || (a.id || '').localeCompare(b.id || '');
                });
            });
          } else {
            consecutiveEmptyPolls++;
          }
        }
      } catch (error) {
        console.error('Error polling messages:', error);
        consecutiveEmptyPolls++;
      } finally {
        lastPollTime = Date.now();
        if (isMounted) {
          const nextPollInterval = Math.min(2000 * Math.pow(1.5, consecutiveEmptyPolls), 5000);
          pollTimeoutId = setTimeout(pollMessages, nextPollInterval);
        }
      }
    };

    pollMessages();

    return () => {
      isMounted = false;
      if (pollTimeoutId) {
        clearTimeout(pollTimeoutId);
      }
    };
  }, [selectedUser?.id, currentUser?.id]);

  useEffect(() => {
    if (currentUser) {
      let isMounted = true;

      const initializeData = async () => {
        try {
          const response = await API.get('/Chat/conversations');
          if (!isMounted) return;

          if (response.data && Array.isArray(response.data)) {
            const formattedConversations = response.data.map(conv => ({
              ...conv,
              user: {
                id: conv.user.id || conv.user.Id,
                username: conv.user.username || conv.user.Username || 
                         conv.user.userName || conv.user.UserName
              }
            }));
            
            setConversations(prev => {
              const hasChanges = JSON.stringify(prev) !== JSON.stringify(formattedConversations);
              return hasChanges ? formattedConversations : prev;
            });
          }
        } catch (error) {
          console.error('Error initializing data:', error);
        }
      };

      initializeData();

      return () => {
        isMounted = false;
      };
    }
  }, [currentUser]);

  const updateMessages = useCallback((updatedMessages) => {
    setMessages(updatedMessages);
  }, []);

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
    setError,
    updateMessages
  };
}; 
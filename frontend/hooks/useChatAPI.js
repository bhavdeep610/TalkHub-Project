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
    if (!user) return;
    
    // Ensure we have the full user data
    const existingUser = registeredUsers.find(u => u.id === user.id);
    const fullUserData = existingUser || user;
    
    setSelectedUser(prev => {
      if (prev?.id === fullUserData.id) return prev;
      setMessages([]); // Clear messages only when switching users
      return fullUserData;
    });
  }, [registeredUsers]);

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

        // Sort messages by timestamp
        const sortedMessages = formattedMessages.sort((a, b) => {
          const timeA = new Date(a.timestamp).getTime();
          const timeB = new Date(b.timestamp).getTime();
          if (timeA === timeB) {
            // If timestamps are equal, use message ID as secondary sort
            return (a.id || '').localeCompare(b.id || '');
          }
          return timeA - timeB;
        });

        // Update messages state atomically
        setMessages(prevMessages => {
          const messageMap = new Map();
          
          // First add messages with IDs from both previous and new messages
          [...prevMessages, ...sortedMessages].forEach(msg => {
            if (msg.id) {
              messageMap.set(msg.id, msg);
            }
          });
          
          // Then add messages without IDs if they don't exist
          [...prevMessages, ...sortedMessages].forEach(msg => {
            if (!msg.id) {
              const key = `${msg.senderId}-${msg.timestamp}-${msg.content}`;
              if (!messageMap.has(key)) {
                messageMap.set(key, msg);
              }
            }
          });
          
          // Convert back to array and sort
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

  // Send a new message
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

        // Update messages state
        setMessages(prevMessages => [...prevMessages, newMessage]);
        
        // Update conversations
        updateConversationWithNewMessage(receiverId, newMessage);
        
        // Store this partner in recent conversations
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
        // If conversation doesn't exist, create a new one
        const user = registeredUsers.find(u => u.id === receiverId);
        if (!user) return prevConversations;

        return [{
          user,
          lastMessage: message,
          messages: [message],
          hasMessages: true
        }, ...prevConversations];
      }

      // Update existing conversation
      const updatedConversations = [...prevConversations];
      const conversation = { ...updatedConversations[conversationIndex] };
      conversation.lastMessage = message;
      conversation.hasMessages = true;
      conversation.messages = [...(conversation.messages || []), message];

      // Move the updated conversation to the top
      updatedConversations.splice(conversationIndex, 1);
      updatedConversations.unshift(conversation);

      return updatedConversations;
    });
  };

  // Helper: Store recent conversation partner
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

  // Only users with chat history
  const usersWithChatHistory = useMemo(() => {
    if (!currentUser) return [];
    const ids = new Set(conversations.map(conv => conv.user.id));
    return registeredUsers.filter(u => ids.has(u.id));
  }, [conversations, registeredUsers, currentUser]);

  // Update polling mechanism with better coordination
  useEffect(() => {
    if (!selectedUser || !currentUser) return;

    let isMounted = true;
    let pollTimeoutId = null;
    let lastMessageCount = messages.length;
    let lastPollTime = Date.now();
    let consecutiveEmptyPolls = 0;

    const pollMessages = async () => {
      if (!isMounted) return;

      // Throttle polling based on activity
      const now = Date.now();
      const timeSinceLastPoll = now - lastPollTime;
      
      // Adaptive polling interval:
      // - 2 seconds if there's recent activity
      // - Up to 5 seconds if no new messages
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

          // Only update state if there are actual changes
          if (formattedMessages.length !== lastMessageCount) {
            lastMessageCount = formattedMessages.length;
            consecutiveEmptyPolls = 0;

            setMessages(prevMessages => {
              const messageMap = new Map();
              
              // Add existing messages to map
              prevMessages.forEach(msg => {
                const key = msg.id || `${msg.senderId}-${msg.timestamp}-${msg.content}`;
                messageMap.set(key, msg);
              });

              // Add or update new messages
              formattedMessages.forEach(msg => {
                const key = msg.id || `${msg.senderId}-${msg.timestamp}-${msg.content}`;
                if (!messageMap.has(key)) {
                  messageMap.set(key, msg);
                }
              });

              // Convert to sorted array
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
          // Adjust polling interval based on activity
          const nextPollInterval = Math.min(2000 * Math.pow(1.5, consecutiveEmptyPolls), 5000);
          pollTimeoutId = setTimeout(pollMessages, nextPollInterval);
        }
      }
    };

    // Start polling
    pollMessages();

    return () => {
      isMounted = false;
      if (pollTimeoutId) {
        clearTimeout(pollTimeoutId);
      }
    };
  }, [selectedUser?.id, currentUser?.id]);

  // Optimized conversation polling
  useEffect(() => {
    if (!currentUser) return;

    let isMounted = true;
    let pollTimeoutId = null;
    let lastUpdateTime = Date.now();
    let consecutiveNoChanges = 0;

    const pollConversations = async () => {
      if (!isMounted) return;

      const now = Date.now();
      const timeSinceLastUpdate = now - lastUpdateTime;
      
      // Adaptive polling with exponential backoff
      const minPollInterval = Math.min(3000 * Math.pow(1.5, consecutiveNoChanges), 10000);
      
      if (timeSinceLastUpdate < minPollInterval) {
        pollTimeoutId = setTimeout(pollConversations, minPollInterval - timeSinceLastUpdate);
        return;
      }

      try {
        const response = await API.get('/Chat/conversations');
        if (!isMounted) return;

        if (response.data && Array.isArray(response.data)) {
          const formattedConversations = response.data.map(conv => ({
            user: {
              id: conv.user.id,
              username: conv.user.username || `User ${conv.user.id}`
            },
            lastMessage: conv.lastMessage,
            messages: conv.messages || [],
            hasMessages: Boolean(conv.messages?.length)
          }));

          setConversations(prev => {
            // Only update if there are actual changes
            const hasChanges = JSON.stringify(prev) !== JSON.stringify(formattedConversations);
            if (hasChanges) {
              consecutiveNoChanges = 0;
              return formattedConversations;
            }
            consecutiveNoChanges++;
            return prev;
          });
        }
      } catch (error) {
        console.error('Error polling conversations:', error);
        consecutiveNoChanges++;
      } finally {
        lastUpdateTime = Date.now();
        if (isMounted) {
          const nextPollInterval = Math.min(3000 * Math.pow(1.5, consecutiveNoChanges), 10000);
          pollTimeoutId = setTimeout(pollConversations, nextPollInterval);
        }
      }
    };

    // Start polling
    pollConversations();

    return () => {
      isMounted = false;
      if (pollTimeoutId) {
        clearTimeout(pollTimeoutId);
      }
    };
  }, [currentUser?.id]);

  // Function to update messages after deletion
  const updateMessages = useCallback((updatedMessages) => {
    setMessages(updatedMessages);
  }, []);

  // Initialize conversations and fetch messages when the component mounts
  useEffect(() => {
    if (currentUser) {
      let isMounted = true;

      // Fetch initial conversations
      const initializeData = async () => {
        try {
          setIsLoadingConversations(true);
          const response = await API.get('/Chat/conversations');
          if (!isMounted) return;

          if (response.data) {
            const formattedConversations = response.data.map(conv => ({
              ...conv,
              user: {
                id: conv.user.id || conv.user.Id,
                username: conv.user.username || conv.user.Username || conv.user.userName || conv.user.UserName
              }
            }));
            
            setConversations(formattedConversations);
            
            // If there are conversations, select the most recent one
            if (formattedConversations.length > 0) {
              const mostRecentConversation = formattedConversations[0];
              const partnerId = mostRecentConversation.user.id;
              
              try {
                // Fetch the partner's user data
                const partnerResponse = await API.get(`/Chat/user/${partnerId}`);
                if (!isMounted) return;

                if (partnerResponse.data) {
                  const userData = {
                    id: partnerResponse.data.id || partnerResponse.data.Id,
                    username: partnerResponse.data.username || partnerResponse.data.Username || 
                             partnerResponse.data.userName || partnerResponse.data.UserName
                  };
                  setSelectedUser(userData);
                  
                  // Fetch messages for this conversation
                  const messagesResponse = await API.get(`/Chat/get/${partnerId}`);
                  if (!isMounted) return;

                  if (messagesResponse.data && Array.isArray(messagesResponse.data)) {
                    const formattedMessages = messagesResponse.data.map(msg => ({
                      id: msg.id || msg.Id,
                      senderId: msg.senderId || msg.SenderId,
                      senderName: msg.senderName || msg.SenderName,
                      receiverId: msg.receiverId || msg.ReceiverId,
                      receiverName: msg.receiverName || msg.ReceiverName,
                      content: msg.content || msg.Content,
                      timestamp: msg.created || msg.Created
                    }));
                    setMessages(formattedMessages);
                  }
                }
              } catch (error) {
                console.error('Error fetching user or messages:', error);
              }
            }
          }
        } catch (error) {
          console.error('Error initializing chat data:', error);
        } finally {
          if (isMounted) {
            setIsLoadingConversations(false);
          }
        }
      };

      initializeData();

      // Set up polling for new messages
      const messagesPollInterval = setInterval(async () => {
        if (selectedUser) {
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

              setMessages(prevMessages => {
                // Only update if we have new messages
                if (formattedMessages.length > prevMessages.length) {
                  return formattedMessages;
                }
                return prevMessages;
              });
            }
          } catch (error) {
            console.error('Error polling messages:', error);
          }
        }
      }, 3000);

      // Set up polling for conversations
      const conversationsPollInterval = setInterval(async () => {
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
            setConversations(formattedConversations);
          }
        } catch (error) {
          console.error('Error polling conversations:', error);
        }
      }, 5000);

      return () => {
        isMounted = false;
        clearInterval(messagesPollInterval);
        clearInterval(conversationsPollInterval);
      };
    }
  }, [currentUser]);

  // Remove the duplicate polling effects
  useEffect(() => {
    if (selectedUser && currentUser) {
      let isMounted = true;

      const fetchInitialMessages = async () => {
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
            setMessages(formattedMessages);
          }
        } catch (error) {
          console.error('Error fetching initial messages:', error);
        }
      };

      fetchInitialMessages();

      return () => {
        isMounted = false;
      };
    }
  }, [selectedUser, currentUser]);

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
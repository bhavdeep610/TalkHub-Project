import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import API from '../api';
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

  // Update polling mechanism
  useEffect(() => {
    if (selectedUser && currentUser) {
      let isMounted = true;
      let initialFetchDone = false;
      let lastMessageCount = messages.length;
      let lastFetchTime = Date.now();
      let pollTimeoutId = null;
      
      const pollMessages = async () => {
        if (!isMounted || !initialFetchDone) return;
        
        const now = Date.now();
        if (now - lastFetchTime < 2000) return; // Reduce polling frequency to 2 seconds
        
        try {
          const msgs = await fetchMessages(selectedUser.id);
          if (!isMounted) return;
          
          if (msgs && msgs.length > lastMessageCount) {
            lastMessageCount = msgs.length;
            if (isMounted) {
              setHasNewMessages(true);
              // Play notification sound or show visual indicator here if needed
            }
          }
          
          lastFetchTime = now;
        } catch (err) {
          console.error("Polling fetch error:", err);
        } finally {
          if (isMounted) {
            pollTimeoutId = setTimeout(pollMessages, 2000); // Poll every 2 seconds
          }
        }
      };
      
      // Initial fetch with retry
      const doInitialFetch = async () => {
        if (!initialFetchDone && isMounted) {
          try {
            await retryWithDelay(async () => {
              await fetchMessages(selectedUser.id);
              if (isMounted) {
                initialFetchDone = true;
                pollTimeoutId = setTimeout(pollMessages, 2000);
              }
            });
          } catch (err) {
            console.error("Initial fetch error:", err);
            if (isMounted) {
              // Retry initial fetch after 2 seconds
              setTimeout(doInitialFetch, 2000);
            }
          }
        }
      };
      
      doInitialFetch();
      
      return () => {
        isMounted = false;
        if (pollTimeoutId) {
          clearTimeout(pollTimeoutId);
        }
      };
    }
  }, [selectedUser?.id, currentUser?.id]);

  // Add polling for new messages
  useEffect(() => {
    let mounted = true;
    let pollInterval;
    let lastMessageCount = messages.length;
    let lastPollTime = Date.now();

    const pollMessages = async () => {
      if (!currentUser || !selectedUser) return;

      // Throttle polling if no changes
      const now = Date.now();
      if (now - lastPollTime < 2000) return;
      lastPollTime = now;

      try {
        const response = await API.get(`/Chat/get/${selectedUser.id}`);
        if (!mounted) return;

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

          // Only update if there are new messages
          if (formattedMessages.length > lastMessageCount) {
            lastMessageCount = formattedMessages.length;
            setMessages(formattedMessages);
            
            // Update the conversation with new messages
            if (formattedMessages.length > 0) {
              const lastMessage = formattedMessages[formattedMessages.length - 1];
              updateConversationWithNewMessage(selectedUser.id, lastMessage);
            }
          }
        }
      } catch (error) {
        console.error('Error polling messages:', error);
      }
    };

    if (selectedUser) {
      // Initial fetch
      pollMessages();
      
      // Set up polling with increasing intervals
      pollInterval = setInterval(pollMessages, 3000);
    }

    return () => {
      mounted = false;
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [selectedUser, currentUser]);

  // Add effect to fetch conversations periodically
  useEffect(() => {
    let mounted = true;
    let pollInterval;
    let lastUpdateTime = 0;

    const pollConversations = async () => {
      if (!currentUser) return;

      // Throttle updates
      const now = Date.now();
      if (now - lastUpdateTime < 3000) return;

      try {
        const response = await API.get('/Chat/conversations');
        if (!mounted) return;

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
              messages: conv.messages || [],
              hasMessages: Boolean(conv.messages?.length)
            };
          });

          setConversations(prevConversations => {
            // Only update if there are actual changes
            const hasChanges = formattedConversations.some((conv, index) => {
              const prevConv = prevConversations[index];
              return !prevConv || 
                     prevConv.user.id !== conv.user.id ||
                     prevConv.lastMessage?.id !== conv.lastMessage?.id;
            });

            if (!hasChanges) {
              return prevConversations;
            }

            lastUpdateTime = now;
            
            // Merge new conversations with existing ones
            const conversationMap = new Map(
              prevConversations.map(conv => [conv.user.id, conv])
            );

            formattedConversations.forEach(conv => {
              const existing = conversationMap.get(conv.user.id);
              if (!existing || conv.lastMessage?.timestamp > existing.lastMessage?.timestamp) {
                conversationMap.set(conv.user.id, conv);
              }
            });

            return Array.from(conversationMap.values())
              .sort((a, b) => {
                const timeA = a.lastMessage?.timestamp || 0;
                const timeB = b.lastMessage?.timestamp || 0;
                return timeB - timeA;
              });
          });
        }
      } catch (error) {
        console.error('Error polling conversations:', error);
      }
    };

    // Initial fetch
    pollConversations();
    
    // Set up polling with a longer interval
    pollInterval = setInterval(pollConversations, 5000);

    return () => {
      mounted = false;
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [currentUser, registeredUsers]);

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
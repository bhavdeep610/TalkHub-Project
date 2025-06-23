import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import API from '../src/services/api';
import { profilePictureService } from '../src/services/profilePictureService';
import signalRService from '../src/services/signalRService';

/**
 * @param {Object} props - Component props
 * @returns {JSX.Element} ChatSidebar component
 */
  
const ChatSidebar = ({ 
  conversations = [], 
  selectedUser, 
  newChatUserOptions = [],
  onSelectUser, 
  onStartNewChat = () => {},
  onRefreshUsers = () => {},
  formatDate = (date) => new Date(date).toLocaleDateString(),
  onConversationUpdate = () => {}, 
  hideHeader = false 
}) => {
  const [showUserList, setShowUserList] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [userProfilePictures, setUserProfilePictures] = useState({});
  const [loadingPictures, setLoadingPictures] = useState(false);
  const [error, setError] = useState(null);
  const retryTimeoutRef = useRef(null);
  const lastFetchTimeRef = useRef(0);
  const FETCH_COOLDOWN = 60000; 
  const lastMessagesCache = useRef(new Map());
  const [showScrollButton, setShowScrollButton] = useState(false);
  const sidebarRef = useRef(null);
  const mountedRef = useRef(true);

  const handleSelectConversation = useCallback((conversation) => {
    if (conversation && conversation.user) {
      onSelectUser(conversation.user);
    }
  }, [onSelectUser]);

  const handleStartChat = useCallback((userId) => {
    onStartNewChat(userId);
    setShowUserList(false);
  }, [onStartNewChat]);

  useEffect(() => {
    conversations.forEach(conversation => {
      if (conversation.lastMessage) {
        lastMessagesCache.current.set(conversation.user.id, conversation.lastMessage);
      }
    });
  }, [conversations]);

  useEffect(() => {
    const unsubscribe = signalRService.onConversationUpdate((updatedConversation) => {
      onConversationUpdate(updatedConversation);
    });

    return () => unsubscribe();
  }, [onConversationUpdate]);

  const fetchProfilePictures = useCallback(async (retryCount = 0) => {
    const now = Date.now();
    if (now - lastFetchTimeRef.current < FETCH_COOLDOWN) {
      return;
    }

    if (retryCount > 3) {
      setError('Failed to load profile pictures. Please try again later.');
      return;
    }

    setLoadingPictures(true);
    try {
      const userIds = [
        ...conversations.map(c => c.user.id),
        ...(newChatUserOptions || []).map(u => u.id)
      ];
      const uniqueUserIds = [...new Set(userIds)];
      
      const uncachedUserIds = uniqueUserIds.filter(id => !userProfilePictures[id]);
      
      if (uncachedUserIds.length === 0) {
        setLoadingPictures(false);
        return;
      }

      const pictures = await profilePictureService.getProfilePictures(uncachedUserIds);
      setUserProfilePictures(prev => ({
        ...prev,
        ...pictures
      }));
      setError(null);
      lastFetchTimeRef.current = now;
    } catch (error) {
      console.error('Error in fetchProfilePictures:', error);
      
      if (error.isNetworkError || error.isTimeout) {
        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current);
        }
        retryTimeoutRef.current = setTimeout(() => {
          fetchProfilePictures(retryCount + 1);
        }, 2000 * (retryCount + 1));
      } else {
        setError('Failed to load profile pictures. Please try again later.');
      }
    } finally {
      setLoadingPictures(false);
    }
  }, [conversations, newChatUserOptions, userProfilePictures]);

  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const userIds = [
      ...conversations.map(c => c.user.id),
      ...(newChatUserOptions || []).map(u => u.id)
    ];
    const uniqueUserIds = [...new Set(userIds)];
    const hasUncachedUsers = uniqueUserIds.some(id => !userProfilePictures[id]);

    if (hasUncachedUsers) {
      fetchProfilePictures();
    }
  }, [conversations, newChatUserOptions, userProfilePictures, fetchProfilePictures]);

  const conversationList = useMemo(() => {
    return conversations.map(conversation => {
      const user = conversation.user;
      const lastMessage = conversation.lastMessage || lastMessagesCache.current.get(user.id);
      const hasMessages = conversation.hasMessages || lastMessagesCache.current.has(user.id);
      const isSelected = selectedUser && selectedUser.id === user.id;
      const profilePicture = userProfilePictures[user.id];
      
      const renderProfilePicture = () => {
        if (!user) return null;

        return (
          <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-purple-600 flex-shrink-0">
            {loadingPictures && !profilePicture ? (
              <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : profilePicture ? (
              <img 
                src={profilePicture}
                alt={`${user.username}'s profile`}
                className="w-full h-full object-cover"
                loading="lazy"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.style.display = 'none';
                  const parent = e.target.parentNode;
                  if (parent) {
                    parent.innerHTML = `
                      <div class="w-full h-full bg-purple-100 flex items-center justify-center">
                        <span class="text-sm font-medium text-purple-600">
                          ${user.username.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    `;
                  }
                }}
              />
            ) : (
              <div className="w-full h-full bg-purple-100 flex items-center justify-center">
                <span className="text-sm font-medium text-purple-600">
                  {user.username.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>
        );
      };
      
      return (
        <div 
          key={user.id} 
          className={`flex items-center px-6 py-3 cursor-pointer ${
            isSelected ? 'bg-purple-50' : 'hover:bg-gray-50'
          } transition-colors duration-200`}
          onClick={() => handleSelectConversation(conversation)}
        >
          {renderProfilePicture()}
          <div className="ml-3 flex-grow min-w-0">
            <p className="font-medium text-gray-900 truncate">{user.username}</p>
            <div className="h-5 flex items-center">
              {hasMessages ? (
                lastMessage ? (
                  <p className="text-sm text-gray-500 truncate">
                    {lastMessage.content || lastMessage.Content}
                  </p>
                ) : (
                  <div className="w-24 h-3 bg-gray-100 animate-pulse rounded"></div>
                )
              ) : (
                <p className="text-xs text-gray-400">No messages yet</p>
              )}
            </div>
            {lastMessage && (
              <p className="text-xs text-gray-400 mt-0.5">
                {formatDate(lastMessage.timestamp || lastMessage.created || lastMessage.Created)}
              </p>
            )}
          </div>
        </div>
      );
    });
  }, [conversations, selectedUser, userProfilePictures, loadingPictures, formatDate, handleSelectConversation]);

   useMemo(() => {
    return (newChatUserOptions || []).map(user => {
      const profilePicture = userProfilePictures[user.id];
      
      return (
        <div 
          key={user.id} 
          className="flex items-center px-6 py-3 cursor-pointer hover:bg-gray-50 transition-colors duration-200"
          onClick={() => handleStartChat(user.id)}
        >
          <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-purple-600 flex-shrink-0">
            {loadingPictures && !profilePicture ? (
              <div className="w-full h-full bg-gray-100 animate-pulse flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : profilePicture ? (
              <img 
                src={profilePicture}
                alt={`${user.username}'s profile`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full bg-purple-100 flex items-center justify-center">
                <span className="text-sm font-medium text-purple-600">
                  {user.username.substring(0, 1).toUpperCase()}
                </span>
              </div>
            )}
          </div>
          <div className="ml-3">
            <p className="font-medium text-gray-900">{user.username}</p>
          </div>
        </div>
      );
    });
  }, [newChatUserOptions, userProfilePictures, loadingPictures]);

   useCallback(() => {
    onRefreshUsers();
    const now = Date.now();
    if (now - lastFetchTimeRef.current >= FETCH_COOLDOWN) {
      fetchProfilePictures();
    }
  }, [onRefreshUsers, fetchProfilePictures]);

  const handleScroll = useCallback(() => {
    if (!sidebarRef.current) return;
    
    const { scrollTop,  } = sidebarRef.current;
    const scrolledFromTop = scrollTop > 200;
    setShowScrollButton(scrolledFromTop);
  }, []);

  const scrollToBottom = useCallback(() => {
    if (!sidebarRef.current) return;
    sidebarRef.current.scrollTo({
      top: sidebarRef.current.scrollHeight,
      behavior: 'smooth'
    });
  }, []);

  useEffect(() => {
    const sidebar = sidebarRef.current;
    if (sidebar) {
      sidebar.addEventListener('scroll', handleScroll);
      return () => sidebar.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  return (
    <div className="flex flex-col h-full">
      {!hideHeader && (
        <div className="h-12 min-h-[48px] flex-shrink-0 flex items-center justify-between px-6 border-b border-gray-200 bg-white">
          <h2 className="text-lg font-semibold text-gray-800">Chats</h2>
          <button
            onClick={() => onStartNewChat()}
            className="text-purple-600 hover:text-purple-700 font-medium text-sm transition-colors duration-200 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            New Chat
          </button>
        </div>
      )}
      <div 
        ref={sidebarRef}
        className="flex-1 overflow-y-auto relative"
      >
        {conversationList}

        {showScrollButton && (
          <button
            onClick={scrollToBottom}
            className="fixed bottom-20 right-4 bg-purple-600 text-white p-2 rounded-full shadow-lg hover:bg-purple-700 transition-colors duration-200 z-10"
            aria-label="Scroll to bottom"
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-5 w-5" 
              viewBox="0 0 20 20" 
              fill="currentColor"
            >
              <path 
                fillRule="evenodd" 
                d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" 
                clipRule="evenodd" 
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

ChatSidebar.propTypes = {
  conversations: PropTypes.array,
  selectedUser: PropTypes.object,
  registeredUsers: PropTypes.array,
  newChatUserOptions: PropTypes.array,
  isLoadingUsers: PropTypes.bool,
  onSelectUser: PropTypes.func.isRequired,
  onStartNewChat: PropTypes.func,
  onRefreshUsers: PropTypes.func,
  formatDate: PropTypes.func,
  onConversationUpdate: PropTypes.func,
  hideHeader: PropTypes.bool 
};

export default React.memo(ChatSidebar); 
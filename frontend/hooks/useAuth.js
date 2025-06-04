import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';

/**
 * Custom hook to handle authentication and user state
 * @returns {Object} Authentication methods and state
 */
export const useAuth = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  // Check if token is expired
  const isTokenExpired = useCallback((decodedToken) => {
    if (!decodedToken.exp) return true;
    const expirationTime = decodedToken.exp * 1000; // Convert to milliseconds
    return Date.now() >= expirationTime;
  }, []);

  // Get current user from token
  const loadUser = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setCurrentUser(null);
        setIsLoading(false);
        return;
      }

      // Try to decode the token to get user information
      const decodedToken = jwtDecode(token);
      
      // Check if token is expired
      if (isTokenExpired(decodedToken)) {
        console.log('Token expired, logging out...');
        logout();
        return;
      }

      const userId = decodedToken.nameid || decodedToken.sub || decodedToken.id;
      
      const userInfo = {
        id: parseInt(userId),
        username: decodedToken.unique_name || decodedToken.name || "User" + userId,
        role: decodedToken.role || 'User'
      };
      
      setCurrentUser(userInfo);
    } catch (error) {
      console.error('Failed to decode token:', error);
      localStorage.removeItem('token');
      setError('Authentication failed. Please login again.');
      setCurrentUser(null);
      navigate('/login');
    } finally {
      setIsLoading(false);
    }
  }, [navigate, isTokenExpired]);

  // Load user on mount and token change
  useEffect(() => {
    loadUser();

    // Set up token change listener
    const handleStorageChange = (e) => {
      if (e.key === 'token') {
        loadUser();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [loadUser]);

  // Logout function
  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('recentChatPartners');
    setCurrentUser(null);
    navigate('/login');
  }, [navigate]);

  // Check if user is authenticated
  const isAuthenticated = !!currentUser;

  // Get the auth token
  const getToken = useCallback(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decodedToken = jwtDecode(token);
        if (isTokenExpired(decodedToken)) {
          logout();
          return null;
        }
        return token;
      } catch (error) {
        console.error('Invalid token:', error);
        logout();
        return null;
      }
    }
    return null;
  }, [isTokenExpired, logout]);

  return {
    currentUser,
    isLoading,
    error,
    isAuthenticated,
    logout,
    getToken,
    loadUser
  };
}; 
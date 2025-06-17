import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import API from '../src/services/api';

/**
 * Custom hook to handle authentication and user state
 * @returns {Object} Authentication methods and state
 */
export const useAuth = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  // Check if token is expired
  const isTokenExpired = useCallback((decodedToken) => {
    if (!decodedToken.exp) return true;
    const expirationTime = decodedToken.exp * 1000; // Convert to milliseconds
    return Date.now() >= expirationTime;
  }, []);

  // Get token
  const getToken = useCallback(() => {
    return localStorage.getItem('token');
  }, []);

  // Logout function
  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('username');
    setCurrentUser(null);
    setIsAuthenticated(false);
    navigate('/login');
  }, [navigate]);

  // Validate token with backend
  const validateToken = useCallback(async (token) => {
    try {
      const response = await API.get('/User/profile');
      return true;
    } catch (error) {
      if (error.isAuthError || error.response?.status === 401) {
        console.log('Token validation failed:', error.message);
        return false;
      }
      // If it's not an auth error, consider the token valid
      return true;
    }
  }, []);

  // Get current user from token
  const loadUser = useCallback(async () => {
    if (isLoading) {
      try {
        const token = getToken();
        if (!token) {
          setCurrentUser(null);
          setIsAuthenticated(false);
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

        // Validate token with backend
        const isValid = await validateToken(token);
        if (!isValid) {
          console.log('Token invalid, logging out...');
          logout();
          return;
        }

        const userId = decodedToken.nameid || decodedToken.sub || decodedToken.id;
        
        const userInfo = {
          id: parseInt(userId),
          username: decodedToken.unique_name || decodedToken.name || "User" + userId,
          role: decodedToken.role || 'User',
          token: token
        };
        
        setCurrentUser(userInfo);
        setIsAuthenticated(true);
      } catch (error) {
        console.error('Failed to decode token:', error);
        setError('Authentication failed. Please login again.');
        setCurrentUser(null);
        setIsAuthenticated(false);
        logout();
      } finally {
        setIsLoading(false);
      }
    }
  }, [isLoading, getToken, isTokenExpired, logout, validateToken]);

  // Load user on mount and token changes
  useEffect(() => {
    loadUser();
  }, [loadUser]);

  // Set up interval to check token expiration
  useEffect(() => {
    const interval = setInterval(async () => {
      const token = getToken();
      if (token && isAuthenticated) {
        try {
          const decodedToken = jwtDecode(token);
          if (isTokenExpired(decodedToken)) {
            console.log('Token expired during interval check');
            logout();
            return;
          }
          
          // Validate token with backend
          const isValid = await validateToken(token);
          if (!isValid) {
            console.log('Token invalid during interval check');
            logout();
          }
        } catch (error) {
          console.error('Error checking token expiration:', error);
          logout();
        }
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [getToken, isTokenExpired, logout, validateToken, isAuthenticated]);

  return {
    currentUser,
    isLoading,
    isAuthenticated,
    error,
    getToken,
    logout,
    loadUser
  };
}; 
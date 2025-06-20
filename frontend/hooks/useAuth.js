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

  const isTokenExpired = useCallback((decodedToken) => {
    if (!decodedToken.exp) return true;
    const expirationTime = decodedToken.exp * 1000; 
    return Date.now() >= expirationTime;
  }, []);

  const getToken = useCallback(() => {
    return localStorage.getItem('token');
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('username');
    setCurrentUser(null);
    setIsAuthenticated(false);
    navigate('/login');
  }, [navigate]);

  const validateToken = useCallback(async() => {
    try {
       await API.get('/User/profile');
      return true;
    } catch (error) {
      if (error.isAuthError || error.response?.status === 401) {
        console.log('Token validation failed:', error.message);
        return false;
      }
      return true;
    }
  }, []);

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

        const decodedToken = jwtDecode(token);
        
        if (isTokenExpired(decodedToken)) {
          console.log('Token expired, logging out...');
          logout();
          return;
        }

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

  useEffect(() => {
    loadUser();
  }, [loadUser]);

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
    }, 60000); 

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
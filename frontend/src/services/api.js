import axios from 'axios';
import { config } from '../config';

// Create axios instance with your backend base URL
const API = axios.create({
  baseURL: config.API_ENDPOINT,
  timeout: 10000, // Increase timeout to 10 seconds
  headers: {
    'Content-Type': 'application/json',
  }
});

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

// Helper function to delay execution
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Add request interceptor
API.interceptors.request.use(
  (config) => {
    // Get token from localStorage
    const token = localStorage.getItem('token');
    if (token) {
      // Make sure to add 'Bearer ' prefix
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Add retry count to config
    config.retryCount = config.retryCount || 0;
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor with retry logic
API.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If we haven't reached max retries and the error is retryable
    if (originalRequest.retryCount < MAX_RETRIES && 
        (error.message === 'Network Error' || 
         error.code === 'ECONNABORTED' || 
         (error.response && [500, 502, 503, 504].includes(error.response.status)))) {
      
      originalRequest.retryCount += 1;

      // Wait before retrying
      await delay(RETRY_DELAY * originalRequest.retryCount);

      // Retry the request
      return API(originalRequest);
    }

    // If error is network related or server is down
    if (error.message === 'Network Error' || !error.response) {
      return Promise.reject({
        message: 'No response from server. Please check your connection and try again.',
        status: 0,
        details: null,
        isNetworkError: true,
        retryCount: originalRequest?.retryCount || 0
      });
    }

    // If error is timeout
    if (error.code === 'ECONNABORTED') {
      return Promise.reject({
        message: 'Request timed out. Please try again.',
        status: 408,
        details: null,
        isTimeout: true,
        retryCount: originalRequest?.retryCount || 0
      });
    }

    // Check if token is expired or invalid
    if (error.response?.status === 401) {
      // Only clear auth data and redirect if not already on login page
      if (!window.location.pathname.includes('/login')) {
        // Clear all auth data
        localStorage.removeItem('token');
        localStorage.removeItem('userId');
        localStorage.removeItem('username');
        
        // Redirect to login page
        window.location.href = '/login';
      }
      
      // Return a rejection with auth error
      return Promise.reject({
        message: 'Session expired. Please login again.',
        status: 401,
        details: null,
        isAuthError: true
      });
    }

    // Format error response
    return Promise.reject({
      message: error.response?.data?.message || 'An error occurred',
      status: error.response?.status || 500,
      details: error.response?.data || null,
      retryCount: originalRequest?.retryCount || 0
    });
  }
);

export default API; 
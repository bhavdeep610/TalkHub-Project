import axios from 'axios';
import { config } from '../config';

// Create axios instance with your backend base URL
const API = axios.create({
  baseURL: config.API_ENDPOINT,
  timeout: 5000, // 5 second timeout
  headers: {
    'Content-Type': 'application/json',
  }
});

// Add request interceptor
API.interceptors.request.use(
  (config) => {
    // Get token from localStorage
    const token = localStorage.getItem('token');
    if (token) {
      // Make sure to add 'Bearer ' prefix
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor
API.interceptors.response.use(
  (response) => response,
  async (error) => {
    // If error is network related or server is down
    if (error.message === 'Network Error' || !error.response) {
      return Promise.reject({
        message: 'No response from server. Please check your connection.',
        status: 0,
        details: null
      });
    }

    // If error is timeout
    if (error.code === 'ECONNABORTED') {
      return Promise.reject({
        message: 'Request timed out. Please try again.',
        status: 408,
        details: null
      });
    }

    // Check if token is expired or invalid
    if (error.response?.status === 401) {
      // Clear all auth data
      localStorage.removeItem('token');
      localStorage.removeItem('userId');
      localStorage.removeItem('username');
      
      // Redirect to login page
      window.location.href = '/login';
      
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
      details: error.response?.data || null
    });
  }
);

export default API; 
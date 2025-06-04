import axios from 'axios';

// Create axios instance with your backend base URL
const API = axios.create({
  baseURL: '/api',  // This will be proxied by Vite
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
    const originalRequest = error.config;

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

    // If token expired (401) and not already retrying
    if (error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      // Clear token and redirect to login
      localStorage.removeItem('token');
      window.location.href = '/login';
      
      return Promise.reject({
        message: 'Session expired. Please login again.',
        status: 401,
        details: null
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
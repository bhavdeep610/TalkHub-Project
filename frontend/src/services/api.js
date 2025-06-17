import axios from 'axios';
import { config } from '../config';

const API = axios.create({
  baseURL: config.API_BASE_URL,
  headers: {
    ...config.CORS_SETTINGS.headers
  },
  withCredentials: config.CORS_SETTINGS.credentials === 'include'
});

// Add request interceptor
API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = token;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor
API.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // If error is network-related, add a flag
    if (!error.response) {
      error.isNetworkError = true;
      return Promise.reject(error);
    }

    // If request times out, add a flag
    if (error.code === 'ECONNABORTED') {
      error.isTimeout = true;
      return Promise.reject(error);
    }

    // Handle 401 Unauthorized errors
    if (error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Try to refresh token
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        const response = await axios.post(`${config.API_BASE_URL}/Auth/refresh-token`, {
          refreshToken
        });

        if (response.data.token) {
          localStorage.setItem('token', response.data.token);
          if (response.data.refreshToken) {
            localStorage.setItem('refreshToken', response.data.refreshToken);
          }

          // Update the failed request's Authorization header
          originalRequest.headers.Authorization = response.data.token;
          return API(originalRequest);
        }
      } catch (refreshError) {
        // If refresh token fails, clear auth data and reject
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('userId');
        localStorage.removeItem('username');
        return Promise.reject(refreshError);
      }
    }

    // Handle other errors
    if (error.response) {
      // Server responded with error status
      const errorMessage = error.response.data?.message || error.response.data || error.message;
      error.message = errorMessage;

      // Add custom error properties
      error.status = error.response.status;
      error.isServerError = error.response.status >= 500;
      error.isClientError = error.response.status >= 400 && error.response.status < 500;
    }

    return Promise.reject(error);
  }
);

export default API; 
import axios from 'axios';
import { config } from '../config';

const API = axios.create({
  baseURL: config.API_BASE_URL,
  headers: {
    ...config.CORS_SETTINGS.headers
  },
  withCredentials: config.CORS_SETTINGS.credentials === 'include'
});

API.interceptors.request.use(
  (config) => {
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

API.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    if (!error.response) {
      error.isNetworkError = true;
      return Promise.reject(error);
    }

    if (error.code === 'ECONNABORTED') {
      error.isTimeout = true;
      return Promise.reject(error);
    }

    if (error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
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

          originalRequest.headers.Authorization = response.data.token;
          return API(originalRequest);
        }
      } catch (refreshError) {
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('userId');
        localStorage.removeItem('username');
        return Promise.reject(refreshError);
      }
    }

    if (error.response) {
      const errorMessage = error.response.data?.message || error.response.data || error.message;
      error.message = errorMessage;

      error.status = error.response.status;
      error.isServerError = error.response.status >= 500;
      error.isClientError = error.response.status >= 400 && error.response.status < 500;
    }

    return Promise.reject(error);
  }
);

export default API; 
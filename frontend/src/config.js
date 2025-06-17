// Get the base URL for the API
const getBaseUrl = () => {
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:5211/api';
  }
  return 'https://talkhub-backend-02fc.onrender.com/api';
};

const baseUrl = getBaseUrl();

// Ensure URL consistency by removing trailing slashes
const normalizeUrl = (url) => url.replace(/\/+$/, '');

export const config = {
  API_BASE_URL: normalizeUrl(baseUrl),
  API_ENDPOINT: normalizeUrl(`${baseUrl}`),
  WEBSOCKET_URL: normalizeUrl(baseUrl.replace(/^http/, 'ws').replace('/api', '')) + '/chathub',
  WEBSOCKET_ENDPOINT: normalizeUrl(baseUrl.replace('/api', '')) + '/chathub',
  isDevelopment: process.env.NODE_ENV === 'development',
  CORS_SETTINGS: {
    credentials: 'include',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  }
}; 
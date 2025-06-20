// Get the base URL for the API
const getBaseUrl = () => {
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:5211';
  }
  return 'https://talkhub-backend-02fc.onrender.com';
};

const baseUrl = getBaseUrl();

const normalizeUrl = (url) => url.replace(/\/+$/, '');

export const config = {
  API_BASE_URL: normalizeUrl(`${baseUrl}/api`),
  API_ENDPOINT: normalizeUrl(`${baseUrl}/api`),
  WEBSOCKET_URL: normalizeUrl(baseUrl.replace(/^http/, 'ws')) + '/chathub',
  WEBSOCKET_ENDPOINT: normalizeUrl(baseUrl) + '/chathub',
  isDevelopment: process.env.NODE_ENV === 'development',
  CORS_SETTINGS: {
    credentials: 'include',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  }
}; 
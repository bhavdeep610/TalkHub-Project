// Get the base URL for the API
const getBaseUrl = () => {
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:5211';
  }
  return 'https://talkhub-backend-02fc.onrender.com';
};

const baseUrl = getBaseUrl();

export const config = {
  API_BASE_URL: baseUrl,
  API_ENDPOINT: `${baseUrl}/api`,
  WEBSOCKET_URL: baseUrl.replace(/^http/, 'ws') + '/chathub',
  WEBSOCKET_ENDPOINT: `${baseUrl}/chathub`,
  isDevelopment: process.env.NODE_ENV === 'development'
}; 
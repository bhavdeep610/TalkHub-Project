import API from './api';
import { config } from '../src/config';

const CACHE_KEY = 'profilePictureCache';
const CACHE_EXPIRY = 30 * 60 * 1000; // 30 minutes

class ProfilePictureService {
  constructor() {
    this.cache = this.loadCache();
    this.pendingRequests = new Map();
  }

  loadCache() {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { pictures, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_EXPIRY) {
          return pictures;
        }
        // Clear expired cache
        localStorage.removeItem(CACHE_KEY);
      }
    } catch (error) {
      console.error('Error loading profile picture cache:', error);
    }
    return {};
  }

  updateCache(pictures) {
    try {
      this.cache = pictures;
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        pictures,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('Error updating profile picture cache:', error);
    }
  }

  async getProfilePicture(userId) {
    // Check cache first
    if (this.cache[userId]) {
      return this.cache[userId];
    }

    // Check if there's already a pending request for this user
    if (this.pendingRequests.has(userId)) {
      return this.pendingRequests.get(userId);
    }

    try {
      // Create a new promise for this request
      const promise = (async () => {
        try {
          const response = await API.get(`/ProfilePicture/${userId}`);
          let imageUrl = null;

          if (response.data) {
            if (typeof response.data === 'string') {
              imageUrl = response.data;
            } else if (response.data.imageUrl) {
              imageUrl = response.data.imageUrl;
            } else if (response.data.filePath) {
              imageUrl = response.data.filePath;
            }

            if (imageUrl && !imageUrl.startsWith('http')) {
              imageUrl = imageUrl.startsWith('/')
                ? `${config.API_BASE_URL}${imageUrl}`
                : `${config.API_BASE_URL}/${imageUrl}`;
            }

            // Update cache with new picture
            this.updateCache({
              ...this.cache,
              [userId]: imageUrl
            });

            return imageUrl;
          }
          return null;
        } finally {
          // Remove from pending requests when done
          this.pendingRequests.delete(userId);
        }
      })();

      // Store the promise in pending requests
      this.pendingRequests.set(userId, promise);
      return promise;
    } catch (error) {
      console.error(`Error fetching profile picture for user ${userId}:`, error);
      this.pendingRequests.delete(userId);
      return null;
    }
  }

  async getProfilePictures(userIds) {
    // Filter out users whose pictures we already have in cache
    const uncachedUserIds = userIds.filter(id => !this.cache[id]);
    
    if (uncachedUserIds.length === 0) {
      return this.cache;
    }

    try {
      // Create a map of promises for uncached users
      const fetchPromises = uncachedUserIds.map(userId => this.getProfilePicture(userId));
      
      // Wait for all promises to resolve
      await Promise.all(fetchPromises);
      
      return this.cache;
    } catch (error) {
      console.error('Error fetching multiple profile pictures:', error);
      return this.cache;
    }
  }

  clearCache() {
    this.cache = {};
    localStorage.removeItem(CACHE_KEY);
  }
}

export const profilePictureService = new ProfilePictureService(); 
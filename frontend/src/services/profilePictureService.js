import API from './api';
import { config } from '../config';

const CACHE_KEY = 'profilePictureCache';
const CACHE_EXPIRY = 30 * 60 * 1000; 

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
    if (this.cache[userId]) {
      return this.cache[userId];
    }

    if (this.pendingRequests.has(userId)) {
      return this.pendingRequests.get(userId);
    }

    try {
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

            this.updateCache({
              ...this.cache,
              [userId]: imageUrl
            });

            return imageUrl;
          }
          return null;
        } finally {
          this.pendingRequests.delete(userId);
        }
      })();

      this.pendingRequests.set(userId, promise);
      return promise;
    } catch (error) {
      console.error(`Error fetching profile picture for user ${userId}:`, error);
      this.pendingRequests.delete(userId);
      return null;
    }
  }

  async getProfilePictures(userIds) {
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return this.cache;
    }

    const uncachedUserIds = userIds.filter(id => !this.cache[id]);
    
    if (uncachedUserIds.length === 0) {
      return this.cache;
    }

    try {
      const fetchPromises = uncachedUserIds.map(async userId => {
        try {
          return await this.getProfilePicture(userId);
        } catch (error) {
          console.error(`Error fetching profile picture for user ${userId}:`, error);
          return null;
        }
      });
      
      await Promise.allSettled(fetchPromises);
      
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
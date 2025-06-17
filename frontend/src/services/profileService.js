import API from './api';

class ProfileService {
  async updateProfile(data) {
    try {
      const response = await API.put('/Profile/update', data);
      return response.data;
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  }

  async getProfile(userId) {
    try {
      const response = await API.get(`/Profile/${userId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching profile:', error);
      throw error;
    }
  }

  async changePassword(data) {
    try {
      const response = await API.post('/Profile/change-password', data);
      return response.data;
    } catch (error) {
      console.error('Error changing password:', error);
      throw error;
    }
  }
}

export const profileService = new ProfileService(); 
import API from './api';

class MessageService {
  async sendMessage(receiverId, content) {
    try {
      const response = await API.post(`/Chat/send/${receiverId}`, { content });
      return response.data;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  async getMessages(userId) {
    try {
      const response = await API.get(`/Chat/get/${userId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching messages:', error);
      throw error;
    }
  }

  async deleteMessage(messageId) {
    try {
      const response = await API.delete(`/Chat/delete/${messageId}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting message:', error);
      throw error;
    }
  }

  async updateMessage(messageId, content) {
    try {
      const response = await API.put(`/Chat/update/${messageId}`, { content });
      return response.data;
    } catch (error) {
      console.error('Error updating message:', error);
      throw error;
    }
  }
}

export const messageService = new MessageService(); 
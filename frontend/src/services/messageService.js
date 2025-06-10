import API from './api';

class MessageService {
  async editMessage(messageId, newContent) {
    try {
      const response = await API.put(`/Chat/update/${messageId}`, {
        newContent
      });
      return response.data;
    } catch (error) {
      console.error('Error editing message:', error);
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

  async getMessages(receiverId) {
    try {
      const response = await API.get(`/Chat/get/${receiverId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching messages:', error);
      throw error;
    }
  }

  async sendMessage(receiverId, content) {
    try {
      const response = await API.post('/Chat/send', {
        receiverID: receiverId,
        content
      });
      return response.data;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }
}

export const messageService = new MessageService(); 
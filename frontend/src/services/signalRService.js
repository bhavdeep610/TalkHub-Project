import * as signalR from '@microsoft/signalr';
import { config } from '../config';

class SignalRService {
  constructor() {
    this.connection = null;
    this.messageCallbacks = new Set();
    this.conversationCallbacks = new Set();
    this.typingCallbacks = new Set();
    this.connectionCallbacks = new Set();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 2000; // Start with 2 seconds
  }

  async start() {
    if (this.connection?.state === signalR.HubConnectionState.Connected) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      this.connection = new signalR.HubConnectionBuilder()
        .withUrl(config.WEBSOCKET_ENDPOINT, {
          accessTokenFactory: () => token,
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-Requested-With': 'XMLHttpRequest'
          },
          withCredentials: true
        })
        .withAutomaticReconnect({
          nextRetryDelayInMilliseconds: retryContext => {
            if (retryContext.previousRetryCount >= this.maxReconnectAttempts) {
              return null; // Stop trying to reconnect
            }

            // Exponential backoff
            const delay = Math.min(1000 * Math.pow(2, retryContext.previousRetryCount), 30000);
            return delay;
          }
        })
        .configureLogging(signalR.LogLevel.Information)
        .build();

      // Set up connection event handlers
      this.connection.onclose(error => {
        console.log('SignalR connection closed:', error);
        this.notifyConnectionCallbacks({ status: 'disconnected', error });
      });

      this.connection.onreconnecting(error => {
        console.log('SignalR reconnecting:', error);
        this.notifyConnectionCallbacks({ status: 'reconnecting', error });
      });

      this.connection.onreconnected(connectionId => {
        console.log('SignalR reconnected:', connectionId);
        this.notifyConnectionCallbacks({ status: 'connected', connectionId });
      });

      // Set up message handlers
      this.connection.on('ReceiveMessage', message => {
        this.notifyMessageCallbacks(message);
      });

      this.connection.on('ConversationUpdate', conversation => {
        this.notifyConversationCallbacks(conversation);
      });

      this.connection.on('UserTyping', data => {
        this.notifyTypingCallbacks(data);
      });

      await this.connection.start();
      console.log('SignalR connected successfully');
      this.notifyConnectionCallbacks({ status: 'connected', connectionId: this.connection.connectionId });
      this.reconnectAttempts = 0; // Reset reconnect attempts on successful connection
    } catch (error) {
      console.error('Error starting SignalR connection:', error);
      this.notifyConnectionCallbacks({ status: 'error', error });
      
      // Implement reconnection logic
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
        console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
        setTimeout(() => this.start(), delay);
      }
    }
  }

  async stop() {
    if (this.connection?.state === signalR.HubConnectionState.Connected) {
      try {
        await this.connection.stop();
        console.log('SignalR connection stopped');
        this.notifyConnectionCallbacks({ status: 'disconnected' });
      } catch (error) {
        console.error('Error stopping SignalR connection:', error);
      }
    }
  }

  // Message handling
  onReceiveMessage(callback) {
    this.messageCallbacks.add(callback);
    return () => this.messageCallbacks.delete(callback);
  }

  notifyMessageCallbacks(message) {
    this.messageCallbacks.forEach(callback => {
      try {
        callback(message);
      } catch (error) {
        console.error('Error in message callback:', error);
      }
    });
  }

  // Conversation handling
  onConversationUpdate(callback) {
    this.conversationCallbacks.add(callback);
    return () => this.conversationCallbacks.delete(callback);
  }

  notifyConversationCallbacks(conversation) {
    this.conversationCallbacks.forEach(callback => {
      try {
        callback(conversation);
      } catch (error) {
        console.error('Error in conversation callback:', error);
      }
    });
  }

  // Typing indicator handling
  onUserTyping(callback) {
    this.typingCallbacks.add(callback);
    return () => this.typingCallbacks.delete(callback);
  }

  notifyTypingCallbacks(data) {
    this.typingCallbacks.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error('Error in typing callback:', error);
      }
    });
  }

  // Connection status handling
  onConnectionChange(callback) {
    this.connectionCallbacks.add(callback);
    return () => this.connectionCallbacks.delete(callback);
  }

  notifyConnectionCallbacks(status) {
    this.connectionCallbacks.forEach(callback => {
      try {
        callback(status);
      } catch (error) {
        console.error('Error in connection callback:', error);
      }
    });
  }

  // Send a message
  async sendMessage({ receiverId, content }) {
    if (this.connection?.state !== signalR.HubConnectionState.Connected) {
      throw new Error('SignalR connection is not established');
    }

    try {
      await this.connection.invoke('SendMessage', receiverId, content);
    } catch (error) {
      console.error('Error sending message through SignalR:', error);
      throw error;
    }
  }

  // Send typing indicator
  async sendTypingIndicator(receiverId) {
    if (this.connection?.state !== signalR.HubConnectionState.Connected) {
      return; // Silently fail for typing indicators
    }

    try {
      await this.connection.invoke('TypingNotification', receiverId, true);
    } catch (error) {
      console.error('Error sending typing indicator:', error);
    }
  }

  // Get connection state
  getConnectionState() {
    return this.connection?.state || 'disconnected';
  }

  // Check if connected
  isConnected() {
    return this.connection?.state === signalR.HubConnectionState.Connected;
  }

  // Delete a message
  async deleteMessage(messageId) {
    if (this.connection?.state !== signalR.HubConnectionState.Connected) {
      throw new Error('SignalR connection is not established');
    }

    try {
      await this.connection.invoke('DeleteMessage', messageId);
    } catch (error) {
      console.error('Error deleting message through SignalR:', error);
      throw error;
    }
  }
}

const signalRService = new SignalRService();
export { signalRService };
export default signalRService; 
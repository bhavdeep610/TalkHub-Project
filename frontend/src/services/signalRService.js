import * as signalR from '@microsoft/signalr';
import { config } from '../config';

class SignalRService {
  static _instance = null;

  constructor() {
    if (SignalRService._instance) {
      return SignalRService._instance;
    }

    this._connection = null;
    this.messageCallbacks = new Set();
    this.conversationCallbacks = new Set();
    this.typingCallbacks = new Set();
    this.connectionCallbacks = new Set();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 2000;
    this.isInitialized = false;
    this.connectionPromise = null;
    this.messageQueue = new Map();

    SignalRService._instance = this;
  }

  get connection() {
    return this._connection;
  }

  set connection(value) {
    this._connection = value;
  }

  async initialize() {
    if (this.isInitialized) return;

    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('No authentication token found');
    }

    this._connection = new signalR.HubConnectionBuilder()
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
            return null;
          }
          return Math.min(1000 * Math.pow(2, retryContext.previousRetryCount), 30000);
        }
      })
      .configureLogging(signalR.LogLevel.Information)
      .build();

    this.setupEventHandlers();
    this.isInitialized = true;
  }

  setupEventHandlers() {
    if (!this.connection) return;

    this.connection.onclose(error => {
      console.log('SignalR connection closed:', error);
      this.notifyConnectionCallbacks({ status: 'disconnected', error });
    });

    this.connection.onreconnecting(error => {
      console.log('SignalR reconnecting:', error);
      this.notifyConnectionCallbacks({ status: 'reconnecting', error });
    });

    this.connection.onreconnected(async connectionId => {
      console.log('SignalR reconnected:', connectionId);
      this.notifyConnectionCallbacks({ status: 'connected', connectionId });
      
      // Process queued messages
      for (const [key, { receiverId, content }] of this.messageQueue.entries()) {
        try {
          await this.sendMessage(receiverId, content, false);
          this.messageQueue.delete(key);
        } catch (error) {
          console.error('Failed to send queued message:', error);
        }
      }
    });

    // Message events
    this.connection.on('MessageSent', message => {
      this.notifyMessageCallbacks({ type: 'sent', message });
    });

    this.connection.on('ReceiveMessage', message => {
      this.notifyMessageCallbacks({ type: 'received', message });
    });

    this.connection.on('MessageDeleted', messageId => {
      this.notifyMessageCallbacks({ type: 'delete', messageId });
    });

    this.connection.on('MessageUpdated', message => {
      this.notifyMessageCallbacks({ type: 'update', message });
    });

    this.connection.on('ConversationUpdate', conversation => {
      this.notifyConversationCallbacks(conversation);
    });

    this.connection.on('UserTyping', data => {
      this.notifyTypingCallbacks(data);
    });
  }

  async start() {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    if (this.connection?.state === signalR.HubConnectionState.Connected) {
      return Promise.resolve();
    }

    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      this.connectionPromise = this.connection.start();
      await this.connectionPromise;
      
      console.log('SignalR connected successfully');
      this.notifyConnectionCallbacks({ 
        status: 'connected', 
        connectionId: this.connection.connectionId 
      });
      
      this.reconnectAttempts = 0;
    } catch (error) {
      console.error('Error starting SignalR connection:', error);
      this.notifyConnectionCallbacks({ status: 'error', error });
      
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
        console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.start();
      }
      
      throw error;
    } finally {
      this.connectionPromise = null;
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

  async sendMessage(receiverId, content, shouldQueue = true) {
    if (!this.connection || this.connection.state !== signalR.HubConnectionState.Connected) {
      if (shouldQueue) {
        const key = `${Date.now()}-${Math.random()}`;
        this.messageQueue.set(key, { receiverId, content });
        return { queued: true, key };
      }
      throw new Error('Not connected');
    }

    try {
      await this.connection.invoke('SendMessage', receiverId, content);
      return { sent: true };
    } catch (error) {
      console.error('Error sending message:', error);
      if (shouldQueue) {
        const key = `${Date.now()}-${Math.random()}`;
        this.messageQueue.set(key, { receiverId, content });
        return { queued: true, key };
      }
      throw error;
    }
  }

  async sendTypingIndicator(receiverId) {
    if (!this.isInitialized || this.connection?.state !== signalR.HubConnectionState.Connected) {
      return;
    }

    try {
      await this.connection.invoke('TypingNotification', receiverId, true);
    } catch (error) {
      console.error('Error sending typing indicator:', error);
    }
  }

  getConnectionState() {
    return this.connection?.state || 'disconnected';
  }

  isConnected() {
    return this.isInitialized && this.connection?.state === signalR.HubConnectionState.Connected;
  }

  async deleteMessage(messageId) {
    if (!this.isConnected()) {
      throw new Error('Not connected to SignalR hub');
    }

    try {
      await this.connection.invoke('DeleteMessage', messageId);
      return { success: true };
    } catch (error) {
      console.error('Error deleting message via SignalR:', error);
      throw error;
    }
  }
}

export default new SignalRService(); 
import * as signalR from '@microsoft/signalr';

class SignalRService {
    constructor() {
        this.connection = null;
        this.messageHandlers = new Set();
        this.typingHandlers = new Set();
        this.userStatusHandlers = new Set();
        this.connectionHandlers = new Set();
        this.messageQueue = [];
        this.isReconnecting = false;
        this.connectionStarted = false;
        this.retryCount = 0;
        this.maxRetries = 5;
        this.baseUrl = process.env.REACT_APP_API_URL || 'https://talkhub-backend-02fc.onrender.com';
        this.isStarting = false;
        this.isStopping = false;
        this.reconnectTimeout = null;
    }

    async startConnection(token) {
        if (this.connectionStarted || this.isStarting || this.isStopping) {
            console.log('Connection already exists or is in progress');
            return;
        }

        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }

        this.isStarting = true;
        try {
            if (this.connection) {
                console.warn('Stopping existing connection before restarting...');
                await this.stopConnection();
            }

            const connectionBuilder = new signalR.HubConnectionBuilder()
                .withUrl(`${this.baseUrl}/chathub`, {
                    accessTokenFactory: () => token,
                    transport: signalR.HttpTransportType.WebSockets,
                    skipNegotiation: true,
                    logger: signalR.LogLevel.Warning
                })
                .withAutomaticReconnect({
                    nextRetryDelayInMilliseconds: retryContext => {
                        if (retryContext.elapsedMilliseconds < 60000) {
                            // First minute: try every 10 seconds
                            return Math.min(10000, 1000 * Math.pow(2, retryContext.previousRetryCount));
                        }
                        if (retryContext.elapsedMilliseconds < 300000) {
                            // First 5 minutes: try every 30 seconds
                            return 30000;
                        }
                        // After 5 minutes: stop trying
                        return null;
                    }
                })
                .configureLogging(signalR.LogLevel.Warning)
                .build();

            this.connection = connectionBuilder;
            this.setupEventHandlers();

            await this.connection.start();
            console.log('Connected to SignalR hub');

            this.connectionStarted = true;
            this.retryCount = 0;
            this.notifyConnectionChange({ status: 'connected', connectionId: this.connection.connectionId });

            await this.processMessageQueue();
        } catch (err) {
            console.error('Error starting SignalR connection:', err);
            this.connectionStarted = false;
            this.notifyConnectionChange({ status: 'error', error: err });
            
            // Schedule a single retry after 5 seconds
            if (!this.reconnectTimeout) {
                this.reconnectTimeout = setTimeout(() => {
                    this.reconnectTimeout = null;
                    if (!this.connectionStarted && !this.isStarting) {
                        this.startConnection(token);
                    }
                }, 5000);
            }
        } finally {
            this.isStarting = false;
        }
    }

    async stopConnection() {
        if (this.isStopping || !this.connection) return;

        this.isStopping = true;
        try {
            await this.connection.stop();
            this.connection = null;
            this.connectionStarted = false;
            this.notifyConnectionChange({ status: 'disconnected' });
        } catch (err) {
            console.error('Error stopping SignalR connection:', err);
        } finally {
            this.isStopping = false;
        }
    }

    setupEventHandlers() {
        if (!this.connection) return;

        this.connection.on('ReceiveMessage', (message) => {
            this.messageHandlers.forEach(handler => handler(message));
        });

        this.connection.on('messagesent', (message) => {
            console.log('Message sent confirmation received:', message);
            this.messageHandlers.forEach(handler => handler(message));
        });

        this.connection.on('UserTyping', (notification) => {
            this.typingHandlers.forEach(handler => handler(notification));
        });

        this.connection.on('UserOnline', (user) => {
            this.userStatusHandlers.forEach(handler => handler({ ...user, status: 'online' }));
        });

        this.connection.on('UserOffline', (user) => {
            this.userStatusHandlers.forEach(handler => handler({ ...user, status: 'offline' }));
        });

        this.connection.onreconnecting((error) => {
            if (this.isReconnecting) return;
            
            console.log('Reconnecting to SignalR hub...', error);
            this.isReconnecting = true;
            this.connectionStarted = false;
            this.notifyConnectionChange({ status: 'reconnecting', error });
        });

        this.connection.onreconnected((connectionId) => {
            console.log('Reconnected to SignalR hub', connectionId);
            this.isReconnecting = false;
            this.connectionStarted = true;
            this.retryCount = 0;
            this.notifyConnectionChange({ status: 'connected', connectionId });
            this.processMessageQueue();
        });

        this.connection.onclose((error) => {
            console.log('SignalR connection closed', error);
            this.connectionStarted = false;
            this.notifyConnectionChange({ status: 'disconnected', error });
        });
    }

    async sendMessage(receiverId, content) {
        if (!this.connection || !this.connectionStarted) {
            this.messageQueue.push({ receiverId, content });
            throw new Error('Not connected to chat');
        }

        try {
            await this.connection.invoke('SendMessage', receiverId, content);
        } catch (error) {
            console.error('Error sending message:', error);
            this.messageQueue.push({ receiverId, content });
            throw error;
        }
    }

    async processMessageQueue() {
        if (!this.connectionStarted || this.messageQueue.length === 0) return;

        while (this.messageQueue.length > 0 && this.connectionStarted) {
            const { receiverId, content } = this.messageQueue[0];
            try {
                await this.connection.invoke('SendMessage', receiverId, content);
                this.messageQueue.shift(); // Remove the message after successful send
            } catch (error) {
                console.error('Error processing message queue:', error);
                break;
            }
        }
    }

    async sendTypingNotification(receiverId, isTyping) {
        if (!this.connectionStarted) return;
        try {
            await this.connection.invoke('TypingNotification', receiverId, isTyping);
        } catch (error) {
            console.error('Error sending typing notification:', error);
        }
    }

    onReceiveMessage(handler) {
        this.messageHandlers.add(handler);
        return () => this.messageHandlers.delete(handler);
    }

    onTypingNotification(handler) {
        this.typingHandlers.add(handler);
        return () => this.typingHandlers.delete(handler);
    }

    onUserStatusChange(handler) {
        this.userStatusHandlers.add(handler);
        return () => this.userStatusHandlers.delete(handler);
    }

    onConnectionChange(handler) {
        this.connectionHandlers.add(handler);
        return () => this.connectionHandlers.delete(handler);
    }

    notifyConnectionChange(status) {
        this.connectionHandlers.forEach(handler => handler(status));
    }

    isConnected() {
        return this.connectionStarted && this.connection?.state === signalR.HubConnectionState.Connected;
    }
}

// Create a singleton instance
const signalRService = new SignalRService();
export default signalRService;

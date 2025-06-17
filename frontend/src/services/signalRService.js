import * as signalR from '@microsoft/signalr';
import { config } from '../config';

class SignalRService {
    constructor() {
        this.connection = null;
        this.messageHandlers = new Set();
        this.typingHandlers = new Set();
        this.userStatusHandlers = new Set();
        this.connectionHandlers = new Set();
        this.conversationHandlers = new Set();
        this.messageQueue = [];
        this.isReconnecting = false;
        this.connectionStarted = false;
        this.retryCount = 0;
        this.maxRetries = 5;
        this.baseUrl = config.API_BASE_URL;

        this.isStarting = false;
        this.isStopping = false;
    }

    async startConnection(token) {
        if (this.connectionStarted || this.isStarting || this.isStopping) {
            console.log('Connection already in progress or active');
            return;
        }

        this.isStarting = true;
        try {
            if (this.connection) {
                console.warn('Stopping existing connection before restarting...');
                await this.connection.stop();
                this.connection = null;
            }

            console.log('Building new SignalR connection...');
            const connectionBuilder = new signalR.HubConnectionBuilder()
                .withUrl(`${config.API_BASE_URL}/chathub`, {
                    accessTokenFactory: () => token,
                    transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.ServerSentEvents | signalR.HttpTransportType.LongPolling,
                    skipNegotiation: false,
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                })
                .withAutomaticReconnect({
                    nextRetryDelayInMilliseconds: retryContext => {
                        if (retryContext.previousRetryCount === 0) {
                            return 0;
                        } else if (retryContext.previousRetryCount < 3) {
                            return 2000;
                        } else if (retryContext.previousRetryCount < 5) {
                            return 5000;
                        } else if (retryContext.elapsedMilliseconds < 60000) {
                            return 10000;
                        }
                        return null;
                    }
                })
                .configureLogging(signalR.LogLevel.Information)
                .build();

            this.connection = connectionBuilder;

            // Add connection lifecycle logging
            this.connection.onclose((error) => {
                console.log('Connection closed', error);
                this.connectionStarted = false;
                this.notifyConnectionChange({ status: 'disconnected', error });
            });

            this.connection.onreconnecting((error) => {
                console.log('Reconnecting...', error);
                this.isReconnecting = true;
                this.connectionStarted = false;
                this.notifyConnectionChange({ status: 'reconnecting', error });
            });

            this.connection.onreconnected((connectionId) => {
                console.log('Reconnected!', connectionId);
                this.isReconnecting = false;
                this.connectionStarted = true;
                this.notifyConnectionChange({ status: 'connected', connectionId });
            });

            this.setupEventHandlers();

            console.log('Starting SignalR connection...');
            await this.connection.start();
            console.log('Connected to SignalR hub successfully');

            this.connectionStarted = true;
            this.retryCount = 0;
            this.notifyConnectionChange({ status: 'connected', connectionId: this.connection.connectionId });

            await this.processMessageQueue();
        } catch (err) {
            console.error('Error starting SignalR connection:', err);
            this.connectionStarted = false;
            this.notifyConnectionChange({ 
                status: 'error', 
                error: err,
                details: 'Failed to establish connection. Will retry automatically.'
            });

            if (this.retryCount < this.maxRetries) {
                this.retryCount++;
                const delay = Math.min(1000 * Math.pow(2, this.retryCount), 10000);
                console.log(`Scheduling retry attempt ${this.retryCount} in ${delay}ms...`);
                setTimeout(() => {
                    if (!this.connectionStarted) {
                        console.log(`Attempting retry ${this.retryCount}...`);
                        this.startConnection(token);
                    }
                }, delay);
            }
        } finally {
            this.isStarting = false;
        }
    }

    async stopConnection() {
        if (!this.connection || this.isStopping || this.isStarting) return;

        this.isStopping = true;
        try {
            this.notifyConnectionChange({ status: 'disconnecting' });
            await this.connection.stop();
            this.connectionStarted = false;
            console.log('Disconnected from SignalR hub');
            this.notifyConnectionChange({ status: 'disconnected' });
        } catch (err) {
            console.error('Error stopping SignalR connection:', err);
            this.notifyConnectionChange({ status: 'error', error: err });
        } finally {
            this.isStopping = false;
        }
    }

    setupEventHandlers() {
        this.connection.on('ReceiveMessage', (message) => {
            this.messageHandlers.forEach(handler => handler(message));
        });

        this.connection.on('messagesent', (message) => {
            console.log('Message sent confirmation received:', message);
            this.messageHandlers.forEach(handler => handler(message));
        });

        this.connection.on('MessageUpdated', (message) => {
            console.log('Message update received:', message);
            this.messageHandlers.forEach(handler => handler(message));
        });

        this.connection.on('ConversationUpdated', (conversation) => {
            console.log('Conversation update received:', conversation);
            this.conversationHandlers.forEach(handler => handler(conversation));
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
            console.log('Connection closed', error);
            this.connectionStarted = false;
            this.notifyConnectionChange({ status: 'disconnected', error });

            if (this.retryCount < this.maxRetries) {
                this.retryCount++;
                console.log(`Attempting to reconnect... (Attempt ${this.retryCount} of ${this.maxRetries})`);
                setTimeout(() => {
                    this.startConnection(); // Note: ensure token is accessible or stored
                }, 2000 * this.retryCount);
            }
        });
    }

    async sendMessage(receiverId, content) {
        const message = { receiverId, content };

        if (!this.connectionStarted || this.isReconnecting) {
            this.messageQueue.push(message);
            console.log('Message queued:', message);
            return { queued: true, message };
        }

        try {
            await this.connection.invoke('SendMessage', receiverId, content);
            return { sent: true, message };
        } catch (error) {
            console.error('Error sending message:', error);
            this.messageQueue.push(message);
            return { queued: true, error, message };
        }
    }

    async processMessageQueue() {
        if (!this.connectionStarted || this.messageQueue.length === 0) return;

        console.log(`Processing ${this.messageQueue.length} queued messages`);
        const messages = [...this.messageQueue];
        this.messageQueue = [];

        for (const message of messages) {
            try {
                await this.connection.invoke('SendMessage', message.receiverId, message.content);
                console.log('Queued message sent successfully:', message);
            } catch (error) {
                console.error('Error sending queued message:', error);
                this.messageQueue.push(message); // Re-queue
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

    onConversationUpdate(handler) {
        this.conversationHandlers.add(handler);
        return () => {
            this.conversationHandlers.delete(handler);
        };
    }

    notifyConnectionChange(state) {
        this.connectionHandlers.forEach(handler => {
            try {
                handler(state);
            } catch (error) {
                console.error('Error in connection state handler:', error);
            }
        });
    }

    isConnected() {
        return this.connectionStarted && !this.isReconnecting;
    }
}

const signalRService = new SignalRService();
export default signalRService;

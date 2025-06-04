import { useState, useEffect, useCallback } from 'react';
import signalRService from '../services/signalRService';

export const useSignalR = (token, onMessageReceived) => {
  const [connectionState, setConnectionState] = useState('disconnected');
  const [connectionError, setConnectionError] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Handle connection state changes
  useEffect(() => {
    const handleConnectionChange = ({ status, error }) => {
      setConnectionState(status);
      setConnectionError(error || null);
      setIsConnecting(status === 'connecting' || status === 'reconnecting');
    };

    const unsubscribe = signalRService.onConnectionChange(handleConnectionChange);

    // Start connection if we have a token
    if (token) {
      setIsConnecting(true);
      signalRService.startConnection(token)
        .catch(error => {
          console.error('Failed to start SignalR connection:', error);
          setConnectionError(error);
          setConnectionState('error');
        })
        .finally(() => {
          setIsConnecting(false);
        });
    }

    return () => {
      unsubscribe();
      signalRService.stopConnection();
    };
  }, [token]);

  // Set up message handler
  useEffect(() => {
    if (!onMessageReceived) return;
    
    const unsubscribe = signalRService.onReceiveMessage(onMessageReceived);
    return () => unsubscribe();
  }, [onMessageReceived]);

  // Wrap sendMessage in useCallback to maintain reference stability
  const sendMessage = useCallback(async (receiverId, content) => {
    if (!signalRService.isConnected()) {
      throw new Error('Not connected to SignalR hub');
    }
    await signalRService.sendMessage(receiverId, content);
  }, []);

  return {
    sendMessage,
    connectionState,
    connectionError,
    isConnecting,
    isConnected: signalRService.isConnected()
  };
}; 
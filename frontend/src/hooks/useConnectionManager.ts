import { useState, useRef, useCallback, useEffect } from 'react';
import { getDeviceId } from '../utils/deviceId';
import { WebSocketService } from '../services/websocket';

export enum ConnectionState {
  CONNECTED = 'connected',
  CONNECTING = 'connecting',
  DISCONNECTED = 'disconnected',
  RECONNECTING = 'reconnecting',
  FAILED = 'failed', // Auto-reconnect failed, needs manual reconnect
}

interface ConnectionManagerOptions {
  maxAutoReconnectTime: number; // Max time to attempt auto-reconnect (ms)
  onStateChange?: (state: ConnectionState) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onReconnecting?: (attempt: number) => void;
  onReconnectFailed?: () => void;
}

const DEFAULT_OPTIONS: ConnectionManagerOptions = {
  maxAutoReconnectTime: 5 * 60 * 1000, // 5 minutes
};

export function useConnectionManager(
  sessionId: string | null,
  token: string | null,
  options: Partial<ConnectionManagerOptions> = {}
) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [canManualReconnect, setCanManualReconnect] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  
  const disconnectTimeRef = useRef<number | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const wsServiceRef = useRef<WebSocketService | null>(null);
  
  // Initialize device ID
  useEffect(() => {
    getDeviceId().then(setDeviceId);
  }, []);
  
  // Update connection state and notify
  const updateConnectionState = useCallback((state: ConnectionState) => {
    setConnectionState(state);
    opts.onStateChange?.(state);
  }, [opts]);
  
  // Clear reconnect timeout
  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);
  
  // Handle successful connection
  const handleConnect = useCallback(() => {
    disconnectTimeRef.current = null;
    clearReconnectTimeout();
    setCanManualReconnect(false);
    updateConnectionState(ConnectionState.CONNECTED);
  }, [clearReconnectTimeout, updateConnectionState]);
  
  // Handle disconnection
  const handleDisconnect = useCallback(() => {
    const now = Date.now();
    
    // Record disconnect time if not already recorded
    if (!disconnectTimeRef.current) {
      disconnectTimeRef.current = now;
    }
    
    // Check if we should attempt auto-reconnect
    const timeSinceDisconnect = now - disconnectTimeRef.current;
    
    if (timeSinceDisconnect < opts.maxAutoReconnectTime) {
      // Within auto-reconnect window
      updateConnectionState(ConnectionState.RECONNECTING);
      
      // WebSocketService will handle the actual reconnection
      // We just track the state here
    } else {
      // Outside auto-reconnect window
      clearReconnectTimeout();
      updateConnectionState(ConnectionState.FAILED);
      setCanManualReconnect(true);
      
      // Stop auto-reconnect in WebSocketService
      if (wsServiceRef.current) {
        wsServiceRef.current.disconnect();
      }
    }
  }, [opts.maxAutoReconnectTime, clearReconnectTimeout, updateConnectionState]);
  
  // Connect with device ID
  const connect = useCallback(async () => {
    if (!sessionId || !token || !deviceId) return;
    
    updateConnectionState(ConnectionState.CONNECTING);
    
    try {
      // Create or get WebSocket service instance
      wsServiceRef.current = WebSocketService.getInstance();
      
      // Set up event handlers
      wsServiceRef.current.on('connect', () => {
        handleConnect();
        opts.onConnect?.();
      });
      wsServiceRef.current.on('disconnect', () => {
        handleDisconnect();
        opts.onDisconnect?.();
      });
      wsServiceRef.current.on('error', (error: any) => {
        console.error('WebSocket error:', error);
        handleDisconnect();
      });
      wsServiceRef.current.on('reconnecting', (attempt: number) => {
        opts.onReconnecting?.(attempt);
      });
      wsServiceRef.current.on('reconnectFailed', () => {
        opts.onReconnectFailed?.();
      });
      
      // Connect with device ID
      await wsServiceRef.current.connect(sessionId, token, { deviceId });
    } catch (error) {
      console.error('Failed to connect:', error);
      updateConnectionState(ConnectionState.FAILED);
      setCanManualReconnect(true);
    }
  }, [sessionId, token, deviceId, handleConnect, handleDisconnect, updateConnectionState]);
  
  // Manual reconnect
  const manualReconnect = useCallback(() => {
    if (!canManualReconnect) return;
    
    // Reset disconnect time to allow auto-reconnect again
    disconnectTimeRef.current = null;
    setCanManualReconnect(false);
    
    // Reconnect
    connect();
  }, [canManualReconnect, connect]);
  
  // Disconnect
  const disconnect = useCallback(() => {
    clearReconnectTimeout();
    disconnectTimeRef.current = null;
    
    if (wsServiceRef.current) {
      wsServiceRef.current.disconnect();
      wsServiceRef.current = null;
    }
    
    updateConnectionState(ConnectionState.DISCONNECTED);
  }, [clearReconnectTimeout, updateConnectionState]);
  
  // Monitor reconnect timeout
  useEffect(() => {
    if (connectionState !== ConnectionState.RECONNECTING || !disconnectTimeRef.current) {
      return;
    }
    
    // Set up a timeout to stop auto-reconnect
    const checkReconnectTimeout = () => {
      if (!disconnectTimeRef.current) return;
      
      const timeSinceDisconnect = Date.now() - disconnectTimeRef.current;
      
      if (timeSinceDisconnect >= opts.maxAutoReconnectTime) {
        // Stop auto-reconnect
        handleDisconnect();
      } else {
        // Check again in 1 second
        reconnectTimeoutRef.current = setTimeout(checkReconnectTimeout, 1000);
      }
    };
    
    checkReconnectTimeout();
    
    return () => clearReconnectTimeout();
  }, [connectionState, opts.maxAutoReconnectTime, handleDisconnect, clearReconnectTimeout]);
  
  // Connect when ready
  useEffect(() => {
    if (sessionId && token && deviceId) {
      connect();
    }
    
    return () => disconnect();
  }, [sessionId, token, deviceId]); // eslint-disable-line react-hooks/exhaustive-deps
  
  return {
    connectionState,
    canManualReconnect,
    manualReconnect,
    disconnect,
    deviceId,
    isConnected: connectionState === ConnectionState.CONNECTED,
    isConnecting: connectionState === ConnectionState.CONNECTING || connectionState === ConnectionState.RECONNECTING,
  };
}
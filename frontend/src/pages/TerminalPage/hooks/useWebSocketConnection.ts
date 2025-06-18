import { useEffect, useCallback, RefObject, useState } from 'react';
import { wsService } from '../../../services/websocket';
import { useConnectionManager, ConnectionState } from '../../../hooks/useConnectionManager';
import type { StableTerminalHandle as TerminalHandle } from '../../../components/StableTerminal';

interface UseWebSocketConnectionProps {
  currentSessionId: string | null;
  token: string | null;
  isTerminalReady: boolean;
  terminalRef: RefObject<TerminalHandle>;
  setSessions: React.Dispatch<React.SetStateAction<any[]>>;
  setCurrentSessionId: React.Dispatch<React.SetStateAction<string | null>>;
  setError: (error: string | null) => void;
  isMobileKeyboard: boolean;
  isKeyboardToolbarVisible: boolean;
}

interface UseWebSocketConnectionReturn {
  handleTerminalData: (data: string) => void;
  handleTerminalResize: (cols: number, rows: number) => void;
  connectionState: ConnectionState;
  canManualReconnect: boolean;
  manualReconnect: () => void;
}

export function useWebSocketConnection({
  currentSessionId,
  token,
  isTerminalReady,
  terminalRef,
  setSessions,
  setCurrentSessionId,
  setError,
  isMobileKeyboard,
  isKeyboardToolbarVisible,
}: UseWebSocketConnectionProps): UseWebSocketConnectionReturn {
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  
  // Use the connection manager hook
  const {
    connectionState,
    canManualReconnect,
    manualReconnect: doManualReconnect,
    deviceId,
    isConnected,
  } = useConnectionManager(
    isTerminalReady ? currentSessionId : null,
    isTerminalReady ? token : null,
    {
      onConnect: () => {
        console.log('WebSocket connected successfully');
        setError(null);
        setReconnectAttempt(0);
      },
      onDisconnect: () => {
        console.log('WebSocket disconnected');
      },
      onReconnecting: (attempt) => {
        console.log(`WebSocket reconnecting (attempt ${attempt})`);
        setReconnectAttempt(attempt);
      },
      onReconnectFailed: () => {
        console.log('WebSocket reconnection failed');
        setError('Connection lost. Click reconnect to try again.');
      },
    }
  );
  
  // Set up message handlers
  useEffect(() => {
    if (!isConnected || !currentSessionId) return;
    
    const terminalDataHandler = (message: any) => {
      if (terminalRef.current?.write) {
        terminalRef.current.write(message.data);
      }
      
      // Update session activity time locally
      setSessions(prev => prev.map(s => 
        s.id === currentSessionId 
          ? { ...s, lastActivity: new Date().toISOString() }
          : s
      ));
    };
    
    const terminalClearHandler = () => {
      if (terminalRef.current?.clear) {
        terminalRef.current.clear();
      }
    };
    
    const terminalExitHandler = (message: any) => {
      const exitCode = message.data?.exitCode || 0;
      console.log(`Session ${currentSessionId} exited with code ${exitCode}`);
      
      // Show notification
      setError(`Session terminated (exit code: ${exitCode})`);
      
      // Update session status locally to show it's dead
      setSessions(prev => prev.map(s => 
        s.id === currentSessionId 
          ? { ...s, status: 'dead' }
          : s
      ));
      
      // Disconnect WebSocket to prevent reconnection attempts
      wsService.disconnect();
      
      // Clear the current session ID
      setCurrentSessionId(null);
    };
    
    wsService.onMessage('terminal_data', terminalDataHandler);
    wsService.onMessage('terminal_clear', terminalClearHandler);
    wsService.onMessage('terminal_exit', terminalExitHandler);
    
    return () => {
      console.log('Cleaning up WebSocket message handlers');
      wsService.offMessage('terminal_data');
      wsService.offMessage('terminal_clear');
      wsService.offMessage('terminal_exit');
    };
  }, [isConnected, currentSessionId, terminalRef, setSessions, setCurrentSessionId, setError]);

  // Terminal handlers
  const handleTerminalData = useCallback((data: string) => {
    if (!isConnected) {
      console.warn('Cannot send data - WebSocket not connected');
      return;
    }
    
    wsService.sendTerminalInput(data);
    
    // Update session activity time locally
    setSessions(prev => prev.map(s => 
      s.id === currentSessionId 
        ? { ...s, lastActivity: new Date().toISOString() }
        : s
    ));
    
    // On mobile, ensure input is visible when typing
    if (isMobileKeyboard && isKeyboardToolbarVisible) {
      setTimeout(() => {
        if (terminalRef.current) {
          // Use smart scrolling to cursor position
          try {
            terminalRef.current.scrollToCursor();
          } catch (e) {
            terminalRef.current.scrollToBottom();
          }
        }
      }, 50);
    }
  }, [currentSessionId, setSessions, isMobileKeyboard, isKeyboardToolbarVisible, terminalRef, isConnected]);

  const handleTerminalResize = useCallback((cols: number, rows: number) => {
    wsService.sendTerminalResize(cols, rows);
  }, []);
  
  const manualReconnect = useCallback(() => {
    if (!token) return;
    doManualReconnect();
  }, [token, doManualReconnect]);

  return {
    handleTerminalData,
    handleTerminalResize,
    connectionState,
    canManualReconnect,
    manualReconnect,
  };
}
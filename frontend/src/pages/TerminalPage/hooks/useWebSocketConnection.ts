import { useEffect, useCallback, RefObject } from 'react';
import { wsService } from '../../../services/websocket';
import type { StableTerminalHandle as TerminalHandle } from '../../../components/StableTerminal';

interface UseWebSocketConnectionProps {
  currentSessionId: string | null;
  token: string | null;
  isTerminalReady: boolean;
  terminalRef: RefObject<TerminalHandle>;
  setSessions: React.Dispatch<React.SetStateAction<any[]>>;
  setError: (error: string | null) => void;
  isMobileKeyboard: boolean;
  isKeyboardToolbarVisible: boolean;
}

interface UseWebSocketConnectionReturn {
  handleTerminalData: (data: string) => void;
  handleTerminalResize: (cols: number, rows: number) => void;
}

export function useWebSocketConnection({
  currentSessionId,
  token,
  isTerminalReady,
  terminalRef,
  setSessions,
  setError,
  isMobileKeyboard,
  isKeyboardToolbarVisible,
}: UseWebSocketConnectionProps): UseWebSocketConnectionReturn {
  // Handle WebSocket connection only after terminal is ready
  useEffect(() => {
    if (!token || !currentSessionId || !isTerminalReady) return;
    
    console.log('Setting up WebSocket connection for session:', currentSessionId, '(terminal ready)');
    
    // Connect to WebSocket after terminal is initialized
    wsService.connect(currentSessionId, token).catch((error) => {
      console.error('Failed to connect to WebSocket:', error);
      setError('Failed to connect to session');
    });
    
    // Set up message handlers
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
    
    wsService.onMessage('terminal_data', terminalDataHandler);
    wsService.onMessage('terminal_clear', terminalClearHandler);
    
    return () => {
      console.log('Cleaning up WebSocket connection for session:', currentSessionId);
      wsService.offMessage('terminal_data');
      wsService.offMessage('terminal_clear');
      wsService.disconnect();
    };
  }, [currentSessionId, token, isTerminalReady, terminalRef, setSessions, setError]);

  // Terminal handlers
  const handleTerminalData = useCallback((data: string) => {
    if (!wsService.isConnected()) return;
    
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
  }, [currentSessionId, setSessions, isMobileKeyboard, isKeyboardToolbarVisible, terminalRef]);

  const handleTerminalResize = useCallback((cols: number, rows: number) => {
    wsService.sendTerminalResize(cols, rows);
  }, []);

  return {
    handleTerminalData,
    handleTerminalResize,
  };
}
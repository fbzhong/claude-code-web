import { useState, useCallback, useEffect, useRef } from 'react';
import { SessionInfo } from '../../../components/SessionList';
import { sessionApi } from '../../../services/sessionApi';
import { wsService, sessionListWsService } from '../../../services/websocket';
import { OperationStates } from '../components/SessionsDrawer';

interface UseSessionManagementProps {
  token: string | null;
  onError: (error: string) => void;
}

interface UseSessionManagementReturn {
  // States
  sessions: SessionInfo[];
  currentSessionId: string | null;
  operationStates: OperationStates;
  
  // Actions
  loadSessions: () => void;
  createNewSession: (name: string, workingDir?: string) => void;
  selectSession: (sessionId: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  renameSession: (sessionId: string, newName: string) => Promise<void>;
  refreshSessions: (showLoading?: boolean) => Promise<void>;
  
  // Setters
  setSessions: React.Dispatch<React.SetStateAction<SessionInfo[]>>;
  setCurrentSessionId: React.Dispatch<React.SetStateAction<string | null>>;
}

export const useSessionManagement = ({ 
  token, 
  onError 
}: UseSessionManagementProps): UseSessionManagementReturn => {
  // Session states
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  
  // Operation states
  const [operationStates, setOperationStates] = useState<OperationStates>({
    creating: false,
    refreshing: false,
    selecting: null,
    deleting: new Set(),
    renaming: new Set(),
  });
  
  const isCreatingRef = useRef(false);
  const currentSessionIdRef = useRef<string | null>(null);
  
  // Helper to update operation states
  const updateOperationState = useCallback((updates: Partial<OperationStates>) => {
    setOperationStates(prev => ({ ...prev, ...updates }));
  }, []);

  // Refresh sessions from server
  const refreshSessions = useCallback(async (showLoading = true) => {
    if (showLoading) {
      updateOperationState({ refreshing: true });
    }
    
    try {
      const sessionList = await sessionApi.getAllSessions();
      setSessions(sessionList);
    } catch (err: any) {
      console.error('Failed to fetch sessions:', err);
      // Don't show error for background refresh
      if (showLoading) {
        onError('Failed to fetch sessions');
      }
    } finally {
      if (showLoading) {
        updateOperationState({ refreshing: false });
      }
    }
  }, [updateOperationState, onError]);

  // Create new session
  const createNewSession = useCallback((name: string, workingDir?: string) => {
    
    // Check and set creating state using ref
    if (isCreatingRef.current) {
      return;
    }
    
    // Set creating flag
    isCreatingRef.current = true;
    updateOperationState({ creating: true });
    
    
    // Use an IIFE to handle the async work
    (async () => {
      try {
        
        // Disconnect from current session if needed
        if (wsService.isConnected()) {
          wsService.disconnect();
        }
        
        const newSession = await sessionApi.createSession({ name, workingDir });
        
        // Validate the response has required fields
        if (!newSession || !newSession.id) {
          throw new Error('Invalid session response from server');
        }
        
        // Only set the current session ID - the session will be added via WebSocket event
        setCurrentSessionId(newSession.id);
        
        
      } catch (err: any) {
        console.error('createNewSession: Error occurred:', err);
        onError(err.message || 'Failed to create session');
        refreshSessions(false);
      } finally {
        isCreatingRef.current = false;
        updateOperationState({ creating: false });
      }
    })();
    
  }, [refreshSessions, updateOperationState, onError]);

  // Select session
  const selectSession = useCallback(async (sessionId: string) => {
    // Check if already selecting this session
    if (operationStates.selecting === sessionId) return;
    
    // If clicking the same session that's already active, just return
    if (currentSessionId === sessionId && wsService.isConnected()) {
      return;
    }
    
    updateOperationState({ selecting: sessionId });
    
    try {
      // Disconnect from current session if switching to a different one
      if (wsService.isConnected() && currentSessionId !== sessionId) {
        wsService.disconnect();
      }
      
      // Don't call attachToSession API here - WebSocket connection will handle it
      // This avoids double counting of connected clients
      
      setCurrentSessionId(sessionId);
      
    } catch (err: any) {
      onError(err.message || 'Failed to attach to session');
    } finally {
      updateOperationState({ selecting: null });
    }
  }, [currentSessionId, operationStates.selecting, updateOperationState, onError]);

  // Delete session
  const deleteSession = useCallback(async (sessionId: string) => {
    // Check if already deleting
    if (operationStates.deleting.has(sessionId)) return;
    
    // Add to deleting set
    updateOperationState({
      deleting: new Set([...operationStates.deleting, sessionId])
    });
    
    // Store original sessions for rollback
    const originalSessions = sessions;
    
    // Optimistic update - remove immediately
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    
    // If deleting current session, clear it
    if (sessionId === currentSessionId) {
      wsService.disconnect();
      setCurrentSessionId(null);
    }
    
    try {
      await sessionApi.deleteSession(sessionId);
      
      // Background refresh to sync with server
      refreshSessions(false);
      
    } catch (err: any) {
      // Rollback on error
      setSessions(originalSessions);
      onError(err.message || 'Failed to delete session');
    } finally {
      // Remove from deleting set
      updateOperationState({
        deleting: new Set([...operationStates.deleting].filter(id => id !== sessionId))
      });
    }
  }, [currentSessionId, sessions, operationStates.deleting, refreshSessions, updateOperationState, onError]);

  // Rename session
  const renameSession = useCallback(async (sessionId: string, newName: string) => {
    // Check if already renaming
    if (operationStates.renaming.has(sessionId)) return;
    
    // Add to renaming set
    updateOperationState({
      renaming: new Set([...operationStates.renaming, sessionId])
    });
    
    // Store original name for rollback
    const originalSessions = sessions;
      
    // Optimistic update - rename immediately
    setSessions(prev => prev.map(s => 
      s.id === sessionId ? { ...s, name: newName } : s
    ));
    
    try {
      await sessionApi.renameSession(sessionId, newName);
      
      // Background refresh to sync with server
      refreshSessions(false);
      
    } catch (err: any) {
      // Rollback on error
      setSessions(originalSessions);
      onError(err.message || 'Failed to rename session');
    } finally {
      // Remove from renaming set
      updateOperationState({
        renaming: new Set([...operationStates.renaming].filter(id => id !== sessionId))
      });
    }
  }, [sessions, operationStates.renaming, refreshSessions, updateOperationState, onError]);

  // Keep currentSessionIdRef in sync
  useEffect(() => {
    currentSessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

  // Load sessions on mount and setup WebSocket
  useEffect(() => {
    if (token) {
      refreshSessions();
      
      // Use a ref to track if we're already trying to connect
      let isConnecting = false;
      let retryTimeout: NodeJS.Timeout | null = null;
      
      // Connect to session list WebSocket with retry logic
      const connectSessionListWS = () => {
        if (isConnecting) {
          return;
        }
        
        isConnecting = true;
        
        sessionListWsService.connect(token).then(() => {
          isConnecting = false;
        }).catch((error) => {
          console.error('Failed to connect to session list WebSocket:', error);
          isConnecting = false;
          
          // Only retry if the error is not due to an existing connection
          if (!error.message?.includes('already connected')) {
            // Retry connection after delay
            retryTimeout = setTimeout(connectSessionListWS, 3000);
          }
        });
      };
      
      connectSessionListWS();
      
      // Setup session list message handlers
      const handleSessionList = (message: any) => {
        setSessions(message.data);
      };
      
      const handleSessionUpdated = (message: any) => {
        const { session, eventType } = message.data;
        
        setSessions(prev => {
          if (eventType === 'created') {
            // Check if session already exists to avoid duplicates
            const exists = prev.find(s => s.id === session.id);
            return exists ? prev : [...prev, session];
          } else {
            // Update existing session
            const updated = prev.map(s => s.id === session.id ? session : s);
            return updated;
          }
        });
      };
      
      const handleSessionDeleted = (message: any) => {
        const { sessionId } = message.data;
        
        setSessions(prev => {
          const filtered = prev.filter(s => s.id !== sessionId);
          return filtered;
        });
        
        // If the deleted session was the current one, clear it
        if (sessionId === currentSessionIdRef.current) {
          setCurrentSessionId(null);
        }
      };
      
      sessionListWsService.onMessage('session_list', handleSessionList);
      sessionListWsService.onMessage('session_updated', handleSessionUpdated);
      sessionListWsService.onMessage('session_deleted', handleSessionDeleted);
      
      // Periodic refresh as fallback
      const interval = setInterval(() => {
        refreshSessions(false);
      }, 60000); // Reduced to 1 minute since we have real-time updates
      
      return () => {
        // Clear retry timeout if exists
        if (retryTimeout) {
          clearTimeout(retryTimeout);
        }
        clearInterval(interval);
        sessionListWsService.offMessage('session_list');
        sessionListWsService.offMessage('session_updated');
        sessionListWsService.offMessage('session_deleted');
        sessionListWsService.disconnect();
      };
    }
  }, [token, refreshSessions]);

  // Load sessions alias for compatibility
  const loadSessions = useCallback(() => {
    refreshSessions();
  }, [refreshSessions]);

  return {
    // States
    sessions,
    currentSessionId,
    operationStates,
    
    // Actions
    loadSessions,
    createNewSession,
    selectSession,
    deleteSession,
    renameSession,
    refreshSessions,
    
    // Setters
    setSessions,
    setCurrentSessionId,
  };
};
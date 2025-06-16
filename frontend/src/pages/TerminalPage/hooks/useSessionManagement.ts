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
    console.log('createNewSession called with:', name, workingDir);
    
    // Check and set creating state using ref
    if (isCreatingRef.current) {
      console.log('createNewSession: Already creating, skipping');
      return;
    }
    
    // Set creating flag
    isCreatingRef.current = true;
    updateOperationState({ creating: true });
    
    console.log('createNewSession: Starting async work');
    
    // Use an IIFE to handle the async work
    (async () => {
      try {
        console.log('createNewSession: Inside async IIFE');
        
        // Disconnect from current session if needed
        if (wsService.isConnected()) {
          console.log('createNewSession: Disconnecting from current session');
          wsService.disconnect();
        }
        
        console.log('createNewSession: Calling API to create session');
        const newSession = await sessionApi.createSession({ name, workingDir });
        console.log('createNewSession: API returned session:', newSession);
        
        // Validate the response has required fields
        if (!newSession || !newSession.id) {
          throw new Error('Invalid session response from server');
        }
        
        // Update states
        setSessions(prev => [...prev, newSession]);
        setCurrentSessionId(newSession.id);
        
        // Background refresh to sync with server
        refreshSessions(false);
        
        console.log('createNewSession: Session created successfully');
      } catch (err: any) {
        console.error('createNewSession: Error occurred:', err);
        onError(err.message || 'Failed to create session');
        refreshSessions(false);
      } finally {
        console.log('createNewSession: Resetting creating state');
        isCreatingRef.current = false;
        updateOperationState({ creating: false });
      }
    })();
    
    console.log('createNewSession: Function returning, async work continues');
  }, [refreshSessions, updateOperationState, onError]);

  // Select session
  const selectSession = useCallback(async (sessionId: string) => {
    // Check if already selecting this session
    if (operationStates.selecting === sessionId) return;
    
    // If clicking the same session that's already active, just return
    if (currentSessionId === sessionId && wsService.isConnected()) {
      console.log('Already connected to session:', sessionId);
      return;
    }
    
    updateOperationState({ selecting: sessionId });
    
    try {
      // Disconnect from current session if switching to a different one
      if (wsService.isConnected() && currentSessionId !== sessionId) {
        wsService.disconnect();
      }
      
      // Only call attachToSession API if we're switching to a different session
      if (currentSessionId !== sessionId) {
        await sessionApi.attachToSession(sessionId);
      }
      
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

  // Load sessions on mount and setup WebSocket
  useEffect(() => {
    if (token) {
      refreshSessions();
      
      // Connect to session list WebSocket with retry logic
      const connectSessionListWS = () => {
        console.log('🔌 Attempting to connect session list WebSocket...');
        sessionListWsService.connect(token).then(() => {
          console.log('✅ Connected to session list WebSocket');
        }).catch((error) => {
          console.error('❌ Failed to connect to session list WebSocket:', error);
          // Retry connection after delay
          setTimeout(connectSessionListWS, 3000);
        });
      };
      
      connectSessionListWS();
      
      // Setup session list message handlers
      const handleSessionList = (message: any) => {
        console.log('Received session list:', message.data);
        setSessions(message.data);
      };
      
      const handleSessionUpdated = (message: any) => {
        console.log('🔄 Session updated event received:', message.data);
        const { session, eventType } = message.data;
        
        console.log('Session data:', {
          id: session.id,
          name: session.name,
          status: session.status,
          workingDir: session.workingDir,
          lastCommand: session.lastCommand,
          isExecuting: session.isExecuting,
          connectedClients: session.connectedClients
        });
        
        setSessions(prev => {
          if (eventType === 'created') {
            console.log('➕ Adding new session to list');
            // Check if session already exists to avoid duplicates
            const exists = prev.find(s => s.id === session.id);
            return exists ? prev : [...prev, session];
          } else {
            console.log('🔄 Updating existing session in list');
            // Update existing session
            const updated = prev.map(s => s.id === session.id ? session : s);
            console.log('Updated sessions list:', updated.map(s => ({ 
              id: s.id.slice(0, 8), 
              workingDir: s.workingDir, 
              lastCommand: s.lastCommand, 
              isExecuting: s.isExecuting,
              connectedClients: s.connectedClients
            })));
            return updated;
          }
        });
      };
      
      const handleSessionDeleted = (message: any) => {
        console.log('Session deleted:', message.data);
        const { sessionId } = message.data;
        setSessions(prev => prev.filter(s => s.id !== sessionId));
        
        // If current session was deleted, clear it
        if (sessionId === currentSessionId) {
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
        clearInterval(interval);
        sessionListWsService.offMessage('session_list');
        sessionListWsService.offMessage('session_updated');
        sessionListWsService.offMessage('session_deleted');
        sessionListWsService.disconnect();
      };
    }
  }, [token, refreshSessions, currentSessionId]);

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
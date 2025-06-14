import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Button,
  Alert,
  Snackbar,
  Paper,
  LinearProgress,
  CircularProgress,
  useTheme,
  useMediaQuery,
  SwipeableDrawer,
  Badge,
} from '@mui/material';
import {
  Logout as LogoutIcon,
  Terminal as TerminalIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Circle as CircleIcon,
  Close as CloseIcon,
  ViewList as ViewListIcon,
} from '@mui/icons-material';
import { SessionInfo } from '../components/SessionList';
import { sessionApi } from '../services/sessionApi';
import { StableTerminal as Terminal } from '../components/StableTerminal';
import type { StableTerminalHandle as TerminalHandle } from '../components/StableTerminal';
import { wsService } from '../services/websocket';
import { useAuthStore } from '../stores/authStore';
import { useNavigate } from 'react-router-dom';

// Unified operation states
interface OperationStates {
  creating: boolean;
  refreshing: boolean;
  selecting: string | null;
  deleting: Set<string>;
  renaming: Set<string>;
}

export const TerminalPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, token, logout } = useAuthStore();
  
  // UI states
  const [mobileSessionsOpen, setMobileSessionsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
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
  
  const terminalRef = useRef<TerminalHandle>(null);
  const isCreatingRef = useRef(false);
  
  // Responsive design
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isTablet = useMediaQuery(theme.breakpoints.down('lg'));
  
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
        setError('Failed to fetch sessions');
      }
    } finally {
      if (showLoading) {
        updateOperationState({ refreshing: false });
      }
    }
  }, [updateOperationState]);

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
        
        if (terminalRef.current?.clear) {
          terminalRef.current.clear();
        }
        
        // Background refresh to sync with server
        refreshSessions(false);
        
        console.log('createNewSession: Session created successfully');
      } catch (err: any) {
        console.error('createNewSession: Error occurred:', err);
        setError(err.message || 'Failed to create session');
        refreshSessions(false);
      } finally {
        console.log('createNewSession: Resetting creating state');
        isCreatingRef.current = false;
        updateOperationState({ creating: false });
      }
    })();
    
    console.log('createNewSession: Function returning, async work continues');
  }, [refreshSessions, updateOperationState]);

  // Select session
  const selectSession = useCallback(async (sessionId: string) => {
    // Check if already selecting this session
    if (operationStates.selecting === sessionId) return;
    
    updateOperationState({ selecting: sessionId });
    
    try {
      // Disconnect from current session
      if (currentSessionId && wsService.isConnected()) {
        wsService.disconnect();
      }
      
      await sessionApi.attachToSession(sessionId);
      
      setCurrentSessionId(sessionId);
      
      if (terminalRef.current?.clear) {
        terminalRef.current.clear();
      }
      
    } catch (err: any) {
      setError(err.message || 'Failed to attach to session');
    } finally {
      updateOperationState({ selecting: null });
    }
  }, [currentSessionId, updateOperationState]);

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
      if (terminalRef.current?.clear) {
        terminalRef.current.clear();
      }
    }
    
    try {
      await sessionApi.deleteSession(sessionId);
      
      // Background refresh to sync with server
      refreshSessions(false);
      
    } catch (err: any) {
      // Rollback on error
      setSessions(originalSessions);
      setError(err.message || 'Failed to delete session');
    } finally {
      // Remove from deleting set
      updateOperationState({
        deleting: new Set([...operationStates.deleting].filter(id => id !== sessionId))
      });
    }
  }, [currentSessionId, sessions, refreshSessions, updateOperationState]);

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
    const originalSession = sessions.find(s => s.id === sessionId);
    
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
      setError(err.message || 'Failed to rename session');
    } finally {
      // Remove from renaming set
      updateOperationState({
        renaming: new Set([...operationStates.renaming].filter(id => id !== sessionId))
      });
    }
  }, [sessions, refreshSessions, updateOperationState]);

  // Load sessions on mount
  useEffect(() => {
    if (token) {
      refreshSessions();
      
      // Periodic refresh for activity times
      const interval = setInterval(() => {
        refreshSessions(false);
      }, 30000);
      
      return () => clearInterval(interval);
    }
  }, [token, refreshSessions]);

  // Handle WebSocket connection
  useEffect(() => {
    if (!token || !currentSessionId) return;
    
    // Connect to WebSocket
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
      wsService.offMessage('terminal_data');
      wsService.offMessage('terminal_clear');
      wsService.disconnect();
    };
  }, [currentSessionId, token]);

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
  }, [currentSessionId]);

  const handleTerminalResize = useCallback((cols: number, rows: number) => {
    wsService.sendTerminalResize(cols, rows);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 5000) return 'Just now';
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000);
      return minutes === 1 ? '1 min ago' : `${minutes} mins ago`;
    }
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
    }
    const days = Math.floor(diff / 86400000);
    return days === 1 ? '1 day ago' : `${days} days ago`;
  };

  const getStatusColor = (status: SessionInfo['status']): 'success' | 'warning' | 'error' | 'default' => {
    switch (status) {
      case 'active': return 'success';
      case 'detached': return 'warning';
      case 'dead': return 'error';
      default: return 'default';
    }
  };

  return (
    <Box sx={{ display: 'flex', height: '100vh', flexDirection: 'column' }}>
      <AppBar position="static" sx={{ bgcolor: '#2d2d30' }}>
        <Toolbar sx={{ minHeight: { xs: 56, sm: 64 } }}>
          
          {/* Show sessions button on mobile */}
          {isMobile && currentSessionId && (
            <IconButton
              color="inherit"
              onClick={() => setMobileSessionsOpen(true)}
              sx={{ mr: 1 }}
            >
              <Badge badgeContent={sessions.length} color="primary">
                <ViewListIcon />
              </Badge>
            </IconButton>
          )}
          
          <Typography 
            variant={isMobile ? "subtitle1" : "h6"} 
            sx={{ 
              flexGrow: 1, 
              fontWeight: 600,
              display: { xs: 'none', sm: 'block' }
            }}
          >
            Claude Web Terminal
          </Typography>
          
          {/* Simplified mobile header */}
          <Typography 
            variant="subtitle1" 
            sx={{ 
              flexGrow: 1, 
              fontWeight: 600,
              display: { xs: 'block', sm: 'none' }
            }}
          >
            Terminal
          </Typography>
          
          {!isMobile && (
            <Typography variant="body2" sx={{ mr: 2, opacity: 0.9 }}>
              {user?.username}
            </Typography>
          )}
          
          <IconButton 
            color="inherit" 
            onClick={handleLogout} 
            size={isMobile ? "medium" : "small"}
          >
            <LogoutIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Box sx={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* Sessions Sidebar - Hidden on mobile */}
        {!isMobile && (
          <Paper sx={{ 
            width: isTablet ? 280 : 350, 
            bgcolor: '#1e1e1e', 
            borderRight: '1px solid rgba(255,255,255,0.1)',
            display: 'flex',
            flexDirection: 'column',
            transition: 'width 0.3s ease'
          }}>
          <Box sx={{ p: 2, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <Typography variant="h6" sx={{ color: '#ffffff', mb: 2 }}>
              Active Sessions
            </Typography>
            <Button
              fullWidth
              variant="contained"
              startIcon={operationStates.creating ? <CircularProgress size={18} /> : <AddIcon />}
              onClick={() => createNewSession(`Session ${sessions.length + 1}`)}
              disabled={operationStates.creating}
              sx={{ mb: 1 }}
            >
              {operationStates.creating ? 'Creating...' : 'New Session'}
            </Button>
            <Button
              fullWidth
              variant="outlined"
              onClick={() => refreshSessions()}
              disabled={operationStates.refreshing}
              size="small"
            >
              {operationStates.refreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
          </Box>

          {operationStates.refreshing && <LinearProgress />}

          <Box sx={{ flex: 1, overflow: 'auto' }}>
            {sessions.length === 0 ? (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  No active sessions. Create your first session to get started.
                </Typography>
              </Box>
            ) : (
              <List dense>
                {sessions.map((session) => (
                  <ListItem 
                    key={session.id} 
                    button
                    selected={session.id === currentSessionId}
                    onClick={() => selectSession(session.id)}
                    disabled={operationStates.selecting === session.id}
                    sx={{ 
                      borderRadius: 1,
                      mx: 1,
                      mb: 0.5,
                      opacity: operationStates.selecting === session.id ? 0.6 : 1,
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
                      '&.Mui-selected': { 
                        bgcolor: 'rgba(144, 202, 249, 0.15)',
                        '&:hover': { bgcolor: 'rgba(144, 202, 249, 0.25)' }
                      }
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      <CircleIcon 
                        sx={{ 
                          fontSize: 12, 
                          color: theme => {
                            const status = getStatusColor(session.status);
                            return status === 'default' 
                              ? theme.palette.grey[500] 
                              : theme.palette[status].main;
                          }
                        }} 
                      />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Typography variant="body2" noWrap sx={{ color: '#ffffff' }}>
                            {session.name}
                          </Typography>
                          {session.connectedClients > 0 && (
                            <Chip 
                              label={session.connectedClients} 
                              size="small" 
                              variant="outlined"
                              sx={{ minWidth: 'auto', height: 18, fontSize: '0.7rem' }}
                            />
                          )}
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="caption" color="text.secondary" noWrap>
                            {session.workingDir}
                          </Typography>
                          <br />
                          <Typography variant="caption" color="text.secondary">
                            {formatTime(session.lastActivity)}
                          </Typography>
                        </Box>
                      }
                    />
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      <IconButton 
                        size="small" 
                        onClick={(e) => {
                          e.stopPropagation();
                          const newName = prompt('Enter new session name:', session.name);
                          if (newName && newName.trim()) {
                            renameSession(session.id, newName.trim());
                          }
                        }}
                        disabled={operationStates.renaming.has(session.id)}
                        sx={{ color: 'rgba(255,255,255,0.7)' }}
                      >
                        {operationStates.renaming.has(session.id) ? (
                          <CircularProgress size={16} sx={{ color: 'rgba(255,255,255,0.7)' }} />
                        ) : (
                          <EditIcon fontSize="small" />
                        )}
                      </IconButton>
                      <IconButton 
                        size="small" 
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`Delete session "${session.name}"?`)) {
                            deleteSession(session.id);
                          }
                        }}
                        disabled={operationStates.deleting.has(session.id)}
                        sx={{ color: 'rgba(255,255,255,0.7)' }}
                      >
                        {operationStates.deleting.has(session.id) ? (
                          <CircularProgress size={16} sx={{ color: 'rgba(255,255,255,0.7)' }} />
                        ) : (
                          <DeleteIcon fontSize="small" />
                        )}
                      </IconButton>
                    </Box>
                  </ListItem>
                ))}
              </List>
            )}
          </Box>
          </Paper>
        )}

        {/* Terminal Area */}
        <Box sx={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          bgcolor: '#0a0a0a', 
          position: 'relative',
          minHeight: 0,
          overflow: 'hidden'
        }}>
          {currentSessionId ? (
            <Box sx={{ 
              flex: 1, 
              overflow: 'hidden',
              p: 1,
              display: 'flex',
              minHeight: 0,
            }}>
              <Terminal
                key={currentSessionId}
                ref={terminalRef}
                onData={handleTerminalData}
                onResize={handleTerminalResize}
              />
            </Box>
          ) : (
            <Box sx={{ 
              flex: 1, 
              display: 'flex', 
              flexDirection: 'column',
              alignItems: 'center', 
              justifyContent: 'center',
              color: 'rgba(255,255,255,0.6)',
              p: 2,
            }}>
              <TerminalIcon sx={{ fontSize: { xs: 48, sm: 64 }, mb: 2, opacity: 0.5 }} />
              <Typography variant={isMobile ? "h6" : "h5"} sx={{ mb: 1 }}>
                No Session Selected
              </Typography>
              <Typography 
                variant="body2" 
                sx={{ 
                  mb: 3, 
                  textAlign: 'center', 
                  maxWidth: { xs: '100%', sm: 400 },
                  px: { xs: 2, sm: 0 }
                }}
              >
                {isMobile 
                  ? 'Tap the sessions button above or create a new session.'
                  : 'Select an existing session from the sidebar or create a new one to start using the terminal.'
                }
              </Typography>
              <Button
                variant="contained"
                size={isMobile ? "large" : "medium"}
                startIcon={operationStates.creating ? <CircularProgress size={18} /> : <AddIcon />}
                onClick={() => {
                  if (isMobile) {
                    setMobileSessionsOpen(true);
                  } else {
                    createNewSession(`Session ${sessions.length + 1}`);
                  }
                }}
                disabled={operationStates.creating}
              >
                {operationStates.creating ? 'Creating...' : isMobile ? 'View Sessions' : 'Create New Session'}
              </Button>
            </Box>
          )}
        </Box>
      </Box>


      {/* Mobile Sessions Drawer */}
      <SwipeableDrawer
        anchor="bottom"
        open={mobileSessionsOpen}
        onClose={() => setMobileSessionsOpen(false)}
        onOpen={() => setMobileSessionsOpen(true)}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            bgcolor: '#1e1e1e',
            color: '#cccccc',
            maxHeight: '70vh',
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
          }
        }}
      >
        <Box sx={{ p: 2 }}>
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            mb: 2 
          }}>
            <Typography variant="h6" sx={{ color: '#ffffff' }}>
              Active Sessions ({sessions.length})
            </Typography>
            <IconButton 
              onClick={() => setMobileSessionsOpen(false)}
              sx={{ color: 'rgba(255,255,255,0.7)' }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
          
          <Button
            fullWidth
            variant="contained"
            startIcon={operationStates.creating ? <CircularProgress size={18} /> : <AddIcon />}
            onClick={() => {
              createNewSession(`Session ${sessions.length + 1}`);
              setMobileSessionsOpen(false);
            }}
            disabled={operationStates.creating}
            sx={{ mb: 2 }}
          >
            {operationStates.creating ? 'Creating...' : 'New Session'}
          </Button>

          {operationStates.refreshing && <LinearProgress sx={{ mb: 1 }} />}

          <Box sx={{ maxHeight: '50vh', overflow: 'auto' }}>
            {sessions.length === 0 ? (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  No active sessions. Create your first session to get started.
                </Typography>
              </Box>
            ) : (
              <List>
                {sessions.map((session) => (
                  <ListItem 
                    key={session.id} 
                    button
                    selected={session.id === currentSessionId}
                    onClick={() => {
                      selectSession(session.id);
                      setMobileSessionsOpen(false);
                    }}
                    disabled={operationStates.selecting === session.id}
                    sx={{ 
                      borderRadius: 2,
                      mb: 1,
                      bgcolor: session.id === currentSessionId ? 'rgba(144, 202, 249, 0.15)' : 'transparent',
                      opacity: operationStates.selecting === session.id ? 0.6 : 1,
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      <CircleIcon 
                        sx={{ 
                          fontSize: 12, 
                          color: theme => {
                            const status = getStatusColor(session.status);
                            return status === 'default' 
                              ? theme.palette.grey[500] 
                              : theme.palette[status].main;
                          }
                        }} 
                      />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Typography variant="body1" sx={{ color: '#ffffff' }}>
                          {session.name}
                        </Typography>
                      }
                      secondary={
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            {formatTime(session.lastActivity)}
                          </Typography>
                        </Box>
                      }
                    />
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <IconButton 
                        size="small" 
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`Delete session "${session.name}"?`)) {
                            deleteSession(session.id);
                          }
                        }}
                        disabled={operationStates.deleting.has(session.id)}
                      >
                        {operationStates.deleting.has(session.id) ? (
                          <CircularProgress size={16} />
                        ) : (
                          <DeleteIcon />
                        )}
                      </IconButton>
                    </Box>
                  </ListItem>
                ))}
              </List>
            )}
          </Box>
        </Box>
      </SwipeableDrawer>

      {/* Error Snackbar */}
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={() => setError(null)} 
          severity="error" 
          variant="filled"
          sx={{ width: '100%' }}
        >
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
};
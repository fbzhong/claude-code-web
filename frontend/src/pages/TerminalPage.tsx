import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Chip,
  Button,
  Alert,
  Snackbar,
  Paper,
  LinearProgress,
} from '@mui/material';
import {
  Menu as MenuIcon,
  History as HistoryIcon,
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  RestartAlt as RestartIcon,
  Logout as LogoutIcon,
  Terminal as TerminalIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Circle as CircleIcon,
} from '@mui/icons-material';
import { SessionInfo } from '../components/SessionList';
import { sessionApi } from '../services/sessionApi';
// import { Terminal, TerminalHandle } from '../components/Terminal';
// import { SimpleTerminal as Terminal, TerminalHandle } from '../components/SimpleTerminal';
// import { MinimalTerminalWithRef as Terminal } from '../components/MinimalTerminal';
// import type { MinimalTerminalHandle as TerminalHandle } from '../components/MinimalTerminal';
// import { SafeTerminal as Terminal } from '../components/SafeTerminal';
// import type { SafeTerminalHandle as TerminalHandle } from '../components/SafeTerminal';
// import { BareTerminal as Terminal } from '../components/BareTerminal';
// import type { BareTerminalHandle as TerminalHandle } from '../components/BareTerminal';
// import { FixedTerminal as Terminal } from '../components/FixedTerminal';
// import type { FixedTerminalHandle as TerminalHandle } from '../components/FixedTerminal';
import { StableTerminal as Terminal } from '../components/StableTerminal';
import type { StableTerminalHandle as TerminalHandle } from '../components/StableTerminal';
import { wsService } from '../services/websocket';
import { useAuthStore } from '../stores/authStore';
import { useNavigate } from 'react-router-dom';

export const TerminalPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, token, logout } = useAuthStore();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [claudeStatus, setClaudeStatus] = useState<'stopped' | 'starting' | 'running' | 'error'>('stopped');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [commandHistory, setCommandHistory] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const terminalRef = useRef<TerminalHandle>(null);

  // Session Management Functions
  const refreshSessions = useCallback(async () => {
    try {
      setLoading(true);
      const sessionList = await sessionApi.getAllSessions();
      setSessions(sessionList);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch sessions');
    } finally {
      setLoading(false);
    }
  }, []);

  const createNewSession = useCallback(async (name: string, workingDir?: string) => {
    try {
      setLoading(true);
      
      // First disconnect from current session if any
      if (sessionId && wsService.isConnected()) {
        wsService.disconnect();
      }
      
      const newSession = await sessionApi.createSession({ name, workingDir });
      await refreshSessions();
      setSessionId(newSession.id);
      setCommandHistory([]);
      
      // Clear terminal before connecting to new session
      if (terminalRef.current?.clear) {
        terminalRef.current.clear();
      }
      
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to create session');
    } finally {
      setLoading(false);
    }
  }, [refreshSessions, sessionId]);

  const selectSession = useCallback(async (selectedSessionId: string) => {
    try {
      setLoading(true);
      
      // First disconnect from current session if any
      if (sessionId && wsService.isConnected()) {
        wsService.disconnect();
        // Add a small delay to ensure proper cleanup
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      await sessionApi.attachToSession(selectedSessionId);
      setSessionId(selectedSessionId);
      setCommandHistory([]);
      
      // Clear terminal before connecting to new session
      if (terminalRef.current?.clear) {
        terminalRef.current.clear();
      }
      
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to attach to session');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  const deleteSession = useCallback(async (sessionIdToDelete: string) => {
    try {
      setLoading(true);
      await sessionApi.deleteSession(sessionIdToDelete);
      await refreshSessions();
      
      // If we deleted the current session, clear it
      if (sessionIdToDelete === sessionId) {
        setSessionId(null);
        setCommandHistory([]);
        if (terminalRef.current?.clear) {
          terminalRef.current.clear();
        }
      }
      
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to delete session');
    } finally {
      setLoading(false);
    }
  }, [sessionId, refreshSessions]);

  const renameSession = useCallback(async (sessionIdToRename: string, newName: string) => {
    try {
      setLoading(true);
      await sessionApi.renameSession(sessionIdToRename, newName);
      await refreshSessions();
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to rename session');
    } finally {
      setLoading(false);
    }
  }, [refreshSessions]);

  // Load sessions on mount
  useEffect(() => {
    if (token) {
      console.log('Loading sessions on mount...');
      refreshSessions();
    }
  }, [token, refreshSessions]);

  // Debug: Log current state
  useEffect(() => {
    console.log('TerminalPage state:', {
      sessionId,
      sessionsCount: sessions.length,
      sessions: sessions.map(s => ({ id: s.id, name: s.name, status: s.status }))
    });
    
    // Force cleanup any orphaned terminal elements
    if (!sessionId) {
      const terminalElements = document.querySelectorAll('.xterm');
      console.log('Found terminal elements when sessionId is null:', terminalElements.length);
      terminalElements.forEach((el, index) => {
        console.log(`Removing orphaned terminal element ${index}`);
        el.remove();
      });
    }
  }, [sessionId, sessions]);

  // Focus terminal when sessionId changes
  useEffect(() => {
    if (sessionId && terminalRef.current?.focus) {
      // Add a small delay to ensure terminal is ready
      setTimeout(() => {
        terminalRef.current?.focus();
      }, 100);
    }
  }, [sessionId]);

  useEffect(() => {
    if (!token || !sessionId) {
      console.log('Skipping WebSocket connection: token or sessionId missing', { token: !!token, sessionId });
      return;
    }

    console.log('Connecting to WebSocket for session:', sessionId);
    
    // Connect to WebSocket
    wsService.connect(sessionId, token).then(() => {
      console.log('WebSocket connected successfully for session:', sessionId);
    }).catch((error) => {
      console.error('Failed to connect to WebSocket:', error);
      setError('Failed to connect to session: ' + error.message);
    });

    // Set up message handlers
    const terminalDataHandler = (message: any) => {
      if (terminalRef.current?.write) {
        terminalRef.current.write(message.data);
      }
    };

    const terminalClearHandler = (message: any) => {
      console.log('Received terminal_clear message');
      if (terminalRef.current?.clear) {
        terminalRef.current.clear();
      }
    };

    const commandHistoryHandler = (message: any) => {
      if (Array.isArray(message.data)) {
        setCommandHistory(message.data);
      } else {
        setCommandHistory((prev) => [...prev, message.data]);
      }
    };

    const claudeStatusHandler = (message: any) => {
      setClaudeStatus(message.data.status || 'stopped');
    };

    const sessionInfoHandler = (message: any) => {
      console.log('Session info:', message.data);
    };

    const terminalExitHandler = (message: any) => {
      console.log('Terminal exited:', message.data);
      // TODO: Handle terminal exit
    };

    wsService.onMessage('terminal_data', terminalDataHandler);
    wsService.onMessage('terminal_clear', terminalClearHandler);
    wsService.onMessage('command_history', commandHistoryHandler);
    wsService.onMessage('claude_status', claudeStatusHandler);
    wsService.onMessage('session_info', sessionInfoHandler);
    wsService.onMessage('terminal_exit', terminalExitHandler);

    // Request initial history after connection is established
    setTimeout(() => {
      if (wsService.isConnected()) {
        wsService.requestHistory();
      }
    }, 500);

    return () => {
      // Clean up all handlers before disconnecting
      wsService.offMessage('terminal_data');
      wsService.offMessage('terminal_clear');
      wsService.offMessage('command_history');
      wsService.offMessage('claude_status');
      wsService.offMessage('session_info');
      wsService.offMessage('terminal_exit');
      wsService.disconnect();
    };
  }, [sessionId, token]);

  const handleTerminalData = useCallback((data: string) => {
    try {
      if (!wsService.isConnected()) {
        console.warn('WebSocket not connected, cannot send input');
        return;
      }
      console.log('Sending terminal input:', data);
      wsService.sendTerminalInput(data);
    } catch (error) {
      console.error('Failed to send terminal input:', error);
    }
  }, []);

  const handleTerminalResize = useCallback((cols: number, rows: number) => {
    try {
      wsService.sendTerminalResize(cols, rows);
    } catch (error) {
      console.error('Failed to send terminal resize:', error);
    }
  }, []);

  const handleStartClaude = () => {
    wsService.startClaude({
      workingDir: process.env.HOME || '/tmp',
      autoRestart: true,
    });
  };

  const handleStopClaude = () => {
    wsService.stopClaude();
  };

  const handleRestartClaude = () => {
    wsService.restartClaude();
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getClaudeStatusColor = () => {
    switch (claudeStatus) {
      case 'running':
        return 'success';
      case 'starting':
        return 'warning';
      case 'error':
        return 'error';
      default:
        return 'default';
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
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
        <Toolbar>
          <IconButton
            color="inherit"
            onClick={() => setDrawerOpen(true)}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 600 }}>
            Claude Web Terminal
          </Typography>
          <Chip
            label={`Claude: ${claudeStatus}`}
            color={getClaudeStatusColor()}
            size="small"
            sx={{ mr: 2, fontWeight: 500 }}
          />
          <Typography variant="body2" sx={{ mr: 2, opacity: 0.9 }}>
            {user?.username}
          </Typography>
          <IconButton color="inherit" onClick={handleLogout} size="small">
            <LogoutIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Box sx={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* Sessions Sidebar */}
        <Paper sx={{ 
          width: 350, 
          bgcolor: '#1e1e1e', 
          borderRight: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <Box sx={{ p: 2, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <Typography variant="h6" sx={{ color: '#ffffff', mb: 2 }}>
              Active Sessions
            </Typography>
            <Button
              fullWidth
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => createNewSession(`Session ${sessions.length + 1}`)}
              disabled={loading}
              sx={{ mb: 1 }}
            >
              New Session
            </Button>
            <Button
              fullWidth
              variant="outlined"
              onClick={refreshSessions}
              disabled={loading}
              size="small"
            >
              Refresh
            </Button>
          </Box>

          {loading && <LinearProgress />}

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
                    selected={session.id === sessionId}
                    onClick={() => selectSession(session.id)}
                    sx={{ 
                      borderRadius: 1,
                      mx: 1,
                      mb: 0.5,
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
                        sx={{ color: 'rgba(255,255,255,0.7)' }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton 
                        size="small" 
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`Delete session "${session.name}"?`)) {
                            deleteSession(session.id);
                          }
                        }}
                        sx={{ color: 'rgba(255,255,255,0.7)' }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </ListItem>
                ))}
              </List>
            )}
          </Box>
        </Paper>

        {/* Terminal Area */}
        <Box sx={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          bgcolor: '#0a0a0a', 
          position: 'relative',
          minHeight: 0, // Important for flexbox
          overflow: 'hidden'
        }}>
          {sessionId ? (
            <Box sx={{ 
              flex: 1, 
              overflow: 'hidden',
              p: 1,
              display: 'flex',
              minHeight: 0, // Important for flexbox children
            }}>
              <Terminal
                key={sessionId} // Force re-mount when sessionId changes
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
              position: 'relative',
              zIndex: 2,
            }}>
              <TerminalIcon sx={{ fontSize: 64, mb: 2, opacity: 0.5 }} />
              <Typography variant="h6" sx={{ mb: 1 }}>
                No Session Selected
              </Typography>
              <Typography variant="body2" sx={{ mb: 3, textAlign: 'center', maxWidth: 400 }}>
                Select an existing session from the sidebar or create a new one to start using the terminal.
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => createNewSession(`Session ${sessions.length + 1}`)}
                disabled={loading}
              >
                Create New Session
              </Button>
            </Box>
          )}
        </Box>
      </Box>

      {/* Claude Control Drawer */}
      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sx={{
          '& .MuiDrawer-paper': {
            bgcolor: '#252526',
            color: '#cccccc',
            mt: '64px',
            height: 'calc(100% - 64px)',
          }
        }}
      >
        <Box sx={{ width: 300, p: 2 }}>
          <Typography variant="h6" gutterBottom sx={{ color: '#ffffff' }}>
            Claude Control
          </Typography>
          <Box sx={{ mb: 2 }}>
            <Button
              fullWidth
              variant="contained"
              color="success"
              startIcon={<PlayIcon />}
              onClick={handleStartClaude}
              disabled={claudeStatus === 'running' || claudeStatus === 'starting'}
              sx={{ mb: 1 }}
            >
              Start Claude
            </Button>
            <Button
              fullWidth
              variant="contained"
              color="error"
              startIcon={<StopIcon />}
              onClick={handleStopClaude}
              disabled={claudeStatus === 'stopped'}
              sx={{ mb: 1 }}
            >
              Stop Claude
            </Button>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<RestartIcon />}
              onClick={handleRestartClaude}
              disabled={claudeStatus === 'stopped'}
            >
              Restart Claude
            </Button>
          </Box>

          <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.1)' }} />

          <Typography variant="h6" gutterBottom sx={{ color: '#ffffff' }}>
            Command History
          </Typography>
          <List dense sx={{ maxHeight: 400, overflow: 'auto' }}>
            {commandHistory.length === 0 ? (
              <ListItem>
                <ListItemText 
                  primary="No commands yet"
                  sx={{ opacity: 0.6, fontStyle: 'italic' }}
                />
              </ListItem>
            ) : (
              commandHistory.slice(-10).reverse().map((cmd, index) => (
                <ListItem 
                  key={cmd.id || index}
                  sx={{ 
                    borderRadius: 1,
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
                  }}
                >
                  <ListItemIcon>
                    <HistoryIcon fontSize="small" sx={{ color: '#569cd6' }} />
                  </ListItemIcon>
                  <ListItemText
                    primary={cmd.command}
                    secondary={new Date(cmd.timestamp).toLocaleTimeString()}
                    primaryTypographyProps={{
                      style: {
                        fontFamily: 'Menlo, Monaco, monospace',
                        fontSize: '0.875rem',
                        color: '#d4d4d4',
                      },
                    }}
                    secondaryTypographyProps={{
                      style: {
                        color: '#808080',
                        fontSize: '0.75rem',
                      },
                    }}
                  />
                </ListItem>
              ))
            )}
          </List>
        </Box>
      </Drawer>

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
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
} from '@mui/material';
import {
  Menu as MenuIcon,
  History as HistoryIcon,
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  RestartAlt as RestartIcon,
  Logout as LogoutIcon,
} from '@mui/icons-material';
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
  const [sessionId] = useState(() => crypto.randomUUID());
  const [commandHistory, setCommandHistory] = useState<any[]>([]);
  const terminalRef = useRef<TerminalHandle>(null);

  useEffect(() => {
    if (!token) return;

    // Connect to WebSocket
    wsService.connect(sessionId, token).catch((error) => {
      console.error('Failed to connect to WebSocket:', error);
    });

    // Set up message handlers
    wsService.onMessage('terminal_data', (message) => {
      if (terminalRef.current?.write) {
        terminalRef.current.write(message.data);
      }
    });

    wsService.onMessage('command_history', (message) => {
      if (Array.isArray(message.data)) {
        setCommandHistory(message.data);
      } else {
        setCommandHistory((prev) => [...prev, message.data]);
      }
    });

    wsService.onMessage('claude_status', (message) => {
      setClaudeStatus(message.data.status || 'stopped');
    });

    wsService.onMessage('session_info', (message) => {
      console.log('Session info:', message.data);
    });

    wsService.onMessage('terminal_exit', (message) => {
      console.log('Terminal exited:', message.data);
      // TODO: Handle terminal exit
    });

    // Request initial history after connection is established
    setTimeout(() => {
      if (wsService.isConnected()) {
        wsService.requestHistory();
      }
    }, 2000);

    return () => {
      wsService.disconnect();
    };
  }, [sessionId, token]);

  const handleTerminalData = useCallback((data: string) => {
    try {
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

  const getStatusColor = () => {
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

  return (
    <Box sx={{ display: 'flex', height: '100vh' }}>
      <AppBar position="fixed" sx={{ bgcolor: '#2d2d30', zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar>
          <IconButton
            edge="start"
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
            color={getStatusColor()}
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

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          mt: '64px', // Fixed AppBar height
          height: 'calc(100vh - 64px)',
          bgcolor: '#1e1e1e',
        }}
      >
        <Box sx={{ 
          flexGrow: 1, 
          overflow: 'hidden',
          p: 2,
          height: '100%',
        }}>
          <Terminal
            ref={terminalRef}
            onData={handleTerminalData}
            onResize={handleTerminalResize}
          />
        </Box>
      </Box>
    </Box>
  );
};
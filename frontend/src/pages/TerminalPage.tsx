import React, { useState, useEffect, useRef } from 'react';
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
import { Terminal, TerminalHandle } from '../components/Terminal';
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

    // Request initial history
    setTimeout(() => {
      wsService.requestHistory();
    }, 1000);

    return () => {
      wsService.disconnect();
    };
  }, [sessionId, token]);

  const handleTerminalData = (data: string) => {
    wsService.sendTerminalInput(data);
  };

  const handleTerminalResize = (cols: number, rows: number) => {
    wsService.sendTerminalResize(cols, rows);
  };

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
      <AppBar position="fixed">
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            onClick={() => setDrawerOpen(true)}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Claude Web Terminal
          </Typography>
          <Chip
            label={`Claude: ${claudeStatus}`}
            color={getStatusColor()}
            sx={{ mr: 2 }}
          />
          <Typography variant="body2" sx={{ mr: 2 }}>
            {user?.username}
          </Typography>
          <IconButton color="inherit" onClick={handleLogout}>
            <LogoutIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      >
        <Box sx={{ width: 300, p: 2 }}>
          <Typography variant="h6" gutterBottom>
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

          <Divider sx={{ my: 2 }} />

          <Typography variant="h6" gutterBottom>
            Command History
          </Typography>
          <List dense>
            {commandHistory.slice(-10).reverse().map((cmd, index) => (
              <ListItem key={cmd.id || index}>
                <ListItemIcon>
                  <HistoryIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary={cmd.command}
                  secondary={new Date(cmd.timestamp).toLocaleTimeString()}
                  primaryTypographyProps={{
                    style: {
                      fontFamily: 'monospace',
                      fontSize: '0.875rem',
                    },
                  }}
                />
              </ListItem>
            ))}
          </List>
        </Box>
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          mt: 8, // Account for AppBar
        }}
      >
        <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
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
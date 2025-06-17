import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Button,
  Alert,
  Snackbar,
  CircularProgress,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Logout as LogoutIcon,
  Terminal as TerminalIcon,
  Add as AddIcon,
  Close as CloseIcon,
  Keyboard as KeyboardIcon,
  GitHub as GitHubIcon,
  Code as CodeIcon,
  VpnKey as VpnKeyIcon,
} from '@mui/icons-material';
import { Fab } from '@mui/material';
import { StableTerminal as Terminal } from '../components/StableTerminal';
import type { StableTerminalHandle as TerminalHandle } from '../components/StableTerminal';
import { useAuthStore } from '../stores/authStore';
import { useNavigate } from 'react-router-dom';
import { MobileKeyboardToolbar, useMobileKeyboardToolbar } from '../components/MobileKeyboardToolbar';
import { Dialog, DialogContent, DialogTitle } from '@mui/material';
import GitHubManager from '../components/GitHubManager';
import { SSHAccessDialog } from '../components/SSHAccessDialog';
import { SessionsDrawer } from './TerminalPage/components/SessionsDrawer';
import { useSessionManagement } from './TerminalPage/hooks/useSessionManagement';
import { useWebSocketConnection } from './TerminalPage/hooks/useWebSocketConnection';

export const TerminalPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, token, logout } = useAuthStore();
  
  // UI states
  const [sessionsDrawerOpen, setSessionsDrawerOpen] = useState(false);
  const [sshInfoOpen, setSSHInfoOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [githubDialogOpen, setGithubDialogOpen] = useState(false);
  
  // Session management hook
  const {
    sessions,
    currentSessionId,
    operationStates,
    createNewSession,
    selectSession,
    deleteSession,
    renameSession,
    refreshSessions,
    setSessions,
    setCurrentSessionId,
  } = useSessionManagement({
    token,
    onError: setError,
  });
  
  const terminalRef = useRef<TerminalHandle>(null);
  
  // Responsive design
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  // Mobile keyboard toolbar
  const { 
    isVisible: isKeyboardToolbarVisible, 
    toggleToolbar, 
    isMobile: isMobileKeyboard,
    keyboardHeight 
  } = useMobileKeyboardToolbar(() => {
    // When keyboard shows, scroll to cursor position to ensure it's visible
    const scrollAttempts = [100, 300, 500];
    scrollAttempts.forEach(delay => {
      setTimeout(() => {
        if (terminalRef.current) {
          console.log(`Attempting cursor scroll after ${delay}ms`);
          // Try to scroll to cursor first, fallback to bottom
          try {
            terminalRef.current.scrollToCursor();
          } catch (e) {
            terminalRef.current.scrollToBottom();
          }
          terminalRef.current.focus();
        }
      }, delay);
    });
  });
  
  // Handle terminal clear when session changes
  const handleSessionChange = useCallback(() => {
    if (terminalRef.current?.clear) {
      terminalRef.current.clear();
    }
  }, []);

  // Wrap createNewSession to clear terminal
  const createNewSessionWithClear = useCallback((name: string, workingDir?: string) => {
    createNewSession(name, workingDir);
    handleSessionChange();
  }, [createNewSession, handleSessionChange]);

  // Wrap selectSession to clear terminal
  const selectSessionWithClear = useCallback(async (sessionId: string) => {
    await selectSession(sessionId);
    handleSessionChange();
  }, [selectSession, handleSessionChange]);

  // Wrap deleteSession to clear terminal when deleting current session
  const deleteSessionWithClear = useCallback(async (sessionId: string) => {
    if (sessionId === currentSessionId) {
      handleSessionChange();
    }
    await deleteSession(sessionId);
  }, [deleteSession, currentSessionId, handleSessionChange]);

  // WebSocket connection state
  const [isTerminalReady, setIsTerminalReady] = useState(false);

  // Use WebSocket connection hook
  const { handleTerminalData, handleTerminalResize } = useWebSocketConnection({
    currentSessionId,
    token,
    isTerminalReady,
    terminalRef,
    setSessions,
    setCurrentSessionId,
    setError,
    isMobileKeyboard,
    isKeyboardToolbarVisible,
  });

  // Reset terminal ready state when session changes
  useEffect(() => {
    setIsTerminalReady(false);
  }, [currentSessionId]);

  // Terminal ready callback
  const handleTerminalReady = useCallback(() => {
    console.log('Terminal is ready, enabling WebSocket connection');
    setIsTerminalReady(true);
  }, []);


  const handleMobileKeyPress = useCallback((key: string) => {
    if (!currentSessionId) return;
    handleTerminalData(key);
    
    // Keep terminal focused after sending key
    setTimeout(() => {
      if (terminalRef.current) {
        terminalRef.current.focus();
      }
    }, 50);
  }, [currentSessionId, handleTerminalData]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };


  return (
    <Box sx={{ display: 'flex', height: '100vh', flexDirection: 'column' }}>
      <AppBar position="static" sx={{ bgcolor: '#2d2d30' }}>
        <Toolbar sx={{ minHeight: { xs: 56, sm: 64 } }}>
          <IconButton
            color="inherit"
            onClick={() => setSessionsDrawerOpen(true)}
            sx={{ mr: { xs: 1, sm: 2 } }}
          >
            <MenuIcon />
          </IconButton>
          
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
              {user?.email}
            </Typography>
          )}
          
          <IconButton 
            color="inherit" 
            onClick={() => setGithubDialogOpen(true)}
            size={isMobile ? "medium" : "small"}
            sx={{ mr: 1 }}
            title="GitHub Integration"
          >
            <GitHubIcon />
          </IconButton>
          
          <IconButton 
            color="inherit" 
            onClick={() => setSSHInfoOpen(true)}
            size={isMobile ? "medium" : "small"}
            sx={{ mr: 1 }}
            title="SSH Access Management"
          >
            <VpnKeyIcon />
          </IconButton>
          
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
              // Adjust height when keyboard is visible
              pb: isKeyboardToolbarVisible && isMobileKeyboard ? `${keyboardHeight + 100}px` : 1,
            }}>
              <Terminal
                key={currentSessionId}
                ref={terminalRef}
                onData={handleTerminalData}
                onResize={handleTerminalResize}
                onTerminalReady={handleTerminalReady}
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
                Open the menu to view sessions or create a new one to start using the terminal.
              </Typography>
              <Button
                variant="contained"
                size={isMobile ? "large" : "medium"}
                startIcon={operationStates.creating ? <CircularProgress size={18} /> : <AddIcon />}
                onClick={() => setSessionsDrawerOpen(true)}
                disabled={operationStates.creating}
              >
                {operationStates.creating ? 'Creating...' : 'Open Sessions Menu'}
              </Button>
            </Box>
          )}
        </Box>
      </Box>


      {/* Sessions Drawer */}
      <SessionsDrawer
        open={sessionsDrawerOpen}
        onClose={() => setSessionsDrawerOpen(false)}
        sessions={sessions}
        currentSessionId={currentSessionId}
        operationStates={operationStates}
        onCreateSession={() => {
          createNewSessionWithClear(`Session ${sessions.length + 1}`);
          setSessionsDrawerOpen(false);
        }}
        onSelectSession={(id) => {
          selectSessionWithClear(id);
          setSessionsDrawerOpen(false);
        }}
        onDeleteSession={deleteSessionWithClear}
        onRenameSession={renameSession}
        onRefreshSessions={() => refreshSessions()}
      />

      {/* Mobile Keyboard Toggle Button - Only show when keyboard is not open */}
      {currentSessionId && isMobileKeyboard && !isKeyboardToolbarVisible && (
        <Fab
          color="primary"
          size="small"
          onClick={toggleToolbar}
          sx={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            zIndex: 1299,
            opacity: 0.7,
            '&:hover': {
              opacity: 1,
            },
          }}
        >
          <KeyboardIcon />
        </Fab>
      )}

      {/* Mobile Keyboard Toolbar */}
      {currentSessionId && (
        <MobileKeyboardToolbar
          onKeyPress={handleMobileKeyPress}
          visible={isKeyboardToolbarVisible}
          keyboardHeight={keyboardHeight}
        />
      )}

      {/* SSH Access Dialog */}
      <SSHAccessDialog
        open={sshInfoOpen}
        onClose={() => setSSHInfoOpen(false)}
      />

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

      {/* GitHub Manager Dialog */}
      <Dialog
        open={githubDialogOpen}
        onClose={() => setGithubDialogOpen(false)}
        maxWidth="md"
        fullWidth
        sx={{ '& .MuiDialog-paper': { minHeight: '60vh' } }}
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Typography variant="h6">GitHub Integration</Typography>
            <IconButton onClick={() => setGithubDialogOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <GitHubManager />
        </DialogContent>
      </Dialog>
    </Box>
  );
};
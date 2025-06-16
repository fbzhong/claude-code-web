import React, { useState, useRef, useCallback } from 'react';
import {
  Box,
  Alert,
  Snackbar,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
  Fab,
} from '@mui/material';
import {
  Close as CloseIcon,
  Keyboard as KeyboardIcon,
} from '@mui/icons-material';
import { StableTerminal as Terminal } from '../../components/StableTerminal';
import type { StableTerminalHandle as TerminalHandle } from '../../components/StableTerminal';
import { useAuthStore } from '../../stores/authStore';
import { useNavigate } from 'react-router-dom';
import { MobileKeyboardToolbar, useMobileKeyboardToolbar } from '../../components/MobileKeyboardToolbar';
import GitHubManager from '../../components/GitHubManager';
import { SSHAccessDialog } from '../../components/SSHAccessDialog';

// Import extracted components
import { TerminalHeader } from './components/TerminalHeader';
import { SessionsDrawer } from './components/SessionsDrawer';
import { EmptyTerminalState } from './components/EmptyTerminalState';

// Import hooks
import { useSessionManagement } from './hooks/useSessionManagement';
import { useWebSocketConnection } from './hooks/useWebSocketConnection';

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
  } = useSessionManagement({ token, onError: setError });
  
  // Terminal refs and states
  const terminalRef = useRef<TerminalHandle>(null);
  const [isTerminalReady, setIsTerminalReady] = useState(false);
  
  // Mobile keyboard
  const {
    isVisible: isKeyboardToolbarVisible,
    isMobile: isMobileKeyboard,
    keyboardHeight,
    toggleToolbar,
  } = useMobileKeyboardToolbar();
  
  // WebSocket connection hook
  const { handleTerminalData, handleTerminalResize } = useWebSocketConnection({
    currentSessionId,
    token,
    isTerminalReady,
    terminalRef,
    setSessions,
    setError,
    isMobileKeyboard,
    isKeyboardToolbarVisible,
  });
  
  // Handle session selection with terminal clearing
  const handleSelectSession = useCallback((sessionId: string) => {
    if (terminalRef.current) {
      terminalRef.current.clear();
    }
    selectSession(sessionId);
  }, [selectSession]);
  
  // Handle terminal ready
  const handleTerminalReady = useCallback(() => {
    setIsTerminalReady(true);
  }, []);
  
  // Handle logout
  const handleLogout = async () => {
    logout();
    navigate('/login');
  };
  
  // Handle mobile keyboard key press
  const handleMobileKeyPress = useCallback((key: string) => {
    handleTerminalData(key);
  }, [handleTerminalData]);
  
  return (
    <Box sx={{ display: 'flex', height: '100vh', flexDirection: 'column' }}>
      <TerminalHeader
        user={user}
        onMenuClick={() => setSessionsDrawerOpen(true)}
        onGitHubClick={() => setGithubDialogOpen(true)}
        onSSHClick={() => setSSHInfoOpen(true)}
        onLogout={handleLogout}
      />

      <Box sx={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* Terminal Area */}
        <Box sx={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          bgcolor: '#0a0a0a', 
          minHeight: 0 
        }}>
          {currentSessionId ? (
            <Box sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
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
            <EmptyTerminalState
              isCreating={operationStates.creating}
              onOpenSessions={() => setSessionsDrawerOpen(true)}
            />
          )}
        </Box>
      </Box>

      <SessionsDrawer
        open={sessionsDrawerOpen}
        onClose={() => setSessionsDrawerOpen(false)}
        sessions={sessions}
        currentSessionId={currentSessionId}
        operationStates={operationStates}
        onCreateSession={() => {
          createNewSession(`Session ${sessions.length + 1}`);
          setSessionsDrawerOpen(false);
        }}
        onSelectSession={handleSelectSession}
        onDeleteSession={deleteSession}
        onRenameSession={renameSession}
        onRefreshSessions={refreshSessions}
      />

      {/* Mobile Keyboard Toggle Button */}
      {currentSessionId && isMobileKeyboard && !isKeyboardToolbarVisible && (
        <Fab
          color="primary"
          size="small"
          onClick={toggleToolbar}
          sx={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            zIndex: 100,
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
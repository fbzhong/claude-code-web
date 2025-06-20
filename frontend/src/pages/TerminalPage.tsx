import React, { useState, useEffect, useRef, useCallback } from "react";
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
} from "@mui/material";
import {
  Menu as MenuIcon,
  Logout as LogoutIcon,
  Terminal as TerminalIcon,
  Add as AddIcon,
  Close as CloseIcon,
  Keyboard as KeyboardIcon,
} from "@mui/icons-material";
import { Fab } from "@mui/material";
import { StableTerminal as Terminal } from "../components/StableTerminal";
import type { StableTerminalHandle as TerminalHandle } from "../components/StableTerminal";
import { EmptyTerminalState } from "./TerminalPage/components/EmptyTerminalState";
import { useAuthStore } from "../stores/authStore";
import { useNavigate } from "react-router-dom";
import {
  MobileKeyboardToolbar,
  useMobileKeyboardToolbar,
} from "../components/MobileKeyboardToolbar";
import { Dialog, DialogContent, DialogTitle } from "@mui/material";
import { IntegrationIcons } from "../components/IntegrationIcons";
import { SessionsDrawer } from "./TerminalPage/components/SessionsDrawer";
import { useSessionManagement } from "./TerminalPage/hooks/useSessionManagement";
import { useWebSocketConnection } from "./TerminalPage/hooks/useWebSocketConnection";
import {
  ConnectionStatus,
  ConnectionStatusMini,
} from "../components/ConnectionStatus";

export const TerminalPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, token, logout } = useAuthStore();

  // UI states
  const [sessionsDrawerOpen, setSessionsDrawerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  // Mobile keyboard toolbar
  const {
    isVisible: isKeyboardToolbarVisible,
    toggleToolbar,
    isMobile: isMobileKeyboard,
    keyboardHeight,
  } = useMobileKeyboardToolbar(() => {
    // When keyboard shows, scroll to cursor position to ensure it's visible
    const scrollAttempts = [100, 300, 500];
    scrollAttempts.forEach((delay) => {
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
  const createNewSessionWithClear = useCallback(
    (name: string, workingDir?: string) => {
      createNewSession(name, workingDir);
      handleSessionChange();
    },
    [createNewSession, handleSessionChange]
  );

  // Wrap selectSession to clear terminal
  const selectSessionWithClear = useCallback(
    async (sessionId: string) => {
      await selectSession(sessionId);
      handleSessionChange();
    },
    [selectSession, handleSessionChange]
  );

  // Wrap deleteSession to clear terminal when deleting current session
  const deleteSessionWithClear = useCallback(
    async (sessionId: string) => {
      if (sessionId === currentSessionId) {
        handleSessionChange();
      }
      await deleteSession(sessionId);
    },
    [deleteSession, currentSessionId, handleSessionChange]
  );

  // WebSocket connection state
  const [isTerminalReady, setIsTerminalReady] = useState(false);

  // Use WebSocket connection hook
  const {
    handleTerminalData,
    handleTerminalResize,
    connectionState,
    canManualReconnect,
    manualReconnect,
  } = useWebSocketConnection({
    currentSessionId,
    token,
    isTerminalReady,
    terminalRef,
    setSessions,
    setCurrentSessionId,
    setError,
    setSuccessMessage,
    isMobileKeyboard,
    isKeyboardToolbarVisible,
  });

  // Reset terminal ready state when session changes
  useEffect(() => {
    setIsTerminalReady(false);
  }, [currentSessionId]);

  // Terminal ready callback
  const handleTerminalReady = useCallback(() => {
    console.log("Terminal is ready, enabling WebSocket connection");
    // Add a small delay to ensure WebSocket is fully connected
    setTimeout(() => {
      setIsTerminalReady(true);
    }, 100);
  }, []);

  const handleMobileKeyPress = useCallback(
    (key: string) => {
      if (!currentSessionId) return;
      handleTerminalData(key);

      // Keep terminal focused after sending key
      setTimeout(() => {
        if (terminalRef.current) {
          terminalRef.current.focus();
        }
      }, 50);
    },
    [currentSessionId, handleTerminalData]
  );

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <Box sx={{ display: "flex", height: "100vh", flexDirection: "column" }}>
      <AppBar
        position="static"
        className="frosted-glass"
        sx={{
          borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
          boxShadow: "0 1px 20px rgba(0, 0, 0, 0.3)",
        }}
      >
        <Toolbar
          sx={{
            minHeight: { xs: 56, sm: 64 },
            gap: 1,
          }}
        >
          <IconButton
            color="inherit"
            onClick={() => setSessionsDrawerOpen(true)}
            sx={{ mr: { xs: 1, sm: 2 } }}
          >
            <MenuIcon />
          </IconButton>

          <Typography
            variant={isMobile ? "subtitle1" : "h6"}
            className="gradient-text"
            sx={{
              flexGrow: 1,
              fontWeight: 700,
              letterSpacing: "-0.01em",
              display: { xs: "none", sm: "block" },
            }}
          >
            MOUNTAIN
          </Typography>

          {/* Simplified mobile header */}
          <Typography
            variant="subtitle1"
            className="gradient-text"
            sx={{
              flexGrow: 1,
              fontWeight: 700,
              letterSpacing: "-0.01em",
              display: { xs: "block", sm: "none" },
            }}
          >
            Terminal
          </Typography>

          {/* Connection Status - Hidden per user request */}

          {!isMobile && (
            <Typography variant="body2" sx={{ mr: 2, opacity: 0.9 }}>
              {user?.email}
            </Typography>
          )}

          {/* Dynamic Integration Icons */}
          <IntegrationIcons isMobile={isMobile} />

          <IconButton
            color="inherit"
            onClick={handleLogout}
            size={isMobile ? "medium" : "small"}
            sx={{
              transition: "all 0.2s ease",
              "&:hover": {
                backgroundColor: "rgba(255, 90, 95, 0.2)",
                transform: "scale(1.1)",
              },
            }}
          >
            <LogoutIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Box
        sx={{
          display: "flex",
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
          position: "relative",
          // Prevent outer container from scrolling
          touchAction:
            isKeyboardToolbarVisible && isMobileKeyboard ? "none" : "auto",
        }}
      >
        {/* Terminal Area */}
        <Box
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            bgcolor: "#0a0a0a",
            position: "relative",
            minHeight: 0,
            overflow: "hidden",
            // Lock the outer container when keyboard is visible
            touchAction:
              isKeyboardToolbarVisible && isMobileKeyboard ? "none" : "auto",
          }}
        >
          {currentSessionId ? (
            <Box
              sx={{
                flex: 1,
                overflow: "hidden",
                p: 1,
                display: "flex",
                minHeight: 0,
                position: "relative",
                // Use fixed height calculation when keyboard is visible
                height:
                  isKeyboardToolbarVisible && isMobileKeyboard
                    ? `calc(100vh - 64px - ${keyboardHeight + 10}px)` // viewport - appbar - keyboard - toolbar
                    : "100%",
                maxHeight:
                  isKeyboardToolbarVisible && isMobileKeyboard
                    ? `calc(100vh - 64px - ${keyboardHeight + 10}px)`
                    : "100%",
              }}
            >
              <Terminal
                key={currentSessionId}
                ref={terminalRef}
                onData={handleTerminalData}
                onResize={handleTerminalResize}
                onTerminalReady={handleTerminalReady}
                onFocus={() => {
                  // Scroll the entire page to bottom when terminal gets focus
                  // This ensures the terminal fills the screen and header doesn't obstruct input
                  const scrollHeight = document.documentElement.scrollHeight;
                  const windowHeight = window.innerHeight;
                  const currentScroll = window.scrollY;
                  
                  // Only scroll if there's something to scroll to
                  if (scrollHeight > windowHeight && currentScroll < scrollHeight - windowHeight) {
                    window.scrollTo({
                      top: scrollHeight,
                      behavior: 'smooth'
                    });
                  }
                }}
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

      {/* Sessions Drawer */}
      <SessionsDrawer
        open={sessionsDrawerOpen}
        onClose={() => setSessionsDrawerOpen(false)}
        sessions={sessions}
        currentSessionId={currentSessionId}
        operationStates={operationStates}
        onCreateSession={() => {
          // Don't pass a name - let the backend generate a random animal name
          createNewSessionWithClear("");
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
            position: "fixed",
            bottom: 16,
            right: 16,
            zIndex: 1299,
            opacity: 0.7,
            "&:hover": {
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

      {/* Error Snackbar */}
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          onClose={() => setError(null)}
          severity="error"
          variant="filled"
          sx={{ width: "100%" }}
        >
          {error}
        </Alert>
      </Snackbar>

      {/* Success Snackbar */}
      <Snackbar
        open={!!successMessage}
        autoHideDuration={4000}
        onClose={() => setSuccessMessage(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          onClose={() => setSuccessMessage(null)}
          severity="success"
          variant="filled"
          sx={{ width: "100%" }}
        >
          {successMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

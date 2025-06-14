import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Alert,
  Tabs,
  Tab,
  useTheme,
  useMediaQuery,
  Container,
} from '@mui/material';
import { useAuthStore, setDebugLogger } from '../stores/authStore';
import { useNavigate } from 'react-router-dom';
import { DebugInfo, useDebugLogger } from '../components/DebugInfo';
import { useKeyboardAware } from '../hooks/useKeyboardAware';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`auth-tabpanel-${index}`}
      aria-labelledby={`auth-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, register } = useAuthStore();
  const [tabValue, setTabValue] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Debug logger for mobile debugging
  const debugLogger = useDebugLogger();
  
  // Keyboard awareness for mobile
  const keyboardState = useKeyboardAware();
  
  // Responsive design
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  // Set up debug logger for auth store
  useEffect(() => {
    setDebugLogger(debugLogger);
    debugLogger.logInfo('LOGIN', 'Login page initialized', { 
      userAgent: navigator.userAgent,
      currentURL: window.location.href,
      viewportHeight: window.innerHeight,
      isKeyboardOpen: keyboardState.isKeyboardOpen
    });
  }, [debugLogger, keyboardState.isKeyboardOpen]);

  // Log keyboard state changes
  useEffect(() => {
    debugLogger.logInfo('KEYBOARD', 'Keyboard state changed', {
      isKeyboardOpen: keyboardState.isKeyboardOpen,
      keyboardHeight: keyboardState.keyboardHeight,
      viewportHeight: keyboardState.viewportHeight,
      originalHeight: window.innerHeight
    });
  }, [keyboardState, debugLogger]);

  // Auto-scroll focused input into view when keyboard opens
  useEffect(() => {
    if (isMobile && keyboardState.isKeyboardOpen) {
      const activeElement = document.activeElement;
      if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
        setTimeout(() => {
          activeElement.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
          });
        }, 300); // Wait for keyboard animation
      }
    }
  }, [keyboardState.isKeyboardOpen, isMobile]);

  // Login form state
  const [loginForm, setLoginForm] = useState({
    username: '',
    password: '',
  });

  // Register form state
  const [registerForm, setRegisterForm] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    setError(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      debugLogger.logInfo('LOGIN', 'Attempting login', { username: loginForm.username });
      await login(loginForm.username, loginForm.password);
      debugLogger.logSuccess('LOGIN', 'Login successful, navigating to home');
      navigate('/');
    } catch (err: any) {
      debugLogger.logError('LOGIN', 'Login failed', err);
      // Display detailed error message
      const errorMessage = err.message || err.response?.data?.error || 'Login failed';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (registerForm.password !== registerForm.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      await register(
        registerForm.username,
        registerForm.email,
        registerForm.password
      );
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        // Use dynamic viewport height for mobile browsers
        minHeight: ['100vh', '100dvh'],
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        p: { xs: 2, sm: 3 },
        // Adjust layout when keyboard is open on mobile
        ...(isMobile && keyboardState.isKeyboardOpen && {
          alignItems: 'flex-start',
          paddingTop: { xs: 4, sm: 6 },
          minHeight: keyboardState.viewportHeight,
        }),
        // Prevent zooming on iOS when focusing inputs
        '@media (max-width: 768px)': {
          '@supports (height: 100dvh)': {
            minHeight: '100dvh',
          },
        },
      }}
    >
      <Container maxWidth="sm">
        <Paper
          elevation={3}
          sx={{
            width: '100%',
            p: { xs: 2, sm: 3, md: 4 },
            // Adjust position when keyboard is open on mobile
            ...(isMobile && keyboardState.isKeyboardOpen && {
              position: 'relative',
              transform: `translateY(-${keyboardState.keyboardHeight * 0.3}px)`,
              transition: 'transform 0.3s ease-in-out',
            }),
          }}
        >
          <Typography 
            variant={isMobile ? "h5" : "h4"} 
            align="center" 
            gutterBottom
            sx={{ mb: { xs: 2, sm: 3 } }}
          >
            Claude Web Terminal
          </Typography>

        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={handleTabChange} centered>
            <Tab label="Login" />
            <Tab label="Register" />
          </Tabs>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}

        <TabPanel value={tabValue} index={0}>
          <form onSubmit={handleLogin}>
            <TextField
              fullWidth
              label="Username"
              variant="outlined"
              margin="normal"
              value={loginForm.username}
              onChange={(e) =>
                setLoginForm({ ...loginForm, username: e.target.value })
              }
              required
              autoFocus={!isMobile} // Disable autofocus on mobile to prevent immediate keyboard
              inputProps={{
                style: {
                  fontSize: isMobile ? '16px' : '14px', // Prevent zoom on iOS
                },
              }}
            />
            <TextField
              fullWidth
              label="Password"
              type="password"
              variant="outlined"
              margin="normal"
              value={loginForm.password}
              onChange={(e) =>
                setLoginForm({ ...loginForm, password: e.target.value })
              }
              required
              inputProps={{
                style: {
                  fontSize: isMobile ? '16px' : '14px', // Prevent zoom on iOS
                },
              }}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3 }}
              disabled={loading}
            >
              {loading ? 'Logging in...' : 'Login'}
            </Button>
          </form>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <form onSubmit={handleRegister}>
            <TextField
              fullWidth
              label="Username"
              variant="outlined"
              margin="normal"
              value={registerForm.username}
              onChange={(e) =>
                setRegisterForm({ ...registerForm, username: e.target.value })
              }
              required
              inputProps={{
                style: {
                  fontSize: isMobile ? '16px' : '14px', // Prevent zoom on iOS
                },
              }}
            />
            <TextField
              fullWidth
              label="Email"
              type="email"
              variant="outlined"
              margin="normal"
              value={registerForm.email}
              onChange={(e) =>
                setRegisterForm({ ...registerForm, email: e.target.value })
              }
              required
              inputProps={{
                style: {
                  fontSize: isMobile ? '16px' : '14px', // Prevent zoom on iOS
                },
              }}
            />
            <TextField
              fullWidth
              label="Password"
              type="password"
              variant="outlined"
              margin="normal"
              value={registerForm.password}
              onChange={(e) =>
                setRegisterForm({ ...registerForm, password: e.target.value })
              }
              required
              inputProps={{
                style: {
                  fontSize: isMobile ? '16px' : '14px', // Prevent zoom on iOS
                },
              }}
            />
            <TextField
              fullWidth
              label="Confirm Password"
              type="password"
              variant="outlined"
              margin="normal"
              value={registerForm.confirmPassword}
              onChange={(e) =>
                setRegisterForm({
                  ...registerForm,
                  confirmPassword: e.target.value,
                })
              }
              required
              inputProps={{
                style: {
                  fontSize: isMobile ? '16px' : '14px', // Prevent zoom on iOS
                },
              }}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3 }}
              disabled={loading}
            >
              {loading ? 'Registering...' : 'Register'}
            </Button>
          </form>
        </TabPanel>
        </Paper>
      </Container>
      
      {/* Debug Info for mobile debugging */}
      <DebugInfo 
        logs={debugLogger.logs} 
        onClear={debugLogger.clearLogs}
        maxLogs={20}
      />
    </Box>
  );
};
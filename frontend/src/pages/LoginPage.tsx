import React, { useState, useEffect } from "react";
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
  CircularProgress,
  Divider,
  Link,
  InputAdornment,
  IconButton,
} from "@mui/material";
import {
  Visibility,
  VisibilityOff,
  Email as EmailIcon,
  Lock as LockIcon,
  VpnKey as VpnKeyIcon,
} from "@mui/icons-material";
import { useAuthStore, setDebugLogger } from "../stores/authStore";
import { useNavigate } from "react-router-dom";
import { DebugInfo, useDebugLogger } from "../components/DebugInfo";
import { useKeyboardAware } from "../hooks/useKeyboardAware";

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
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  // Set up debug logger for auth store
  useEffect(() => {
    setDebugLogger(debugLogger);
    debugLogger.logInfo("LOGIN", "Login page initialized", {
      userAgent: navigator.userAgent,
      currentURL: window.location.href,
      viewportHeight: window.innerHeight,
      isKeyboardOpen: keyboardState.isKeyboardOpen,
    });
  }, [debugLogger, keyboardState.isKeyboardOpen]);

  // Log keyboard state changes
  useEffect(() => {
    debugLogger.logInfo("KEYBOARD", "Keyboard state changed", {
      isKeyboardOpen: keyboardState.isKeyboardOpen,
      keyboardHeight: keyboardState.keyboardHeight,
      viewportHeight: keyboardState.viewportHeight,
      originalHeight: window.innerHeight,
    });
  }, [keyboardState, debugLogger]);

  // Auto-scroll focused input into view when keyboard opens
  useEffect(() => {
    if (isMobile && keyboardState.isKeyboardOpen) {
      const activeElement = document.activeElement;
      if (
        activeElement &&
        (activeElement.tagName === "INPUT" ||
          activeElement.tagName === "TEXTAREA")
      ) {
        setTimeout(() => {
          activeElement.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }, 300); // Wait for keyboard animation
      }
    }
  }, [keyboardState.isKeyboardOpen, isMobile]);

  // Login form state
  const [loginForm, setLoginForm] = useState({
    email: "",
    password: "",
  });

  // Register form state
  const [registerForm, setRegisterForm] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    inviteCode: "",
  });

  // Password visibility state
  const [showPassword, setShowPassword] = useState({
    login: false,
    register: false,
    confirm: false,
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
      debugLogger.logInfo("LOGIN", "Attempting login", {
        email: loginForm.email,
      });
      await login(loginForm.email, loginForm.password);
      debugLogger.logSuccess("LOGIN", "Login successful, navigating to home");
      navigate("/");
    } catch (err: any) {
      debugLogger.logError("LOGIN", "Login failed", err);
      // Display detailed error message
      const errorMessage = err.message || "Login failed";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (registerForm.password !== registerForm.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      await register(
        registerForm.email,
        registerForm.password,
        registerForm.inviteCode || undefined
      );
      navigate("/");
    } catch (err: any) {
      debugLogger.logError("REGISTER", "Registration failed", err);
      const errorMessage = err.message || "Registration failed";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      className="tech-grid"
      sx={{
        // Use dynamic viewport height for mobile browsers
        minHeight: ["100vh", "100dvh"],
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "background.default",
        p: { xs: 2, sm: 3 },
        position: "relative",
        overflow: "hidden",
        // Subtle gradient overlay
        "&::before": {
          content: '""',
          position: "absolute",
          top: "-50%",
          left: "-50%",
          width: "200%",
          height: "200%",
          background: "radial-gradient(circle at 30% 50%, rgba(0, 122, 255, 0.1) 0%, transparent 50%)",
          pointerEvents: "none",
        },
        "&::after": {
          content: '""',
          position: "absolute",
          bottom: "-50%",
          right: "-50%",
          width: "200%",
          height: "200%",
          background: "radial-gradient(circle at 70% 50%, rgba(88, 86, 214, 0.1) 0%, transparent 50%)",
          pointerEvents: "none",
        },
        // Adjust layout when keyboard is open on mobile
        ...(isMobile &&
          keyboardState.isKeyboardOpen && {
            alignItems: "flex-start",
            paddingTop: { xs: 4, sm: 6 },
            minHeight: keyboardState.viewportHeight,
          }),
        // Prevent zooming on iOS when focusing inputs
        "@media (max-width: 768px)": {
          "@supports (height: 100dvh)": {
            minHeight: "100dvh",
          },
        },
      }}
    >
      <Container maxWidth="sm">
        <Paper
          className="frosted-glass animate-fadeIn"
          elevation={0}
          sx={{
            width: "100%",
            p: { xs: 2, sm: 3, md: 4 },
            borderRadius: 3,
            position: "relative",
            overflow: "hidden",
            // Subtle gradient border effect
            "&::before": {
              content: '""',
              position: "absolute",
              inset: 0,
              borderRadius: "inherit",
              padding: "1px",
              background: "linear-gradient(135deg, rgba(0, 122, 255, 0.3), rgba(88, 86, 214, 0.3))",
              WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
              WebkitMaskComposite: "xor",
              maskComposite: "exclude",
            },
            // Adjust position when keyboard is open on mobile
            ...(isMobile &&
              keyboardState.isKeyboardOpen && {
                position: "relative",
                transform: `translateY(-${
                  keyboardState.keyboardHeight * 0.3
                }px)`,
                transition: "transform 0.3s ease-in-out",
              }),
          }}
        >
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Typography
              variant={isMobile ? "h5" : "h4"}
              gutterBottom
              className="gradient-text"
              sx={{ 
                fontWeight: 700,
                letterSpacing: "-0.02em",
                mb: 1,
              }}
            >
              Claude Web Terminal
            </Typography>
            <Typography
              variant="body2"
              sx={{ 
                color: 'rgba(255, 255, 255, 0.6)',
                fontSize: '0.95rem',
              }}
            >
              Your powerful remote development environment
            </Typography>
          </Box>

          <Box sx={{ 
            borderBottom: 1, 
            borderColor: "divider",
            mb: 2,
          }}>
            <Tabs 
              value={tabValue} 
              onChange={handleTabChange} 
              centered
              sx={{
                '& .MuiTab-root': {
                  fontSize: '1rem',
                  fontWeight: 600,
                  textTransform: 'none',
                  minWidth: 120,
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    color: '#007AFF',
                  },
                },
                '& .Mui-selected': {
                  color: '#007AFF',
                },
                '& .MuiTabs-indicator': {
                  backgroundColor: '#007AFF',
                  height: 3,
                  borderRadius: '3px 3px 0 0',
                },
              }}
            >
              <Tab label="Sign In" />
              <Tab label="Sign Up" />
            </Tabs>
          </Box>

          {error && (
            <Alert 
              severity="error" 
              sx={{ 
                mt: 2,
                borderRadius: 2,
                backgroundColor: 'rgba(255, 59, 48, 0.1)',
                border: '1px solid rgba(255, 59, 48, 0.3)',
                '& .MuiAlert-icon': {
                  color: '#FF3B30',
                },
              }}
            >
              {error}
            </Alert>
          )}

          <TabPanel value={tabValue} index={0}>
            <form onSubmit={handleLogin}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                variant="outlined"
                margin="normal"
                value={loginForm.email}
                onChange={(e) =>
                  setLoginForm({ ...loginForm, email: e.target.value })
                }
                required
                autoFocus={!isMobile}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <EmailIcon sx={{ color: 'rgba(255, 255, 255, 0.5)' }} />
                    </InputAdornment>
                  ),
                }}
                inputProps={{
                  style: {
                    fontSize: isMobile ? "16px" : "14px",
                  },
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    },
                    '&.Mui-focused': {
                      backgroundColor: 'rgba(255, 255, 255, 0.08)',
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#007AFF',
                        borderWidth: 2,
                      },
                    },
                  },
                  '& .MuiInputLabel-root': {
                    color: 'rgba(255, 255, 255, 0.7)',
                    '&.Mui-focused': {
                      color: '#007AFF',
                    },
                  },
                }}
              />
              <TextField
                fullWidth
                label="Password"
                type={showPassword.login ? "text" : "password"}
                variant="outlined"
                margin="normal"
                value={loginForm.password}
                onChange={(e) =>
                  setLoginForm({ ...loginForm, password: e.target.value })
                }
                required
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockIcon sx={{ color: 'rgba(255, 255, 255, 0.5)' }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword({ ...showPassword, login: !showPassword.login })}
                        edge="end"
                        sx={{ color: 'rgba(255, 255, 255, 0.5)' }}
                      >
                        {showPassword.login ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                inputProps={{
                  style: {
                    fontSize: isMobile ? "16px" : "14px",
                  },
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    },
                    '&.Mui-focused': {
                      backgroundColor: 'rgba(255, 255, 255, 0.08)',
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#007AFF',
                        borderWidth: 2,
                      },
                    },
                  },
                  '& .MuiInputLabel-root': {
                    color: 'rgba(255, 255, 255, 0.7)',
                    '&.Mui-focused': {
                      color: '#007AFF',
                    },
                  },
                }}
              />
              <Button
                type="submit"
                fullWidth
                variant="contained"
                className="animated-gradient-bg"
                sx={{ 
                  mt: 3,
                  mb: 2,
                  py: 1.5,
                  fontSize: '1rem',
                  fontWeight: 600,
                  borderRadius: 2,
                  textTransform: 'none',
                  boxShadow: '0 4px 20px rgba(0, 122, 255, 0.3)',
                  position: 'relative',
                  overflow: 'hidden',
                  '&:hover': {
                    boxShadow: '0 6px 30px rgba(0, 122, 255, 0.4)',
                    transform: 'translateY(-1px)',
                  },
                  '&:disabled': {
                    background: 'rgba(255, 255, 255, 0.1)',
                    boxShadow: 'none',
                  },
                }}
                disabled={loading}
              >
                {loading ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CircularProgress size={20} color="inherit" />
                    <span>Signing in...</span>
                  </Box>
                ) : (
                  "Sign In"
                )}
              </Button>

              <Box sx={{ mt: 3, textAlign: 'center' }}>
                <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                  Don't have an account?{' '}
                  <Link
                    component="button"
                    type="button"
                    variant="body2"
                    onClick={() => setTabValue(1)}
                    sx={{
                      color: '#007AFF',
                      textDecoration: 'none',
                      fontWeight: 600,
                      '&:hover': {
                        textDecoration: 'underline',
                      },
                    }}
                  >
                    Sign up
                  </Link>
                </Typography>
              </Box>
            </form>
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <form onSubmit={handleRegister}>
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
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <EmailIcon sx={{ color: 'rgba(255, 255, 255, 0.5)' }} />
                    </InputAdornment>
                  ),
                }}
                inputProps={{
                  style: {
                    fontSize: isMobile ? "16px" : "14px",
                  },
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    },
                    '&.Mui-focused': {
                      backgroundColor: 'rgba(255, 255, 255, 0.08)',
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#007AFF',
                        borderWidth: 2,
                      },
                    },
                  },
                  '& .MuiInputLabel-root': {
                    color: 'rgba(255, 255, 255, 0.7)',
                    '&.Mui-focused': {
                      color: '#007AFF',
                    },
                  },
                }}
              />
              <TextField
                fullWidth
                label="Password"
                type={showPassword.register ? "text" : "password"}
                variant="outlined"
                margin="normal"
                value={registerForm.password}
                onChange={(e) =>
                  setRegisterForm({ ...registerForm, password: e.target.value })
                }
                required
                helperText="Password must be at least 8 characters and contain 3 of: uppercase, lowercase, numbers, special characters"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockIcon sx={{ color: 'rgba(255, 255, 255, 0.5)' }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword({ ...showPassword, register: !showPassword.register })}
                        edge="end"
                        sx={{ color: 'rgba(255, 255, 255, 0.5)' }}
                      >
                        {showPassword.register ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                inputProps={{
                  style: {
                    fontSize: isMobile ? "16px" : "14px",
                  },
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    },
                    '&.Mui-focused': {
                      backgroundColor: 'rgba(255, 255, 255, 0.08)',
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#007AFF',
                        borderWidth: 2,
                      },
                    },
                  },
                  '& .MuiInputLabel-root': {
                    color: 'rgba(255, 255, 255, 0.7)',
                    '&.Mui-focused': {
                      color: '#007AFF',
                    },
                  },
                  '& .MuiFormHelperText-root': {
                    color: 'rgba(255, 255, 255, 0.5)',
                    fontSize: '0.75rem',
                  },
                }}
              />
              <TextField
                fullWidth
                label="Confirm Password"
                type={showPassword.confirm ? "text" : "password"}
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
                error={registerForm.confirmPassword !== '' && registerForm.password !== registerForm.confirmPassword}
                helperText={registerForm.confirmPassword !== '' && registerForm.password !== registerForm.confirmPassword ? "Passwords don't match" : ""}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockIcon sx={{ color: 'rgba(255, 255, 255, 0.5)' }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword({ ...showPassword, confirm: !showPassword.confirm })}
                        edge="end"
                        sx={{ color: 'rgba(255, 255, 255, 0.5)' }}
                      >
                        {showPassword.confirm ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                inputProps={{
                  style: {
                    fontSize: isMobile ? "16px" : "14px",
                  },
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    },
                    '&.Mui-focused': {
                      backgroundColor: 'rgba(255, 255, 255, 0.08)',
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#007AFF',
                        borderWidth: 2,
                      },
                    },
                  },
                  '& .MuiInputLabel-root': {
                    color: 'rgba(255, 255, 255, 0.7)',
                    '&.Mui-focused': {
                      color: '#007AFF',
                    },
                  },
                  '& .MuiFormHelperText-root': {
                    color: 'rgba(255, 255, 255, 0.5)',
                    fontSize: '0.75rem',
                  },
                }}
              />
              {process.env.REACT_APP_REQUIRE_INVITE_CODE?.toLowerCase() ===
                "true" && (
                <TextField
                  fullWidth
                  label="Invite Code"
                  variant="outlined"
                  margin="normal"
                  value={registerForm.inviteCode}
                  onChange={(e) =>
                    setRegisterForm({
                      ...registerForm,
                      inviteCode: e.target.value,
                    })
                  }
                  required
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <VpnKeyIcon sx={{ color: 'rgba(255, 255, 255, 0.5)' }} />
                      </InputAdornment>
                    ),
                  }}
                  inputProps={{
                    style: {
                      fontSize: isMobile ? "16px" : "14px",
                    },
                  }}
                  helperText="An invite code is required to register"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: 'rgba(255, 255, 255, 0.03)',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      },
                      '&.Mui-focused': {
                        backgroundColor: 'rgba(255, 255, 255, 0.08)',
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderColor: '#007AFF',
                          borderWidth: 2,
                        },
                      },
                    },
                    '& .MuiInputLabel-root': {
                      color: 'rgba(255, 255, 255, 0.7)',
                      '&.Mui-focused': {
                        color: '#007AFF',
                      },
                    },
                    '& .MuiFormHelperText-root': {
                      color: 'rgba(255, 255, 255, 0.5)',
                      fontSize: '0.75rem',
                    },
                  }}
                />
              )}
              <Button
                type="submit"
                fullWidth
                variant="contained"
                className="animated-gradient-bg"
                sx={{ 
                  mt: 3,
                  mb: 2,
                  py: 1.5,
                  fontSize: '1rem',
                  fontWeight: 600,
                  borderRadius: 2,
                  textTransform: 'none',
                  boxShadow: '0 4px 20px rgba(0, 122, 255, 0.3)',
                  position: 'relative',
                  overflow: 'hidden',
                  '&:hover': {
                    boxShadow: '0 6px 30px rgba(0, 122, 255, 0.4)',
                    transform: 'translateY(-1px)',
                  },
                  '&:disabled': {
                    background: 'rgba(255, 255, 255, 0.1)',
                    boxShadow: 'none',
                  },
                }}
                disabled={loading}
              >
                {loading ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CircularProgress size={20} color="inherit" />
                    <span>Creating account...</span>
                  </Box>
                ) : (
                  "Create Account"
                )}
              </Button>

              <Box sx={{ mt: 3, textAlign: 'center' }}>
                <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                  Already have an account?{' '}
                  <Link
                    component="button"
                    type="button"
                    variant="body2"
                    onClick={() => setTabValue(0)}
                    sx={{
                      color: '#007AFF',
                      textDecoration: 'none',
                      fontWeight: 600,
                      '&:hover': {
                        textDecoration: 'underline',
                      },
                    }}
                  >
                    Sign in
                  </Link>
                </Typography>
              </Box>
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

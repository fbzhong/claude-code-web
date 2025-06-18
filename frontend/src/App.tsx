import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { GlobalStyles } from '@mui/material';
import { TerminalPage } from './pages/TerminalPage';
import { LoginPage } from './pages/LoginPage';
import { GitHubCallbackPage } from './pages/GitHubCallbackPage';
import { useAuthStore } from './stores/authStore';
import { SSHKeysManager } from './components/SSHKeysManager';
import { modernTheme } from './theme/modernTheme';

function App() {
  const { isAuthenticated } = useAuthStore();

  return (
    <ThemeProvider theme={modernTheme}>
      <CssBaseline />
      <GlobalStyles
        styles={{
          '@keyframes pulse': {
            '0%': {
              opacity: 1,
              transform: 'scale(1)',
            },
            '50%': {
              opacity: 0.7,
              transform: 'scale(1.05)',
            },
            '100%': {
              opacity: 1,
              transform: 'scale(1)',
            },
          },
          '@keyframes fadeIn': {
            '0%': {
              opacity: 0,
              transform: 'translateY(10px)',
            },
            '100%': {
              opacity: 1,
              transform: 'translateY(0)',
            },
          },
          '@keyframes slideIn': {
            '0%': {
              opacity: 0,
              transform: 'translateX(-10px)',
            },
            '100%': {
              opacity: 1,
              transform: 'translateX(0)',
            },
          },
          '@keyframes shimmer': {
            '0%': {
              backgroundPosition: '-1000px 0',
            },
            '100%': {
              backgroundPosition: '1000px 0',
            },
          },
          '@keyframes gradientShift': {
            '0%': {
              backgroundPosition: '0% 50%',
            },
            '50%': {
              backgroundPosition: '100% 50%',
            },
            '100%': {
              backgroundPosition: '0% 50%',
            },
          },
          '@keyframes float': {
            '0%, 100%': {
              transform: 'translateY(0px)',
            },
            '50%': {
              transform: 'translateY(-10px)',
            },
          },
          '.animate-fadeIn': {
            animation: 'fadeIn 0.3s ease-out',
          },
          '.animate-slideIn': {
            animation: 'slideIn 0.3s ease-out',
          },
          '.glass-morphism': {
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
          },
          '.gradient-text': {
            background: 'linear-gradient(135deg, #007AFF 0%, #5856D6 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          },
          '.hover-lift': {
            transition: 'transform 0.2s ease-in-out',
            '&:hover': {
              transform: 'translateY(-2px)',
            },
          },
          '.gradient-border': {
            position: 'relative',
            background: 'transparent',
            '&::before': {
              content: '""',
              position: 'absolute',
              inset: 0,
              borderRadius: 'inherit',
              padding: '2px',
              background: 'linear-gradient(135deg, #007AFF, #5856D6)',
              WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
              WebkitMaskComposite: 'xor',
              maskComposite: 'exclude',
            },
          },
          '.animated-gradient-bg': {
            background: 'linear-gradient(135deg, #007AFF, #5856D6, #AF52DE, #007AFF)',
            backgroundSize: '300% 300%',
            animation: 'gradientShift 15s ease infinite',
          },
          '.frosted-glass': {
            backgroundColor: 'rgba(255, 255, 255, 0.01)',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
          },
          '.tech-grid': {
            backgroundImage: 
              'linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),' +
              'linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px)',
            backgroundSize: '50px 50px',
          },
        }}
      />
      <Router>
        <Routes>
          <Route 
            path="/login" 
            element={isAuthenticated ? <Navigate to="/" /> : <LoginPage />} 
          />
          <Route 
            path="/auth/github/callback" 
            element={<GitHubCallbackPage />} 
          />
          <Route 
            path="/" 
            element={isAuthenticated ? <TerminalPage /> : <Navigate to="/login" />} 
          />
          <Route 
            path="/ssh-keys" 
            element={isAuthenticated ? <SSHKeysManager /> : <Navigate to="/login" />} 
          />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
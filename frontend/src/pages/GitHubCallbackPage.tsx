import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Box, Typography, CircularProgress, Alert } from '@mui/material';
import githubService from '../services/github';
import { useAuthStore } from '../stores/authStore';

export const GitHubCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuthStore();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    const handleCallback = async () => {
      // Check if user is authenticated
      if (!isAuthenticated) {
        setError('You must be logged in to connect GitHub');
        setProcessing(false);
        // Redirect to login after 3 seconds
        setTimeout(() => navigate('/login'), 3000);
        return;
      }

      // Get code and state from URL parameters
      const params = new URLSearchParams(location.search);
      const code = params.get('code');
      const state = params.get('state');
      const error = params.get('error');
      const errorDescription = params.get('error_description');

      // Handle GitHub errors
      if (error) {
        setError(`GitHub Error: ${errorDescription || error}`);
        setProcessing(false);
        return;
      }

      // Validate parameters
      if (!code || !state) {
        setError('Invalid callback parameters');
        setProcessing(false);
        return;
      }

      try {
        // Call backend to complete OAuth flow
        const response = await githubService.handleCallback(code, state);
        
        if (response.success) {
          // Check if this is a popup window
          if (window.opener) {
            // Close the popup window
            window.close();
          } else {
            // Redirect to main page with success message
            navigate('/', { state: { message: 'Successfully connected to GitHub!' } });
          }
        } else {
          throw new Error('Failed to complete GitHub authentication');
        }
      } catch (err: any) {
        console.error('GitHub callback error:', err);
        setError(err.response?.data?.error || err.message || 'Failed to connect to GitHub');
        setProcessing(false);
      }
    };

    handleCallback();
  }, [isAuthenticated, location, navigate]);

  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      minHeight="100vh"
      bgcolor="#0a0a0a"
      color="white"
      p={3}
    >
      {processing ? (
        <>
          <CircularProgress size={48} sx={{ mb: 2 }} />
          <Typography variant="h6">Connecting to GitHub...</Typography>
          <Typography variant="body2" color="text.secondary" mt={1}>
            Please wait while we complete the authentication process
          </Typography>
        </>
      ) : error ? (
        <>
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
          <Typography variant="body2" color="text.secondary">
            {window.opener ? 'You can close this window.' : 'Redirecting to login...'}
          </Typography>
        </>
      ) : (
        <>
          <Alert severity="success" sx={{ mb: 2 }}>
            Successfully connected to GitHub!
          </Alert>
          <Typography variant="body2" color="text.secondary">
            {window.opener ? 'You can close this window.' : 'Redirecting...'}
          </Typography>
        </>
      )}
    </Box>
  );
};
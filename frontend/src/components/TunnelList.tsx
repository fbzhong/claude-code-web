import React, { useState, useEffect } from 'react';
import {
  Paper,
  Typography,
  List,
  ListItem,
  ListItemText,
  Chip,
  Link,
  Box,
  CircularProgress,
  Alert,
  Skeleton,
} from '@mui/material';
import { OpenInNew as OpenInNewIcon } from '@mui/icons-material';

interface Tunnel {
  hostname: string;
  public_url: string;
  upstream: string;
  client_id: string;
  connected_at: string;
  status: string;
}

interface TunnelListProps {
  sessionId?: string;
}

const TunnelList: React.FC<TunnelListProps> = ({ sessionId }) => {
  const [tunnels, setTunnels] = useState<Tunnel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tunnelsEnabled, setTunnelsEnabled] = useState(false);

  // Format time to relative format
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  // Extract port from upstream URL
  const extractPort = (upstream: string) => {
    const match = upstream.match(/:(\d+)$/);
    return match ? match[1] : upstream;
  };

  useEffect(() => {
    // Check if tunnels are enabled
    const checkConfig = async () => {
      try {
        const response = await fetch('/api/config');
        if (response.ok) {
          const data = await response.json();
          setTunnelsEnabled(data.features?.tunnels?.enabled || false);
        }
      } catch (err) {
        console.error('Failed to check config:', err);
      }
    };

    checkConfig();
  }, []);

  useEffect(() => {
    if (!tunnelsEnabled) {
      setLoading(false);
      return;
    }

    const fetchTunnels = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setError('Not authenticated');
          setLoading(false);
          return;
        }

        const response = await fetch('/api/tunnels', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch tunnels');
        }

        const data = await response.json();
        setTunnels(data.data?.tunnels || []);
        setError(null);
      } catch (err: any) {
        console.error('Failed to fetch tunnels:', err);
        setError(err.message || 'Failed to fetch tunnels');
      } finally {
        setLoading(false);
      }
    };

    // Initial fetch
    fetchTunnels();

    // Poll for updates every 5 seconds
    const interval = setInterval(fetchTunnels, 5000);

    return () => clearInterval(interval);
  }, [tunnelsEnabled]);

  if (!tunnelsEnabled) {
    return null;
  }

  if (loading && tunnels.length === 0) {
    return (
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          Active Tunnels
        </Typography>
        <Box sx={{ p: 2 }}>
          <Skeleton variant="text" height={60} />
          <Skeleton variant="text" height={60} />
        </Box>
      </Paper>
    );
  }

  if (error) {
    return (
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          Active Tunnels
        </Typography>
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          Active Tunnels
        </Typography>
        {loading && tunnels.length > 0 && (
          <CircularProgress size={20} sx={{ ml: 2 }} />
        )}
      </Box>

      {tunnels.length === 0 ? (
        <Typography color="text.secondary" sx={{ py: 2 }}>
          No active tunnels. Use `inlets client` in your terminal to create a tunnel.
        </Typography>
      ) : (
        <List sx={{ pt: 0 }}>
          {tunnels.map((tunnel, index) => (
            <ListItem
              key={index}
              sx={{
                borderBottom: index < tunnels.length - 1 ? '1px solid' : 'none',
                borderColor: 'divider',
                px: 0,
              }}
            >
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body1" component="span">
                      Port {extractPort(tunnel.upstream)}
                    </Typography>
                    <Typography variant="body1" color="text.secondary" component="span">
                      →
                    </Typography>
                    <Typography variant="body1" component="span">
                      {tunnel.hostname}
                    </Typography>
                  </Box>
                }
                secondary={
                  <Box sx={{ mt: 0.5 }}>
                    <Link
                      href={tunnel.public_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.5,
                        textDecoration: 'none',
                        '&:hover': {
                          textDecoration: 'underline',
                        },
                      }}
                    >
                      {tunnel.public_url}
                      <OpenInNewIcon sx={{ fontSize: 16 }} />
                    </Link>
                    <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
                      Connected {formatTime(tunnel.connected_at)}
                    </Typography>
                  </Box>
                }
              />
              <Chip
                label="Active"
                color="success"
                size="small"
                sx={{ ml: 2 }}
              />
            </ListItem>
          ))}
        </List>
      )}
    </Paper>
  );
};

export default TunnelList;
import React, { useState } from 'react';
import {
  IconButton,
  Badge,
  Tooltip,
  Dialog,
  DialogContent,
  DialogTitle,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Box,
  Typography,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  GitHub as GitHubIcon,
  VpnKey as VpnKeyIcon,
  Storage as StorageIcon,
  RestartAlt as RestartAltIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { useIntegrationStatus, IntegrationStatus } from '../hooks/useIntegrationStatus';
import GitHubManager from './GitHubManager';
import { SSHAccessDialog } from './SSHAccessDialog';
import { containerApi } from '../services/api';

interface IntegrationIconsProps {
  isMobile?: boolean;
}

export const IntegrationIcons: React.FC<IntegrationIconsProps> = ({ isMobile = false }) => {
  const { status, loading, error } = useIntegrationStatus();
  const [githubDialogOpen, setGithubDialogOpen] = useState(false);
  const [sshDialogOpen, setSSHDialogOpen] = useState(false);
  const [containerMenuAnchor, setContainerMenuAnchor] = useState<null | HTMLElement>(null);
  const [isRestarting, setIsRestarting] = useState(false);

  const getStatusIcon = (enabled: boolean, connected: boolean) => {
    if (!enabled) return null;
    if (connected) return <CheckCircleIcon sx={{ fontSize: 12, color: 'success.main' }} />;
    return <WarningIcon sx={{ fontSize: 12, color: 'warning.main' }} />;
  };

  const handleContainerRestart = async () => {
    if (!window.confirm('This will restart your container and terminate all active sessions. Continue?')) {
      return;
    }

    setIsRestarting(true);
    try {
      await containerApi.restart();
      setContainerMenuAnchor(null);
      // Refresh page after restart
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error('Failed to restart container:', error);
      alert('Failed to restart container. Please try again.');
    } finally {
      setIsRestarting(false);
    }
  };

  if (loading) {
    return (
      <CircularProgress 
        size={isMobile ? 24 : 20} 
        sx={{ color: 'rgba(255, 255, 255, 0.7)' }} 
      />
    );
  }

  if (error) {
    return (
      <Tooltip title={`Failed to load integration status: ${error}`}>
        <IconButton size={isMobile ? "medium" : "small"} sx={{ color: 'error.main' }}>
          <ErrorIcon />
        </IconButton>
      </Tooltip>
    );
  }

  return (
    <>
      {/* GitHub Integration */}
      {status.github.enabled && (
        <Tooltip 
          title={
            status.github.connected 
              ? `GitHub: Connected as ${status.github.user?.login}` 
              : 'GitHub: Not connected'
          }
        >
          <IconButton
            color="inherit"
            onClick={() => setGithubDialogOpen(true)}
            size={isMobile ? "medium" : "small"}
            sx={{
              mr: 1,
              transition: "all 0.2s ease",
              "&:hover": {
                backgroundColor: "rgba(255, 255, 255, 0.1)",
                transform: "scale(1.1)",
              },
            }}
          >
            <Badge
              overlap="circular"
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              badgeContent={getStatusIcon(status.github.enabled, status.github.connected)}
            >
              <GitHubIcon />
            </Badge>
          </IconButton>
        </Tooltip>
      )}

      {/* SSH Integration */}
      {status.ssh.enabled && (
        <Tooltip 
          title={
            status.ssh.configured 
              ? `SSH: Configured (${status.ssh.keyCount} keys)` 
              : 'SSH: Not configured'
          }
        >
          <IconButton
            color="inherit"
            onClick={() => setSSHDialogOpen(true)}
            size={isMobile ? "medium" : "small"}
            sx={{
              mr: 1,
              transition: "all 0.2s ease",
              "&:hover": {
                backgroundColor: "rgba(255, 255, 255, 0.1)",
                transform: "scale(1.1)",
              },
            }}
          >
            <Badge
              overlap="circular"
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              badgeContent={getStatusIcon(status.ssh.enabled, status.ssh.configured && status.ssh.hasKeys)}
            >
              <VpnKeyIcon />
            </Badge>
          </IconButton>
        </Tooltip>
      )}

      {/* Container Management */}
      {status.container.enabled && (
        <Tooltip title="Container Management">
          <IconButton
            color="inherit"
            onClick={(e) => setContainerMenuAnchor(e.currentTarget)}
            size={isMobile ? "medium" : "small"}
            sx={{
              mr: 1,
              transition: "all 0.2s ease",
              "&:hover": {
                backgroundColor: "rgba(255, 255, 255, 0.1)",
                transform: "scale(1.1)",
              },
            }}
            disabled={isRestarting}
          >
            {isRestarting ? (
              <CircularProgress size={20} sx={{ color: 'inherit' }} />
            ) : (
              <Badge
                overlap="circular"
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                badgeContent={
                  <CheckCircleIcon sx={{ fontSize: 12, color: 'success.main' }} />
                }
              >
                <StorageIcon />
              </Badge>
            )}
          </IconButton>
        </Tooltip>
      )}

      {/* GitHub Dialog */}
      <Dialog
        open={githubDialogOpen}
        onClose={() => setGithubDialogOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: 'rgba(15, 15, 15, 0.95)',
            backdropFilter: 'blur(20px)',
            color: '#ffffff',
          },
        }}
      >
        <DialogTitle sx={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
          GitHub Integration
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          <GitHubManager />
        </DialogContent>
      </Dialog>

      {/* SSH Dialog */}
      <SSHAccessDialog
        open={sshDialogOpen}
        onClose={() => setSSHDialogOpen(false)}
      />

      {/* Container Menu */}
      <Menu
        anchorEl={containerMenuAnchor}
        open={Boolean(containerMenuAnchor)}
        onClose={() => setContainerMenuAnchor(null)}
        PaperProps={{
          sx: {
            backgroundColor: 'rgba(15, 15, 15, 0.95)',
            backdropFilter: 'blur(20px)',
            color: '#ffffff',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          },
        }}
      >
        <MenuItem onClick={handleContainerRestart} disabled={isRestarting}>
          <ListItemIcon>
            {isRestarting ? (
              <CircularProgress size={20} sx={{ color: 'inherit' }} />
            ) : (
              <RestartAltIcon sx={{ color: 'warning.main' }} />
            )}
          </ListItemIcon>
          <ListItemText>
            {isRestarting ? 'Restarting...' : 'Restart Container'}
          </ListItemText>
        </MenuItem>
        
        <Divider sx={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }} />
        
        <Box sx={{ p: 2, maxWidth: 280 }}>
          <Typography variant="caption" color="text.secondary">
            Restarting the container will terminate all active sessions and refresh the environment.
          </Typography>
        </Box>
      </Menu>
    </>
  );
};
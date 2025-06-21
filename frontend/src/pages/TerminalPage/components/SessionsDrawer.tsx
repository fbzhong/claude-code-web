import React, { useState } from 'react';
import {
  Box,
  Typography,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Button,
  LinearProgress,
  CircularProgress,
  Drawer,
  Divider,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Circle as CircleIcon,
  Close as CloseIcon,
  PlayArrow as PlayArrowIcon,
  RestartAlt as RestartAltIcon,
  Group as GroupIcon,
} from '@mui/icons-material';
import { SessionInfo } from '../../../components/SessionList';
import TunnelList from '../../../components/TunnelList';

// Props interface
interface SessionsDrawerProps {
  open: boolean;
  onClose: () => void;
  sessions: SessionInfo[];
  currentSessionId: string | null;
  operationStates: OperationStates;
  onCreateSession: () => void;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onRenameSession: (id: string, name: string) => void;
  onRefreshSessions: () => void;
}

// Operation states interface
export interface OperationStates {
  creating: boolean;
  refreshing: boolean;
  selecting: string | null;
  deleting: Set<string>;
  renaming: Set<string>;
}

// Helper functions
const formatTime = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  if (diff < 5000) return 'Just now';
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return minutes === 1 ? '1 min ago' : `${minutes} mins ago`;
  }
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  }
  const days = Math.floor(diff / 86400000);
  return days === 1 ? '1 day ago' : `${days} days ago`;
};

const formatWorkingDir = (workingDir: string) => {
  if (!workingDir) return '';
  
  // Check if it's a user home directory pattern (like /Users/username or /home/username)
  const homePattern = /^(\/Users\/[^/]+|\/home\/[^/]+)/;
  const match = workingDir.match(homePattern);
  
  if (match) {
    // Replace home directory with ~
    const relativePath = workingDir.replace(match[1], '~');
    const parts = relativePath.split('/').filter(Boolean);
    
    if (parts.length === 1) {
      // Just ~ (home directory)
      return '~';
    } else if (parts.length === 2) {
      // ~/Documents
      return relativePath;
    } else {
      // ~/Documents/Projects/MyProject -> ~/D/P/MyProject
      const homePart = parts[0]; // ~
      const middleParts = parts.slice(1, -1); // Documents, Projects
      const lastPart = parts[parts.length - 1]; // MyProject
      
      // Abbreviate middle parts to first letter
      const abbreviatedMiddle = middleParts.map(part => part.charAt(0).toUpperCase()).join('/');
      
      return `${homePart}/${abbreviatedMiddle}/${lastPart}`;
    }
  }
  
  // For non-home paths, abbreviate all directories except the last one
  const parts = workingDir.split('/').filter(Boolean);
  if (parts.length <= 1) {
    return workingDir;
  }
  
  const middleParts = parts.slice(0, -1); // All parts except last
  const lastPart = parts[parts.length - 1]; // Last directory
  
  // Abbreviate middle parts to first letter
  const abbreviatedMiddle = middleParts.map(part => part.charAt(0).toUpperCase()).join('/');
  
  return `/${abbreviatedMiddle}/${lastPart}`;
};

const getStatusColor = (session: SessionInfo): 'success' | 'warning' | 'error' | 'default' => {
  // If session is executing, use different color
  if (session.isExecuting) {
    return 'warning'; // Orange/yellow for executing
  }
  
  switch (session.status) {
    case 'active': return 'success'; // Green for idle active
    case 'detached': return 'warning'; // Yellow for detached
    case 'dead': return 'error'; // Red for dead
    default: return 'default';
  }
};

export const SessionsDrawer: React.FC<SessionsDrawerProps> = ({
  open,
  onClose,
  sessions,
  currentSessionId,
  operationStates,
  onCreateSession,
  onSelectSession,
  onDeleteSession,
  onRenameSession,
  onRefreshSessions,
}) => {

  return (
    <Drawer
      anchor="left"
      open={open}
      onClose={onClose}
      sx={{
        '& .MuiDrawer-paper': {
          backgroundColor: 'rgba(10, 10, 10, 0.95)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          borderRight: '1px solid rgba(255, 255, 255, 0.1)',
          color: '#ffffff',
          width: { xs: '85vw', sm: 400 },
          maxWidth: 500,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        }
      }}
    >
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          mb: 2 
        }}>
          <Typography 
            variant="h6" 
            className="gradient-text"
            sx={{ fontWeight: 700 }}
          >
            Active Sessions ({sessions.length})
          </Typography>
          <IconButton 
            onClick={onClose}
            sx={{ color: 'rgba(255,255,255,0.7)' }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
        
        <Button
          fullWidth
          variant="contained"
          startIcon={operationStates.creating ? <CircularProgress size={18} /> : <AddIcon />}
          onClick={onCreateSession}
          disabled={operationStates.creating}
          sx={{ mb: 1 }}
        >
          {operationStates.creating ? 'Creating...' : 'New Session'}
        </Button>
        
        <Button
          fullWidth
          variant="outlined"
          onClick={onRefreshSessions}
          disabled={operationStates.refreshing}
          size="small"
          sx={{ mb: 1 }}
        >
          {operationStates.refreshing ? 'Refreshing...' : 'Refresh'}
        </Button>

        {operationStates.refreshing && <LinearProgress sx={{ mb: 1 }} />}

        <Divider sx={{ my: 2 }} />

        <Box sx={{ flex: 1, overflow: 'auto' }}>
          {sessions.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                No active sessions. Create your first session to get started.
              </Typography>
            </Box>
          ) : (
            <List dense>
              {sessions.map((session) => (
                <ListItem 
                  key={session.id} 
                  button
                  selected={session.id === currentSessionId}
                  onClick={() => onSelectSession(session.id)}
                  disabled={operationStates.selecting === session.id}
                  sx={{ 
                    borderRadius: 1,
                    mb: 0.5,
                    opacity: operationStates.selecting === session.id ? 0.6 : 1,
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
                    '&.Mui-selected': { 
                      bgcolor: 'rgba(144, 202, 249, 0.15)',
                      '&:hover': { bgcolor: 'rgba(144, 202, 249, 0.25)' }
                    }
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    {session.isExecuting ? (
                      <PlayArrowIcon 
                        sx={{ 
                          fontSize: 16, 
                          color: theme => theme.palette.warning.main,
                          animation: 'pulse 1.5s ease-in-out infinite'
                        }} 
                      />
                    ) : (
                      <CircleIcon 
                        sx={{ 
                          fontSize: 12, 
                          color: theme => {
                            const statusColor = getStatusColor(session);
                            return statusColor === 'default' 
                              ? theme.palette.grey[500] 
                              : theme.palette[statusColor].main;
                          }
                        }} 
                      />
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Typography variant="body2" noWrap sx={{ color: '#ffffff' }}>
                          {session.name}
                        </Typography>
                        {session.connectedClients > 1 && (
                          <Tooltip title={`${session.connectedClients} connected clients`}>
                            <Chip 
                              icon={<GroupIcon sx={{ fontSize: 12 }} />}
                              label={session.connectedClients} 
                              size="small" 
                              variant="outlined"
                              sx={{ minWidth: 'auto', height: 18, fontSize: '0.7rem' }}
                            />
                          </Tooltip>
                        )}
                      </Box>
                    }
                    secondary={
                      `${formatWorkingDir(session.workingDir)}\n` +
                      (session.lastCommand ? `$ ${session.lastCommand.slice(0, 30)}${session.lastCommand.length > 30 ? '...' : ''}\n` : '') +
                      `${formatTime(session.lastActivity)}`
                    }
                    secondaryTypographyProps={{
                      component: 'div',
                      sx: {
                        whiteSpace: 'pre-line',
                        '& > *:first-of-type': {
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          display: 'block'
                        }
                      }
                    }}
                  />
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <IconButton 
                      size="small" 
                      onClick={(e) => {
                        e.stopPropagation();
                        const newName = prompt('Enter new session name:', session.name);
                        if (newName && newName.trim()) {
                          onRenameSession(session.id, newName.trim());
                        }
                      }}
                      disabled={operationStates.renaming.has(session.id)}
                      sx={{ color: 'rgba(255,255,255,0.7)' }}
                    >
                      {operationStates.renaming.has(session.id) ? (
                        <CircularProgress size={16} sx={{ color: 'rgba(255,255,255,0.7)' }} />
                      ) : (
                        <EditIcon fontSize="small" />
                      )}
                    </IconButton>
                    <IconButton 
                      size="small" 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`Delete session "${session.name}"?`)) {
                          onDeleteSession(session.id);
                        }
                      }}
                      disabled={operationStates.deleting.has(session.id)}
                      sx={{ color: 'rgba(255,255,255,0.7)' }}
                    >
                      {operationStates.deleting.has(session.id) ? (
                        <CircularProgress size={16} sx={{ color: 'rgba(255,255,255,0.7)' }} />
                      ) : (
                        <DeleteIcon fontSize="small" />
                      )}
                    </IconButton>
                  </Box>
                </ListItem>
              ))}
            </List>
          )}
        </Box>
        
        {/* Tunnels Section */}
        <Divider sx={{ my: 2 }} />
        <Box sx={{ px: 2 }}>
          <TunnelList />
        </Box>
      </Box>
    </Drawer>
  );
};
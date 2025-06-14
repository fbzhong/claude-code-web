import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  ListItemSecondaryAction,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  Tooltip,
  Alert
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Terminal as TerminalIcon,
  Circle as CircleIcon
} from '@mui/icons-material';

export interface SessionInfo {
  id: string;
  name: string;
  status: 'active' | 'detached' | 'dead';
  createdAt: string;
  lastActivity: string;
  workingDir: string;
  connectedClients: number;
  outputPreview?: string;
}

interface SessionListProps {
  sessions: SessionInfo[];
  currentSessionId?: string;
  onSessionSelect: (sessionId: string) => void;
  onSessionCreate: (name: string, workingDir?: string) => void;
  onSessionDelete: (sessionId: string) => void;
  onSessionRename: (sessionId: string, newName: string) => void;
  onRefresh: () => void;
}

export const SessionList: React.FC<SessionListProps> = ({
  sessions,
  currentSessionId,
  onSessionSelect,
  onSessionCreate,
  onSessionDelete,
  onSessionRename,
  onRefresh
}) => {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [selectedSessionForRename, setSelectedSessionForRename] = useState<SessionInfo | null>(null);
  const [newSessionName, setNewSessionName] = useState('');
  const [newSessionWorkingDir, setNewSessionWorkingDir] = useState('');
  const [renameValue, setRenameValue] = useState('');

  useEffect(() => {
    onRefresh();
  }, []);

  const handleCreateSession = () => {
    if (newSessionName.trim()) {
      onSessionCreate(newSessionName.trim(), newSessionWorkingDir.trim() || undefined);
      setCreateDialogOpen(false);
      setNewSessionName('');
      setNewSessionWorkingDir('');
    }
  };

  const handleRenameSession = () => {
    if (selectedSessionForRename && renameValue.trim()) {
      onSessionRename(selectedSessionForRename.id, renameValue.trim());
      setRenameDialogOpen(false);
      setSelectedSessionForRename(null);
      setRenameValue('');
    }
  };

  const startRename = (session: SessionInfo) => {
    setSelectedSessionForRename(session);
    setRenameValue(session.name);
    setRenameDialogOpen(true);
  };

  const getStatusColor = (status: SessionInfo['status']): 'success' | 'warning' | 'error' | 'grey' => {
    switch (status) {
      case 'active': return 'success';
      case 'detached': return 'warning';
      case 'dead': return 'error';
      default: return 'grey';
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TerminalIcon />
            Sessions
          </Typography>
          <Button
            startIcon={<AddIcon />}
            variant="contained"
            size="small"
            onClick={() => setCreateDialogOpen(true)}
          >
            New
          </Button>
        </Box>
        <Button
          variant="outlined"
          size="small"
          onClick={onRefresh}
          fullWidth
        >
          Refresh
        </Button>
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {sessions.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              No sessions found. Create your first session to get started.
            </Typography>
          </Box>
        ) : (
          <List dense>
            {sessions.map((session) => (
              <ListItem key={session.id} disablePadding>
                <ListItemButton
                  selected={session.id === currentSessionId}
                  onClick={() => onSessionSelect(session.id)}
                  sx={{ py: 1 }}
                >
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CircleIcon 
                          sx={{ 
                            fontSize: 12, 
                            color: theme => {
                              const status = getStatusColor(session.status);
                              return status === 'grey' 
                                ? theme.palette.grey[500] 
                                : theme.palette[status].main;
                            }
                          }} 
                        />
                        <Typography variant="body2" noWrap>
                          {session.name}
                        </Typography>
                        {session.connectedClients > 0 && (
                          <Chip 
                            label={session.connectedClients} 
                            size="small" 
                            variant="outlined"
                            sx={{ minWidth: 'auto', height: 20 }}
                          />
                        )}
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography variant="caption" color="text.secondary" noWrap>
                          {session.workingDir}
                        </Typography>
                        <br />
                        <Typography variant="caption" color="text.secondary">
                          {formatTime(session.lastActivity)}
                        </Typography>
                        {session.outputPreview && (
                          <Typography 
                            variant="caption" 
                            color="text.secondary" 
                            sx={{ 
                              display: 'block',
                              whiteSpace: 'pre-wrap',
                              fontFamily: 'monospace',
                              fontSize: '0.7rem',
                              mt: 0.5,
                              p: 0.5,
                              bgcolor: 'action.hover',
                              borderRadius: 0.5,
                              maxHeight: 40,
                              overflow: 'hidden'
                            }}
                          >
                            {session.outputPreview}
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    <Tooltip title="Rename">
                      <IconButton 
                        size="small" 
                        onClick={(e) => {
                          e.stopPropagation();
                          startRename(session);
                        }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton 
                        size="small" 
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`Delete session "${session.name}"?`)) {
                            onSessionDelete(session.id);
                          }
                        }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </ListItemSecondaryAction>
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}
      </Box>

      {/* Create Session Dialog */}
      <Dialog 
        open={createDialogOpen} 
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create New Session</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Session Name"
            fullWidth
            variant="outlined"
            value={newSessionName}
            onChange={(e) => setNewSessionName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleCreateSession()}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Working Directory (optional)"
            fullWidth
            variant="outlined"
            value={newSessionWorkingDir}
            onChange={(e) => setNewSessionWorkingDir(e.target.value)}
            placeholder="/path/to/directory"
            onKeyPress={(e) => e.key === 'Enter' && handleCreateSession()}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleCreateSession}
            variant="contained"
            disabled={!newSessionName.trim()}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Rename Session Dialog */}
      <Dialog 
        open={renameDialogOpen} 
        onClose={() => setRenameDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Rename Session</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Session Name"
            fullWidth
            variant="outlined"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleRenameSession()}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenameDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleRenameSession}
            variant="contained"
            disabled={!renameValue.trim()}
          >
            Rename
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
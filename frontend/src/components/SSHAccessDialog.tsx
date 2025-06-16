import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Paper,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  Alert,
  Snackbar,
  TextField,
  Tab,
  Tabs,
  CircularProgress,
  InputAdornment,
  Tooltip,
  Divider,
} from '@mui/material';
import {
  ContentCopy as CopyIcon,
  Terminal as TerminalIcon,
  Close as CloseIcon,
  OpenInNew as OpenInNewIcon,
  CheckCircle as CheckIcon,
  VpnKey as KeyIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Upload as UploadIcon,
  CloudUpload as CloudUploadIcon,
} from '@mui/icons-material';
import { api } from '../config/api';

interface SSHInfo {
  username: string;
  host: string;
  port: number;
  command: string;
}

interface SSHCredentials {
  sshPublicKeys: string[];
  sshUsername: string;
  sshHost: string;
  sshPort: number;
}

interface SSHAccessDialogProps {
  open: boolean;
  onClose: () => void;
}

export const SSHAccessDialog: React.FC<SSHAccessDialogProps> = ({ open, onClose }) => {
  const [tabValue, setTabValue] = useState(0);
  const [sshInfo, setSSHInfo] = useState<SSHInfo | null>(null);
  const [credentials, setCredentials] = useState<SSHCredentials | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
  }>({ open: false, message: '', severity: 'success' });
  const [addKeyDialog, setAddKeyDialog] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [keyName, setKeyName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Fetch data when dialog opens
  useEffect(() => {
    if (open) {
      fetchSSHInfo();
      fetchCredentials();
    }
  }, [open]);

  const fetchSSHInfo = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(api.ssh.info(), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch SSH info');
      }
      
      const result = await response.json();
      if (result.success) {
        const data = result.data;
        setSSHInfo({
          username: data.username,
          host: data.hostname || 'localhost',
          port: data.port,
          command: data.connectionCommand || `ssh ${data.username}@${data.hostname || 'localhost'} -p ${data.port}`
        });
      }
    } catch (err: any) {
      console.error('Failed to fetch SSH info:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCredentials = async () => {
    try {
      const response = await fetch(api.sshKeys.get(), {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch SSH credentials');

      const data = await response.json();
      setCredentials(data.data);
    } catch (err) {
      console.error('Failed to load SSH credentials:', err);
    }
  };


  const parseSSHKey = (content: string): { key: string; name: string } => {
    const trimmed = content.trim();
    const lines = trimmed.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      // Check if this looks like an SSH public key
      if (line.match(/^(ssh-rsa|ssh-ed25519|ecdsa-sha2-|ssh-dss)\s+/)) {
        const parts = line.split(' ');
        const keyType = parts[0];
        const keyData = parts[1];
        const comment = parts.slice(2).join(' ');
        
        return {
          key: line,
          name: comment || 'Uploaded key'
        };
      }
    }
    
    throw new Error('No valid SSH public key found in file');
  };

  const handleFileSelect = async (file: File) => {
    try {
      const content = await file.text();
      const { key, name } = parseSSHKey(content);
      setNewKey(key);
      setKeyName(name);
      setSnackbar({ open: true, message: 'SSH key loaded from file', severity: 'success' });
    } catch (err: any) {
      setSnackbar({ open: true, message: err.message || 'Failed to parse SSH key file', severity: 'error' });
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(event.dataTransfer.files);
    const file = files.find(f => 
      f.name.endsWith('.pub') || 
      f.name.includes('id_rsa') || 
      f.name.includes('id_ed25519') ||
      f.type === 'text/plain' ||
      f.type === ''
    );
    
    if (file) {
      handleFileSelect(file);
    } else {
      setSnackbar({ open: true, message: 'Please drop a valid SSH public key file (.pub)', severity: 'error' });
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    // Only set dragging to false if we're leaving the dialog content area
    if (!event.currentTarget.contains(event.relatedTarget as Node)) {
      setIsDragging(false);
    }
  };

  const addPublicKey = async () => {
    try {
      const response = await fetch(api.sshKeys.add(), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ publicKey: newKey, name: keyName }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add SSH key');
      }

      await fetchCredentials();
      closeAddKeyDialog();
      setSnackbar({ open: true, message: 'SSH key added successfully', severity: 'success' });
    } catch (err: any) {
      setSnackbar({ open: true, message: err.message || 'Failed to add SSH key', severity: 'error' });
    }
  };

  const closeAddKeyDialog = () => {
    setAddKeyDialog(false);
    setNewKey('');
    setKeyName('');
    setIsDragging(false);
  };

  const deleteKey = async (index: number) => {
    try {
      const response = await fetch(api.sshKeys.delete(index), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) throw new Error('Failed to delete SSH key');

      await fetchCredentials();
      setSnackbar({ open: true, message: 'SSH key removed successfully', severity: 'success' });
    } catch (err) {
      setSnackbar({ open: true, message: 'Failed to remove SSH key', severity: 'error' });
    }
  };

  const copyToClipboard = async (text: string, label?: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setSnackbar({ open: true, message: label ? `${label} copied to clipboard` : 'Copied to clipboard', severity: 'success' });
    } catch (err) {
      setSnackbar({ open: true, message: 'Failed to copy', severity: 'error' });
    }
  };

  const handleClose = () => {
    setTabValue(0);
    setError(null);
    onClose();
  };

  if (loading && !sshInfo && !credentials) {
    return (
      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogContent>
          <Box display="flex" justifyContent="center" alignItems="center" p={4}>
            <CircularProgress />
          </Box>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box display="flex" alignItems="center" gap={1}>
              <TerminalIcon color="primary" />
              <Typography variant="h6">SSH Access Management</Typography>
            </Box>
            <IconButton onClick={handleClose} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
            <Tab label="Connection Info" />
            <Tab label="SSH Credentials" />
          </Tabs>
        </Box>

        <DialogContent>
          {/* Tab 1: Connection Info */}
          {tabValue === 0 && sshInfo && (
            <Box>
              {/* Connection Details */}
              <Paper elevation={0} sx={{ p: 3, mb: 3, bgcolor: 'background.default' }}>
                <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                  SSH Connection Information
                </Typography>
                <Box sx={{ mt: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <Chip
                    label={`Username: ${sshInfo.username}`}
                    variant="outlined"
                    onDelete={() => copyToClipboard(sshInfo.username)}
                    deleteIcon={<CopyIcon />}
                  />
                  <Chip
                    label={`Host: ${sshInfo.host}`}
                    variant="outlined"
                    onDelete={() => copyToClipboard(sshInfo.host)}
                    deleteIcon={<CopyIcon />}
                  />
                  <Chip
                    label={`Port: ${sshInfo.port}`}
                    variant="outlined"
                    onDelete={() => copyToClipboard(sshInfo.port.toString())}
                    deleteIcon={<CopyIcon />}
                  />
                </Box>
                
                <Box sx={{ mt: 3 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Connection Command:
                  </Typography>
                  <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.900' }}>
                    <Box display="flex" alignItems="center" justifyContent="space-between">
                      <Typography 
                        sx={{ 
                          fontFamily: 'monospace', 
                          fontSize: '0.95rem',
                          color: 'primary.light'
                        }}
                      >
                        {sshInfo.command}
                      </Typography>
                      <IconButton 
                        size="small" 
                        onClick={() => copyToClipboard(sshInfo.command, 'SSH command')}
                      >
                        <CopyIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Paper>
                </Box>
              </Paper>

              {/* VS Code Setup */}
              <Paper elevation={0} sx={{ p: 2, bgcolor: 'background.default' }}>
                <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                  IDE Remote-SSH Setup
                </Typography>
                
                {/* Prerequisites */}
                <Alert severity="info" sx={{ mb: 2, py: 0.5 }}>
                  <Typography variant="caption">
                    <strong>Prerequisites:</strong> VS Code/Cursor/Windsurf with Remote-SSH extension
                  </Typography>
                </Alert>

                {/* Direct Connect Buttons */}
                <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', mb: 1.5 }}>
                  <Button
                    variant="contained"
                    color="primary"
                    size="medium"
                    startIcon={<OpenInNewIcon />}
                    onClick={() => {
                      const vsCodeUrl = `vscode://vscode-remote/ssh-remote+${sshInfo.username}@${sshInfo.host}:${sshInfo.port}/home/developer/workspace`;
                      window.location.href = vsCodeUrl;
                    }}
                    sx={{ 
                      px: 2, 
                      py: 1,
                      fontSize: '0.9rem',
                      textTransform: 'none',
                      flex: 1
                    }}
                  >
                    VS Code
                  </Button>
                  <Button
                    variant="contained"
                    color="secondary"
                    size="medium"
                    startIcon={<OpenInNewIcon />}
                    onClick={() => {
                      const cursorUrl = `cursor://vscode-remote/ssh-remote+${sshInfo.username}@${sshInfo.host}:${sshInfo.port}/home/developer/workspace`;
                      window.location.href = cursorUrl;
                    }}
                    sx={{ 
                      px: 2, 
                      py: 1,
                      fontSize: '0.9rem',
                      textTransform: 'none',
                      flex: 1
                    }}
                  >
                    Cursor
                  </Button>
                  <Button
                    variant="contained"
                    color="success"
                    size="medium"
                    startIcon={<OpenInNewIcon />}
                    onClick={() => {
                      const windsurfUrl = `windsurf://vscode-remote/ssh-remote+${sshInfo.username}@${sshInfo.host}:${sshInfo.port}/home/developer/workspace`;
                      window.location.href = windsurfUrl;
                    }}
                    sx={{ 
                      px: 2, 
                      py: 1,
                      fontSize: '0.9rem',
                      textTransform: 'none',
                      flex: 1
                    }}
                  >
                    Windsurf
                  </Button>
                </Box>
                
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center' }}>
                  Add your SSH public key in 'SSH Credentials' tab first
                </Typography>
              </Paper>
            </Box>
          )}

          {/* Tab 2: SSH Credentials */}
          {tabValue === 1 && credentials && (
            <Box>

              {/* SSH Public Keys */}
              <Paper elevation={0} sx={{ p: 3, bgcolor: 'background.default' }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <KeyIcon color="primary" />
                    <Typography variant="subtitle1" fontWeight="bold">
                      SSH Public Keys ({credentials.sshPublicKeys.length})
                    </Typography>
                  </Box>
                  <Button
                    variant="outlined"
                    startIcon={<AddIcon />}
                    onClick={() => setAddKeyDialog(true)}
                    size="small"
                  >
                    Add Key
                  </Button>
                </Box>

                {credentials.sshPublicKeys.length === 0 ? (
                  <Alert severity="info">
                    No SSH keys added yet. Add your public key to enable SSH access.
                  </Alert>
                ) : (
                  <List>
                    {credentials.sshPublicKeys.map((key, index) => {
                      const keyParts = key.split(' ');
                      const keyType = keyParts[0];
                      const keyFingerprint = keyParts[1]?.substring(0, 20) + '...';
                      const keyComment = keyParts[2] || 'No comment';

                      return (
                        <React.Fragment key={index}>
                          {index > 0 && <Divider />}
                          <ListItem>
                            <ListItemText
                              primary={
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Chip label={keyType} size="small" color="primary" />
                                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                    {keyFingerprint}
                                  </Typography>
                                </Box>
                              }
                              secondary={keyComment}
                            />
                            <ListItemSecondaryAction>
                              <Tooltip title="Copy full key">
                                <IconButton edge="end" onClick={() => copyToClipboard(key)} sx={{ mr: 1 }}>
                                  <CopyIcon />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Remove key">
                                <IconButton edge="end" onClick={() => deleteKey(index)}>
                                  <DeleteIcon />
                                </IconButton>
                              </Tooltip>
                            </ListItemSecondaryAction>
                          </ListItem>
                        </React.Fragment>
                      );
                    })}
                  </List>
                )}
              </Paper>
            </Box>
          )}
        </DialogContent>
        
        <DialogActions>
          <Button onClick={handleClose}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Add Key Dialog */}
      <Dialog open={addKeyDialog} onClose={closeAddKeyDialog} maxWidth="md" fullWidth>
        <DialogTitle>Add SSH Public Key</DialogTitle>
        <DialogContent
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          sx={{
            border: isDragging ? '2px dashed #1976d2' : '2px dashed transparent',
            borderRadius: 1,
            backgroundColor: isDragging ? 'rgba(25, 118, 210, 0.04)' : 'transparent',
            transition: 'all 0.2s ease-in-out',
            position: 'relative'
          }}
        >
          {/* File Upload Section */}
          <Box sx={{ mt: 2, mb: 3 }}>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".pub,text/plain"
              style={{ display: 'none' }}
            />
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              p: 4,
              border: '2px dashed',
              borderColor: 'divider',
              borderRadius: 2,
              bgcolor: 'background.default',
              transition: 'all 0.2s ease-in-out',
              cursor: 'pointer',
              '&:hover': {
                borderColor: 'primary.main',
                bgcolor: 'action.hover',
                '& .upload-icon': {
                  transform: 'scale(1.1)',
                  color: 'primary.main'
                }
              }
            }}
            onClick={() => fileInputRef.current?.click()}
            >
              <CloudUploadIcon 
                className="upload-icon"
                sx={{ 
                  fontSize: 64, 
                  color: 'text.secondary',
                  mb: 2,
                  transition: 'all 0.2s ease-in-out'
                }} 
              />
              <Typography variant="h6" color="text.primary" gutterBottom sx={{ fontWeight: 600 }}>
                Upload SSH Key File
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3, textAlign: 'center' }}>
                Drag and drop your .pub file here, or click to browse
              </Typography>
              <Button
                variant="contained"
                startIcon={<UploadIcon />}
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                sx={{
                  borderRadius: 2,
                  textTransform: 'none',
                  px: 3,
                  py: 1
                }}
              >
                Choose File
              </Button>
            </Box>
            {isDragging && (
              <Box sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(25, 118, 210, 0.12)',
                borderRadius: 2,
                border: '2px solid',
                borderColor: 'primary.main',
                zIndex: 1000,
                pointerEvents: 'none'
              }}>
                <CloudUploadIcon 
                  sx={{ 
                    fontSize: 48, 
                    color: 'primary.main',
                    mb: 1
                  }} 
                />
                <Typography variant="h6" color="primary" sx={{ fontWeight: 600 }}>
                  Drop SSH key file here
                </Typography>
              </Box>
            )}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', my: 2 }}>
            <Divider sx={{ flex: 1 }} />
            <Typography variant="body2" sx={{ mx: 2, color: 'text.secondary' }}>
              OR
            </Typography>
            <Divider sx={{ flex: 1 }} />
          </Box>

          {/* Manual Input Section */}
          <TextField
            fullWidth
            multiline
            rows={4}
            label="SSH Public Key"
            placeholder="ssh-rsa AAAAB3NzaC1yc2... user@host"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            sx={{ mb: 2 }}
            helperText="Paste your SSH public key here. Usually found in ~/.ssh/id_rsa.pub"
          />
          <TextField
            fullWidth
            label="Key Name (optional)"
            placeholder="My Laptop"
            value={keyName}
            onChange={(e) => setKeyName(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeAddKeyDialog}>Cancel</Button>
          <Button onClick={addPublicKey} variant="contained" disabled={!newKey.trim()}>
            Add Key
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};
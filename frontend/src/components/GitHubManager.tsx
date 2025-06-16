import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  CircularProgress,
  Alert,
  Avatar,
  Tooltip,
  TextField,
  InputAdornment,
  Snackbar,
  Divider,
  Grid
} from '@mui/material';
import {
  GitHub as GitHubIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  ContentCopy as CopyIcon,
  Lock as LockIcon,
  Public as PublicIcon,
  Link as LinkIcon,
  LinkOff as LinkOffIcon,
  Check as CheckIcon,
  Search as SearchIcon
} from '@mui/icons-material';
import githubService, { GitHubRepo, GitHubStatus } from '../services/github';

const GitHubManager: React.FC = () => {
  const [status, setStatus] = useState<GitHubStatus | null>(null);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);
  const [cloneUrl, setCloneUrl] = useState('');
  const [showCloneDialog, setShowCloneDialog] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadGitHubData();
  }, []);

  const loadGitHubData = async () => {
    try {
      setLoading(true);
      const [statusData, reposData] = await Promise.all([
        githubService.getStatus(),
        githubService.getRepos()
      ]);
      setStatus(statusData);
      setRepos(reposData.repos);
    } catch (error) {
      console.error('Failed to load GitHub data:', error);
      showSnackbar('Failed to load GitHub data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      const { authUrl } = await githubService.connect();
      window.open(authUrl, '_blank', 'width=600,height=700');
      
      // Poll for connection status
      const pollInterval = setInterval(async () => {
        const newStatus = await githubService.getStatus();
        if (newStatus.connected) {
          clearInterval(pollInterval);
          setStatus(newStatus);
          
          // Automatically sync repositories after connection
          showSnackbar('Connected! Syncing repositories...', 'success');
          try {
            const { repos: newRepos } = await githubService.syncRepos();
            setRepos(newRepos);
            showSnackbar(`Successfully synced ${newRepos.length} repositories!`, 'success');
          } catch (error) {
            console.error('Failed to sync repos after connection:', error);
            showSnackbar('Connected, but failed to sync repositories. Please try syncing manually.', 'error');
          }
        }
      }, 2000);
      
      // Stop polling after 5 minutes
      setTimeout(() => clearInterval(pollInterval), 300000);
    } catch (error) {
      console.error('Failed to initiate GitHub connection:', error);
      showSnackbar('Failed to connect to GitHub', 'error');
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect from GitHub? This will revoke access and remove all repository data.')) {
      return;
    }
    
    try {
      await githubService.disconnect();
      setStatus({ connected: false });
      setRepos([]);
      showSnackbar('Disconnected from GitHub', 'success');
    } catch (error) {
      console.error('Failed to disconnect:', error);
      showSnackbar('Failed to disconnect from GitHub', 'error');
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      const { repos: newRepos } = await githubService.syncRepos();
      setRepos(newRepos);
      showSnackbar('Repositories synced successfully', 'success');
    } catch (error) {
      console.error('Failed to sync repos:', error);
      showSnackbar('Failed to sync repositories', 'error');
    } finally {
      setSyncing(false);
    }
  };

  const handleDeleteRepo = async (repo: GitHubRepo) => {
    if (!window.confirm(`Remove ${repo.repo_full_name} from your connected repositories?`)) {
      return;
    }
    
    try {
      await githubService.deleteRepo(repo.repo_id);
      setRepos(repos.filter(r => r.repo_id !== repo.repo_id));
      showSnackbar('Repository removed', 'success');
    } catch (error) {
      console.error('Failed to delete repo:', error);
      showSnackbar('Failed to remove repository', 'error');
    }
  };

  const handleGetCloneUrl = async (repo: GitHubRepo) => {
    try {
      const tokenData = await githubService.getRepoToken(repo.repo_id);
      setCloneUrl(tokenData.clone_url);
      setSelectedRepo(repo);
      setShowCloneDialog(true);
    } catch (error) {
      console.error('Failed to get clone URL:', error);
      showSnackbar('Failed to get clone URL', 'error');
    }
  };

  const handleCopyCloneUrl = () => {
    navigator.clipboard.writeText(cloneUrl);
    showSnackbar('Clone URL copied to clipboard', 'success');
  };

  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Main Status Card */}
      <Card sx={{ mb: 3, background: status?.connected ? 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)' : undefined }}>
        <CardContent sx={{ p: 3 }}>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
            <Box display="flex" alignItems="center">
              <GitHubIcon sx={{ fontSize: 32, mr: 2, color: status?.connected ? '#fff' : 'text.primary' }} />
              <Typography variant="h5" sx={{ color: status?.connected ? '#fff' : 'text.primary' }}>
                GitHub Integration
              </Typography>
            </Box>
            {status?.connected && (
              <Chip
                icon={<CheckIcon />}
                label="Connected"
                color="success"
                sx={{ backgroundColor: 'rgba(76, 175, 80, 0.9)', color: '#fff' }}
              />
            )}
          </Box>

          {!status?.connected ? (
            <Box>
              <Typography variant="body1" sx={{ mb: 3, color: 'text.secondary' }}>
                Connect your GitHub account to manage repositories directly from your terminal.
              </Typography>
              
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6}>
                  <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                    <Typography variant="subtitle2" gutterBottom>Features</Typography>
                    <Typography variant="body2" color="text.secondary">
                      • Clone private repositories<br />
                      • Create pull requests<br />
                      • Manage issues<br />
                      • Update workflows
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                    <Typography variant="subtitle2" gutterBottom>Access Scope</Typography>
                    <Typography variant="body2" color="text.secondary">
                      • Access to ALL repositories<br />
                      • Cannot select specific repos<br />
                      • Includes all organizations<br />
                      • OAuth Apps limitation
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
              
              <Box textAlign="center">
                <Button
                  variant="contained"
                  size="large"
                  onClick={handleConnect}
                  startIcon={<GitHubIcon />}
                  sx={{ 
                    backgroundColor: '#24292e',
                    '&:hover': { backgroundColor: '#1a1e22' }
                  }}
                >
                  Connect GitHub Account
                </Button>
                <Typography variant="caption" display="block" sx={{ mt: 2, color: 'text.secondary' }}>
                  This will request repository access permissions
                </Typography>
              </Box>
            </Box>
          ) : (
            <Box>
              {status.github_user && (
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box display="flex" alignItems="center">
                    <Avatar 
                      src={status.github_user.avatar_url} 
                      sx={{ width: 48, height: 48, mr: 2 }} 
                    />
                    <Box>
                      <Typography variant="h6" sx={{ color: '#fff' }}>
                        {status.github_user.name || status.github_user.login}
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                        @{status.github_user.login}
                        {status.connected_at && (
                          <> • Connected {new Date(status.connected_at).toLocaleDateString()}</>
                        )}
                      </Typography>
                    </Box>
                  </Box>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={handleDisconnect}
                    startIcon={<LinkOffIcon />}
                    sx={{ 
                      borderColor: 'rgba(255,255,255,0.5)',
                      color: '#fff',
                      '&:hover': {
                        borderColor: '#fff',
                        backgroundColor: 'rgba(255,255,255,0.1)'
                      }
                    }}
                  >
                    Disconnect
                  </Button>
                </Box>
              )}
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Repository List - Only show when connected */}
      {status?.connected && (
        <Card>
          <CardContent>
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
              <Box>
                <Typography variant="h6">
                  Repositories
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {repos.length} {repos.length === 1 ? 'repository' : 'repositories'} synced
                </Typography>
              </Box>
              <Box display="flex" alignItems="center" gap={2}>
                <TextField
                  size="small"
                  placeholder="Search repositories..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon sx={{ color: 'text.secondary' }} />
                      </InputAdornment>
                    ),
                  }}
                  sx={{ minWidth: 250 }}
                />
                <Button
                  variant="outlined"
                  onClick={handleSync}
                  disabled={syncing}
                  startIcon={syncing ? <CircularProgress size={16} /> : <RefreshIcon />}
                >
                  {syncing ? 'Syncing...' : 'Sync'}
                </Button>
              </Box>
            </Box>

            <Divider sx={{ mb: 2 }} />

            {repos.length === 0 ? (
              <Box textAlign="center" py={4}>
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  No repositories synced yet
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Click the sync button above to fetch your repositories from GitHub
                </Typography>
                <Button
                  variant="contained"
                  onClick={handleSync}
                  disabled={syncing}
                  startIcon={<RefreshIcon />}
                >
                  Sync Repositories
                </Button>
              </Box>
            ) : (
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Click on any repository to get a secure clone URL
                </Typography>
                {(() => {
                  const filteredRepos = repos.filter((repo) => 
                    repo.repo_full_name.toLowerCase().includes(searchQuery.toLowerCase())
                  );

                  if (filteredRepos.length === 0) {
                    return (
                      <Box textAlign="center" py={4}>
                        <Typography variant="body1" color="text.secondary">
                          No repositories found matching "{searchQuery}"
                        </Typography>
                      </Box>
                    );
                  }

                  return (
                    <List sx={{ maxHeight: 400, overflow: 'auto' }}>
                      {filteredRepos.map((repo) => (
                    <ListItem
                      key={repo.repo_id}
                      button
                      onClick={() => handleGetCloneUrl(repo)}
                      sx={{
                        '&:hover': { bgcolor: 'action.hover' },
                        borderRadius: 1,
                        mb: 1
                      }}
                    >
                      <ListItemText
                        primary={
                          <Box display="flex" alignItems="center">
                            <Typography variant="body1">
                              {repo.repo_full_name}
                            </Typography>
                            {repo.is_private ? (
                              <Tooltip title="Private repository">
                                <LockIcon sx={{ ml: 1, fontSize: 16, color: 'text.secondary' }} />
                              </Tooltip>
                            ) : (
                              <Tooltip title="Public repository">
                                <PublicIcon sx={{ ml: 1, fontSize: 16, color: 'text.secondary' }} />
                              </Tooltip>
                            )}
                          </Box>
                        }
                        secondary={`Last synced: ${new Date(repo.last_synced_at).toLocaleString()}`}
                      />
                    </ListItem>
                      ))}
                    </List>
                  );
                })()}
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {/* Clone Dialog */}
      <Dialog open={showCloneDialog} onClose={() => setShowCloneDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Clone Repository</DialogTitle>
        <DialogContent>
          {selectedRepo && (
            <Box>
              <Typography variant="body2" color="text.secondary" mb={2}>
                Use this secure URL to clone <strong>{selectedRepo.repo_full_name}</strong>:
              </Typography>
              <TextField
                fullWidth
                value={cloneUrl}
                variant="outlined"
                InputProps={{
                  readOnly: true,
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={handleCopyCloneUrl}>
                        <CopyIcon />
                      </IconButton>
                    </InputAdornment>
                  ),
                  sx: { fontFamily: 'monospace', fontSize: '0.9rem' }
                }}
                sx={{ mb: 2 }}
              />
              <Alert severity="info" sx={{ mb: 2 }}>
                This URL includes a temporary access token. Use it immediately and do not share it.
              </Alert>
              <Typography variant="body2" color="text.secondary">
                Terminal command:
              </Typography>
              <Box
                component="pre"
                sx={{
                  bgcolor: 'grey.900',
                  p: 2,
                  borderRadius: 1,
                  overflow: 'auto',
                  fontFamily: 'monospace',
                  fontSize: '0.9rem',
                  mt: 1
                }}
              >
                git clone {cloneUrl}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCloneDialog(false)}>Close</Button>
          <Button onClick={handleCopyCloneUrl} variant="contained" startIcon={<CopyIcon />}>
            Copy URL
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default GitHubManager;
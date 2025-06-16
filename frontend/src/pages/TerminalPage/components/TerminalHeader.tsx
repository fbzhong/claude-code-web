import React from 'react';
import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Logout as LogoutIcon,
  GitHub as GitHubIcon,
  VpnKey as VpnKeyIcon,
} from '@mui/icons-material';

interface TerminalHeaderProps {
  user: { username: string } | null;
  onMenuClick: () => void;
  onGitHubClick: () => void;
  onSSHClick: () => void;
  onLogout: () => void;
}

export const TerminalHeader: React.FC<TerminalHeaderProps> = ({
  user,
  onMenuClick,
  onGitHubClick,
  onSSHClick,
  onLogout,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <AppBar position="static" sx={{ bgcolor: '#2d2d30' }}>
      <Toolbar sx={{ minHeight: { xs: 56, sm: 64 } }}>
        <IconButton
          color="inherit"
          onClick={onMenuClick}
          sx={{ mr: { xs: 1, sm: 2 } }}
        >
          <MenuIcon />
        </IconButton>
        
        <Typography 
          variant={isMobile ? "subtitle1" : "h6"} 
          sx={{ 
            flexGrow: 1, 
            fontWeight: 600,
            display: { xs: 'none', sm: 'block' }
          }}
        >
          Claude Web Terminal
        </Typography>
        
        {/* Simplified mobile header */}
        <Typography 
          variant="subtitle1" 
          sx={{ 
            flexGrow: 1, 
            fontWeight: 600,
            display: { xs: 'block', sm: 'none' }
          }}
        >
          Terminal
        </Typography>
        
        {!isMobile && (
          <Typography variant="body2" sx={{ mr: 2, opacity: 0.9 }}>
            {user?.username}
          </Typography>
        )}
        
        <IconButton 
          color="inherit" 
          onClick={onGitHubClick}
          size={isMobile ? "medium" : "small"}
          sx={{ mr: 1 }}
          title="GitHub Integration"
        >
          <GitHubIcon />
        </IconButton>
        
        <IconButton 
          color="inherit" 
          onClick={onSSHClick}
          size={isMobile ? "medium" : "small"}
          sx={{ mr: 1 }}
          title="SSH Access Management"
        >
          <VpnKeyIcon />
        </IconButton>
        
        <IconButton 
          color="inherit" 
          onClick={onLogout} 
          size={isMobile ? "medium" : "small"}
        >
          <LogoutIcon />
        </IconButton>
      </Toolbar>
    </AppBar>
  );
};
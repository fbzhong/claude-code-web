import React from 'react';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Terminal as TerminalIcon,
  Add as AddIcon,
} from '@mui/icons-material';

interface EmptyTerminalStateProps {
  isCreating: boolean;
  onOpenSessions: () => void;
}

export const EmptyTerminalState: React.FC<EmptyTerminalStateProps> = ({
  isCreating,
  onOpenSessions,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Box sx={{ 
      flex: 1, 
      display: 'flex', 
      flexDirection: 'column',
      alignItems: 'center', 
      justifyContent: 'center',
      color: 'rgba(255,255,255,0.6)',
      p: 2,
    }}>
      <TerminalIcon sx={{ fontSize: { xs: 48, sm: 64 }, mb: 2, opacity: 0.5 }} />
      <Typography variant={isMobile ? "h6" : "h5"} sx={{ mb: 1 }}>
        No Session Selected
      </Typography>
      <Typography 
        variant="body2" 
        sx={{ 
          mb: 3, 
          textAlign: 'center', 
          maxWidth: { xs: '100%', sm: 400 },
          px: { xs: 2, sm: 0 }
        }}
      >
        Open the menu to view sessions or create a new one to start using the terminal.
      </Typography>
      <Button
        variant="contained"
        size={isMobile ? "large" : "medium"}
        startIcon={isCreating ? <CircularProgress size={18} /> : <AddIcon />}
        onClick={onOpenSessions}
        disabled={isCreating}
      >
        {isCreating ? 'Creating...' : 'Open Sessions Menu'}
      </Button>
    </Box>
  );
};
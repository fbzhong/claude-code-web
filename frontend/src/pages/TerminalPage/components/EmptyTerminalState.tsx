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
      position: 'relative',
      overflow: 'auto',
    }}>
      {/* ASCII Art Above Content */}
      <Box
        sx={{
          mb: { xs: 2, sm: 3, md: 4 },
          opacity: 0.3,
          fontSize: { xs: '0.4rem', sm: '0.6rem', md: '0.8rem' },
          lineHeight: 1.2,
          fontFamily: 'monospace',
          color: '#007AFF',
          whiteSpace: 'pre',
          userSelect: 'none',
          textAlign: 'center',
          textShadow: '0 0 10px rgba(0, 122, 255, 0.5)',
        }}
      >
{`       ███╗   ███╗   ██████╗   ██╗   ██╗  ███╗   ██╗  ████████╗   █████╗   ██╗  ███╗   ██╗  
       ████╗ ████║  ██╔═══██╗  ██║   ██║  ████╗  ██║  ╚══██╔══╝  ██╔══██╗  ██║  ████╗  ██║  
       ██╔██╗██╔██║  ██║   ██║  ██║   ██║  ██╔██╗ ██║     ██║     ███████║  ██║  ██╔██╗ ██║  
       ██║╚██╔╝██║  ██║   ██║  ██║   ██║  ██║╚██╗██║     ██║     ██╔══██║  ██║  ██║╚██╗██║  
       ██║ ╚═╝ ██║  ╚██████╔╝  ╚██████╔╝  ██║ ╚████║     ██║     ██║  ██║  ██║  ██║ ╚████║  
       ╚═╝     ╚═╝   ╚═════╝    ╚═════╝   ╚═╝  ╚═══╝     ╚═╝     ╚═╝  ╚═╝  ╚═╝  ╚═╝  ╚═══╝  
                               .-'''-.
                             _(       )_
                           _(  (___)   )_
                .-'''-.  _(  (_____)     )_  .-'''-.
              _(       )_(  (_______)       )_(       )_
            _(  (___)   )(  (_________)         )(  (___)   )_
          _(  (_____)     )(  (____________)          )(  (_____)     )_
        _(  (_______)       )(______________________________)(  (_______)       )_
      _(  (_________)         )_                        _(  (_________)         )_
     (  (____________)          )_                  _(  (____________)          )
      (______________________________)            (______________________________)`}
      </Box>
      
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Typography 
          variant="body2" 
          sx={{ 
            mb: 4, 
            textAlign: 'center', 
            maxWidth: { xs: '100%', sm: 400 },
            px: { xs: 2, sm: 0 },
            opacity: 0.8,
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
          sx={{
            py: 1.5,
            px: 3,
          }}
        >
          {isCreating ? 'Creating...' : 'Open Sessions Menu'}
        </Button>
      </Box>
    </Box>
  );
};
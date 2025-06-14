import React from 'react';
import {
  Box,
  IconButton,
  Button,
  ButtonGroup,
  useTheme,
  useMediaQuery,
  Paper,
  Tooltip,
} from '@mui/material';
import {
  KeyboardArrowUp,
  KeyboardArrowDown,
  KeyboardArrowLeft,
  KeyboardArrowRight,
} from '@mui/icons-material';

interface MobileKeyboardToolbarProps {
  onKeyPress: (key: string) => void;
  visible?: boolean;
}

export const MobileKeyboardToolbar: React.FC<MobileKeyboardToolbarProps> = ({ 
  onKeyPress, 
  visible = true 
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  if (!isMobile || !visible) {
    return null;
  }

  const handleKeyPress = (key: string) => {
    onKeyPress(key);
  };

  const KeyButton: React.FC<{ 
    label: string; 
    keyCode: string; 
    tooltip?: string;
    size?: 'small' | 'medium';
  }> = ({ label, keyCode, tooltip, size = 'small' }) => (
    <Tooltip title={tooltip || label}>
      <Button
        size={size}
        variant="outlined"
        onClick={() => handleKeyPress(keyCode)}
        sx={{
          minWidth: 'auto',
          px: 1,
          py: 0.5,
          fontSize: '0.75rem',
          borderColor: 'divider',
          color: 'text.secondary',
          '&:hover': {
            backgroundColor: 'action.hover',
            borderColor: 'primary.main',
          },
        }}
      >
        {label}
      </Button>
    </Tooltip>
  );

  const ArrowButton: React.FC<{
    direction: 'up' | 'down' | 'left' | 'right';
    keyCode: string;
  }> = ({ direction, keyCode }) => {
    const icons = {
      up: <KeyboardArrowUp />,
      down: <KeyboardArrowDown />,
      left: <KeyboardArrowLeft />,
      right: <KeyboardArrowRight />,
    };

    return (
      <IconButton
        size="small"
        onClick={() => handleKeyPress(keyCode)}
        sx={{
          color: 'text.secondary',
          '&:hover': {
            backgroundColor: 'action.hover',
            color: 'primary.main',
          },
        }}
      >
        {icons[direction]}
      </IconButton>
    );
  };

  return (
    <Paper
      elevation={4}
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1300,
        backgroundColor: 'background.paper',
        borderTop: 1,
        borderColor: 'divider',
        px: 1,
        py: 0.5,
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        '&::-webkit-scrollbar': {
          height: 4,
        },
        '&::-webkit-scrollbar-thumb': {
          backgroundColor: 'action.disabled',
          borderRadius: 2,
        },
      }}
    >
      {/* Common keys group */}
      <ButtonGroup size="small" variant="outlined">
        <KeyButton label="ESC" keyCode="\x1B" tooltip="Escape" />
        <KeyButton label="Tab" keyCode="\t" tooltip="Tab completion" />
        <KeyButton label="Ctrl+C" keyCode="\x03" tooltip="Interrupt" />
        <KeyButton label="Ctrl+D" keyCode="\x04" tooltip="Exit" />
      </ButtonGroup>

      {/* Navigation keys */}
      <ButtonGroup size="small" variant="outlined">
        <KeyButton label="Home" keyCode="\x1B[H" tooltip="Beginning of line" />
        <KeyButton label="End" keyCode="\x1B[F" tooltip="End of line" />
      </ButtonGroup>

      {/* Page navigation */}
      <ButtonGroup size="small" variant="outlined">
        <KeyButton label="PgUp" keyCode="\x1B[5~" tooltip="Page Up" />
        <KeyButton label="PgDn" keyCode="\x1B[6~" tooltip="Page Down" />
      </ButtonGroup>

      {/* Arrow keys */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          ml: 1,
        }}
      >
        <ArrowButton direction="up" keyCode="\x1B[A" />
        <Box sx={{ display: 'flex' }}>
          <ArrowButton direction="left" keyCode="\x1B[D" />
          <ArrowButton direction="down" keyCode="\x1B[B" />
          <ArrowButton direction="right" keyCode="\x1B[C" />
        </Box>
      </Box>

      {/* Additional useful keys */}
      <ButtonGroup size="small" variant="outlined" sx={{ ml: 'auto' }}>
        <KeyButton label="Ctrl+L" keyCode="\x0C" tooltip="Clear screen" />
        <KeyButton label="Ctrl+A" keyCode="\x01" tooltip="Beginning of line" />
        <KeyButton label="Ctrl+E" keyCode="\x05" tooltip="End of line" />
        <KeyButton label="Ctrl+Z" keyCode="\x1A" tooltip="Suspend" />
      </ButtonGroup>
    </Paper>
  );
};

// Hook to manage keyboard toolbar state
export const useMobileKeyboardToolbar = () => {
  const [isVisible, setIsVisible] = React.useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Toggle toolbar visibility
  const toggleToolbar = () => {
    setIsVisible(prev => !prev);
  };

  // Hide toolbar when not mobile
  React.useEffect(() => {
    if (!isMobile) {
      setIsVisible(false);
    }
  }, [isMobile]);

  return {
    isVisible,
    setIsVisible,
    toggleToolbar,
    isMobile,
  };
};
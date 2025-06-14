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
  keyboardHeight?: number;
}

export const MobileKeyboardToolbar: React.FC<MobileKeyboardToolbarProps> = ({ 
  onKeyPress, 
  visible = true,
  keyboardHeight = 0 
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  if (!isMobile || !visible) {
    return null;
  }

  const handleKeyPress = (key: string, event?: React.MouseEvent) => {
    // Prevent button from taking focus
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
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
        variant="contained"
        onMouseDown={(e) => {
          e.preventDefault(); // Prevent focus loss
          handleKeyPress(keyCode, e);
          // Remove focus after click
          setTimeout(() => (e.target as HTMLElement).blur(), 0);
        }}
        onTouchStart={(e) => {
          e.preventDefault(); // Prevent focus loss on touch
          handleKeyPress(keyCode);
          // Remove focus after touch
          setTimeout(() => (e.target as HTMLElement).blur(), 0);
        }}
        onClick={(e) => e.preventDefault()} // Prevent any default click behavior
        sx={{
          minWidth: 50,
          minHeight: 40,
          px: 0.5,
          py: 0.75,
          fontSize: '0.85rem',
          fontWeight: '500',
          backgroundColor: '#2a2a2a',
          color: '#ffffff',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: 1.5,
          textTransform: 'none',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          whiteSpace: 'nowrap',
          flexShrink: 0,
          '&:hover': {
            backgroundColor: '#3a3a3a',
            borderColor: 'rgba(255, 255, 255, 0.3)',
            transform: 'translateY(-1px)',
            boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
          },
          '&:active': {
            backgroundColor: '#1a1a1a',
            transform: 'translateY(0)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
          },
          '&:focus': {
            outline: 'none',
            backgroundColor: '#2a2a2a',
          },
          '&:focus-visible': {
            outline: '2px solid rgba(255, 255, 255, 0.3)',
            outlineOffset: '2px',
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
        onMouseDown={(e) => {
          e.preventDefault(); // Prevent focus loss
          handleKeyPress(keyCode, e);
          // Remove focus after click
          setTimeout(() => (e.target as HTMLElement).blur(), 0);
        }}
        onTouchStart={(e) => {
          e.preventDefault(); // Prevent focus loss on touch
          handleKeyPress(keyCode);
          // Remove focus after touch
          setTimeout(() => (e.target as HTMLElement).blur(), 0);
        }}
        onClick={(e) => e.preventDefault()} // Prevent any default click behavior
        sx={{
          padding: 0.75,
          minWidth: 40,
          minHeight: 40,
          flexShrink: 0,
          backgroundColor: '#2a2a2a',
          color: '#ffffff',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: 1.5,
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          '&:hover': {
            backgroundColor: '#3a3a3a',
            borderColor: 'rgba(255, 255, 255, 0.3)',
            transform: 'translateY(-1px)',
            boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
          },
          '&:active': {
            backgroundColor: '#1a1a1a',
            transform: 'translateY(0)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
          },
          '&:focus': {
            outline: 'none',
            backgroundColor: '#2a2a2a',
          },
          '&:focus-visible': {
            outline: '2px solid rgba(255, 255, 255, 0.3)',
            outlineOffset: '2px',
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
        bottom: keyboardHeight > 0 ? `${keyboardHeight}px` : 0,
        left: 0,
        right: 0,
        zIndex: 1300,
        backgroundColor: '#1a1a1a',
        borderTop: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
        px: 0.75,
        py: 0.75,
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 0.5,
        overflowX: 'auto',
        overflowY: 'hidden',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
        '&::-webkit-scrollbar': {
          display: 'none',
        },
        // Smooth transition when showing/hiding
        transform: visible ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 0.3s ease-in-out, bottom 0.3s ease-in-out',
        // Ensure it stays above the iOS keyboard
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {/* Most frequently used first */}
      <KeyButton label="Tab" keyCode={'\t'} tooltip="Tab" />
      <KeyButton label="Enter" keyCode={'\r'} tooltip="Enter" />
      <KeyButton label="ESC" keyCode={'\x1B'} tooltip="Escape" />
      <KeyButton label="^C" keyCode={'\x03'} tooltip="Stop" />
      <KeyButton label="^L" keyCode={'\x0C'} tooltip="Clear" />
      
      {/* Navigation - inline arrows */}
      <ArrowButton direction="left" keyCode={'\x1B[D'} />
      <ArrowButton direction="up" keyCode={'\x1B[A'} />
      <ArrowButton direction="down" keyCode={'\x1B[B'} />
      <ArrowButton direction="right" keyCode={'\x1B[C'} />
      
      {/* Less frequent but important */}
      <KeyButton label="^U" keyCode={'\x15'} tooltip="Clear line" />
      <KeyButton label="^W" keyCode={'\x17'} tooltip="Delete word" />
      <KeyButton label="^R" keyCode={'\x12'} tooltip="Search" />
      <KeyButton label="^D" keyCode={'\x04'} tooltip="Exit" />
      <KeyButton label="^Z" keyCode={'\x1A'} tooltip="Suspend" />
      
      {/* Scroll indicator */}
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        px: 1,
        color: 'rgba(255, 255, 255, 0.4)',
        fontSize: '0.7rem',
        flexShrink: 0,
        fontStyle: 'italic',
      }}>
        滑动 →
      </Box>
    </Paper>
  );
};

// Hook to manage keyboard toolbar state
export const useMobileKeyboardToolbar = (onKeyboardShow?: () => void) => {
  const [isVisible, setIsVisible] = React.useState(false);
  const [isNativeKeyboardOpen, setIsNativeKeyboardOpen] = React.useState(false);
  const [keyboardHeight, setKeyboardHeight] = React.useState(0);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Toggle toolbar visibility
  const toggleToolbar = () => {
    setIsVisible(prev => !prev);
  };

  // Detect native keyboard state on iOS
  React.useEffect(() => {
    if (!isMobile) {
      setIsVisible(false);
      return;
    }

    let lastHeight = window.innerHeight;
    
    const detectKeyboard = () => {
      const currentHeight = window.innerHeight;
      const viewport = window.visualViewport;
      
      // Use visualViewport if available (more accurate on iOS)
      if (viewport) {
        const calculatedKeyboardHeight = window.innerHeight - viewport.height;
        const isKeyboardOpen = calculatedKeyboardHeight > 50; // Threshold to detect keyboard
        
        setIsNativeKeyboardOpen(isKeyboardOpen);
        setKeyboardHeight(isKeyboardOpen ? calculatedKeyboardHeight : 0);
        // Auto show/hide toolbar with native keyboard
        if (isKeyboardOpen !== isVisible) {
          setIsVisible(isKeyboardOpen);
          if (isKeyboardOpen && onKeyboardShow) {
            onKeyboardShow();
          }
        }
      } else {
        // Fallback for older browsers
        const heightDiff = lastHeight - currentHeight;
        const isKeyboardOpen = heightDiff > 100; // Keyboard typically > 100px
        
        setIsNativeKeyboardOpen(isKeyboardOpen);
        setKeyboardHeight(isKeyboardOpen ? heightDiff : 0);
        if (isKeyboardOpen !== isVisible) {
          setIsVisible(isKeyboardOpen);
          if (isKeyboardOpen && onKeyboardShow) {
            onKeyboardShow();
          }
        }
      }
      
      lastHeight = currentHeight;
    };

    // Listen to viewport changes
    const handleViewportChange = () => {
      detectKeyboard();
    };

    // Listen to focus/blur events on inputs
    const handleFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      // Check if focused element is in terminal
      if (target && target.closest('.xterm')) {
        setTimeout(detectKeyboard, 300); // Wait for keyboard animation
      }
    };

    const handleBlur = () => {
      setTimeout(detectKeyboard, 300); // Wait for keyboard animation
    };

    // Add event listeners
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange);
      // Don't listen to scroll events as they can cause false negatives
      // window.visualViewport.addEventListener('scroll', handleViewportChange);
    } else {
      window.addEventListener('resize', handleViewportChange);
    }
    
    document.addEventListener('focusin', handleFocus);
    document.addEventListener('focusout', handleBlur);

    // Initial detection
    detectKeyboard();

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportChange);
      } else {
        window.removeEventListener('resize', handleViewportChange);
      }
      document.removeEventListener('focusin', handleFocus);
      document.removeEventListener('focusout', handleBlur);
    };
  }, [isMobile, onKeyboardShow]);

  return {
    isVisible,
    setIsVisible,
    toggleToolbar,
    isMobile,
    isNativeKeyboardOpen,
    keyboardHeight,
  };
};
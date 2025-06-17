import { createTheme } from '@mui/material/styles';

// Modern Silicon Valley color palette - inspired by Apple and top tech companies
const palette = {
  primary: {
    main: '#007AFF', // iOS blue - clean and modern
    light: '#5AC8FA',
    dark: '#0051D5',
    contrastText: '#FFFFFF',
  },
  secondary: {
    main: '#5856D6', // Purple accent - modern gradient endpoint
    light: '#AF52DE',
    dark: '#3F3C9F',
    contrastText: '#FFFFFF',
  },
  success: {
    main: '#34C759',
    light: '#4CD964',
    dark: '#248A3D',
  },
  error: {
    main: '#FF3B30',
    light: '#FF6961',
    dark: '#D70015',
  },
  warning: {
    main: '#FF9500',
    light: '#FFCC00',
    dark: '#F57C00',
  },
  info: {
    main: '#5AC8FA',
    light: '#64D2FF',
    dark: '#0A84FF',
  },
  background: {
    default: '#000000', // Pure black for modern look
    paper: '#0A0A0A', // Near black
    elevated: '#141414', // Slightly elevated surface
  },
  text: {
    primary: '#FFFFFF',
    secondary: 'rgba(255, 255, 255, 0.7)',
    disabled: 'rgba(255, 255, 255, 0.38)',
  },
  divider: 'rgba(255, 255, 255, 0.08)',
  action: {
    active: '#FFFFFF',
    hover: 'rgba(255, 255, 255, 0.08)',
    selected: 'rgba(255, 255, 255, 0.12)',
    disabled: 'rgba(255, 255, 255, 0.26)',
    disabledBackground: 'rgba(255, 255, 255, 0.12)',
  },
};

// Modern typography inspired by SF Pro
const typography = {
  fontFamily: [
    '-apple-system',
    'BlinkMacSystemFont',
    '"SF Pro Display"',
    '"SF Pro Text"',
    '"Helvetica Neue"',
    'Arial',
    'sans-serif',
  ].join(','),
  h1: {
    fontSize: '3.5rem',
    fontWeight: 700,
    letterSpacing: '-0.02em',
    lineHeight: 1.2,
  },
  h2: {
    fontSize: '2.5rem',
    fontWeight: 600,
    letterSpacing: '-0.01em',
    lineHeight: 1.3,
  },
  h3: {
    fontSize: '2rem',
    fontWeight: 600,
    letterSpacing: '-0.01em',
    lineHeight: 1.4,
  },
  h4: {
    fontSize: '1.5rem',
    fontWeight: 600,
    letterSpacing: '0',
    lineHeight: 1.4,
  },
  h5: {
    fontSize: '1.25rem',
    fontWeight: 600,
    letterSpacing: '0',
    lineHeight: 1.5,
  },
  h6: {
    fontSize: '1.125rem',
    fontWeight: 600,
    letterSpacing: '0',
    lineHeight: 1.5,
  },
  body1: {
    fontSize: '1rem',
    fontWeight: 400,
    letterSpacing: '0',
    lineHeight: 1.5,
  },
  body2: {
    fontSize: '0.875rem',
    fontWeight: 400,
    letterSpacing: '0',
    lineHeight: 1.5,
  },
  button: {
    fontSize: '0.9375rem',
    fontWeight: 500,
    letterSpacing: '0.02em',
    textTransform: 'none' as const,
  },
  caption: {
    fontSize: '0.75rem',
    fontWeight: 400,
    letterSpacing: '0.03em',
    lineHeight: 1.66,
  },
  overline: {
    fontSize: '0.6875rem',
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    lineHeight: 2,
  },
};

// Modern shape with subtle rounded corners
const shape = {
  borderRadius: 12,
};

// Smooth transitions
const transitions = {
  easing: {
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    easeOut: 'cubic-bezier(0.0, 0, 0.2, 1)',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    sharp: 'cubic-bezier(0.4, 0, 0.6, 1)',
  },
  duration: {
    shortest: 150,
    shorter: 200,
    short: 250,
    standard: 300,
    complex: 375,
    enteringScreen: 225,
    leavingScreen: 195,
  },
};

// Modern shadows with blur
const shadows = [
  'none',
  '0px 2px 4px rgba(0, 0, 0, 0.6)',
  '0px 4px 8px rgba(0, 0, 0, 0.6)',
  '0px 8px 16px rgba(0, 0, 0, 0.6)',
  '0px 12px 24px rgba(0, 0, 0, 0.6)',
  '0px 16px 32px rgba(0, 0, 0, 0.6)',
  '0px 20px 40px rgba(0, 0, 0, 0.6)',
  '0px 24px 48px rgba(0, 0, 0, 0.6)',
  '0px 28px 56px rgba(0, 0, 0, 0.6)',
  '0px 32px 64px rgba(0, 0, 0, 0.6)',
  '0px 36px 72px rgba(0, 0, 0, 0.6)',
  '0px 40px 80px rgba(0, 0, 0, 0.6)',
  '0px 44px 88px rgba(0, 0, 0, 0.6)',
  '0px 48px 96px rgba(0, 0, 0, 0.6)',
  '0px 52px 104px rgba(0, 0, 0, 0.6)',
  '0px 56px 112px rgba(0, 0, 0, 0.6)',
  '0px 60px 120px rgba(0, 0, 0, 0.6)',
  '0px 64px 128px rgba(0, 0, 0, 0.6)',
  '0px 68px 136px rgba(0, 0, 0, 0.6)',
  '0px 72px 144px rgba(0, 0, 0, 0.6)',
  '0px 76px 152px rgba(0, 0, 0, 0.6)',
  '0px 80px 160px rgba(0, 0, 0, 0.6)',
  '0px 84px 168px rgba(0, 0, 0, 0.6)',
  '0px 88px 176px rgba(0, 0, 0, 0.6)',
  '0px 92px 184px rgba(0, 0, 0, 0.6)',
];

export const modernTheme = createTheme({
  palette,
  typography,
  shape,
  transitions,
  shadows: shadows as any,
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollbarColor: '#2C2C2E #000000',
          '&::-webkit-scrollbar, & *::-webkit-scrollbar': {
            width: 8,
            height: 8,
          },
          '&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb': {
            borderRadius: 4,
            backgroundColor: '#2C2C2E',
            minHeight: 24,
            border: '2px solid #000000',
          },
          '&::-webkit-scrollbar-thumb:hover, & *::-webkit-scrollbar-thumb:hover': {
            backgroundColor: '#3A3A3C',
          },
          '&::-webkit-scrollbar-track, & *::-webkit-scrollbar-track': {
            backgroundColor: '#000000',
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '10px 20px',
          fontSize: '0.9375rem',
          fontWeight: 500,
          boxShadow: 'none',
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            transform: 'translateY(-1px)',
            boxShadow: '0 4px 12px rgba(0, 122, 255, 0.15)',
          },
        },
        contained: {
          background: 'linear-gradient(135deg, #007AFF 0%, #5856D6 100%)',
          '&:hover': {
            background: 'linear-gradient(135deg, #0051D5 0%, #3F3C9F 100%)',
          },
        },
        outlined: {
          borderWidth: 2,
          '&:hover': {
            borderWidth: 2,
            backgroundColor: 'rgba(0, 122, 255, 0.08)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#0A0A0A',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(20px)',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
          boxShadow: 'none',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: 'rgba(10, 10, 10, 0.95)',
          backdropFilter: 'blur(20px)',
          borderRight: '1px solid rgba(255, 255, 255, 0.05)',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            transition: 'all 0.2s ease-in-out',
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
            },
            '&.Mui-focused': {
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: '#007AFF',
                borderWidth: 2,
              },
            },
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          backgroundColor: '#0A0A0A',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(20px)',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          fontWeight: 500,
          backgroundColor: 'rgba(255, 255, 255, 0.08)',
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.12)',
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            transform: 'scale(1.1)',
          },
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          margin: '2px 8px',
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
          },
          '&.Mui-selected': {
            backgroundColor: 'rgba(0, 122, 255, 0.15)',
            '&:hover': {
              backgroundColor: 'rgba(0, 122, 255, 0.25)',
            },
          },
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: 'rgba(30, 30, 30, 0.95)',
          backdropFilter: 'blur(10px)',
          borderRadius: 6,
          fontSize: '0.875rem',
          padding: '8px 12px',
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          backdropFilter: 'blur(10px)',
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          backgroundColor: 'rgba(255, 255, 255, 0.08)',
        },
        bar: {
          borderRadius: 4,
          background: 'linear-gradient(90deg, #007AFF 0%, #5856D6 100%)',
        },
      },
    },
  },
});
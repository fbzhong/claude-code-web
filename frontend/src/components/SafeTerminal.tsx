import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { Box } from '@mui/material';

interface SafeTerminalProps {
  onData: (data: string) => void;
  onResize?: (cols: number, rows: number) => void;
}

export interface SafeTerminalHandle {
  write: (data: string) => void;
  clear: () => void;
  focus: () => void;
}

export const SafeTerminal = forwardRef<SafeTerminalHandle, SafeTerminalProps>(
  ({ onData, onResize }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const terminalRef = useRef<Terminal | null>(null);
    const isInitialized = useRef(false);

    useEffect(() => {
      if (!containerRef.current || isInitialized.current) {
        return;
      }

      // Ensure container has dimensions before creating terminal
      const container = containerRef.current;
      const rect = container.getBoundingClientRect();
      
      if (rect.width === 0 || rect.height === 0) {
        // Retry after a short delay if container has no size
        const retryTimeout = setTimeout(() => {
          if (!isInitialized.current) {
            // Force a re-render by updating state
            window.dispatchEvent(new Event('resize'));
          }
        }, 100);
        return () => clearTimeout(retryTimeout);
      }

      console.log('Initializing SafeTerminal with container size:', rect.width, 'x', rect.height);
      isInitialized.current = true;

      try {
        // Create terminal with explicit options to avoid viewport issues
        const term = new Terminal({
          cols: 80,
          rows: 24,
          fontSize: 14,
          fontFamily: 'Menlo, Monaco, "Courier New", monospace',
          theme: {
            background: '#1e1e1e',
            foreground: '#d4d4d4',
            cursor: '#d4d4d4',
            black: '#000000',
            red: '#cd3131',
            green: '#0dbc79',
            yellow: '#e5e510',
            blue: '#2472c8',
            magenta: '#bc3fbc',
            cyan: '#11a8cd',
            white: '#e5e5e5',
            brightBlack: '#666666',
            brightRed: '#f14c4c',
            brightGreen: '#23d18b',
            brightYellow: '#f5f543',
            brightBlue: '#3b8eea',
            brightMagenta: '#d670d6',
            brightCyan: '#29b8db',
            brightWhite: '#e5e5e5'
          },
          allowTransparency: false,
          drawBoldTextInBrightColors: true,
          letterSpacing: 0,
          lineHeight: 1,
          scrollback: 1000,
          tabStopWidth: 8,
          windowsMode: false
        });

        terminalRef.current = term;

        // Open terminal in container
        term.open(container);

        // Set up event handlers with stable references
        const dataHandler = (data: string) => {
          onData(data);
        };

        const resizeHandler = ({ cols, rows }: { cols: number; rows: number }) => {
          if (onResize) {
            onResize(cols, rows);
          }
        };

        term.onData(dataHandler);
        term.onResize(resizeHandler);

        // Write welcome message
        term.writeln('\x1b[1;32mWelcome to Claude Web Terminal\x1b[0m');
        term.writeln('Connecting to server...');
        term.write('$ ');

        // Focus terminal
        term.focus();

        console.log('SafeTerminal initialized successfully');
      } catch (error) {
        console.error('Failed to initialize SafeTerminal:', error);
        isInitialized.current = false;
      }

      // Cleanup
      return () => {
        if (terminalRef.current) {
          try {
            terminalRef.current.dispose();
            terminalRef.current = null;
            isInitialized.current = false;
          } catch (e) {
            console.warn('Error disposing terminal:', e);
          }
        }
      };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      write: (data: string) => {
        if (terminalRef.current) {
          try {
            terminalRef.current.write(data);
          } catch (e) {
            console.error('Error writing to terminal:', e);
          }
        }
      },
      clear: () => {
        if (terminalRef.current) {
          try {
            terminalRef.current.clear();
          } catch (e) {
            console.error('Error clearing terminal:', e);
          }
        }
      },
      focus: () => {
        if (terminalRef.current) {
          try {
            terminalRef.current.focus();
          } catch (e) {
            console.error('Error focusing terminal:', e);
          }
        }
      }
    }), []);

    return (
      <Box
        ref={containerRef}
        sx={{
          width: '100%',
          height: '100%',
          bgcolor: '#1e1e1e',
          overflow: 'hidden',
          position: 'relative',
          '& .xterm': {
            padding: '8px',
            width: '100%',
            height: '100%',
          },
          '& .xterm-viewport': {
            width: '100% !important',
            height: '100% !important',
          },
          '& .xterm-screen': {
            width: '100% !important',
            height: '100% !important',
          },
          '& .xterm-helpers': {
            position: 'absolute',
            top: 0,
            zIndex: 5,
          }
        }}
      />
    );
  }
);

SafeTerminal.displayName = 'SafeTerminal';
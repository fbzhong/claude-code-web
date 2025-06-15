import React, { useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { Box } from '@mui/material';

interface TerminalProps {
  onData: (data: string) => void;
  onResize?: (cols: number, rows: number) => void;
}

export interface TerminalHandle {
  write: (data: string) => void;
  clear: () => void;
  focus: () => void;
}

export const SimpleTerminal = forwardRef<TerminalHandle, TerminalProps>(({ onData, onResize }, ref) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const isInitialized = useRef(false);
  const onDataRef = useRef(onData);
  const onResizeRef = useRef(onResize);

  // Update refs to avoid stale closures
  useEffect(() => {
    onDataRef.current = onData;
  }, [onData]);

  useEffect(() => {
    onResizeRef.current = onResize;
  }, [onResize]);

  // Initialize terminal
  const initTerminal = useCallback(() => {
    if (!terminalRef.current || isInitialized.current) return;

    console.log('Initializing SimpleTerminal...');
    isInitialized.current = true;

    try {
      // Create terminal with fixed size
      const xterm = new XTerm({
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
        convertEol: true,
        scrollback: 1000,
        disableStdin: false,
        cursorBlink: true
      });

      // Store ref
      xtermRef.current = xterm;

      // Open terminal in the container
      xterm.open(terminalRef.current);

      // Set up event handlers
      const dataHandler = (data: string) => {
        onDataRef.current(data);
      };

      const resizeHandler = ({ cols, rows }: { cols: number; rows: number }) => {
        if (onResizeRef.current) {
          onResizeRef.current(cols, rows);
        }
      };

      // Attach event handlers
      xterm.onData(dataHandler);
      xterm.onResize(resizeHandler);

      // Write welcome message
      xterm.writeln('\x1b[1;32mWelcome to Claude Web Terminal\x1b[0m');
      xterm.writeln('\x1b[1;33mConnecting...\x1b[0m');
      xterm.writeln('');

      // Focus terminal after a short delay
      setTimeout(() => {
        try {
          xterm.focus();
        } catch (e) {
          console.warn('Failed to focus terminal:', e);
        }
      }, 200);

      console.log('SimpleTerminal initialized successfully');
    } catch (error) {
      console.error('Failed to initialize terminal:', error);
      isInitialized.current = false;
    }
  }, []);

  useEffect(() => {
    // Initialize terminal when component mounts
    initTerminal();

    // Cleanup
    return () => {
      if (xtermRef.current) {
        try {
          console.log('Disposing SimpleTerminal...');
          xtermRef.current.dispose();
          xtermRef.current = null;
          isInitialized.current = false;
        } catch (e) {
          console.warn('Error disposing terminal:', e);
        }
      }
    };
  }, [initTerminal]);

  // Public methods
  useImperativeHandle(ref, () => ({
    write: (data: string) => {
      if (xtermRef.current) {
        try {
          xtermRef.current.write(data);
        } catch (e) {
          console.error('Error writing to terminal:', e);
        }
      }
    },
    clear: () => {
      if (xtermRef.current) {
        try {
          xtermRef.current.clear();
        } catch (e) {
          console.error('Error clearing terminal:', e);
        }
      }
    },
    focus: () => {
      if (xtermRef.current) {
        try {
          xtermRef.current.focus();
        } catch (e) {
          console.error('Error focusing terminal:', e);
        }
      }
    }
  }), []);

  return (
    <Box
      ref={terminalRef}
      sx={{
        width: '100%',
        height: '100%',
        bgcolor: '#1e1e1e',
        overflow: 'hidden',
        '& .xterm': {
          padding: '8px',
          height: '100%',
        },
        '& .xterm-viewport': {
          backgroundColor: '#1e1e1e',
          overflowY: 'auto',
        },
        '& .xterm-screen': {
          height: '100%',
        },
      }}
    />
  );
});

SimpleTerminal.displayName = 'SimpleTerminal';

// Also export a basic terminal without any addons for maximum compatibility
export const BasicTerminal = forwardRef<TerminalHandle, TerminalProps>(({ onData, onResize }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<XTerm | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Create a very basic terminal
    const term = new XTerm({
      cols: 80,
      rows: 24
    });

    terminalRef.current = term;

    // Open terminal
    term.open(containerRef.current);

    // Set up handlers
    term.onData(onData);
    if (onResize) {
      term.onResize(({ cols, rows }) => onResize(cols, rows));
    }

    // Simple welcome message
    term.write('Terminal ready\r\n$ ');

    return () => {
      term.dispose();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useImperativeHandle(ref, () => ({
    write: (data: string) => terminalRef.current?.write(data),
    clear: () => terminalRef.current?.clear(),
    focus: () => terminalRef.current?.focus()
  }), []);

  return <div ref={containerRef} style={{ width: '100%', height: '100%', backgroundColor: '#000' }} />;
});

BasicTerminal.displayName = 'BasicTerminal';
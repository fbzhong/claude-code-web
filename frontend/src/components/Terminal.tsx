import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { SearchAddon } from 'xterm-addon-search';
import 'xterm/css/xterm.css';
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

export const Terminal = forwardRef<TerminalHandle, TerminalProps>(({ onData, onResize }, ref) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Create terminal instance
    const xterm = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#0a0a0a',
        foreground: '#ffffff',
        cursor: '#ffffff',
        selectionBackground: 'rgba(255, 255, 255, 0.3)',
        black: '#000000',
        red: '#ff5555',
        green: '#50fa7b',
        yellow: '#f1fa8c',
        blue: '#bd93f9',
        magenta: '#ff79c6',
        cyan: '#8be9fd',
        white: '#bbbbbb',
        brightBlack: '#555555',
        brightRed: '#ff5555',
        brightGreen: '#50fa7b',
        brightYellow: '#f1fa8c',
        brightBlue: '#bd93f9',
        brightMagenta: '#ff79c6',
        brightCyan: '#8be9fd',
        brightWhite: '#ffffff',
      },
    });

    // Create addons
    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    const searchAddon = new SearchAddon();

    // Load addons
    xterm.loadAddon(fitAddon);
    xterm.loadAddon(webLinksAddon);
    xterm.loadAddon(searchAddon);

    // Open terminal
    xterm.open(terminalRef.current);
    
    // Store references
    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;
    
    // Fit terminal after a small delay to ensure proper rendering
    setTimeout(() => {
      try {
        fitAddon.fit();
      } catch (e) {
        console.warn('Failed to fit terminal:', e);
      }
    }, 100);

    // Handle data from terminal
    xterm.onData((data) => {
      onData(data);
    });

    // Handle resize
    xterm.onResize(({ cols, rows }) => {
      onResize?.(cols, rows);
    });

    // Handle window resize
    const handleResize = () => {
      if (fitAddonRef.current) {
        try {
          fitAddonRef.current.fit();
        } catch (e) {
          console.warn('Failed to fit terminal on resize:', e);
        }
      }
    };

    window.addEventListener('resize', handleResize);

    // Initial focus
    xterm.focus();

    return () => {
      window.removeEventListener('resize', handleResize);
      xterm.dispose();
    };
  }, [onData, onResize]);

  // Public method to write data to terminal
  const write = (data: string) => {
    xtermRef.current?.write(data);
  };

  // Public method to clear terminal
  const clear = () => {
    xtermRef.current?.clear();
  };

  // Public method to focus terminal
  const focus = () => {
    xtermRef.current?.focus();
  };

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    write,
    clear,
    focus
  }), []);

  return (
    <Box
      ref={terminalRef}
      sx={{
        width: '100%',
        height: '100%',
        bgcolor: '#0a0a0a',
        '& .xterm': {
          padding: '10px',
        },
      }}
    />
  );
});
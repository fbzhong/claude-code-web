import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SearchAddon } from '@xterm/addon-search';
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

export const Terminal = forwardRef<TerminalHandle, TerminalProps>(({ onData, onResize }, ref) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const isInitialized = useRef(false);

  useEffect(() => {
    if (!terminalRef.current || isInitialized.current) return;

    console.log('Initializing terminal...');
    
    // Mark as initialized immediately to prevent double initialization
    isInitialized.current = true;

    // Create terminal instance with conservative settings
    const xterm = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#0a0a0a',
        foreground: '#ffffff',
        cursor: '#ffffff',
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
      // Start with fixed dimensions to avoid fit issues
      cols: 80,
      rows: 24,
    });

    // Store reference before opening
    xtermRef.current = xterm;

    // Open terminal
    xterm.open(terminalRef.current);

    // Create and load addons after terminal is open
    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    const searchAddon = new SearchAddon();

    xterm.loadAddon(fitAddon);
    xterm.loadAddon(webLinksAddon);
    xterm.loadAddon(searchAddon);
    
    fitAddonRef.current = fitAddon;

    // Handle data from terminal
    xterm.onData((data) => {
      onData(data);
    });

    // Handle resize
    xterm.onResize(({ cols, rows }) => {
      onResize?.(cols, rows);
    });

    // Delayed fit to ensure DOM is ready
    const fitTerminal = () => {
      if (!fitAddonRef.current || !xtermRef.current) return;
      
      try {
        // Only fit if container has dimensions
        const container = terminalRef.current;
        if (container && container.offsetWidth > 0 && container.offsetHeight > 0) {
          fitAddonRef.current.fit();
          console.log('Terminal fitted successfully');
        } else {
          console.log('Container not ready, retrying fit...');
          setTimeout(fitTerminal, 100);
        }
      } catch (e) {
        console.warn('Failed to fit terminal:', e);
      }
    };

    // Wait for next tick before fitting
    requestAnimationFrame(() => {
      setTimeout(fitTerminal, 100);
    });

    // Handle window resize with debouncing
    let resizeTimeout: any;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (!fitAddonRef.current || !xtermRef.current) return;
        
        try {
          const container = terminalRef.current;
          if (container && container.offsetWidth > 0 && container.offsetHeight > 0) {
            fitAddonRef.current.fit();
          }
        } catch (e) {
          console.warn('Failed to fit terminal on resize:', e);
        }
      }, 100);
    };

    window.addEventListener('resize', handleResize);

    // Focus terminal when ready
    setTimeout(() => {
      try {
        xterm.focus();
      } catch (e) {
        console.warn('Failed to focus terminal:', e);
      }
    }, 300);

    // Cleanup
    return () => {
      console.log('Cleaning up terminal...');
      clearTimeout(resizeTimeout);
      window.removeEventListener('resize', handleResize);
      
      // Dispose addons first
      try {
        fitAddon.dispose();
        webLinksAddon.dispose();
        searchAddon.dispose();
      } catch (e) {
        console.warn('Error disposing addons:', e);
      }
      
      // Then dispose terminal
      try {
        xterm.dispose();
      } catch (e) {
        console.warn('Error disposing terminal:', e);
      }
      
      isInitialized.current = false;
    };
  }, []); // Empty deps to run only once

  // Public methods
  const write = (data: string) => {
    xtermRef.current?.write(data);
  };

  const clear = () => {
    xtermRef.current?.clear();
  };

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
          height: '100%',
        },
        '& .xterm-viewport': {
          backgroundColor: '#0a0a0a',
        },
      }}
    />
  );
});

Terminal.displayName = 'Terminal';
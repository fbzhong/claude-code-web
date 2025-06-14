import React, { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import 'xterm/css/xterm.css';

interface MinimalTerminalProps {
  onData: (data: string) => void;
  onResize?: (cols: number, rows: number) => void;
}

export const MinimalTerminal: React.FC<MinimalTerminalProps> = ({ onData, onResize }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);

  useEffect(() => {
    // Only initialize if container is ready and terminal not already created
    if (!containerRef.current || terminalRef.current) {
      return;
    }

    console.log('Creating minimal terminal...');

    // Create terminal instance
    const terminal = new Terminal({
      cols: 80,
      rows: 24,
      fontFamily: 'monospace',
      fontSize: 14,
      theme: {
        background: '#000000',
        foreground: '#ffffff'
      }
    });

    // Save reference
    terminalRef.current = terminal;

    // Open terminal in container
    terminal.open(containerRef.current);

    // Write initial message
    terminal.writeln('Terminal initialized');
    terminal.write('$ ');

    // Set up data handler
    const handleData = (data: string) => {
      onData(data);
    };
    terminal.onData(handleData);

    // Set up resize handler
    if (onResize) {
      terminal.onResize(({ cols, rows }) => {
        onResize(cols, rows);
      });
    }

    // Focus terminal
    terminal.focus();

    // Cleanup function
    return () => {
      console.log('Disposing minimal terminal...');
      if (terminalRef.current) {
        terminalRef.current.dispose();
        terminalRef.current = null;
      }
    };
  }, []); // Run only once on mount

  // Helper method to write data to terminal
  useEffect(() => {
    // Expose write method on window for testing
    (window as any).terminalWrite = (data: string) => {
      if (terminalRef.current) {
        terminalRef.current.write(data);
      }
    };
  }, []);

  return (
    <div 
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: '#000000',
        padding: 0,
        margin: 0,
        overflow: 'hidden'
      }}
    />
  );
};

// Create a ref-based version for parent components
export interface MinimalTerminalHandle {
  write: (data: string) => void;
  clear: () => void;
  focus: () => void;
}

export const MinimalTerminalWithRef = React.forwardRef<MinimalTerminalHandle, MinimalTerminalProps>(
  ({ onData, onResize }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const terminalRef = useRef<Terminal | null>(null);

    useEffect(() => {
      if (!containerRef.current || terminalRef.current) {
        return;
      }

      const terminal = new Terminal({
        cols: 80,
        rows: 24,
        fontFamily: 'monospace',
        fontSize: 14,
        theme: {
          background: '#000000',
          foreground: '#ffffff'
        }
      });

      terminalRef.current = terminal;
      terminal.open(containerRef.current);
      terminal.writeln('Terminal ready');
      terminal.write('$ ');

      terminal.onData(onData);
      if (onResize) {
        terminal.onResize(({ cols, rows }) => onResize(cols, rows));
      }

      terminal.focus();

      return () => {
        if (terminalRef.current) {
          terminalRef.current.dispose();
          terminalRef.current = null;
        }
      };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    React.useImperativeHandle(ref, () => ({
      write: (data: string) => {
        if (terminalRef.current) {
          terminalRef.current.write(data);
        }
      },
      clear: () => {
        if (terminalRef.current) {
          terminalRef.current.clear();
        }
      },
      focus: () => {
        if (terminalRef.current) {
          terminalRef.current.focus();
        }
      }
    }), []);

    return (
      <div 
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: '#000000'
        }}
      />
    );
  }
);

MinimalTerminalWithRef.displayName = 'MinimalTerminalWithRef';
import React, { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';

interface BareTerminalProps {
  onData: (data: string) => void;
  onResize?: (cols: number, rows: number) => void;
}

export interface BareTerminalHandle {
  write: (data: string) => void;
  clear: () => void;
  focus: () => void;
}

// Store terminal instances globally to prevent re-initialization
const terminalInstances = new Map<string, Terminal>();

export const BareTerminal = React.forwardRef<BareTerminalHandle, BareTerminalProps>(
  ({ onData, onResize }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const terminalIdRef = useRef<string>(`terminal-${Date.now()}`);
    const mountedRef = useRef(false);

    useEffect(() => {
      if (mountedRef.current) return;
      mountedRef.current = true;

      const terminalId = terminalIdRef.current;
      
      // Wait for next tick to ensure DOM is ready
      const timer = setTimeout(() => {
        if (!containerRef.current) return;

        try {
          // Check if we already have a terminal instance
          let terminal = terminalInstances.get(terminalId);
          
          if (!terminal) {
            // Create new terminal with minimal options
            terminal = new Terminal({
              cols: 80,
              rows: 24,
              fontSize: 14,
              fontFamily: 'monospace',
              theme: {
                background: '#000000',
                foreground: '#ffffff'
              }
            });
            
            terminalInstances.set(terminalId, terminal);
          }

          // Clear the container first
          containerRef.current.innerHTML = '';
          
          // Open terminal
          terminal.open(containerRef.current);
          
          // Write initial text
          terminal.write('Terminal ready\r\n$ ');
          
          // Set up event handlers
          const dataDisposable = terminal.onData((data) => {
            onData(data);
          });
          
          const resizeDisposable = terminal.onResize(({ cols, rows }) => {
            if (onResize) {
              onResize(cols, rows);
            }
          });
          
          // Focus terminal
          terminal.focus();
          
          // Cleanup function
          return () => {
            dataDisposable.dispose();
            resizeDisposable.dispose();
          };
        } catch (error) {
          console.error('Failed to create terminal:', error);
        }
      }, 0);

      return () => {
        clearTimeout(timer);
        // Don't dispose terminal here to avoid re-initialization issues
      };
    }, []); // Empty deps, run only once

    // Expose methods via ref
    React.useImperativeHandle(ref, () => ({
      write: (data: string) => {
        const terminal = terminalInstances.get(terminalIdRef.current);
        if (terminal) {
          try {
            terminal.write(data);
          } catch (e) {
            console.error('Error writing to terminal:', e);
          }
        }
      },
      clear: () => {
        const terminal = terminalInstances.get(terminalIdRef.current);
        if (terminal) {
          try {
            terminal.clear();
          } catch (e) {
            console.error('Error clearing terminal:', e);
          }
        }
      },
      focus: () => {
        const terminal = terminalInstances.get(terminalIdRef.current);
        if (terminal) {
          try {
            terminal.focus();
          } catch (e) {
            console.error('Error focusing terminal:', e);
          }
        }
      }
    }), []);

    // Clean up terminal instance on unmount
    useEffect(() => {
      return () => {
        const terminalId = terminalIdRef.current;
        const terminal = terminalInstances.get(terminalId);
        if (terminal) {
          try {
            terminal.dispose();
            terminalInstances.delete(terminalId);
          } catch (e) {
            console.error('Error disposing terminal:', e);
          }
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
          position: 'relative'
        }}
      />
    );
  }
);

BareTerminal.displayName = 'BareTerminal';
import React, { useRef, useLayoutEffect } from 'react';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { Box } from '@mui/material';

interface FixedTerminalProps {
  onData: (data: string) => void;
  onResize?: (cols: number, rows: number) => void;
}

export interface FixedTerminalHandle {
  write: (data: string) => void;
  clear: () => void;
  focus: () => void;
}

export const FixedTerminal = React.forwardRef<FixedTerminalHandle, FixedTerminalProps>(
  ({ onData, onResize }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const terminalRef = useRef<Terminal | null>(null);
    const isInitializedRef = useRef(false);

    // Use layout effect to ensure DOM measurements are accurate
    useLayoutEffect(() => {
      if (!containerRef.current || isInitializedRef.current) {
        return;
      }

      const container = containerRef.current;
      
      // Force layout calculation
      container.style.width = '100%';
      container.style.height = '100%';
      const forceReflow = container.offsetHeight; // Force reflow
      console.log('Container height:', forceReflow);

      // Create a wrapper div to isolate xterm
      const wrapper = document.createElement('div');
      wrapper.style.width = '100%';
      wrapper.style.height = '100%';
      wrapper.style.position = 'relative';
      wrapper.style.overflow = 'hidden';
      
      container.appendChild(wrapper);

      // Initialize terminal after DOM is ready
      requestAnimationFrame(() => {
        if (isInitializedRef.current) return;
        
        try {
          console.log('Initializing FixedTerminal...');
          isInitializedRef.current = true;

          // Create terminal with specific options to avoid viewport issues
          const term = new Terminal({
            cols: 80,
            rows: 24,
            fontSize: 14,
            fontFamily: 'Menlo, Monaco, "Courier New", monospace',
            theme: {
              background: '#1e1e1e',
              foreground: '#d4d4d4',
              cursor: '#d4d4d4'
            },
            cursorBlink: true,
            scrollback: 1000,
            convertEol: true,
            disableStdin: false,
            // Disable features that might cause viewport issues
            windowsMode: false,
            macOptionIsMeta: true,
            rightClickSelectsWord: false,
            allowTransparency: false,
            drawBoldTextInBrightColors: true
          });

          terminalRef.current = term;

          // Open terminal in wrapper
          term.open(wrapper);

          // Add error boundary for viewport issues
          const termAny = term as any;
          if (termAny._core && termAny._core.viewport) {
            try {
              const originalRefresh = termAny._core.viewport._innerRefresh;
              termAny._core.viewport._innerRefresh = function() {
                try {
                  originalRefresh.call(this);
                } catch (e) {
                  console.warn('Viewport refresh error caught:', e);
                }
              };
            } catch (e) {
              console.warn('Could not patch viewport:', e);
            }
          }

          // Set up event handlers
          const dataDisposable = term.onData((data) => {
            onData(data);
          });

          const resizeDisposable = term.onResize(({ cols, rows }) => {
            if (onResize) {
              onResize(cols, rows);
            }
          });

          // Write welcome message
          term.writeln('\x1b[1;32mWelcome to Claude Web Terminal\x1b[0m');
          term.writeln('Type commands to interact with the shell');
          term.write('$ ');

          // Focus after a delay
          setTimeout(() => {
            try {
              term.focus();
            } catch (e) {
              console.warn('Failed to focus terminal:', e);
            }
          }, 100);

          console.log('FixedTerminal initialized successfully');

          // Cleanup
          return () => {
            dataDisposable.dispose();
            resizeDisposable.dispose();
          };
        } catch (error) {
          console.error('Failed to initialize FixedTerminal:', error);
          isInitializedRef.current = false;
        }
      });

      return () => {
        if (terminalRef.current) {
          try {
            terminalRef.current.dispose();
            terminalRef.current = null;
            isInitializedRef.current = false;
          } catch (e) {
            console.warn('Error disposing terminal:', e);
          }
        }
        // Clean up wrapper
        if (wrapper.parentNode) {
          wrapper.parentNode.removeChild(wrapper);
        }
      };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Expose methods via ref
    React.useImperativeHandle(ref, () => ({
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
          position: 'relative',
          overflow: 'hidden',
          '& .xterm': {
            padding: '8px',
          },
          '& .xterm-viewport': {
            overflow: 'hidden !important',
          },
          '& .xterm-screen': {
            position: 'relative',
          }
        }}
      />
    );
  }
);

FixedTerminal.displayName = 'FixedTerminal';
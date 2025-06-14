import React, { useEffect, useRef, useState } from 'react';
import { Box, CircularProgress } from '@mui/material';

interface IsolatedTerminalProps {
  onData: (data: string) => void;
  onResize?: (cols: number, rows: number) => void;
}

export interface IsolatedTerminalHandle {
  write: (data: string) => void;
  clear: () => void;
  focus: () => void;
}

export const IsolatedTerminal = React.forwardRef<IsolatedTerminalHandle, IsolatedTerminalProps>(
  ({ onData, onResize }, ref) => {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [isLoading, setIsLoading] = useState(true);
    const terminalRef = useRef<any>(null);

    useEffect(() => {
      if (!iframeRef.current) return;

      const setupTerminal = () => {
        const iframeWindow = iframeRef.current!.contentWindow;
        if (!iframeWindow) return;

        // Inject xterm.js and CSS into iframe
        const doc = iframeWindow.document;
        doc.open();
        doc.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { margin: 0; padding: 0; background: #000; overflow: hidden; }
              #terminal { width: 100vw; height: 100vh; }
              .xterm { height: 100%; }
              .xterm-viewport { background-color: transparent !important; }
            </style>
            <link rel="stylesheet" href="https://unpkg.com/xterm@5.3.0/css/xterm.css" />
          </head>
          <body>
            <div id="terminal"></div>
            <script src="https://unpkg.com/xterm@5.3.0/lib/xterm.js"></script>
            <script>
              let term = null;
              
              window.initTerminal = function() {
                try {
                  term = new Terminal({
                    cols: 80,
                    rows: 24,
                    fontSize: 14,
                    fontFamily: 'Menlo, Monaco, monospace',
                    theme: {
                      background: '#1e1e1e',
                      foreground: '#d4d4d4'
                    }
                  });
                  
                  term.open(document.getElementById('terminal'));
                  term.write('\\x1b[32mTerminal Initialized\\x1b[0m\\r\\n$ ');
                  
                  term.onData(function(data) {
                    window.parent.postMessage({ type: 'terminal-data', data: data }, '*');
                  });
                  
                  term.onResize(function(size) {
                    window.parent.postMessage({ type: 'terminal-resize', cols: size.cols, rows: size.rows }, '*');
                  });
                  
                  term.focus();
                  
                  window.terminalWrite = function(data) {
                    if (term) term.write(data);
                  };
                  
                  window.terminalClear = function() {
                    if (term) term.clear();
                  };
                  
                  window.terminalFocus = function() {
                    if (term) term.focus();
                  };
                  
                  window.parent.postMessage({ type: 'terminal-ready' }, '*');
                } catch (e) {
                  console.error('Failed to initialize terminal:', e);
                  window.parent.postMessage({ type: 'terminal-error', error: e.message }, '*');
                }
              };
              
              // Initialize terminal after a short delay
              setTimeout(window.initTerminal, 100);
            </script>
          </body>
          </html>
        `);
        doc.close();
      };

      // Handle messages from iframe
      const handleMessage = (event: MessageEvent) => {
        if (event.source !== iframeRef.current?.contentWindow) return;

        switch (event.data.type) {
          case 'terminal-ready':
            setIsLoading(false);
            terminalRef.current = iframeRef.current?.contentWindow;
            break;
          case 'terminal-data':
            onData(event.data.data);
            break;
          case 'terminal-resize':
            if (onResize) {
              onResize(event.data.cols, event.data.rows);
            }
            break;
          case 'terminal-error':
            console.error('Terminal error:', event.data.error);
            break;
        }
      };

      window.addEventListener('message', handleMessage);

      // Setup terminal after iframe loads
      const iframe = iframeRef.current;
      iframe.onload = setupTerminal;

      // Trigger load if already loaded
      if (iframe.contentDocument?.readyState === 'complete') {
        setupTerminal();
      }

      return () => {
        window.removeEventListener('message', handleMessage);
      };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Expose methods via ref
    React.useImperativeHandle(ref, () => ({
      write: (data: string) => {
        if (terminalRef.current && terminalRef.current.terminalWrite) {
          terminalRef.current.terminalWrite(data);
        }
      },
      clear: () => {
        if (terminalRef.current && terminalRef.current.terminalClear) {
          terminalRef.current.terminalClear();
        }
      },
      focus: () => {
        if (terminalRef.current && terminalRef.current.terminalFocus) {
          terminalRef.current.terminalFocus();
        }
      }
    }), []);

    return (
      <Box sx={{ width: '100%', height: '100%', position: 'relative', bgcolor: '#1e1e1e' }}>
        {isLoading && (
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 10
            }}
          >
            <CircularProgress />
          </Box>
        )}
        <iframe
          ref={iframeRef}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            display: 'block'
          }}
          title="Terminal"
          sandbox="allow-scripts allow-same-origin"
        />
      </Box>
    );
  }
);

IsolatedTerminal.displayName = 'IsolatedTerminal';
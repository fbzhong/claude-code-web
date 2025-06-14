import React, { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { Box } from '@mui/material';

interface StableTerminalProps {
  onData: (data: string) => void;
  onResize?: (cols: number, rows: number) => void;
}

export interface StableTerminalHandle {
  write: (data: string) => void;
  clear: () => void;
  focus: () => void;
}

export const StableTerminal = React.forwardRef<StableTerminalHandle, StableTerminalProps>(
  ({ onData, onResize }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const terminalRef = useRef<Terminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const writeBufferRef = useRef<string[]>([]);
    const writeTimerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
      if (!containerRef.current) return;

      // Detect if mobile device
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      
      // Create terminal instance with stable version
      const term = new Terminal({
        cols: 80,
        rows: 24,
        fontSize: isMobile ? 12 : 14,
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
        cursorBlink: !isMobile, // Disable cursor blink on mobile to reduce redraws
        scrollback: isMobile ? 500 : 1000, // Reduce scrollback on mobile
        convertEol: true,
        // 改善CJK输入法支持
        allowTransparency: false,
        macOptionIsMeta: false,
        rightClickSelectsWord: false,
        // 处理输入法相关设置
        windowsMode: false,
        // Mobile optimizations
        fastScrollModifier: 'shift',
        fastScrollSensitivity: 5,
        rendererType: isMobile ? 'dom' : 'canvas', // Use DOM renderer on mobile for better stability
      });

      terminalRef.current = term;

      // Create and load fit addon
      const fitAddon = new FitAddon();
      fitAddonRef.current = fitAddon;
      term.loadAddon(fitAddon);

      // Open terminal
      term.open(containerRef.current);

      // Initial fit
      setTimeout(() => {
        try {
          fitAddon.fit();
        } catch (e) {
          console.error('Error fitting terminal:', e);
        }
      }, 0);

      // Set up event handlers with input filtering
      let isComposing = false;
      let lastInputData = '';
      let lastInputTime = 0;
      
      // 处理输入法组合事件
      const container = containerRef.current;
      container.addEventListener('compositionstart', () => {
        isComposing = true;
      });
      
      container.addEventListener('compositionend', () => {
        isComposing = false;
      });
      
      term.onData((data) => {
        const now = Date.now();
        
        // 防止重复输入 - 检查相同数据在短时间内的重复
        if (data === lastInputData && now - lastInputTime < 100) {
          console.log('Duplicate input detected, ignoring:', data);
          return;
        }
        
        lastInputData = data;
        lastInputTime = now;
        
        // 如果正在输入法组合中，延迟发送
        if (isComposing) {
          setTimeout(() => {
            if (!isComposing) {
              onData(data);
            }
          }, 100);
        } else {
          onData(data);
        }
      });

      if (onResize) {
        term.onResize(({ cols, rows }) => {
          onResize(cols, rows);
        });
      }

      // Don't write welcome message - let the server send initial content

      // Focus terminal
      term.focus();

      // Set up resize observer with debouncing
      let resizeTimeout: NodeJS.Timeout;
      let lastWidth = 0;
      let lastHeight = 0;
      
      const resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) return;
        
        const { width, height } = entry.contentRect;
        
        // Skip resize if dimensions haven't changed significantly (avoid micro-resizes on mobile)
        if (Math.abs(width - lastWidth) < 5 && Math.abs(height - lastHeight) < 5) {
          return;
        }
        
        lastWidth = width;
        lastHeight = height;
        
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
          if (fitAddonRef.current && terminalRef.current) {
            try {
              // On mobile, be more conservative with fitting
              if (isMobile) {
                // Check if terminal is visible before fitting
                const rect = containerRef.current?.getBoundingClientRect();
                if (rect && rect.width > 0 && rect.height > 0) {
                  fitAddonRef.current.fit();
                  console.log('Terminal resized to:', terminalRef.current.cols, 'x', terminalRef.current.rows);
                }
              } else {
                fitAddonRef.current.fit();
                console.log('Terminal resized to:', terminalRef.current.cols, 'x', terminalRef.current.rows);
              }
            } catch (e) {
              console.error('Error fitting terminal on resize:', e);
            }
          }
        }, isMobile ? 300 : 100); // Longer debounce on mobile
      });

      resizeObserver.observe(containerRef.current);

      console.log('StableTerminal initialized with xterm v4.19.0');

      // Cleanup
      return () => {
        // Clear any pending timers
        if (resizeTimeout) clearTimeout(resizeTimeout);
        if (writeTimerRef.current) clearTimeout(writeTimerRef.current);
        
        resizeObserver.disconnect();
        if (fitAddonRef.current) {
          fitAddonRef.current.dispose();
          fitAddonRef.current = null;
        }
        if (terminalRef.current) {
          terminalRef.current.dispose();
          terminalRef.current = null;
        }
      };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    
    const flushWriteBuffer = () => {
      if (writeBufferRef.current.length > 0 && terminalRef.current) {
        const data = writeBufferRef.current.join('');
        writeBufferRef.current = [];
        try {
          terminalRef.current.write(data);
        } catch (e) {
          console.error('Error writing buffered data to terminal:', e);
        }
      }
    };
    
    // Expose methods via ref
    React.useImperativeHandle(ref, () => ({
      write: (data: string) => {
        if (terminalRef.current) {
          try {
            // Detect if mobile device
            const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
            
            if (isMobile) {
              // Buffer writes on mobile to reduce redraws
              writeBufferRef.current.push(data);
              
              // Clear existing timer
              if (writeTimerRef.current) {
                clearTimeout(writeTimerRef.current);
              }
              
              // Detect if this is a cursor positioning sequence (common in progress bars)
              // eslint-disable-next-line no-control-regex
              const hasCursorPositioning = /\x1b\[\d*[ABCDGJK]|\x1b\[\d*;\d*[Hf]|\r/.test(data);
              
              // Flush immediately for cursor positioning, otherwise batch
              if (hasCursorPositioning) {
                flushWriteBuffer();
              } else {
                writeTimerRef.current = setTimeout(flushWriteBuffer, 50);
              }
            } else {
              // Direct write on desktop
              terminalRef.current.write(data);
            }
          } catch (e) {
            console.error('Error writing to terminal:', e);
          }
        }
      },
      clear: () => {
        if (terminalRef.current) {
          try {
            // Clear both buffer and screen for complete reset
            terminalRef.current.clear();
            terminalRef.current.reset();
            // Write a clean prompt to indicate the terminal is ready
            terminalRef.current.write('\x1b[2J\x1b[H'); // Clear screen and move cursor to top
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
            width: '100%',
            height: '100%',
            boxSizing: 'border-box',
          },
          '& .xterm-viewport': {
            width: '100% !important',
            overflow: 'hidden !important',
          },
          '& .xterm-screen': {
            width: '100% !important',
          }
        }}
      />
    );
  }
);

StableTerminal.displayName = 'StableTerminal';
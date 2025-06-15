import React, { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { Box } from '@mui/material';
import { useMobileTerminalEnhancements } from '../hooks/useMobileTerminalEnhancements';

interface StableTerminalProps {
  onData: (data: string) => void;
  onResize?: (cols: number, rows: number) => void;
}

export interface StableTerminalHandle {
  write: (data: string) => void;
  clear: () => void;
  focus: () => void;
  scrollToBottom: () => void;
  scrollToCursor: () => void;
}

export const StableTerminal = React.forwardRef<StableTerminalHandle, StableTerminalProps>(
  ({ onData, onResize }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const terminalRef = useRef<Terminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const writeBufferRef = useRef<string[]>([]);
    const writeTimerRef = useRef<NodeJS.Timeout | null>(null);
    
    // Use mobile enhancements
    const mobileEnhancements = useMobileTerminalEnhancements({
      terminal: terminalRef.current,
    });

    useEffect(() => {
      if (!containerRef.current) return;

      // Detect if mobile device
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      
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
      let sentDataInComposition = new Set<string>();
      
      // 处理输入法组合事件
      const container = containerRef.current;
      
      // iOS 特殊处理 - 使用更激进的策略
      if (isIOS) {
        let recentlySentData = new Map<string, number>();
        let compositionFinalData = '';
        
        // 清理过期的发送记录
        const cleanupRecentlySent = () => {
          const now = Date.now();
          for (const [data, time] of recentlySentData.entries()) {
            if (now - time > 300) { // 300ms 后清理
              recentlySentData.delete(data);
            }
          }
        };
        
        // 检查是否最近发送过
        const wasRecentlySent = (data: string): boolean => {
          cleanupRecentlySent();
          return recentlySentData.has(data);
        };
        
        // 记录发送的数据
        const recordSent = (data: string) => {
          recentlySentData.set(data, Date.now());
        };
        
        container.addEventListener('compositionstart', () => {
          console.log('[iOS IME] Composition start');
          isComposing = true;
          compositionFinalData = '';
        });
        
        container.addEventListener('compositionupdate', (e) => {
          console.log('[iOS IME] Composition update:', e.data);
        });
        
        container.addEventListener('compositionend', (e) => {
          console.log('[iOS IME] Composition end:', e.data);
          compositionFinalData = e.data || '';
          
          // 快速重置状态
          setTimeout(() => {
            isComposing = false;
            
            // 发送组合的最终数据（如果还没发送）
            if (compositionFinalData && !wasRecentlySent(compositionFinalData)) {
              // 只发送包含非 ASCII 字符的文本
              const hasNonASCII = [...compositionFinalData].some(char => char.charCodeAt(0) >= 128);
              if (hasNonASCII) {
                console.log('[iOS IME] Sending final composition data:', compositionFinalData);
                onData(compositionFinalData);
                recordSent(compositionFinalData);
              }
            }
            
            compositionFinalData = '';
          }, 10);
        });
        
        // iOS 上的 onData 处理 - 更简单的策略
        term.onData((data) => {
          console.log('[iOS Terminal] onData:', {
            data,
            isComposing,
            charCode: data.charCodeAt(0),
            hex: '0x' + data.charCodeAt(0).toString(16),
            length: data.length
          });
          
          // 避免短时间内重复发送相同数据
          if (wasRecentlySent(data)) {
            console.log('[iOS Terminal] Skipping recently sent data:', data);
            return;
          }
          
          // 记录已发送
          recordSent(data);
          
          // 直接发送所有数据
          console.log('[iOS Terminal] Sending data:', data);
          onData(data);
        });
        
        
      } else {
        // 非 iOS 设备的标准处理
        container.addEventListener('compositionstart', () => {
          isComposing = true;
        });
        
        container.addEventListener('compositionend', (e) => {
          isComposing = false;
          if (e.data) {
            onData(e.data);
          }
        });
        
        term.onData((data) => {
          if (!isComposing) {
            onData(data);
          }
        });
      }

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
        let data = writeBufferRef.current.join('');
        writeBufferRef.current = [];
        
        // On mobile, simplify redundant ANSI sequences
        if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
          // Remove redundant cursor movements
          data = data.replace(/(\x1b\[\d*[CD])+/g, (match) => {
            // Combine multiple right/left movements
            const total = match.match(/\x1b\[\d*[CD]/g)?.reduce((sum, seq) => {
              const num = parseInt(seq.match(/\d+/)?.[0] || '1');
              return seq.includes('C') ? sum + num : sum - num;
            }, 0) || 0;
            
            if (total > 0) return `\x1b[${total}C`;
            if (total < 0) return `\x1b[${-total}D`;
            return '';
          });
          
          // Simplify color codes - remove redundant resets
          data = data.replace(/(\x1b\[0m\x1b\[\d+m)+/g, (match) => {
            const lastColor = match.match(/\x1b\[\d+m$/)?.[0];
            return lastColor || match;
          });
        }
        
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
              
              // More comprehensive ANSI sequence detection
              // eslint-disable-next-line no-control-regex
              const ansiPatterns = {
                cursorPositioning: /\x1b\[\d*[ABCDGJK]|\x1b\[\d*;\d*[Hf]|\r/,
                clearLine: /\x1b\[2K|\x1b\[K/,
                colorCodes: /\x1b\[\d+(;\d+)*m/,
                saveRestoreCursor: /\x1b\[s|\x1b\[u/,
                scrollRegion: /\x1b\[\d*;\d*r/,
              };
              
              // Check if this requires immediate flush
              const requiresImmediateFlush = 
                ansiPatterns.cursorPositioning.test(data) ||
                ansiPatterns.clearLine.test(data) ||
                ansiPatterns.saveRestoreCursor.test(data) ||
                ansiPatterns.scrollRegion.test(data);
              
              // Flush immediately for critical sequences, otherwise batch
              if (requiresImmediateFlush) {
                flushWriteBuffer();
              } else {
                // Use longer buffer time for color codes only
                const bufferTime = ansiPatterns.colorCodes.test(data) ? 100 : 50;
                writeTimerRef.current = setTimeout(flushWriteBuffer, bufferTime);
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
      },
      scrollToBottom: () => {
        if (terminalRef.current) {
          try {
            console.log('Scrolling to bottom...');
            // First try xterm's scrollToBottom
            terminalRef.current.scrollToBottom();
            
            // Also scroll the viewport element directly
            const viewport = containerRef.current?.querySelector('.xterm-viewport');
            if (viewport) {
              console.log('Viewport scroll before:', viewport.scrollTop, 'height:', viewport.scrollHeight);
              viewport.scrollTop = viewport.scrollHeight;
              console.log('Viewport scroll after:', viewport.scrollTop);
            }
          } catch (e) {
            console.error('Error scrolling to bottom:', e);
          }
        }
      },
      scrollToCursor: () => {
        if (terminalRef.current) {
          try {
            console.log('Scrolling to cursor...');
            const term = terminalRef.current;
            const viewport = containerRef.current?.querySelector('.xterm-viewport');
            
            if (viewport && term.buffer && term.buffer.active) {
              // 获取当前光标位置
              const cursorY = term.buffer.active.cursorY;
              const baseY = term.buffer.active.baseY;
              const actualY = baseY + cursorY;
              
              // 计算需要滚动的位置
              const viewportHeight = viewport.clientHeight;
              const lineHeight = Math.floor(viewportHeight / term.rows);
              const targetScrollTop = Math.max(0, (actualY - Math.floor(term.rows / 2)) * lineHeight);
              
              console.log('Cursor position:', { cursorY, baseY, actualY, targetScrollTop });
              
              // 平滑滚动到光标位置
              viewport.scrollTo({
                top: targetScrollTop,
                behavior: 'smooth'
              });
            }
          } catch (e) {
            console.error('Error scrolling to cursor:', e);
            // 降级到滚动到底部
            if (terminalRef.current) {
              terminalRef.current.scrollToBottom();
            }
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
            // Allow scrolling in viewport
            overflow: 'auto !important',
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
import React, { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { CanvasAddon } from "@xterm/addon-canvas";
import "@xterm/xterm/css/xterm.css";
import { Box } from "@mui/material";
import { useMobileTerminalEnhancements } from "../hooks/useMobileTerminalEnhancements";
import { ansiOptimizer } from "../utils/ansiOptimizer";

interface StableTerminalProps {
  onData: (data: string) => void;
  onResize?: (cols: number, rows: number) => void;
  onTerminalReady?: () => void;
}

export interface StableTerminalHandle {
  write: (data: string) => void;
  clear: () => void;
  focus: () => void;
  scrollToBottom: () => void;
  scrollToCursor: () => void;
}

export const StableTerminal = React.forwardRef<
  StableTerminalHandle,
  StableTerminalProps
>(({ onData, onResize, onTerminalReady }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  // Store current onData callback in a ref that updates on each render
  const onDataRef = useRef(onData);
  onDataRef.current = onData;
  const writeBufferRef = useRef<string[]>([]);
  const writeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isDisposedRef = useRef<boolean>(false);
  const animationFrameRef = useRef<number | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  // Use mobile enhancements
  const mobileEnhancements = useMobileTerminalEnhancements({
    terminal: terminalRef.current,
  });

  // Helper function to check if container has valid dimensions
  const hasValidDimensions = () => {
    if (!containerRef.current) return false;
    const rect = containerRef.current.getBoundingClientRect();
    return (
      rect.width > 0 && rect.height > 0 && containerRef.current.isConnected
    );
  };

  // Helper function to check if terminal is alive and not disposed
  const isTerminalAlive = () => {
    return (
      !isDisposedRef.current &&
      terminalRef.current &&
      !(terminalRef.current as any)._core?._isDisposed
    );
  };

  // Safe fit function that checks all conditions
  const safeFit = () => {
    if (!isTerminalAlive() || !fitAddonRef.current || !hasValidDimensions()) {
      return false;
    }
    try {
      fitAddonRef.current.fit();
      return true;
    } catch (e) {
      console.error("Error fitting terminal:", e);
      return false;
    }
  };

  // Initialize terminal when container has dimensions
  const initializeTerminal = () => {
    if (
      !containerRef.current ||
      !hasValidDimensions() ||
      isDisposedRef.current
    ) {
      return false;
    }

    // Detect if mobile device
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    // Create terminal instance with optimized settings for platform
    const term = new Terminal({
      cols: 80,
      rows: 24,
      fontSize: isMobile ? 12 : 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: "#1e1e1e",
        foreground: "#d4d4d4",
        cursor: "#d4d4d4",
        black: "#000000",
        red: "#cd3131",
        green: "#0dbc79",
        yellow: "#e5e510",
        blue: "#2472c8",
        magenta: "#bc3fbc",
        cyan: "#11a8cd",
        white: "#e5e5e5",
        brightBlack: "#666666",
        brightRed: "#f14c4c",
        brightGreen: "#23d18b",
        brightYellow: "#f5f543",
        brightBlue: "#3b8eea",
        brightMagenta: "#d670d6",
        brightCyan: "#29b8db",
        brightWhite: "#e5e5e5",
      },
      cursorBlink: !isMobile, // Disable cursor blink on mobile to reduce redraws
      scrollback: isMobile ? 500 : 1000, // Further reduce scrollback on mobile for memory
      convertEol: true,
      // 改善CJK输入法支持
      allowTransparency: false,
      macOptionIsMeta: false,
      rightClickSelectsWord: false,
      // 处理输入法相关设置
      windowsMode: false,
      // iOS/Mobile optimizations
      fastScrollModifier: "shift",
      fastScrollSensitivity: isMobile ? 3 : 5, // Slower scrolling on mobile
      // Disable features that cause performance issues on mobile
      logLevel: isMobile ? "warn" : "info", // Reduce logging on mobile
      // GPU acceleration hints
      disableStdin: false,
      smoothScrollDuration: 80,
    });

    terminalRef.current = term;

    // Create and load fit addon
    const fitAddon = new FitAddon();
    fitAddonRef.current = fitAddon;
    term.loadAddon(fitAddon);

    // Load high-performance renderer based on device and capabilities
    try {
      if (isMobile) {
        // For mobile devices (especially iOS), try WebGL first, fallback to Canvas
        try {
          const webglAddon = new WebglAddon();
          term.loadAddon(webglAddon);
          console.log(
            "✅ Loaded WebGL renderer for mobile - should have best performance"
          );
        } catch (webglError) {
          console.warn(
            "WebGL not supported, falling back to Canvas:",
            webglError
          );
          try {
            const canvasAddon = new CanvasAddon();
            term.loadAddon(canvasAddon);
            console.log(
              "⚠️ Loaded Canvas renderer for mobile - good performance"
            );
          } catch (canvasError) {
            console.error(
              "❌ Canvas renderer also failed, using DOM renderer (slower):",
              canvasError
            );
          }
        }
      } else {
        // For desktop, WebGL is usually well supported
        try {
          const webglAddon = new WebglAddon();
          term.loadAddon(webglAddon);
          console.log("Loaded WebGL renderer for desktop");
        } catch (webglError) {
          console.warn(
            "WebGL not supported on desktop, falling back to Canvas:",
            webglError
          );
          try {
            const canvasAddon = new CanvasAddon();
            term.loadAddon(canvasAddon);
            console.log("Loaded Canvas renderer for desktop");
          } catch (canvasError) {
            console.warn(
              "Canvas renderer failed, using DOM renderer:",
              canvasError
            );
          }
        }
      }
    } catch (rendererError) {
      console.warn(
        "All hardware-accelerated renderers failed, using DOM:",
        rendererError
      );
    }

    try {
      // Open terminal
      term.open(containerRef.current);

      // Fit in next frame after open() completes
      requestAnimationFrame(() => {
        if (isTerminalAlive() && hasValidDimensions()) {
          safeFit();
        }
      });

      return true;
    } catch (e) {
      console.error("Error opening terminal:", e);
      return false;
    }
  };

  useEffect(() => {
    if (!containerRef.current) return;

    isDisposedRef.current = false;
    let waitForDimensions: ResizeObserver | null = null;
    let initTimer: NodeJS.Timeout | null = null;

    const delayedInitialize = () => {
      initTimer = setTimeout(() => {
        if (isDisposedRef.current || terminalRef.current) return;

        if (hasValidDimensions()) {
          const success = initializeTerminal();
          if (success && terminalRef.current) {
            setupTerminalEvents();
            setupResizeObserver();
            // 通知终端已准备好
            onTerminalReady?.();
          }
        } else {
          // Still no dimensions after delay, use ResizeObserver
          waitForDimensions = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (
              entry &&
              entry.contentRect.width > 0 &&
              entry.contentRect.height > 0
            ) {
              waitForDimensions?.disconnect();
              if (!isDisposedRef.current && !terminalRef.current) {
                const success = initializeTerminal();
                if (success && terminalRef.current) {
                  setupTerminalEvents();
                  setupResizeObserver();
                  // 通知终端已准备好
                  onTerminalReady?.();
                }
              }
            }
          });

          if (containerRef.current) {
            waitForDimensions.observe(containerRef.current);
          }
        }
      }, 500); // 100ms延迟避免 xterm.js syncScrollArea → this._renderService.dimensions 错误
    };

    // 启动延迟初始化
    delayedInitialize();

    // Cleanup function for the useEffect
    return () => {
      // Mark as disposed first to prevent any further operations
      isDisposedRef.current = true;

      // Clear initialization timer
      if (initTimer) {
        clearTimeout(initTimer);
        initTimer = null;
      }

      // Disconnect dimension watcher if it exists
      if (waitForDimensions) {
        waitForDimensions.disconnect();
      }

      // Cancel any pending animation frames
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      // Clear any pending timers
      if (writeTimerRef.current) {
        clearTimeout(writeTimerRef.current);
        writeTimerRef.current = null;
      }

      // Disconnect ResizeObserver
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }

      // Cancel any viewport refresh animation frame before disposing
      if (
        terminalRef.current &&
        (terminalRef.current as any)._core?.viewport?._refreshAnimationFrame
      ) {
        cancelAnimationFrame(
          (terminalRef.current as any)._core.viewport._refreshAnimationFrame
        );
      }

      // Dispose addons first
      if (fitAddonRef.current) {
        try {
          fitAddonRef.current.dispose();
        } catch (e) {
          console.warn("Error disposing fit addon:", e);
        }
        fitAddonRef.current = null;
      }

      // Dispose terminal last
      if (terminalRef.current) {
        try {
          terminalRef.current.dispose();
        } catch (e) {
          console.warn("Error disposing terminal:", e);
        }
        terminalRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Setup terminal event handlers
  const setupTerminalEvents = () => {
    const term = terminalRef.current;
    if (!term) return;

    // Detect if mobile device
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    // Simple IME handling - let xterm.js 5.5.0 handle it natively
    // Based on ttyd's approach: minimal interference with xterm.js's built-in IME support
    term.onData((data) => {
      // xterm.js 5.5.0 has improved IME handling
      // Just pass through all data without custom filtering
      // Use ref to always call the latest onData callback
      onDataRef.current(data);
    });

    if (onResize) {
      term.onResize(({ cols, rows }) => {
        onResize(cols, rows);
      });
    }

    // Don't write welcome message - let the server send initial content

    // Focus terminal
    term.focus();
  };

  // Setup ResizeObserver with proper safeguards
  const setupResizeObserver = () => {
    if (!containerRef.current || isDisposedRef.current) return;

    // Detect if mobile device
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    // Set up resize observer with debouncing
    let resizeTimeout: NodeJS.Timeout;
    let lastWidth = 0;
    let lastHeight = 0;

    const resizeObserver = new ResizeObserver((entries) => {
      // Check if component is disposed before processing
      if (isDisposedRef.current || !isTerminalAlive()) {
        return;
      }

      const entry = entries[0];
      if (!entry) return;

      const { width, height } = entry.contentRect;

      // Skip resize if dimensions haven't changed significantly (avoid micro-resizes on mobile)
      if (
        Math.abs(width - lastWidth) < 5 &&
        Math.abs(height - lastHeight) < 5
      ) {
        return;
      }

      lastWidth = width;
      lastHeight = height;

      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(
        () => {
          // Double-check disposal state
          if (isDisposedRef.current || !isTerminalAlive()) {
            return;
          }

          if (isMobile) {
            // Check if terminal is visible before fitting
            if (hasValidDimensions()) {
              const success = safeFit();
              if (
                success &&
                terminalRef.current?.cols &&
                terminalRef.current?.rows
              ) {
                console.log(
                  "Terminal resized to:",
                  terminalRef.current.cols,
                  "x",
                  terminalRef.current.rows
                );
              }
            }
          } else {
            const success = safeFit();
            if (
              success &&
              terminalRef.current?.cols &&
              terminalRef.current?.rows
            ) {
              console.log(
                "Terminal resized to:",
                terminalRef.current.cols,
                "x",
                terminalRef.current.rows
              );
            }
          }
        },
        isMobile ? 300 : 100
      ); // Longer debounce on mobile
    });

    resizeObserverRef.current = resizeObserver;
    resizeObserver.observe(containerRef.current);

    console.log("StableTerminal initialized with xterm v5.5.0");
  };

  const flushWriteBuffer = () => {
    if (writeBufferRef.current.length > 0 && terminalRef.current) {
      let data = writeBufferRef.current.join("");
      writeBufferRef.current = [];

      // On mobile, use advanced ANSI sequence optimization
      if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
        try {
          data = ansiOptimizer.optimize(data);
        } catch (e) {
          console.warn("ANSI optimization failed, using original data:", e);
        }
      }

      try {
        terminalRef.current.write(data);
      } catch (e) {
        console.error("Error writing buffered data to terminal:", e);
      }
    }
  };

  // Expose methods via ref
  React.useImperativeHandle(
    ref,
    () => ({
      write: (data: string) => {
        if (isTerminalAlive()) {
          try {
            // Detect if mobile device
            const isMobile = /iPhone|iPad|iPod|Android/i.test(
              navigator.userAgent
            );

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
                diffPattern: /^[\+\-]|\x1b\[3[12]m/, // Detect diff output
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
                // Detect if this is diff output
                const isDiff = ansiPatterns.diffPattern.test(data);

                // Use adaptive buffer time based on content type
                let bufferTime = 50; // Default

                if (isDiff) {
                  // For diff output, use longer buffer to batch color changes
                  bufferTime = 150;

                  // If buffer is getting large (many diff lines), flush sooner
                  if (writeBufferRef.current.length > 20) {
                    bufferTime = 20;
                  }
                } else if (ansiPatterns.colorCodes.test(data)) {
                  // Regular color codes
                  bufferTime = 100;
                }

                writeTimerRef.current = setTimeout(
                  flushWriteBuffer,
                  bufferTime
                );
              }
            } else {
              // Direct write on desktop
              terminalRef.current!.write(data);
            }
          } catch (e) {
            console.error("Error writing to terminal:", e);
          }
        }
      },
      clear: () => {
        if (isTerminalAlive()) {
          try {
            // Clear both buffer and screen for complete reset
            terminalRef.current!.clear();
            terminalRef.current!.reset();
            // Write a clean prompt to indicate the terminal is ready
            terminalRef.current!.write("\x1b[2J\x1b[H"); // Clear screen and move cursor to top
          } catch (e) {
            console.error("Error clearing terminal:", e);
          }
        }
      },
      focus: () => {
        if (isTerminalAlive()) {
          try {
            terminalRef.current!.focus();
          } catch (e) {
            console.error("Error focusing terminal:", e);
          }
        }
      },
      scrollToBottom: () => {
        if (isTerminalAlive()) {
          try {
            console.log("Scrolling to bottom...");
            // First try xterm's scrollToBottom
            terminalRef.current!.scrollToBottom();

            // Also scroll the viewport element directly
            const viewport =
              containerRef.current?.querySelector(".xterm-viewport");
            if (viewport) {
              console.log(
                "Viewport scroll before:",
                viewport.scrollTop,
                "height:",
                viewport.scrollHeight
              );
              viewport.scrollTop = viewport.scrollHeight;
              console.log("Viewport scroll after:", viewport.scrollTop);
            }
          } catch (e) {
            console.error("Error scrolling to bottom:", e);
          }
        }
      },
      scrollToCursor: () => {
        if (isTerminalAlive()) {
          try {
            console.log("Scrolling to cursor...");
            const term = terminalRef.current!;
            const viewport =
              containerRef.current?.querySelector(".xterm-viewport");

            if (viewport && term.buffer && term.buffer.active) {
              // 获取当前光标位置
              const cursorY = term.buffer.active.cursorY;
              const baseY = term.buffer.active.baseY;
              const actualY = baseY + cursorY;

              // 计算需要滚动的位置
              const viewportHeight = viewport.clientHeight;
              const lineHeight = Math.floor(viewportHeight / term.rows);
              const targetScrollTop = Math.max(
                0,
                (actualY - Math.floor(term.rows / 2)) * lineHeight
              );

              console.log("Cursor position:", {
                cursorY,
                baseY,
                actualY,
                targetScrollTop,
              });

              // 平滑滚动到光标位置
              viewport.scrollTo({
                top: targetScrollTop,
                behavior: "smooth",
              });
            }
          } catch (e) {
            console.error("Error scrolling to cursor:", e);
            // 降级到滚动到底部
            if (isTerminalAlive()) {
              terminalRef.current!.scrollToBottom();
            }
          }
        }
      },
    }),
    []
  );

  return (
    <Box
      ref={containerRef}
      sx={{
        width: "100%",
        height: "100%",
        bgcolor: "#1e1e1e",
        position: "relative",
        overflow: "hidden",
        "& .xterm": {
          padding: "8px",
          width: "100%",
          height: "100%",
          boxSizing: "border-box",
        },
        "& .xterm-viewport": {
          width: "100% !important",
          // Enable smooth scrolling on iOS
          overflow: "auto !important",
          WebkitOverflowScrolling: "touch", // iOS momentum scrolling
          // Don't use overscrollBehavior: "contain" as it can cause issues with keyboard
          // Force GPU acceleration
          transform: "translateZ(0)",
          willChange: "scroll-position",
        },
        "& .xterm-screen": {
          width: "100% !important",
        },
      }}
    />
  );
});

StableTerminal.displayName = "StableTerminal";

import { useEffect, useRef, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';

interface MobileTerminalEnhancementsOptions {
  terminal: Terminal | null;
  onSpecialKey?: (key: string) => void;
  enableGestures?: boolean; // Make gestures optional, default false
}

export const useMobileTerminalEnhancements = ({ 
  terminal, 
  onSpecialKey,
  enableGestures = false // Disable gestures by default to improve scrolling
}: MobileTerminalEnhancementsOptions) => {
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const swipeThreshold = 50; // Increased threshold to reduce false positives
  
  // Handle swipe gestures for navigation
  const handleTouchStart = useCallback((e: TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };
  }, []);
  
  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (!touchStartRef.current || !terminal) return;
    
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    const deltaTime = Date.now() - touchStartRef.current.time;
    
    // Only handle gestures if they are fast swipes (under 300ms)
    // This prevents interfering with normal scrolling
    if (deltaTime < 300) {
      // Horizontal swipe - only if it's a clear horizontal gesture
      if (Math.abs(deltaX) > swipeThreshold * 2 && Math.abs(deltaX) > Math.abs(deltaY) * 2) {
        if (deltaX > 0) {
          // Swipe right - forward in history
          terminal.write('\x1B[A'); // Up arrow for history
        } else {
          // Swipe left - backward in history
          terminal.write('\x1B[B'); // Down arrow for history
        }
        // Note: Can't preventDefault with passive listeners
      }
      // Vertical swipe - disabled by default to not interfere with scrolling
      // Users should use the keyboard toolbar for page up/down
    }
    
    touchStartRef.current = null;
  }, [terminal]);
  
  // Double tap for Tab completion
  const lastTapRef = useRef<number>(0);
  const handleDoubleTap = useCallback((e: TouchEvent) => {
    const now = Date.now();
    const timeSinceLastTap = now - lastTapRef.current;
    
    if (timeSinceLastTap < 300 && timeSinceLastTap > 0) {
      // Double tap detected - send Tab
      if (terminal) {
        terminal.write('\t');
        e.preventDefault();
      }
    }
    
    lastTapRef.current = now;
  }, [terminal]);
  
  // Long press for ESC
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const handleLongPressStart = useCallback((e: TouchEvent) => {
    longPressTimerRef.current = setTimeout(() => {
      if (terminal) {
        terminal.write('\x1B'); // ESC
        // Haptic feedback if available
        if ('vibrate' in navigator) {
          navigator.vibrate(50);
        }
      }
    }, 500); // 500ms for long press
  }, [terminal]);
  
  const handleLongPressEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);
  
  // Setup event listeners
  useEffect(() => {
    if (!terminal || !enableGestures) return;
    
    const element = terminal.element;
    if (!element) return;
    
    // Add touch event listeners with passive for better scrolling
    // Only prevent default when actually handling gestures
    const touchStartHandler = (e: TouchEvent) => {
      handleTouchStart(e);
      handleLongPressStart(e);
    };
    
    const touchEndHandler = (e: TouchEvent) => {
      handleTouchEnd(e);
      handleLongPressEnd();
      handleDoubleTap(e);
    };
    
    element.addEventListener('touchstart', touchStartHandler, { passive: true });
    element.addEventListener('touchend', touchEndHandler, { passive: true });
    element.addEventListener('touchcancel', handleLongPressEnd, { passive: true });
    
    return () => {
      element.removeEventListener('touchstart', touchStartHandler);
      element.removeEventListener('touchend', touchEndHandler);
      element.removeEventListener('touchcancel', handleLongPressEnd);
    };
  }, [terminal, enableGestures, handleTouchStart, handleTouchEnd, handleLongPressStart, handleLongPressEnd, handleDoubleTap]);
  
  // Return useful methods
  return {
    simulateTab: () => terminal?.write('\t'),
    simulateEsc: () => terminal?.write('\x1B'),
    simulateCtrlC: () => terminal?.write('\x03'),
  };
};
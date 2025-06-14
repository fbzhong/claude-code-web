import { useEffect, useRef, useCallback } from 'react';
import { Terminal } from 'xterm';

interface MobileTerminalEnhancementsOptions {
  terminal: Terminal | null;
  onSpecialKey?: (key: string) => void;
}

export const useMobileTerminalEnhancements = ({ 
  terminal, 
  onSpecialKey 
}: MobileTerminalEnhancementsOptions) => {
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const swipeThreshold = 50;
  
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
    
    // Quick swipe detection (under 300ms)
    if (deltaTime < 300) {
      // Horizontal swipe
      if (Math.abs(deltaX) > swipeThreshold && Math.abs(deltaX) > Math.abs(deltaY)) {
        if (deltaX > 0) {
          // Swipe right - forward in history
          terminal.write('\x1B[A'); // Up arrow for history
        } else {
          // Swipe left - backward in history
          terminal.write('\x1B[B'); // Down arrow for history
        }
        e.preventDefault();
      }
      // Vertical swipe
      else if (Math.abs(deltaY) > swipeThreshold) {
        if (deltaY > 0) {
          // Swipe down - Page Down
          terminal.write('\x1B[6~');
        } else {
          // Swipe up - Page Up
          terminal.write('\x1B[5~');
        }
        e.preventDefault();
      }
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
    if (!terminal) return;
    
    const element = terminal.element;
    if (!element) return;
    
    // Add touch event listeners
    element.addEventListener('touchstart', handleTouchStart, { passive: false });
    element.addEventListener('touchend', handleTouchEnd, { passive: false });
    element.addEventListener('touchstart', handleLongPressStart, { passive: false });
    element.addEventListener('touchend', handleLongPressEnd, { passive: false });
    element.addEventListener('touchcancel', handleLongPressEnd, { passive: false });
    element.addEventListener('touchend', handleDoubleTap, { passive: false });
    
    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchend', handleTouchEnd);
      element.removeEventListener('touchstart', handleLongPressStart);
      element.removeEventListener('touchend', handleLongPressEnd);
      element.removeEventListener('touchcancel', handleLongPressEnd);
      element.removeEventListener('touchend', handleDoubleTap);
    };
  }, [terminal, handleTouchStart, handleTouchEnd, handleLongPressStart, handleLongPressEnd, handleDoubleTap]);
  
  // Return useful methods
  return {
    simulateTab: () => terminal?.write('\t'),
    simulateEsc: () => terminal?.write('\x1B'),
    simulateCtrlC: () => terminal?.write('\x03'),
  };
};
import { useState, useEffect } from 'react';

interface KeyboardState {
  isKeyboardOpen: boolean;
  keyboardHeight: number;
  viewportHeight: number;
}

export const useKeyboardAware = (): KeyboardState => {
  const [keyboardState, setKeyboardState] = useState<KeyboardState>({
    isKeyboardOpen: false,
    keyboardHeight: 0,
    viewportHeight: window.innerHeight,
  });

  useEffect(() => {
    const initialViewportHeight = window.innerHeight;
    let resizeTimer: NodeJS.Timeout;

    const handleResize = () => {
      // Clear existing timer
      if (resizeTimer) {
        clearTimeout(resizeTimer);
      }

      // Debounce resize events
      resizeTimer = setTimeout(() => {
        const currentHeight = window.innerHeight;
        const heightDifference = initialViewportHeight - currentHeight;
        
        // Consider keyboard open if viewport height decreased by more than 150px
        const isKeyboardOpen = heightDifference > 150;
        
        setKeyboardState({
          isKeyboardOpen,
          keyboardHeight: isKeyboardOpen ? heightDifference : 0,
          viewportHeight: currentHeight,
        });
      }, 100);
    };

    // Handle visual viewport API if available (iOS Safari)
    if ('visualViewport' in window && window.visualViewport) {
      const visualViewport = window.visualViewport;
      
      const handleViewportChange = () => {
        const heightDifference = window.innerHeight - visualViewport.height;
        const isKeyboardOpen = heightDifference > 150;
        
        setKeyboardState({
          isKeyboardOpen,
          keyboardHeight: isKeyboardOpen ? heightDifference : 0,
          viewportHeight: visualViewport.height,
        });
      };

      visualViewport.addEventListener('resize', handleViewportChange);
      
      return () => {
        visualViewport.removeEventListener('resize', handleViewportChange);
        if (resizeTimer) {
          clearTimeout(resizeTimer);
        }
      };
    } else {
      // Fallback for older browsers
      window.addEventListener('resize', handleResize);
      
      return () => {
        window.removeEventListener('resize', handleResize);
        if (resizeTimer) {
          clearTimeout(resizeTimer);
        }
      };
    }
  }, []);

  return keyboardState;
};
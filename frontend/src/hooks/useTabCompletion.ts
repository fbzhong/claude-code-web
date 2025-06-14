import { useState, useCallback, useRef } from 'react';

interface TabCompletionState {
  isCompleting: boolean;
  completionCount: number;
  lastTabTime: number;
}

export const useTabCompletion = (onDoubleTab: () => void) => {
  const [state, setState] = useState<TabCompletionState>({
    isCompleting: false,
    completionCount: 0,
    lastTabTime: 0,
  });
  
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const handleTab = useCallback(() => {
    const now = Date.now();
    const timeSinceLastTab = now - state.lastTabTime;
    
    // Clear timeout if exists
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // If tab pressed within 500ms, it's a double tab
    if (timeSinceLastTab < 500 && state.completionCount > 0) {
      setState({
        isCompleting: true,
        completionCount: state.completionCount + 1,
        lastTabTime: now,
      });
      
      // Trigger double tab action (show completions)
      onDoubleTab();
    } else {
      // First tab press
      setState({
        isCompleting: false,
        completionCount: 1,
        lastTabTime: now,
      });
    }
    
    // Reset state after 1 second
    timeoutRef.current = setTimeout(() => {
      setState({
        isCompleting: false,
        completionCount: 0,
        lastTabTime: 0,
      });
    }, 1000);
    
    // Always return tab character
    return '\t';
  }, [state, onDoubleTab]);
  
  const reset = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setState({
      isCompleting: false,
      completionCount: 0,
      lastTabTime: 0,
    });
  }, []);
  
  return {
    handleTab,
    isCompleting: state.isCompleting,
    completionCount: state.completionCount,
    reset,
  };
};
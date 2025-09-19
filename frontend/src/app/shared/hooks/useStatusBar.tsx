import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

type StatusType = 'success' | 'error' | 'warning' | 'info' | 'neutral';

interface StatusBarState {
  message: string | null;
  type: StatusType;
}

interface StatusBarContextType {
  showStatus: (type: StatusType, message: string, duration?: number) => void;
  clearStatus: () => void;
  state: StatusBarState;
}

const StatusBarContext = createContext<StatusBarContextType | undefined>(undefined);

export const StatusBarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<StatusBarState>({ message: null, type: 'neutral' });
  const timeoutRef = useRef<number | null>(null);

  const clearStatus = useCallback(() => {
    setState({ message: null, type: 'neutral' });
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const showStatus = useCallback((type: StatusType, message: string, duration: number = 3000) => {
    setState({ type, message });
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (duration > 0) {
      timeoutRef.current = window.setTimeout(() => {
        clearStatus();
      }, duration);
    }
  }, [clearStatus]);

  useEffect(() => () => { if (timeoutRef.current) window.clearTimeout(timeoutRef.current); }, []);

  // Listen for global status events from non-React code
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ type: StatusType; message: string; duration?: number }>;
      const { type, message, duration } = ce.detail || { type: 'info', message: '', duration: 3000 };
      if (message) showStatus(type, message, duration);
    };
    window.addEventListener('mindoodle:status', handler as EventListener);
    return () => window.removeEventListener('mindoodle:status', handler as EventListener);
  }, [showStatus]);

  return (
    <StatusBarContext.Provider value={{ showStatus, clearStatus, state }}>
      {children}
    </StatusBarContext.Provider>
  );
};

export const useStatusBar = (): StatusBarContextType => {
  const ctx = useContext(StatusBarContext);
  if (!ctx) throw new Error('useStatusBar must be used within a StatusBarProvider');
  return ctx;
};

// Utility for non-React code: emit a global status event
export function emitStatus(type: StatusType, message: string, duration: number = 3000): void {
  const event = new CustomEvent('mindoodle:status', { detail: { type, message, duration } });
  window.dispatchEvent(event);
}

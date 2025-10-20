import React, { createContext, useContext } from 'react';
import { useStatusBar } from './useStatusBar';
import { useStableCallback } from '../utilities/useStableCallback';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification { id: string; type: NotificationType; message: string; duration?: number }

interface NotificationContextType {
  showNotification: (type: NotificationType, message: string, duration?: number) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

interface NotificationProviderProps { children: React.ReactNode }

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const { showStatus } = useStatusBar();

  const showNotification = useStableCallback((type: NotificationType, message: string, duration: number = 5000) => {
    
    showStatus(type, message, duration > 0 ? duration : 3000);
  });

  return (
    <NotificationContext.Provider value={{ showNotification }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

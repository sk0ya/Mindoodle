import React from 'react';
import { NotificationProvider } from '@shared/hooks/useNotification';
import { ErrorHandlerProvider } from '@shared/hooks/useErrorHandler';
import { StatusBarProvider } from '@shared/hooks/useStatusBar';

interface MindMapProvidersProps {
  children: React.ReactNode;
}

const MindMapProviders: React.FC<MindMapProvidersProps> = ({ children }) => {
  return (
    <StatusBarProvider>
      <NotificationProvider>
        <ErrorHandlerProvider>
            {children}
        </ErrorHandlerProvider>
      </NotificationProvider>
    </StatusBarProvider>
  );
};

export default MindMapProviders;

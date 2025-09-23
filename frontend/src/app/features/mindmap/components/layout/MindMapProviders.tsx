import React from 'react';
import { NotificationProvider, ErrorHandlerProvider, StatusBarProvider } from '@shared/hooks';

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

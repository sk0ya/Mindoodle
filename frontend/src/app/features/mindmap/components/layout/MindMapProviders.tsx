import React from 'react';
import { NotificationProvider } from '../../../../shared/hooks/useNotification';
import { ErrorHandlerProvider } from '../../../../shared/hooks/useErrorHandler';
import { FileUploadProvider } from '../../../../shared/hooks/useFileUpload';
import { StatusBarProvider } from '../../../../shared/hooks/useStatusBar';

interface MindMapProvidersProps {
  children: React.ReactNode;
}

const MindMapProviders: React.FC<MindMapProvidersProps> = ({ children }) => {
  return (
    <StatusBarProvider>
      <NotificationProvider>
        <ErrorHandlerProvider>
          <FileUploadProvider>
            {children}
          </FileUploadProvider>
        </ErrorHandlerProvider>
      </NotificationProvider>
    </StatusBarProvider>
  );
};

export default MindMapProviders;

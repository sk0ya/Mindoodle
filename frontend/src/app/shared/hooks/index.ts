// Shared Hooks - Organized by category for better maintainability

// Data Management Hooks
export { useDataReset } from './data/useDataReset';
export { useDataCleanup, type DataCleanupStats } from './data/useDataCleanup';
export { useModelLoader } from './data/useModelLoader';

// UI Interaction Hooks
export { useLoadingState, useResizingState, useBooleanState, useHoverState } from './ui/useBooleanState';
export { useDragAndDrop } from './ui/useDragAndDrop';
export { useModal } from './ui/useModal';
export { useModalState } from './ui/useModalState';
export { useNotification, NotificationProvider, type NotificationType, type Notification } from './ui/useNotification';
export { useStatusBar, StatusBarProvider } from './ui/useStatusBar';
export { useCommandPalette, type UseCommandPaletteOptions, type UseCommandPaletteReturn } from './ui/useCommandPalette';

// System & Error Handling Hooks
export { useErrorBoundary } from './system/useErrorBoundary';
export { useErrorHandler, ErrorHandlerProvider, type ErrorInfo } from './system/useErrorHandler';
export { useGlobalErrorHandlers } from './system/useGlobalErrorHandlers';
export { useInitializationWaiter } from './system/useInitializationWaiter';

// Network Hooks
export { useConnectionTest } from './network/useConnectionTest';
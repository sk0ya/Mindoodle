import { useCallback, useMemo } from 'react';
import { useSettings, useUpdateSetting } from './useStoreSelectors';
import { CloudStorageAdapter, GroupCloudStorageAdapter } from '@/app/core/storage/adapters';
import { WorkspaceService } from '@shared/services';

/**
 * Shared hook for cloud workspace management
 * Handles cloud authentication, connection toggle, and status
 */
export const useCloudWorkspace = (workspaces: Array<{ id: string; name: string }>) => {
  const settings = useSettings();
  const updateSetting = useUpdateSetting();

  const isCloudConnected = useMemo(
    () => workspaces.some((ws) => ws.id === 'cloud'),
    [workspaces]
  );

  const handleAuthSuccess = useCallback(
    (authenticatedAdapter: CloudStorageAdapter) => {
      if (!authenticatedAdapter?.isAuthenticated) {
        return;
      }

      const workspaceService = WorkspaceService.getInstance();
      workspaceService.addCloudWorkspace(authenticatedAdapter);
      updateSetting('storageMode', 'local+cloud');
    },
    [updateSetting]
  );

  const handleToggleCloud = useCallback(() => {
    const workspaceService = WorkspaceService.getInstance();

    if (isCloudConnected) {
      updateSetting('storageMode', 'local');
      workspaceService.logoutFromCloud();
    } else {
      let adapter = workspaceService.getCloudAdapter();
      if (!adapter) {
        adapter = new CloudStorageAdapter(settings.cloudApiEndpoint);
        workspaceService.setCloudAdapter(adapter);
      }

      window.dispatchEvent(
        new CustomEvent('mindoodle:showAuthModal', {
          detail: { cloudAdapter: adapter, onSuccess: handleAuthSuccess },
        })
      );
    }
  }, [isCloudConnected, settings.cloudApiEndpoint, updateSetting, handleAuthSuccess]);

  return {
    isCloudConnected,
    handleToggleCloud,
    handleAuthSuccess,
  };
};

export const useGroupWorkspace = (
  workspaces: Array<{ id: string; name: string }>,
  onDisconnect?: () => void | Promise<void>
) => {
  const settings = useSettings();
  const updateSetting = useUpdateSetting();

  const isGroupConnected = useMemo(
    () => workspaces.some((ws) => ws.id === 'group'),
    [workspaces]
  );

  const handleAuthSuccess = useCallback(
    (authenticatedAdapter: CloudStorageAdapter) => {
      const user = authenticatedAdapter?.getCurrentUser();
      if (!authenticatedAdapter?.isAuthenticated || !user?.groupId) {
        return;
      }

      const workspaceService = WorkspaceService.getInstance();
      workspaceService.addGroupWorkspace(authenticatedAdapter);
      updateSetting('storageMode', 'local+cloud');
    },
    [updateSetting]
  );

  const handleToggleGroup = useCallback(async () => {
    const workspaceService = WorkspaceService.getInstance();

    if (isGroupConnected) {
      await onDisconnect?.();
      workspaceService.logoutFromGroup();
      return;
    }

    let adapter = workspaceService.getGroupAdapter();
    if (!adapter) {
      adapter = new GroupCloudStorageAdapter(settings.cloudApiEndpoint);
      workspaceService.setGroupAdapter(adapter);
    }

    const user = adapter.getCurrentUser();
    if (adapter.isAuthenticated && user?.groupId) {
      workspaceService.addGroupWorkspace(adapter);
      updateSetting('storageMode', 'local+cloud');
      return;
    }

    window.dispatchEvent(
      new CustomEvent('mindoodle:showAuthModal', {
        detail: { cloudAdapter: adapter, onSuccess: handleAuthSuccess },
      })
    );
  }, [isGroupConnected, settings.cloudApiEndpoint, updateSetting, handleAuthSuccess, onDisconnect]);

  return {
    isGroupConnected,
    handleToggleGroup,
    handleAuthSuccess,
  };
};

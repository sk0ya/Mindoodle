import { useCallback } from 'react';
import { useSettings, useUpdateSetting } from './useStoreSelectors';

/**
 * Shared hook for handling settings changes across sidebars
 * Provides consistent settings update pattern
 */
export const useSettingsHandler = () => {
  const settings = useSettings();
  const updateSetting = useUpdateSetting();

  const handleSettingChange = useCallback(
    <K extends keyof typeof settings>(key: K, value: typeof settings[K]) => {
      updateSetting(key, value);
    },
    [updateSetting]
  );

  return {
    settings,
    handleSettingChange,
  };
};

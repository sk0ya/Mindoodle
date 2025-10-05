import { useCallback } from 'react';
import { getLocalStorage, setLocalStorage, STORAGE_KEYS } from '@shared/utils';
import { useBooleanState } from '@shared/hooks/ui/useBooleanState';

const STORAGE_KEY = STORAGE_KEYS.FOLDER_GUIDE_DISMISSED;

export function useFolderGuide() {
  const initial = (() => {
    const result = getLocalStorage<string>(STORAGE_KEY);
    return result.success ? result.data !== '1' : true;
  })();
  const { value: showFolderGuide, setTrue: openGuide, setFalse } = useBooleanState({ initialValue: initial });

  const closeGuide = useCallback(() => {
    setFalse();
    setLocalStorage(STORAGE_KEY, '1');
  }, [setFalse]);

  const markDismissed = useCallback(() => {
    setLocalStorage(STORAGE_KEY, '1');
  }, []);

  return { showFolderGuide, openGuide, closeGuide, markDismissed };
}

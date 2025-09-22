import { useCallback, useState } from 'react';
import { getLocalStorage, setLocalStorage, STORAGE_KEYS } from '@shared/utils';

const STORAGE_KEY = STORAGE_KEYS.FOLDER_GUIDE_DISMISSED;

export function useFolderGuide() {
  const [showFolderGuide, setShowFolderGuide] = useState<boolean>(() => {
    const result = getLocalStorage<string>(STORAGE_KEY);
    return result.success ? result.data !== '1' : true;
  });

  const openGuide = useCallback(() => setShowFolderGuide(true), []);
  const closeGuide = useCallback(() => {
    setShowFolderGuide(false);
    setLocalStorage(STORAGE_KEY, '1');
  }, []);

  const markDismissed = useCallback(() => {
    setLocalStorage(STORAGE_KEY, '1');
  }, []);

  return { showFolderGuide, openGuide, closeGuide, markDismissed };
}


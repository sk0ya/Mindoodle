import { useCallback, useState } from 'react';

const STORAGE_KEY = 'mindoodle_guide_dismissed';

export function useFolderGuide() {
  const [showFolderGuide, setShowFolderGuide] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) !== '1';
    } catch {
      return true;
    }
  });

  const openGuide = useCallback(() => setShowFolderGuide(true), []);
  const closeGuide = useCallback(() => {
    setShowFolderGuide(false);
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch {}
  }, []);

  const markDismissed = useCallback(() => {
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch {}
  }, []);

  return { showFolderGuide, openGuide, closeGuide, markDismissed };
}


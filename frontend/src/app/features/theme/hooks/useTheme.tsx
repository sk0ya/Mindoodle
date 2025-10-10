import { useEffect } from 'react';
import { useMindMapStore } from '../../mindmap/store';

export const useTheme = () => {
  const { settings } = useMindMapStore();

  useEffect(() => {
    
    const root = document.documentElement;
    root.setAttribute('data-theme', settings.theme);
    
    
    document.body.className = document.body.className
      .replace(/theme-\w+/g, '')
      .trim();
    document.body.classList.add(`theme-${settings.theme}`);

  }, [settings.theme]);

  return {
    theme: settings.theme,
    setTheme: (theme: 'dark' | 'light') => {
      const { updateSetting } = useMindMapStore.getState();
      updateSetting('theme', theme);
    }
  };
};
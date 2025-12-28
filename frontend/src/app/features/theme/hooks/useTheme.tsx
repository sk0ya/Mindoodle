import { useEffect } from 'react';
import { useSettings, getStoreState } from '../../mindmap/hooks/useStoreSelectors';

export const useTheme = () => {
  const settings = useSettings();

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
      const { updateSetting } = getStoreState();
      updateSetting('theme', theme);
    }
  };
};
import { useMindMapViewport, type ViewportOperationsParams } from './useMindMapViewport';
import type { VimModeHook } from '../../vim/hooks/useVimMode';


export interface NavigationFeaturesParams {
  viewport: ViewportOperationsParams;
  keyboardShortcuts?: {
    handlers: any; 
    vim?: VimModeHook;
  };
}

export const useNavigationFeatures = (params: NavigationFeaturesParams) => {
  const viewportOps = useMindMapViewport(params.viewport);

  
  

  return {
    
    viewportOps,
  };
};

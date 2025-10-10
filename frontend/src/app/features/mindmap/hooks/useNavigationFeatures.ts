import { useMindMapViewport, type ViewportOperationsParams } from './useMindMapViewport';
import type { VimModeHook } from '../../vim/hooks/useVimMode';

/**
 * ナビゲーション機能の統合Hook
 *
 * ビューポート操作とキーボードショートカットを統合
 */
export interface NavigationFeaturesParams {
  viewport: ViewportOperationsParams;
  keyboardShortcuts?: {
    handlers: any; // KeyboardShortcutHandlers (defined in useKeyboardShortcuts.ts)
    vim?: VimModeHook;
  };
}

export const useNavigationFeatures = (params: NavigationFeaturesParams) => {
  const viewportOps = useMindMapViewport(params.viewport);

  // keyboardShortcutsは別途外部で呼び出す必要があるため、ここでは提供しない
  // (handlersとvimが必要なため、コンポーネントレベルで直接使用する)

  return {
    // ビューポート操作
    viewportOps,
  };
};

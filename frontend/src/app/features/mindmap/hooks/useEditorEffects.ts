import { useEffect } from 'react';
import { useLatestRef } from '@shared/hooks';

interface EditorEffectsParams {
  mindMap: any;
  showNotesPanel: boolean;
  vim: any; // VimModeHook type - use any to avoid type complexity
  editingNodeId: string | null;
}

/**
 * Hook for editor-related side effects (autosave toggle, vim mode management)
 */
export function useEditorEffects({
  mindMap,
  showNotesPanel,
  vim,
  editingNodeId,
}: EditorEffectsParams) {

  // Toggle autosave based on right markdown panel visibility to avoid feedback loops
  const setAutoSaveFnRef = useLatestRef<null | ((enabled: boolean) => void)>(
    (typeof mindMap?.setAutoSaveEnabled === 'function') ? mindMap.setAutoSaveEnabled : null
  );

  useEffect(() => {
    try {
      setAutoSaveFnRef.current?.(!showNotesPanel);
    } catch { }
  }, [showNotesPanel, setAutoSaveFnRef]);

  // Ensure Vim mode returns to normal when editing ends (e.g., blur)
  useEffect(() => {
    if (vim.isEnabled && !editingNodeId && vim.mode !== 'normal' && vim.mode !== 'search' &&
      vim.mode !== 'jumpy' && vim.mode !== 'command'
    ) {
      vim.setMode('normal');
    }
  }, [vim.isEnabled, vim.mode, editingNodeId, vim.setMode]);
}

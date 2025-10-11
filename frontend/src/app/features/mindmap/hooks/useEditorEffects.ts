import { useEffect } from 'react';
import { useLatestRef } from '@shared/hooks';
import type { VimModeHook } from '@vim/hooks/useVimMode';

interface EditorEffectsParams {
  mindMap: {
    setAutoSaveEnabled?: (enabled: boolean) => void;
  };
  showNotesPanel: boolean;
  vim: VimModeHook;
  editingNodeId: string | null;
}


export function useEditorEffects({
  mindMap,
  showNotesPanel,
  vim,
  editingNodeId,
}: EditorEffectsParams) {

  
  const setAutoSaveFnRef = useLatestRef<null | ((enabled: boolean) => void)>(
    (typeof mindMap?.setAutoSaveEnabled === 'function') ? mindMap.setAutoSaveEnabled : null
  );

  useEffect(() => {
    try {
      setAutoSaveFnRef.current?.(!showNotesPanel);
    } catch { }
  }, [showNotesPanel, setAutoSaveFnRef]);

  
  useEffect(() => {
    if (vim.isEnabled && !editingNodeId && vim.mode !== 'normal' && vim.mode !== 'search' &&
      vim.mode !== 'jumpy' && vim.mode !== 'command'
    ) {
      vim.setMode('normal');
    }
  }, [vim, editingNodeId]);
}

import { useEffect } from 'react';
import { useLatestRef } from '@shared/hooks';

interface EditorEffectsParams {
  mindMap: any;
  showNotesPanel: boolean;
  vim: any; 
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
  }, [vim.isEnabled, vim.mode, editingNodeId, vim.setMode]);
}

/**
 * Hook for handling keyboard shortcuts in table editor
 */

import { useCallback } from 'react';
import { Selection, EditingCell } from '../utils/table-editor/types';

interface UseTableKeyboardProps {
  editingCell: EditingCell | null;
  selection: Selection;
  onDelete: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onCut: () => void;
  onEscape: () => void;
}

export function useTableKeyboard({
  editingCell,
  selection,
  onDelete,
  onCopy,
  onPaste,
  onCut,
  onEscape,
}: UseTableKeyboardProps) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Don't handle keyboard shortcuts while editing cell
      if (editingCell) return;

      // Stop propagation to prevent conflicts
      e.stopPropagation();

      const isMac = (navigator.userAgent || '').toLowerCase().includes('mac');
      const ctrlOrCmd = isMac ? e.metaKey : e.ctrlKey;

      // Delete/Backspace: delete selection
      if ((e.key === 'Delete' || e.key === 'Backspace') && !ctrlOrCmd) {
        e.preventDefault();
        if (selection.type === 'rows' || selection.type === 'columns') {
          onDelete();
        }
      }

      // Ctrl+C: copy
      if (e.key === 'c' && ctrlOrCmd && !e.shiftKey) {
        e.preventDefault();
        onCopy();
      }

      // Ctrl+V: paste
      if (e.key === 'v' && ctrlOrCmd && !e.shiftKey) {
        e.preventDefault();
        onPaste();
      }

      // Ctrl+X: cut
      if (e.key === 'x' && ctrlOrCmd && !e.shiftKey) {
        e.preventDefault();
        onCut();
      }

      // Escape: clear selection and context menu
      if (e.key === 'Escape') {
        e.preventDefault();
        onEscape();
      }
    },
    [editingCell, selection, onDelete, onCopy, onPaste, onCut, onEscape]
  );

  return { handleKeyDown };
}

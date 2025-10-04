/**
 * Keyboard shortcuts hook for MindMap application
 * Handles all keyboard interactions for efficient mindmap navigation and editing
 */

import type { MindMapNode } from '@shared/types';
import { useEffect } from 'react';
import type { VimModeHook } from '../../vim/hooks/useVimMode';
import { useCommands } from '@commands/system/useCommands';
import type { UseCommandsReturn } from '@commands/system/useCommands';
import { useMindMapStore } from '../store/mindMapStore';
import { JUMP_CHARS } from '../../vim/constants';

interface KeyboardShortcutHandlers {
  selectedNodeId: string | null;
  editingNodeId: string | null;
  setEditText: (_text: string) => void;
  startEdit: (_nodeId: string) => void;
  startEditWithCursorAtEnd: (_nodeId: string) => void;
  startEditWithCursorAtStart: (_nodeId: string) => void;
  finishEdit: (_nodeId: string, _newText?: string, _options?: Partial<MindMapNode>) => Promise<void>;
  cancelEditing: () => void;
  editText: string;
  updateNode: (_id: string, _updates: Partial<MindMapNode>) => void;
  addChildNode: (_parentId: string, _text?: string, _startEditing?: boolean) => Promise<string | null>;
  addSiblingNode: (_nodeId: string, _text?: string, _startEditing?: boolean, _insertAfter?: boolean) => Promise<string | null>;
  changeSiblingOrder?: (_draggedNodeId: string, _targetNodeId: string, _insertBefore?: boolean) => void;
  deleteNode: (_id: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  navigateToDirection: (_direction: 'up' | 'down' | 'left' | 'right') => void;
  selectNode: (_nodeId: string | null) => void;
  setPan?: (_pan: { x: number; y: number } | ((_prev: { x: number; y: number }) => { x: number; y: number })) => void;
  showMapList: boolean;
  setShowMapList: (_show: boolean) => void;
  showLocalStorage: boolean;
  setShowLocalStorage: (_show: boolean) => void;
  showTutorial: boolean;
  setShowTutorial: (_show: boolean) => void;
  showKeyboardHelper: boolean;
  setShowKeyboardHelper: (_show: boolean) => void;
  copyNode: (_nodeId: string) => void;
  pasteNode: (_parentId: string) => Promise<void>;
  pasteImageFromClipboard: (_nodeId: string, _file?: File) => Promise<void>;
  findNodeById: (_nodeId: string) => MindMapNode | null;
  closeAttachmentAndLinkLists: () => void;
  onMarkdownNodeType?: (_nodeId: string, _newType: 'heading' | 'unordered-list' | 'ordered-list') => void;
  centerNodeInView?: (_nodeId: string, _animate?: boolean) => void;
  // Map switching (optional)
  switchToPrevMap?: () => void;
  switchToNextMap?: () => void;
}

/**
 * Handle standard shortcuts (when vim is disabled)
 */
function handleStandardShortcut(
  event: KeyboardEvent,
  commands: UseCommandsReturn,
  handlers: KeyboardShortcutHandlers
): boolean {
  const { key, ctrlKey, metaKey, shiftKey } = event;
  const isModifier = ctrlKey || metaKey;

  // Arrow keys
  if (!isModifier && handlers.selectedNodeId) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
      event.preventDefault();
      const direction = key.replace('Arrow', '').toLowerCase() as 'up' | 'down' | 'left' | 'right';
      commands.execute(`arrow-navigate --direction ${direction}`);
      return true;
    }

    // Core editing shortcuts when Vim is disabled
    if (key === 'Tab') {
      // Prevent browser focus change
      event.preventDefault();
      handlers.closeAttachmentAndLinkLists();
      commands.execute('add-child');
      return true;
    }
    if (key === 'Enter') {
      event.preventDefault();
      handlers.closeAttachmentAndLinkLists();
      commands.execute('add-sibling');
      return true;
    }
    if (key === 'Delete' || key === 'Backspace') {
      event.preventDefault();
      handlers.closeAttachmentAndLinkLists();
      commands.execute('delete');
      return true;
    }
  }

  // Modifier shortcuts
  if (isModifier) {
    // Map switching: Ctrl+P (prev), Ctrl+N (next)
    switch (key.toLowerCase()) {
      case 'p':
        if (handlers.switchToPrevMap) {
          event.preventDefault();
          handlers.switchToPrevMap();
          return true;
        }
        break;
      case 'n':
        if (handlers.switchToNextMap) {
          event.preventDefault();
          handlers.switchToNextMap();
          return true;
        }
        break;
    }

    // Node-related modifier shortcuts require a selection
    if (!handlers.selectedNodeId) {
      return false;
    }
    switch (key.toLowerCase()) {
      case 'c':
        event.preventDefault();
        commands.execute('copy');
        return true;
      case 'v':
        // Defer paste handling to 'paste' event to support image paste
        return true;
      case 'z':
        event.preventDefault();
        if (shiftKey) {
          commands.execute('redo');
        } else {
          commands.execute('undo');
        }
        return true;
      case 'y':
        event.preventDefault();
        commands.execute('redo');
        return true;
    }
  }

  return false;
}

/**
 * Handle non-vim shortcuts even in vim mode (arrows, modifiers)
 */
function handleNonVimShortcut(
  event: KeyboardEvent,
  commands: UseCommandsReturn,
  handlers: KeyboardShortcutHandlers
): boolean {
  const { key, ctrlKey, metaKey, shiftKey } = event;
  const isModifier = ctrlKey || metaKey;

  // Arrow keys work in vim mode too
  if (!isModifier && handlers.selectedNodeId) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
      event.preventDefault();
      const direction = key.replace('Arrow', '').toLowerCase() as 'up' | 'down' | 'left' | 'right';
      commands.execute(`arrow-navigate --direction ${direction}`);
      return true;
    }
  }

  // Modifier shortcuts work in vim mode too
  if (isModifier && handlers.selectedNodeId) {
    switch (key.toLowerCase()) {
      case 'c':
        event.preventDefault();
        commands.execute('copy');
        return true;
      case 'v':
        // Defer paste handling to 'paste' event to support image paste
        return true;
      case 'z':
        event.preventDefault();
        if (shiftKey) {
          commands.execute('redo');
        } else {
          commands.execute('undo');
        }
        return true;
      case 'y':
        event.preventDefault();
        commands.execute('redo');
        return true;
    }
  }

  return false;
}


export const useKeyboardShortcuts = (handlers: KeyboardShortcutHandlers, vim?: VimModeHook) => {

  // Initialize command system
  const commands = useCommands({
    selectedNodeId: handlers.selectedNodeId,
    editingNodeId: handlers.editingNodeId,
    vim,
    handlers: {
      ...handlers,
      // Map switching operations
      switchToNextMap: (handlers as any).switchToNextMap,
      switchToPrevMap: (handlers as any).switchToPrevMap,
    } as any
  });

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      try {
        // If Monaco or text inputs have focus, let them handle paste
        const activeEl = (document.activeElement as HTMLElement | null);
        const monacoFocused = !!(activeEl && (activeEl.closest('.monaco-editor') || activeEl.classList?.contains('monaco-editor')));
        const isInTextInput = !!activeEl && (
          activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.contentEditable === 'true'
        );
        if (monacoFocused || isInTextInput) {
          return;
        }

        // Require a selection to paste into
        if (!handlers.selectedNodeId) return;

        const dt = event.clipboardData;
        if (!dt) return;

        // Prefer image from clipboard
        const items = dt.items || [] as any;
        let imageItem: DataTransferItem | null = null;
        for (let i = 0; i < items.length; i++) {
          const it = items[i];
          if (it && it.kind === 'file' && it.type && it.type.startsWith('image/')) {
            imageItem = it;
            break;
          }
        }

        // Fallback: check files collection
        if (!imageItem && dt.files && dt.files.length > 0) {
          for (let i = 0; i < dt.files.length; i++) {
            const f = dt.files[i];
            if (f && f.type && f.type.startsWith('image/')) {
              // Convert File to DataTransferItem-like via Blob (already a File)
              // We will use this file directly
              // Prevent default and handle image paste via service
              event.preventDefault();
              handlers.pasteImageFromClipboard(handlers.selectedNodeId, f as unknown as File);
              return;
            }
          }
        }

        if (imageItem) {
          const type = imageItem.type || 'image/png';
          const blob = imageItem.getAsFile();
          if (blob) {
            event.preventDefault();
            const ext = (type.split('/')[1] || 'png');
            const file = new File([blob], `image-${Date.now()}.${ext}`, { type });
            handlers.pasteImageFromClipboard(handlers.selectedNodeId, file);
            return;
          }
        }

        // No image detected: treat as node paste
        event.preventDefault();
        commands.execute('paste');
      } catch {
        // On any error, try to fallback to node paste to keep UX consistent
        try { event.preventDefault(); commands.execute('paste'); } catch {}
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      // Strong guard: if Monaco markdown editor has focus, do not handle anything here (including Vim)
      try {
        const activeEl = (document.activeElement as HTMLElement | null);
        const monacoFocused = !!(activeEl && (activeEl.closest('.monaco-editor') || activeEl.classList?.contains('monaco-editor')));
        if (monacoFocused) {
          return; // let markdown editor fully handle keys
        }
      } catch {}
      // Check if in text input
      const target = event.target as HTMLElement;
      const isInTextInput = target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true';
      const isInMonacoEditor = target.closest('.monaco-editor') !== null;

      if (isInTextInput || isInMonacoEditor) {
        // Special handling for editing mode in mindmap nodes
        if (handlers.editingNodeId && !isInMonacoEditor) {
          if (event.key === 'Enter') {
            event.preventDefault();
            handlers.finishEdit(handlers.editingNodeId, handlers.editText).then(() => {
              if (vim && vim.isEnabled) vim.setMode('normal');
            });
            return;
          } else if (event.key === 'Tab') {
            event.preventDefault();
            handlers.finishEdit(handlers.editingNodeId, handlers.editText).then(() => {
              if (vim && vim.isEnabled) vim.setMode('normal');
            });
            return;
          } else if (event.key === 'Escape') {
            event.preventDefault();
            handlers.finishEdit(handlers.editingNodeId, handlers.editText).then(() => {
              if (vim && vim.isEnabled) vim.setMode('normal');
            });
            return;
          }
        }
        // For Monaco Editor or other text inputs, let them handle their own keys
        return;
      }

      const { key, ctrlKey, metaKey, altKey } = event;
      const isModifier = ctrlKey || metaKey;

      // Global: Toggle primary sidebar visibility (Ctrl/Cmd + B)
      // Matches VS Code behavior: hide/show left sidebar
      if ((ctrlKey || metaKey) && !altKey && (key === 'b' || key === 'B')) {
        event.preventDefault();
        try {
          const { ui, setActiveView } = useMindMapStore.getState() as any;
          const next = ui?.activeView ? null : 'maps';
          setActiveView(next);
        } catch {}
        return;
      }

      // Global: Toggle Node Note panel (Ctrl/Cmd + Shift + M)
      if ((ctrlKey || metaKey) && !altKey && event.shiftKey && (key === 'm' || key === 'M')) {
        event.preventDefault();
        try { commands.execute('toggle-node-note-panel'); } catch {}
        return;
      }

      // Global: Toggle Markdown panel (Ctrl/Cmd + M)
      if ((ctrlKey || metaKey) && !altKey && !event.shiftKey && (key === 'm' || key === 'M')) {
        event.preventDefault();
        try {
          // Use command system to toggle, so it stays consistent with handlers
          commands.execute('toggle-markdown-panel');
        } catch {}
        return;
      }

      // Handle search mode - now handled by input field in VimStatusBar
      if (vim && vim.isEnabled && vim.mode === 'search') {
        // Let the input field in VimStatusBar handle all keys
        return;
      }

      // Handle jumpy mode
      if (vim && vim.isEnabled && vim.mode === 'jumpy') {
        const { key } = event;

        if (key === 'Escape') {
          event.preventDefault();
          vim.exitJumpy();
          return;
        } else if (key === 'Enter' && vim.jumpyBuffer) {
          event.preventDefault();
          // Jump to exact match if it exists
          const exactMatch = vim.jumpyLabels.find(jl => jl.label === vim.jumpyBuffer);
          if (exactMatch) {
            const { selectNode } = useMindMapStore.getState() as any;
            selectNode(exactMatch.nodeId);
            vim.exitJumpy();
          }
          return;
        } else if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          event.preventDefault();
          // Handle jump characters
          if (JUMP_CHARS.includes(key.toLowerCase())) {
            vim.jumpToNode(key.toLowerCase());
            return;
          }
        }
        return;
      }

      // Handle command mode - now handled by input field in VimStatusBar
      if (vim && vim.isEnabled && vim.mode === 'command') {
        // Let the input field in VimStatusBar handle all keys
        return;
      }

      // Vim mode handling through command system
      if (vim && vim.isEnabled && vim.mode === 'normal') {
        // Fetch custom vim mappings and leader dynamically
        const { settings } = useMindMapStore.getState() as any;
        const customMap: Record<string, string> = (settings?.vimCustomKeybindings || {}) as Record<string, string>;
        let leader: string = (settings?.vimLeader ?? ',') as string;
        if (typeof leader !== 'string' || leader.length !== 1) leader = ',';

        // Expand tokens in LHS, currently supports <leader> and <Space>
        const expandLhs = (lhs: string): string => {
          let out = lhs.replace(/<\s*leader\s*>/ig, leader);
          out = out.replace(/<\s*space\s*>/ig, ' ');
          return out;
        };

        // Build expanded mapping table and prefix set for fast checks
        const expandedEntries = Object.entries(customMap).map(([lhs, cmd]) => [expandLhs(lhs), cmd]) as Array<[string,string]>;
        const expandedKeysStart = new Set(expandedEntries.map(([lhs]) => (lhs[0] || '')));

        // Handle Ctrl+U and Ctrl+D scroll commands, and map switching Ctrl+P/N
        if (isModifier) {
          const lower = key.toLowerCase();
          if (lower === 'u' && ctrlKey) {
            event.preventDefault();
            commands.executeVimCommand('ctrl-u');
            return;
          } else if (lower === 'd' && ctrlKey) {
            event.preventDefault();
            commands.executeVimCommand('ctrl-d');
            return;
          } else if (lower === 'r' && ctrlKey) {
            // Only handle Ctrl+R in vim mode for redo
            event.preventDefault();
            commands.executeVimCommand('ctrl-r');
            return;
          } else if (lower === 'p' && ctrlKey && handlers.switchToPrevMap) {
            event.preventDefault();
            handlers.switchToPrevMap();
            return;
          } else if (lower === 'n' && ctrlKey && handlers.switchToNextMap) {
            event.preventDefault();
            handlers.switchToNextMap();
            return;
          } else if (lower === '[' && (ctrlKey || metaKey) && handlers.switchToPrevMap) {
            event.preventDefault();
            handlers.switchToPrevMap();
            return;
          } else if (lower === ']' && (ctrlKey || metaKey) && handlers.switchToNextMap) {
            event.preventDefault();
            handlers.switchToNextMap();
            return;
          }
          // Fall through to regular modifier handling
        }

        // Alt-based fallback for browsers that block Ctrl+N
        if (altKey && !ctrlKey && !metaKey) {
          const lower = key.toLowerCase();
          if (lower === 'p' && handlers.switchToPrevMap) {
            event.preventDefault();
            handlers.switchToPrevMap();
            return;
          } else if (lower === 'n' && handlers.switchToNextMap) {
            event.preventDefault();
            handlers.switchToNextMap();
            return;
          }
        }

        // Handle Escape key to clear search information in normal mode
        if (key === 'Escape') {
          event.preventDefault();
          // Clear search query and highlighting if there's an active search
          if (vim.searchQuery || vim.searchResults.length > 0) {
            vim.exitSearch();
            return;
          }
        }

        // Regular vim commands (non-modifier keys)
        if (!isModifier) {
          // Skip modifier keys themselves
          if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(key)) {
            return;
          }

          // Map special keys to lowercase
          // No special keys handled by Vim here; let standard handler manage Tab/Enter/Delete/Backspace
          const specialKeyMap: Record<string, string> = {};

          // Preserve case for letters to support uppercase commands like 'M'
          const normalizedKey = specialKeyMap[key] || key;

          // Prevent browser shortcuts for vim keys and custom leader-prefixed keys
          const vimKeys = commands.getVimKeys();
          if (vimKeys.includes(normalizedKey) || expandedKeysStart.has(normalizedKey)) {
            event.preventDefault();
            event.stopPropagation();
          }

          // Handle special keys directly
          // No direct special key handling; fall through to sequence handling / standard shortcuts

          // 1) Try custom mappings first (with buffer)
          const currentBuffer = vim.commandBuffer;
          const testSequence = currentBuffer + normalizedKey;

          // Check complete match
          const complete = expandedEntries.find(([lhs]) => lhs === testSequence);
          if (complete) {
            const [, rhs] = complete;
            try {
              handlers.closeAttachmentAndLinkLists();
              // RHS can be either a command name or a built-in vim sequence
              const isCmd = commands.isValidCommand(rhs);
              if (isCmd) {
                commands.execute(rhs);
              } else {
                const seqRes = commands.parseVimSequence(rhs);
                if (seqRes.isComplete && seqRes.command) {
                  commands.executeVimCommand(seqRes.command);
                } else {
                  // Fallback: try executing as command anyway
                  commands.execute(rhs);
                }
              }
            } catch {}
            vim.clearCommandBuffer();
            return;
          }
          // Check partial match
          const hasPartial = expandedEntries.some(([lhs]) => lhs.startsWith(testSequence));
          if (hasPartial) {
            vim.appendToCommandBuffer(normalizedKey);
            return;
          }

          // Handle vim sequences through command system
          const result = commands.parseVimSequence(testSequence);

          if (result.isComplete && result.command) {
            // Complete command - execute and clear buffer
            handlers.closeAttachmentAndLinkLists();
            commands.executeVimCommand(result.command);
            vim.clearCommandBuffer();
            return;
          } else if (result.isPartial) {
            // Partial command - add to buffer and wait for more keys
            vim.appendToCommandBuffer(normalizedKey);
            return;
          } else if (result.shouldClear) {
            // Invalid sequence - clear buffer
            vim.clearCommandBuffer();
          }

          // Handle colon key to enter command mode
          if (normalizedKey === ':') {
            event.preventDefault();
            event.stopPropagation();
            vim.startCommandLine();
            return;
          }

          // Try single-key commands
          const singleKeyResult = commands.parseVimSequence(normalizedKey);
          if (singleKeyResult.isComplete && singleKeyResult.command) {
            handlers.closeAttachmentAndLinkLists();
            commands.executeVimCommand(singleKeyResult.command);
            return;
          }
        }
      }

      // Handle non-vim shortcuts through command system
      if (!vim || !vim.isEnabled || vim.mode !== 'normal') {
        // Standard keyboard shortcuts when vim is disabled
        if (handleStandardShortcut(event, commands, handlers)) {
          return;
        }
      } else {
        // Even in vim mode, handle certain shortcuts like arrows and modifiers
        if (handleNonVimShortcut(event, commands, handlers)) {
          return;
        }
        // Also allow standard shortcuts (e.g., Tab/Enter) to run in Vim mode
        if (handleStandardShortcut(event, commands, handlers)) {
          return;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('paste', handlePaste, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('paste', handlePaste, true);
    };
  }, [handlers, vim, commands]);
};

export default useKeyboardShortcuts;

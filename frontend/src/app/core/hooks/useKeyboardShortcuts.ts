/**
 * Keyboard shortcuts hook for MindMap application
 * Handles all keyboard interactions for efficient mindmap navigation and editing
 */

import type { MindMapNode } from '@shared/types';
import { useEffect } from 'react';
import { logger } from '../../shared/utils/logger';
import type { VimModeHook } from './useVimMode';
import { useCommands } from '../commands';
import type { UseCommandsReturn } from '../commands/useCommands';

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
  pasteImageFromClipboard: (_nodeId: string) => Promise<void>;
  findNodeById: (_nodeId: string) => MindMapNode | null;
  closeAttachmentAndLinkLists: () => void;
  onMarkdownNodeType?: (_nodeId: string, _newType: 'heading' | 'unordered-list' | 'ordered-list') => void;
  centerNodeInView?: (_nodeId: string, _animate?: boolean) => void;
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
  }

  // Modifier shortcuts
  if (isModifier && handlers.selectedNodeId) {
    switch (key.toLowerCase()) {
      case 'c':
        event.preventDefault();
        commands.execute('copy');
        return true;
      case 'v':
        event.preventDefault();
        commands.execute('paste');
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
        event.preventDefault();
        commands.execute('paste');
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
      // Node operations
      updateNode: handlers.updateNode,
      deleteNode: handlers.deleteNode,
      findNodeById: handlers.findNodeById,

      // Navigation
      centerNodeInView: handlers.centerNodeInView,
      navigateToDirection: handlers.navigateToDirection,
      selectNode: handlers.selectNode,
      setPan: handlers.setPan,

      // Editing
      startEdit: handlers.startEdit,
      startEditWithCursorAtStart: handlers.startEditWithCursorAtStart,
      startEditWithCursorAtEnd: handlers.startEditWithCursorAtEnd,

      // Structure operations
      addChildNode: handlers.addChildNode,
      addSiblingNode: handlers.addSiblingNode,
      changeSiblingOrder: handlers.changeSiblingOrder,

      // Clipboard operations
      copyNode: handlers.copyNode,
      pasteNode: handlers.pasteNode,
      pasteImageFromClipboard: handlers.pasteImageFromClipboard,

      // Undo/Redo
      undo: handlers.undo,
      redo: handlers.redo,
      canUndo: handlers.canUndo,
      canRedo: handlers.canRedo,

      // UI state management
      showKeyboardHelper: handlers.showKeyboardHelper,
      setShowKeyboardHelper: handlers.setShowKeyboardHelper,
      showMapList: handlers.showMapList,
      setShowMapList: handlers.setShowMapList,
      showLocalStorage: handlers.showLocalStorage,
      setShowLocalStorage: handlers.setShowLocalStorage,
      showTutorial: handlers.showTutorial,
      setShowTutorial: handlers.setShowTutorial,

      // UI operations
      closeAttachmentAndLinkLists: handlers.closeAttachmentAndLinkLists,

      // Markdown operations
      onMarkdownNodeType: handlers.onMarkdownNodeType,
    }
  });

  useEffect(() => {
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

      const { key, ctrlKey, metaKey } = event;
      const isModifier = ctrlKey || metaKey;

      // Vim mode handling through command system
      if (vim && vim.isEnabled && vim.mode === 'normal') {
        // Handle Ctrl+U and Ctrl+D scroll commands
        if (isModifier) {
          if (key.toLowerCase() === 'u' && ctrlKey) {
            event.preventDefault();
            commands.executeVimCommand('ctrl-u');
            return;
          } else if (key.toLowerCase() === 'd' && ctrlKey) {
            event.preventDefault();
            commands.executeVimCommand('ctrl-d');
            return;
          }
          // Fall through to regular modifier handling
        }

        // Regular vim commands (non-modifier keys)
        if (!isModifier) {
          // Map special keys to lowercase
          const specialKeyMap: Record<string, string> = {
            'Tab': 'tab',
            'Enter': 'enter',
            'Delete': 'delete',
            'Backspace': 'backspace'
          };

          // Preserve case for letters to support uppercase commands like 'M'
          const normalizedKey = specialKeyMap[key] || key;

          // Prevent browser shortcuts for vim keys
          const vimKeys = commands.getVimKeys();
          if (vimKeys.includes(normalizedKey)) {
            event.preventDefault();
            event.stopPropagation();
          }

          // Handle special keys directly
          if (['tab', 'enter', 'delete', 'backspace'].includes(normalizedKey)) {
            logger.debug('Debug: Executing special vim key:', normalizedKey);
            handlers.closeAttachmentAndLinkLists();
            commands.executeVimCommand(normalizedKey);
            return;
          }

          // Handle vim sequences through command system
          const currentBuffer = vim.commandBuffer;
          const testSequence = currentBuffer + normalizedKey;
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
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [handlers, vim, commands]);
};

export default useKeyboardShortcuts;

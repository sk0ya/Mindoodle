/**
 * Keyboard shortcuts hook for MindMap application
 * Handles all keyboard interactions for efficient mindmap navigation and editing
 */

import { useEffect } from 'react';
import type { MindMapNode } from '@shared/types';
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
  addSiblingNode: (_nodeId: string, _text?: string, _startEditing?: boolean) => Promise<string | null>;
  deleteNode: (_id: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  navigateToDirection: (_direction: 'up' | 'down' | 'left' | 'right') => void;
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
 * Handle vim key sequences using command system delegation
 */
function handleVimKeySequence(
  key: string,
  vim: VimModeHook,
  commands: UseCommandsReturn,
  handlers: KeyboardShortcutHandlers
): boolean {
  // Special cases that don't follow the normal sequence pattern
  if (key === 'escape') {
    vim.setMode('normal');
    return true;
  }

  if (['tab', 'enter', 'delete', 'backspace'].includes(key)) {
    // Map special keys to vim commands (must match useCommands vimCommandMap)
    const specialKeyMap: Record<string, string> = {
      'tab': 'tab',
      'enter': 'enter',
      'delete': 'delete',
      'backspace': 'backspace'
    };

    const commandName = specialKeyMap[key];
    if (commandName) {
      commands.executeVimCommand(commandName);
      return true;
    }
  }

  // Handle key sequences using command system
  const currentBuffer = vim.commandBuffer;
  const testSequence = currentBuffer + key;
  const result = commands.parseVimSequence(testSequence);

  if (result.isComplete && result.command) {
    // Complete command - execute and clear buffer
    handlers.closeAttachmentAndLinkLists();
    commands.executeVimCommand(result.command);
    vim.clearCommandBuffer();
    return true;
  } else if (result.isPartial) {
    // Partial command - add to buffer and wait for more keys
    vim.appendToCommandBuffer(key);
    return true;
  } else if (result.shouldClear) {
    // Invalid sequence - clear buffer
    vim.clearCommandBuffer();
    // Don't return true here - let the key be processed normally
  }

  // For single-key commands, try to execute directly
  const singleKeyResult = commands.parseVimSequence(key);
  if (singleKeyResult.isComplete && singleKeyResult.command) {
    handlers.closeAttachmentAndLinkLists();
    commands.executeVimCommand(singleKeyResult.command);
    return true;
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
      updateNode: handlers.updateNode,
      deleteNode: handlers.deleteNode,
      centerNodeInView: handlers.centerNodeInView,
      findNodeById: handlers.findNodeById,
      startEditWithCursorAtStart: handlers.startEditWithCursorAtStart,
      startEditWithCursorAtEnd: handlers.startEditWithCursorAtEnd,
      navigateToDirection: handlers.navigateToDirection,
      addChildNode: handlers.addChildNode,
      addSiblingNode: handlers.addSiblingNode,
      copyNode: handlers.copyNode,
      pasteNode: handlers.pasteNode,
      undo: handlers.undo,
      redo: handlers.redo,
      onMarkdownNodeType: handlers.onMarkdownNodeType,
    }
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Vimium対策: キーボードイベントを早期に捕獲
      // Don't handle shortcuts when editing text
      const target = event.target as HTMLElement;
      const isInTextInput = target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true';

      // Check if we're in Monaco Editor (markdown editor)
      const isInMonacoEditor = target.closest('.monaco-editor') !== null;

      if (isInTextInput || isInMonacoEditor) {
        // Special handling for editing mode in mindmap nodes
        if (handlers.editingNodeId && !isInMonacoEditor) {
          if (event.key === 'Enter') {
            event.preventDefault();
            handlers.finishEdit(handlers.editingNodeId, handlers.editText);
            if (vim && vim.isEnabled) vim.setMode('normal');
          } else if (event.key === 'Escape') {
            event.preventDefault();
            handlers.finishEdit(handlers.editingNodeId, handlers.editText);
            if (vim && vim.isEnabled) vim.setMode('normal');
          }
        }
        // For Monaco Editor or other text inputs, let them handle their own keys
        return;
      }

      const { key, ctrlKey, metaKey, shiftKey } = event;
      const isModifier = ctrlKey || metaKey;

      // Vimium競合対策: vimキーの場合は即座に preventDefault
      if (vim && vim.isEnabled && vim.mode === 'normal' && !isModifier && handlers.selectedNodeId) {
        const vimKeys = commands.getVimKeys();
        if (vimKeys.includes(key.toLowerCase())) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
        }
      }

      // Vim mode handling - delegated to command system
      if (vim && vim.isEnabled && vim.mode === 'normal' && !isModifier && handlers.selectedNodeId) {
        const handled = handleVimKeySequence(key.toLowerCase(), vim, commands, handlers);
        if (handled) {
          return;
        }
      }


      // Arrow key navigation (works in both vim and normal mode)
      if (!isModifier && handlers.selectedNodeId) {
        switch (key) {
          case 'ArrowUp':
            event.preventDefault();
            handlers.closeAttachmentAndLinkLists();
            handlers.navigateToDirection('up');
            return;
          case 'ArrowDown':
            event.preventDefault();
            handlers.closeAttachmentAndLinkLists();
            handlers.navigateToDirection('down');
            return;
          case 'ArrowLeft':
            event.preventDefault();
            handlers.closeAttachmentAndLinkLists();
            handlers.navigateToDirection('left');
            return;
          case 'ArrowRight':
            event.preventDefault();
            handlers.closeAttachmentAndLinkLists();
            handlers.navigateToDirection('right');
            return;
        }
      }

      // Standard navigation shortcuts (when vim is disabled OR for non-vim keys when vim is enabled)
      if (!isModifier && handlers.selectedNodeId) {
        // Skip if vim is enabled and this is a vim key that was already handled
        if (vim && vim.isEnabled && vim.mode === 'normal') {
          const vimKeys = [...commands.getVimKeys(), 'escape', 'tab', 'enter'];
          if (vimKeys.includes(key.toLowerCase())) {
            // This key was already handled by vim mode, skip standard handling
            return;
          }
        }
        switch (key) {
          case ' ': // Space
            event.preventDefault();
            if (handlers.selectedNodeId) {
              handlers.startEdit(handlers.selectedNodeId);
            }
            break;
          case 'F2': // F2
            event.preventDefault();
            if (handlers.selectedNodeId) {
              handlers.startEditWithCursorAtEnd(handlers.selectedNodeId);
            }
            break;
          case 'Tab':
            event.preventDefault();
            if (handlers.selectedNodeId) {
              handlers.addChildNode(handlers.selectedNodeId, '', true);
            }
            break;
          case 'Enter':
            event.preventDefault();
            if (handlers.selectedNodeId) {
              handlers.addSiblingNode(handlers.selectedNodeId, '', true);
            }
            break;
          case 'Delete':
          case 'Backspace':
            event.preventDefault();
            if (handlers.selectedNodeId) {
              handlers.deleteNode(handlers.selectedNodeId);
            }
            break;
        }
      }

      // Application shortcuts with modifiers
      if (isModifier) {
        switch (key.toLowerCase()) {
          case 's':
            event.preventDefault();
            // Auto-save is handled by the system
            break;
          case 'z':
            event.preventDefault();
            if (shiftKey && handlers.canRedo) {
              handlers.redo();
            } else if (!shiftKey && handlers.canUndo) {
              handlers.undo();
            }
            break;
          case 'y':
            event.preventDefault();
            if (handlers.canRedo) {
              handlers.redo();
            }
            break;
          case 'c':
            event.preventDefault();
            if (handlers.selectedNodeId) {
              handlers.copyNode(handlers.selectedNodeId);
            }
            break;
          case 'v':
            event.preventDefault();
            if (handlers.selectedNodeId) {
              // まずシステムクリップボードから画像を確認
              handlers.pasteImageFromClipboard(handlers.selectedNodeId).catch(async () => {
                // 画像がない場合は通常のノードペースト（MindMeister形式も含む）
                if (handlers.selectedNodeId) {
                  await handlers.pasteNode(handlers.selectedNodeId);
                }
              });
            }
            break;
          case 'm':
            event.preventDefault();
            if (handlers.selectedNodeId && handlers.onMarkdownNodeType) {
              const selectedNode = handlers.findNodeById(handlers.selectedNodeId);
              if (selectedNode?.markdownMeta?.type === 'heading') {
                handlers.onMarkdownNodeType(handlers.selectedNodeId, 'unordered-list');
              }
            }
            break;
        }
      }

      // Function keys and special shortcuts
      switch (key) {
        case 'F1':
          event.preventDefault();
          handlers.setShowKeyboardHelper(!handlers.showKeyboardHelper);
          break;
        case 'Escape':
          event.preventDefault();
          // Close any open panels
          if (handlers.showMapList) handlers.setShowMapList(false);
          if (handlers.showLocalStorage) handlers.setShowLocalStorage(false);
          if (handlers.showTutorial) handlers.setShowTutorial(false);
          if (handlers.showKeyboardHelper) handlers.setShowKeyboardHelper(false);
          // 添付ファイル・リンク一覧を閉じる
          handlers.closeAttachmentAndLinkLists();
          break;
      }
    };

    // Vimium対策: captureフェーズでイベントを捕獲
    document.addEventListener('keydown', handleKeyDown, true);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [handlers, vim]);
};

export default useKeyboardShortcuts;
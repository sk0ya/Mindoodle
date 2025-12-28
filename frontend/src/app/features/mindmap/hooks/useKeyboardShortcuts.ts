
import type { MindMapNode } from '@shared/types';
import type { VimModeHook } from '../../vim/hooks/useVimMode';
import type { Direction, MarkdownNodeType } from '@commands/system/types';
import { useCommands, type UseCommandsReturn } from '@commands/system/useCommands';
import { parseVimSequence, getVimKeys } from '@commands/system/vimSequenceParser';
import { useMindMapStore } from '../store/mindMapStore';
import { JUMP_CHARS } from '../../vim/constants';
import { useEventListener } from '@shared/hooks/system/useEventListener';
import { logger } from '@shared/utils';

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
  navigateToDirection: (_direction: Direction, _count?: number) => void;
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
  onMarkdownNodeType?: (_nodeId: string, _newType: MarkdownNodeType, _options?: { isCheckbox?: boolean; isChecked?: boolean }) => void;
  centerNodeInView?: (_nodeId: string, _animate?: boolean) => void;
  switchToPrevMap?: () => void;
  switchToNextMap?: () => void;
}

const isModifier = (event: KeyboardEvent): boolean => event.ctrlKey || event.metaKey;

const handleStandardShortcut = (
  event: KeyboardEvent,
  commands: UseCommandsReturn,
  handlers: KeyboardShortcutHandlers
): boolean => {
  // Access properties directly from the event; spreading KeyboardEvent loses non-enumerable props
  const key = event.key;
  const shiftKey = event.shiftKey;
  const selectedNodeId = handlers.selectedNodeId;

  // Guard against undefined/empty key
  if (!key) return false;

  const mod = isModifier(event);

  if (!mod && selectedNodeId) {
    const arrowDir: Record<string, Direction> = {
      ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right'
    };

    if (arrowDir[key]) {
      event.preventDefault();
      commands.execute(`arrow-navigate --direction ${arrowDir[key]}`);
      return true;
    }

    const actions: Record<string, string> = {
      Tab: 'add-child',
      Enter: 'add-sibling',
      Delete: 'delete',
      Backspace: 'delete'
    };

    if (actions[key]) {
      event.preventDefault();
      handlers.closeAttachmentAndLinkLists();
      commands.execute(actions[key]);
      return true;
    }
  }

  if (mod) {
    if (key.toLowerCase() === 'n') {
      event.preventDefault();
      commands.execute('switch-map --direction next');
      return true;
    }

    if (!selectedNodeId) return false;

    const modActions: Record<string, string> = {
      c: shiftKey ? 'copy-text' : 'copy',
      v: '',
      z: shiftKey ? 'redo' : 'undo',
      y: 'redo'
    };

    const action = modActions[key.toLowerCase()];
    if (action !== undefined) {
      if (action) {
        event.preventDefault();
        commands.execute(action);
      }
      return true;
    }
  }

  return false;
};

export const useKeyboardShortcuts = (handlers: KeyboardShortcutHandlers, vim?: VimModeHook) => {
  const commands = useCommands({
    selectedNodeId: handlers.selectedNodeId,
    editingNodeId: handlers.editingNodeId,
    vim,
    handlers: {
      ...handlers,
      switchToNextMap: handlers.switchToNextMap,
      switchToPrevMap: handlers.switchToPrevMap,
    }
  });

  const handlePaste = async (evt: ClipboardEvent) => {
    try {
      const activeEl = document.activeElement as HTMLElement | null;
      const monacoFocused = !!(activeEl && (activeEl.closest('.monaco-editor') || activeEl.classList?.contains('monaco-editor')));
      const isInTextInput = !!activeEl && (
        activeEl.tagName === 'INPUT' ||
        activeEl.tagName === 'TEXTAREA' ||
        activeEl.contentEditable === 'true'
      );

      if (monacoFocused || isInTextInput || !handlers.selectedNodeId) return;

      const dt = evt.clipboardData;
      if (!dt) return;

      const items = Array.from(dt.items || []);
      const imageItem = items.find(it => it.kind === 'file' && it.type?.startsWith('image/'));

      // Check for image in files array
      if (!imageItem && dt.files) {
        const imageFile = Array.from(dt.files).find(f => f.type?.startsWith('image/'));
        if (imageFile) {
          evt.preventDefault();
          logger.debug('Pasting image from files array:', imageFile.type);
          await handlers.pasteImageFromClipboard(handlers.selectedNodeId, imageFile as File);
          return;
        }
      }

      // Check for image in clipboard items
      if (imageItem) {
        const blob = imageItem.getAsFile();
        if (blob) {
          evt.preventDefault();
          const ext = (imageItem.type.split('/')[1] || 'png');
          const file = new File([blob], `image-${Date.now()}.${ext}`, { type: imageItem.type });
          logger.debug('Pasting image from clipboard item:', file.type);
          await handlers.pasteImageFromClipboard(handlers.selectedNodeId, file);
          return;
        }
      }

      // No image found, try regular paste command
      evt.preventDefault();
      await commands.execute('paste');
    } catch (e) {
      logger.error('Paste failed:', e);
      evt.preventDefault();
      // Try fallback paste command
      try {
        await commands.execute('paste');
      } catch (fallbackError) {
        logger.error('Paste fallback failed:', fallbackError);
      }
    }
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    try {
      const activeEl = document.activeElement as HTMLElement | null;
      const monacoFocused = !!(activeEl && (activeEl.closest('.monaco-editor') || activeEl.classList?.contains('monaco-editor')));
      if (monacoFocused) return;
    } catch {}

    const target = event.target as HTMLElement;
    const isInTextInput = target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.contentEditable === 'true';
    const isInCodeMirrorEditor = target.closest('.cm-editor') !== null;

    if (isInTextInput || isInCodeMirrorEditor) {
      if (handlers.editingNodeId && !isInCodeMirrorEditor && ['Enter', 'Tab', 'Escape'].includes(event.key)) {
        event.preventDefault();
        handlers.finishEdit(handlers.editingNodeId, handlers.editText).then(() => {
          if (vim?.isEnabled) vim.setMode('normal');
        });
      }
      return;
    }

    const { key, ctrlKey, metaKey, altKey } = event;
    const mod = isModifier(event);

    if (mod && !altKey && (key === 'b' || key === 'B')) {
      event.preventDefault();
      try {
        const { ui, setActiveView } = useMindMapStore.getState();
        setActiveView(ui?.activeView ? null : 'maps');
      } catch {}
      return;
    }

    if (mod && !altKey) {
      if (event.shiftKey && (key === 'm' || key === 'M')) {
        event.preventDefault();
        commands.execute('toggle-node-note-panel').catch(err => logger.warn('toggle-node-note-panel failed', err));
        return;
      }
      if (!event.shiftKey && (key === 'm' || key === 'M')) {
        event.preventDefault();
        commands.execute('toggle-markdown-panel').catch(err => logger.warn('toggle-markdown-panel failed', err));
        return;
      }
    }

    // Ensure Enter/Tab work regardless of Vim state when not editing inputs
    if (!isInTextInput && !isInCodeMirrorEditor && !mod && handlers.selectedNodeId && (key === 'Enter' || key === 'Tab')) {
      event.preventDefault();
      event.stopPropagation();
      try {
        handlers.closeAttachmentAndLinkLists();
        void commands.execute(key === 'Enter' ? 'add-sibling' : 'add-child').catch(() => {});
      } catch {}
      return;
    }

    if (vim?.isEnabled) {
      if (vim.mode === 'search' || vim.mode === 'command') return;

      if (vim.mode === 'jumpy') {
        if (key === 'Escape') {
          event.preventDefault();
          vim.exitJumpy();
        } else if (key === 'Enter' && vim.jumpyBuffer) {
          event.preventDefault();
          const exactMatch = vim.jumpyLabels.find(jl => jl.label === vim.jumpyBuffer);
          if (exactMatch) {
            useMindMapStore.getState().selectNode(exactMatch.nodeId);
            vim.exitJumpy();
          }
        } else if (key.length === 1 && !ctrlKey && !metaKey && !altKey && JUMP_CHARS.includes(key.toLowerCase())) {
          event.preventDefault();
          vim.jumpToNode(key.toLowerCase());
        }
        return;
      }

      if (vim.mode === 'normal') {
        const { settings } = useMindMapStore.getState();
        const customMap: Record<string, string> = settings?.vimCustomKeybindings || {};
        let leader: string = settings?.vimLeader ?? ',';
        if (typeof leader !== 'string' || leader.length !== 1) leader = ',';

        const expandLhs = (lhs: string): string =>
          lhs.replace(/<\s*leader\s*>/ig, leader).replace(/<\s*space\s*>/ig, ' ');

        const expandedEntries = Object.entries(customMap).map(([lhs, cmd]) => [expandLhs(lhs), cmd]);
        const expandedKeysStart = new Set(expandedEntries.map(([lhs]) => lhs[0] || ''));

        if (mod) {
          const lower = key.toLowerCase();
          if (lower === 'u' && ctrlKey) {
            event.preventDefault();
            commands.executeVimCommand('ctrl-u');
            return;
          } else if (lower === 'd' && ctrlKey) {
            event.preventDefault();
            commands.executeVimCommand('ctrl-d');
            return;
          } else if (lower === '[' && (ctrlKey || metaKey) && handlers.switchToPrevMap) {
            event.preventDefault();
            handlers.switchToPrevMap();
            return;
          } else if ((lower === 'n' && ctrlKey && handlers.switchToNextMap) ||
                     (lower === ']' && (ctrlKey || metaKey) && handlers.switchToNextMap)) {
            event.preventDefault();
            handlers.switchToNextMap();
            return;
          }
        }

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

        if (key === 'Escape') {
          event.preventDefault();
          if (vim.searchQuery || vim.searchResults.length > 0) {
            vim.exitSearch();
            return;
          }
        }

        if (!mod && !['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(key)) {
          const vimKeys = getVimKeys();
          if (vimKeys.includes(key) || expandedKeysStart.has(key)) {
            event.preventDefault();
            event.stopPropagation();
          }

          const currentBuffer = vim.commandBuffer;
          const currentCount = vim.countBuffer;
          const isDigitInput = /^\d$/.test(key) && !currentBuffer;
          const isValidCountStart = isDigitInput && key !== '0' && !currentCount;
          const isValidCountContinue = isDigitInput && currentCount;

          if (isValidCountStart || isValidCountContinue) {
            vim.appendToCountBuffer(key);
            return;
          }

          // Special handling for 'm' key with count buffer (e.g., "3m" -> ordered list starting with 3)
          if (key === 'm' && currentCount && !currentBuffer) {
            // parseVimSequence expects "3m" format, not "m:3"
            const vimSequence = `${currentCount}m`;
            const numberedResult = parseVimSequence(vimSequence);
            if (numberedResult.isComplete && numberedResult.command) {
              handlers.closeAttachmentAndLinkLists();
              commands.executeVimCommand(numberedResult.command, numberedResult.count);
              vim.clearCountBuffer();
              vim.clearCommandBuffer();
              return;
            }
          }

          const testSequence = currentBuffer + key;
          const complete = expandedEntries.find(([lhs]) => lhs === testSequence);

          if (complete) {
            const [, rhs] = complete;
            try {
              handlers.closeAttachmentAndLinkLists();
              if (commands.isValidCommand(rhs)) {
                commands.execute(rhs);
              } else {
                const seqRes = parseVimSequence(rhs);
                if (seqRes.isComplete && seqRes.command) {
                  commands.executeVimCommand(seqRes.command, seqRes.count);
                } else {
                  commands.execute(rhs);
                }
              }
            } catch {}
            vim.clearCommandBuffer();
            return;
          }

          const hasPartial = expandedEntries.some(([lhs]) => lhs.startsWith(testSequence));
          if (hasPartial) {
            vim.appendToCommandBuffer(key);
            return;
          }

          const result = parseVimSequence(testSequence);
          if (result.isComplete && result.command) {
            handlers.closeAttachmentAndLinkLists();
            const count = vim.hasCount() ? vim.getCount() : result.count;
            commands.executeVimCommand(result.command, count);
            vim.clearCommandBuffer();
            vim.clearCountBuffer();
            return;
          } else if (result.isPartial) {
            vim.appendToCommandBuffer(key);
            return;
          } else if (result.shouldClear) {
            vim.clearCommandBuffer();
          }

          if (key === ':') {
            event.preventDefault();
            event.stopPropagation();
            vim.startCommandLine();
            return;
          }

          const singleKeyResult = parseVimSequence(key);
          if (singleKeyResult.isComplete && singleKeyResult.command) {
            handlers.closeAttachmentAndLinkLists();
            const count = vim.hasCount() ? vim.getCount() : singleKeyResult.count;
            commands.executeVimCommand(singleKeyResult.command, count);
            vim.clearCountBuffer();
            return;
          }
        }
      }
    }

    if (handleStandardShortcut(event, commands, handlers)) return;
  };

  useEventListener('keydown', (e) => handleKeyDown(e as KeyboardEvent), { target: document, capture: true });
  useEventListener('paste', (e) => handlePaste(e as ClipboardEvent), { target: document, capture: true });
};

export default useKeyboardShortcuts;

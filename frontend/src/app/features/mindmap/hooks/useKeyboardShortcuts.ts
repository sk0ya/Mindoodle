
import type { MindMapNode } from '@shared/types';
import type { VimModeHook } from '../../vim/hooks/useVimMode';
import type { Direction, MarkdownNodeType } from '@commands/system/types';
import { useCommands, type UseCommandsReturn } from '@commands/system/useCommands';
import { useMindMapStore } from '../store/mindMapStore';
import { JUMP_CHARS } from '../../vim/constants';
import { useEventListener } from '@shared/hooks/system/useEventListener';

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
  onMarkdownNodeType?: (_nodeId: string, _newType: MarkdownNodeType) => void;
  centerNodeInView?: (_nodeId: string, _animate?: boolean) => void;
  
  switchToPrevMap?: () => void;
  switchToNextMap?: () => void;
}

function handleStandardShortcut(
  event: KeyboardEvent,
  commands: UseCommandsReturn,
  handlers: KeyboardShortcutHandlers
): boolean {
  const { key, ctrlKey, metaKey, shiftKey } = event;
  const isModifier = ctrlKey || metaKey;

  
  if (!isModifier && handlers.selectedNodeId) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
      event.preventDefault();
      const direction = key.replace('Arrow', '').toLowerCase() as Direction;
      commands.execute(`arrow-navigate --direction ${direction}`);
      return true;
    }

    
    if (key === 'Tab') {
      
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


  if (isModifier) {

    switch (key.toLowerCase()) {
      case 'n':
        event.preventDefault();
        commands.execute('switch-map --direction next');
        return true;
    }

    
    if (!handlers.selectedNodeId) {
      return false;
    }
    switch (key.toLowerCase()) {
      case 'c':
        event.preventDefault();
        commands.execute(shiftKey ? 'copy-text' : 'copy');
        return true;
      case 'v':
        
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
      const event = evt; // alias for clarity; expected ClipboardEvent
      try {
        
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

        
        if (!handlers.selectedNodeId) return;

        const dt = event.clipboardData;
        if (!dt) return;


        const items = dt.items || [];
        let imageItem: DataTransferItem | null = null;
        for (let i = 0; i < items.length; i++) {
          const it = items[i];
          if (it && it.kind === 'file' && it.type && it.type.startsWith('image/')) {
            imageItem = it;
            break;
          }
        }

        
        if (!imageItem && dt.files && dt.files.length > 0) {
          for (let i = 0; i < dt.files.length; i++) {
            const f = dt.files[i];
            if (f && f.type && f.type.startsWith('image/')) {
              
              
              
              event.preventDefault();
              await handlers.pasteImageFromClipboard(handlers.selectedNodeId, f as unknown as File);
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
            await handlers.pasteImageFromClipboard(handlers.selectedNodeId, file);
            return;
          }
        }


        event.preventDefault();
        await commands.execute('paste');
      } catch (e) {
        console.warn('Paste primary attempt failed:', e);
        event.preventDefault();
        // Fallback without throwing
        try {
          await commands.execute('paste');
        } catch (fallbackError) {
          console.error('Paste fallback failed:', fallbackError);
        }
      }
    };

  const handleKeyDown = (event: KeyboardEvent) => {
      
      try {
        const activeEl = (document.activeElement as HTMLElement | null);
        const monacoFocused = !!(activeEl && (activeEl.closest('.monaco-editor') || activeEl.classList?.contains('monaco-editor')));
        if (monacoFocused) {
          return; 
        }
      } catch {}
      
      const target = event.target as HTMLElement;
      const isInTextInput = target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true';
      const isInCodeMirrorEditor = target.closest('.cm-editor') !== null;

      if (isInTextInput || isInCodeMirrorEditor) {

        if (handlers.editingNodeId && !isInCodeMirrorEditor && (event.key === 'Enter' || event.key === 'Tab' || event.key === 'Escape')) {
          event.preventDefault();
          handlers.finishEdit(handlers.editingNodeId, handlers.editText).then(() => {
            if (vim && vim.isEnabled) vim.setMode('normal');
          });
          return;
        }

        return;
      }

      const { key, ctrlKey, metaKey, altKey } = event;
      const isModifier = ctrlKey || metaKey;

      
      
      if ((ctrlKey || metaKey) && !altKey && (key === 'b' || key === 'B')) {
        event.preventDefault();
        try {
          const { ui, setActiveView } = useMindMapStore.getState();
          const next = ui?.activeView ? null : 'maps';
          setActiveView(next);
        } catch {}
        return;
      }

      
      if ((ctrlKey || metaKey) && !altKey && event.shiftKey && (key === 'm' || key === 'M')) {
        event.preventDefault();
        commands.execute('toggle-node-note-panel').catch(err => {
          console.warn('toggle-node-note-panel failed', err);
        });
        return;
      }

      
      if ((ctrlKey || metaKey) && !altKey && !event.shiftKey && (key === 'm' || key === 'M')) {
        event.preventDefault();
        commands.execute('toggle-markdown-panel').catch(err => {
          console.warn('toggle-markdown-panel failed', err);
        });
        return;
      }

      
      if (vim && vim.isEnabled && vim.mode === 'search') {
        
        return;
      }

      
      if (vim && vim.isEnabled && vim.mode === 'jumpy') {
        const { key } = event;

        if (key === 'Escape') {
          event.preventDefault();
          vim.exitJumpy();
          return;
        } else if (key === 'Enter' && vim.jumpyBuffer) {
          event.preventDefault();
          
          const exactMatch = vim.jumpyLabels.find(jl => jl.label === vim.jumpyBuffer);
          if (exactMatch) {
            const { selectNode } = useMindMapStore.getState();
            selectNode(exactMatch.nodeId);
            vim.exitJumpy();
          }
          return;
        } else if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          event.preventDefault();
          
          if (JUMP_CHARS.includes(key.toLowerCase())) {
            vim.jumpToNode(key.toLowerCase());
            return;
          }
        }
        return;
      }

      
      if (vim && vim.isEnabled && vim.mode === 'command') {
        
        return;
      }

      
      if (vim && vim.isEnabled && vim.mode === 'normal') {
        
        const { settings } = useMindMapStore.getState();
        const customMap: Record<string, string> = (settings?.vimCustomKeybindings || {});
        let leader: string = (settings?.vimLeader ?? ',');
        if (typeof leader !== 'string' || leader.length !== 1) leader = ',';

        
        const expandLhs = (lhs: string): string => {
          let out = lhs.replace(/<\s*leader\s*>/ig, leader);
          out = out.replace(/<\s*space\s*>/ig, ' ');
          return out;
        };

        
        const expandedEntries = Object.entries(customMap).map(([lhs, cmd]) => [expandLhs(lhs), cmd]);
        const expandedKeysStart = new Set(expandedEntries.map(([lhs]) => (lhs[0] || '')));

        // Handle Ctrl+U and Ctrl+D scroll commands, and map switching with Ctrl+[/]
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

        
        if (!isModifier) {
          
          if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(key)) {
            return;
          }

          
          
          const specialKeyMap: Record<string, string> = {};

          
          const normalizedKey = specialKeyMap[key] || key;

          
          const vimKeys = commands.getVimKeys();
          if (vimKeys.includes(normalizedKey) || expandedKeysStart.has(normalizedKey)) {
            event.preventDefault();
            event.stopPropagation();
          }

          
          

          
          
          
          const currentBuffer = vim.commandBuffer;
          const currentCount = vim.countBuffer;

          const isDigitInput = /^\d$/.test(normalizedKey) && !currentBuffer;
          const isValidCountStart = isDigitInput && normalizedKey !== '0' && !currentCount;
          const isValidCountContinue = isDigitInput && currentCount;

          if (isValidCountStart || isValidCountContinue) {
            vim.appendToCountBuffer(normalizedKey);
            return;
          }

          
          const testSequence = currentBuffer + normalizedKey;

          
          const complete = expandedEntries.find(([lhs]) => lhs === testSequence);
          if (complete) {
            const [, rhs] = complete;
            try {
              handlers.closeAttachmentAndLinkLists();
              
              const isCmd = commands.isValidCommand(rhs);
              if (isCmd) {
                commands.execute(rhs);
              } else {
                const seqRes = commands.parseVimSequence(rhs);
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
            vim.appendToCommandBuffer(normalizedKey);
            return;
          }

          
          const result = commands.parseVimSequence(testSequence);

          if (result.isComplete && result.command) {
            
            handlers.closeAttachmentAndLinkLists();
            
            const count = vim.hasCount() ? vim.getCount() : result.count;
            commands.executeVimCommand(result.command, count);
            vim.clearCommandBuffer();
            vim.clearCountBuffer(); 
            return;
          } else if (result.isPartial) {
            
            vim.appendToCommandBuffer(normalizedKey);
            return;
          } else if (result.shouldClear) {
            
            vim.clearCommandBuffer();
          }

          
          if (normalizedKey === ':') {
            event.preventDefault();
            event.stopPropagation();
            vim.startCommandLine();
            return;
          }

          
          const singleKeyResult = commands.parseVimSequence(normalizedKey);
          if (singleKeyResult.isComplete && singleKeyResult.command) {
            handlers.closeAttachmentAndLinkLists();
            
            const count = vim.hasCount() ? vim.getCount() : singleKeyResult.count;
            commands.executeVimCommand(singleKeyResult.command, count);
            vim.clearCountBuffer(); 
            return;
          }
        }
      }


      if (handleStandardShortcut(event, commands, handlers)) {
        return;
      }
    };

  
  useEventListener('keydown', (e) => handleKeyDown(e as KeyboardEvent), { target: document, capture: true });
  useEventListener('paste', (e) => handlePaste(e as ClipboardEvent), { target: document, capture: true });
};

export default useKeyboardShortcuts;

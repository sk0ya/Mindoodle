
import { useCallback, useMemo } from 'react';
import type {
  CommandContext,
  CommandResult,
  ParseResult,
  ExecuteOptions,
  MarkdownNodeType
} from './types';
import { parseCommand, validateCommand, generateSuggestions } from './parser';
import { CommandRegistryImpl } from './registry';
import { registerAllCommands } from '../registerCommands';
import { logger } from '@shared/utils';
import { useMindMapStore } from '@mindmap/store';
import type { VimModeHook } from '@vim/hooks/useVimMode';
import type { MindMapNode } from '@shared/types';

interface UseCommandsProps {
  selectedNodeId: string | null;
  editingNodeId: string | null;
  vim?: VimModeHook;
  handlers: {
    
    updateNode: (id: string, updates: Partial<MindMapNode>) => void;
    deleteNode: (id: string) => void;
    findNodeById: (nodeId: string) => MindMapNode | null;

    
    centerNodeInView?: (nodeId: string, animate?: boolean) => void;
    navigateToDirection: (direction: 'up' | 'down' | 'left' | 'right') => void;
    selectNode: (nodeId: string | null) => void;
    setPan?: (pan: { x: number; y: number } | ((prev: { x: number; y: number }) => { x: number; y: number })) => void;

    
    startEdit: (nodeId: string) => void;
    startEditWithCursorAtStart: (nodeId: string) => void;
    startEditWithCursorAtEnd: (nodeId: string) => void;

    
    addChildNode: (parentId: string, text?: string, startEditing?: boolean) => Promise<string | null>;
    addSiblingNode: (nodeId: string, text?: string, startEditing?: boolean, insertAfter?: boolean) => Promise<string | null>;
    changeSiblingOrder?: (draggedNodeId: string, targetNodeId: string, insertBefore?: boolean) => void;

    
    copyNode: (nodeId: string) => void;
    pasteNode: (parentId: string) => Promise<void>;
    pasteImageFromClipboard: (nodeId: string) => Promise<void>;

    
    undo: () => void;
    redo: () => void;
    canUndo: boolean;
    canRedo: boolean;

    
    showKeyboardHelper: boolean;
    setShowKeyboardHelper: (show: boolean) => void;
    showMapList: boolean;
    setShowMapList: (show: boolean) => void;
    showLocalStorage: boolean;
    setShowLocalStorage: (show: boolean) => void;
    showTutorial: boolean;
    setShowTutorial: (show: boolean) => void;

    
    closeAttachmentAndLinkLists: () => void;


    onMarkdownNodeType?: (nodeId: string, newType: MarkdownNodeType, options?: { isCheckbox?: boolean; isChecked?: boolean }) => void;


    switchToNextMap?: () => void;
    switchToPrevMap?: () => void;
  };
}

export interface UseCommandsReturn {
  execute: (commandString: string, options?: ExecuteOptions) => Promise<CommandResult>;
  parse: (commandString: string) => ParseResult;
  getAvailableCommands: () => string[];
  getSuggestions: (partialInput: string) => string[];
  getHelp: (commandName?: string) => string;
  isValidCommand: (commandName: string) => boolean;
  executeVimCommand: (vimKey: string, count?: number) => Promise<CommandResult>;
  registry: CommandRegistryImpl;
  context: CommandContext;
}

export function useCommands(props: UseCommandsProps): UseCommandsReturn {
  const { selectedNodeId, editingNodeId, vim, handlers } = props;

  
  const registry = useMemo(() => {
    const reg = new CommandRegistryImpl();

    registerAllCommands(reg);

    return reg;
  }, []);

  
  const uiStore = useMindMapStore();
  const context = useMemo((): CommandContext => {
    const cleanHandlers = handlers as CommandContext['handlers'];

    const base = {
      selectedNodeId,
      editingNodeId,
      handlers: cleanHandlers,
      mode: uiStore?.ui?.mode,
      openPanels: uiStore?.ui?.openPanels
    } as CommandContext;
    if (vim !== undefined) {
      base.vim = vim;
    }
    return base;
  }, [selectedNodeId, editingNodeId, vim, handlers, uiStore]);

  const parse = useCallback((commandString: string) => parseCommand(commandString), []);

  
  const execute = useCallback(async (
    commandString: string,
    options: ExecuteOptions = {}
  ): Promise<CommandResult> => {
    try {
      
      const parseResult = parseCommand(commandString);
      if (!parseResult.success || !parseResult.command) {
        return {
          success: false,
          error: parseResult.error || 'Failed to parse command'
        };
      }

      
      const command = registry.get(parseResult.command.name);
      if (!command) {
        const suggestions = generateSuggestions(parseResult.command.name, registry.getAll());
        return {
          success: false,
          error: `Command '${parseResult.command.name}' not found${
            suggestions.length > 0 ? `. Did you mean: ${suggestions.slice(0, 3).join(', ')}?` : ''
          }`
        };
      }

      
      const validationResult = validateCommand(parseResult.command, command);
      if (!validationResult.success || !validationResult.command) {
        return {
          success: false,
          error: validationResult.error || 'Command validation failed'
        };
      }

      
      if (options.dryRun) {
        return {
          success: true,
          message: `Would execute: ${command.name} with args: ${JSON.stringify(validationResult.command.args)}`
        };
      }

      
      const result = await registry.execute(command.name, context, validationResult.command.args);

      if (options.verbose && result.success) {
        logger.debug(`Command executed: ${commandString}`, result);
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error executing command'
      };
    }
  }, [context, registry]);

  
  const executeVimCommand = useCallback(async (vimKey: string, count?: number): Promise<CommandResult> => {
    
    if (vimKey === '.') {
      if (!vim) {
        return { success: false, error: 'Vim mode not available' };
      }
      const repeatRegistry = vim.getRepeatRegistry();
      const lastChange = repeatRegistry.getLastChange();

      if (!lastChange) {
        return { success: false, error: 'No previous change to repeat' };
      }

      
      const repeatCount = count ?? lastChange.count;
      const contextWithCount = { ...context, count: repeatCount };

      const command = registry.get(lastChange.commandName);
      if (!command) {
        return { success: false, error: `Command not found: ${lastChange.commandName}` };
      }

      const result = await registry.execute(lastChange.commandName, contextWithCount, {});
      return result;
    }

    
    
    if (/^m:\d+$/.test(vimKey)) {
      try {
        const num = parseInt(vimKey.split(':')[1], 10);
        if (!selectedNodeId) {
          return { success: false, error: 'No node selected' };
        }

        const node = handlers.findNodeById?.(selectedNodeId);
        if (!node) {
          return { success: false, error: 'Selected node not found' };
        }

        // Calculate level based on parent
        let level = 1;
        let indentLevel = 0;

        // Get parent node to calculate proper level
        try {
          const roots: MindMapNode[] = useMindMapStore.getState?.().data?.rootNodes || [];
          const findParent = (list: MindMapNode[], targetId: string, parent: MindMapNode | null = null): MindMapNode | null => {
            for (const n of list) {
              if (n.id === targetId) return parent;
              if (n.children?.length) {
                const p = findParent(n.children, targetId, n);
                if (p) return p;
              }
            }
            return null;
          };
          const parent = findParent(roots, selectedNodeId);
          if (parent?.markdownMeta && (parent.markdownMeta.type === 'ordered-list' || parent.markdownMeta.type === 'unordered-list')) {
            level = Math.max((parent.markdownMeta.level || 1) + 1, 1);
            indentLevel = Math.max(level - 1, 0) * 2;
          }
        } catch { /* ignore */ }

        const newMeta = {
          type: 'ordered-list' as const,
          level,
          originalFormat: `${Math.max(1, num)}.`,
          indentLevel,
          lineNumber: node.markdownMeta?.lineNumber ?? 0
        };

        // Update node with new metadata
        handlers.updateNode(selectedNodeId, { markdownMeta: newMeta });

        // Trigger store update to sync with markdown
        const store = useMindMapStore.getState();
        if (store.data?.rootNodes) {
          store.setRootNodes(store.data.rootNodes, { emit: true, source: 'vim-ordered-list-conversion' });
        }

        return { success: true, message: `Converted to ${num}. ordered list` };
      } catch (e) {
        console.error('[DEBUG useCommands] Error:', e);
        return { success: false, error: e instanceof Error ? e.message : 'Failed to set ordered number' };
      }
    }

    
    
    if (vimKey === '/' && vim) {
      vim.startSearch();
      return { success: true };
    }

    if (vimKey === 'n' && vim && vim.mode === 'normal') {
      vim.nextSearchResult();
      return { success: true };
    }

    if (vimKey === 'N' && vim && vim.mode === 'normal') {
      vim.previousSearchResult();
      return { success: true };
    }

    if (vimKey === 's' && vim && vim.mode === 'normal') {
      vim.startJumpy();
      return { success: true };
    }

    const vimCommandMap: Record<string, string> = {
      'zz': 'center',
      'zt': 'center-left',
      'dd': 'cut',
      'yy': 'copy',
      'za': 'toggle',
      'zo': 'expand',
      'zc': 'collapse',
      'zR': 'expand-all',
      'zM': 'collapse-all',
      'gg': 'select-root',
      'gt': 'next-map',
      'gT': 'prev-map',
      'gv': 'show-knowledge-graph',
      'ctrl-u': 'scroll-up',
      'ctrl-d': 'scroll-down',
      'r': 'redo',      
      'ciw': 'edit',
      'i': 'append',        
      'a': 'add-child',     
      'A': 'append-end',
      'I': 'insert',        
      'o': 'open',
      'O': 'open-above',
      'X': 'insert-checkbox-child',  
      'h': 'left',
      'j': 'down',
      'k': 'up',
      'l': 'right',
      'p': 'paste-sibling-after',
      'P': 'paste-sibling-before',
      'tab': 'add-child',
      'enter': 'add-sibling',
      'm': 'convert',
      'M': 'select-center',
      'G': 'select-bottom',
      '0': 'select-current-root',
      'delete': 'delete',
      'backspace': 'delete',
      'x': 'toggle-checkbox',
      'u': 'undo',          
      '>>': 'move-as-child-of-sibling',
      '<<': 'move-as-next-sibling-of-parent',
      
      'S': 'toggle-strikethrough',  
      'B': 'toggle-bold',           
      '~': 'toggle-italic'          
    };

    const commandName = vimCommandMap[vimKey];

    if (!commandName) {
      return {
        success: false,
        error: `Unknown vim command: ${vimKey}`
      };
    }

    
    const contextWithCount = count ? { ...context, count } : context;

    
    const command = registry.get(commandName);
    if (!command) {
      return {
        success: false,
        error: `Command not found: ${commandName}`
      };
    }

    
    const result = await registry.execute(commandName, contextWithCount, {});

    
    if (result.success && command.repeatable && vim) {
      const repeatRegistry = vim.getRepeatRegistry();
      repeatRegistry.record({
        commandName,
        count: count ?? 1,
        context: {
          selectedNodeId: context.selectedNodeId,
          editingNodeId: context.editingNodeId
        }
      });
    }

    return result;
  }, [vim, context, registry, selectedNodeId, handlers]);

  const getAvailableCommands = useCallback(() => registry.getAvailableNames(), [registry]);
  const getSuggestions = useCallback((partialInput: string) => generateSuggestions(partialInput, registry.getAll()), [registry]);
  const getHelp = useCallback((commandName?: string) => registry.getHelp(commandName), [registry]);
  const isValidCommand = useCallback((commandName: string) => registry.get(commandName) !== undefined, [registry]);

  return {
    execute,
    parse,
    getAvailableCommands,
    getSuggestions,
    getHelp,
    isValidCommand,
    executeVimCommand,
    registry,
    context
  };
}

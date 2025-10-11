
import type { Command, CommandContext, CommandResult } from '../system/types';
import type { MindMapNode } from '@shared/types';
import { useMindMapStore } from '@mindmap/store';
import { isMindMeisterFormat, parseMindMeisterMarkdown } from '../../features/markdown';

type StoreState = ReturnType<typeof useMindMapStore.getState>;
type ExtendedStoreState = StoreState & {
  beginHistoryGroup?: (_group: string) => void;
  endHistoryGroup?: (_success: boolean) => void;
  ui?: { clipboard?: MindMapNode };
  _pasteInProgress?: boolean;
};


export const undoCommand: Command = {
  name: 'undo',
  aliases: ['u'],
  description: 'Undo the last operation',
  category: 'editing',
  examples: ['undo', 'u'],

  execute(context: CommandContext): CommandResult {
    if (!context.handlers.canUndo) {
      return {
        success: false,
        error: 'Nothing to undo'
      };
    }

    try {
      context.handlers.undo();
      return {
        success: true,
        message: 'Undid last operation'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to undo'
      };
    }
  }
};


export const redoCommand: Command = {
  name: 'redo',
  aliases: ['r'],
  description: 'Redo the last undone operation',
  category: 'editing',
  examples: ['redo', 'r'],

  execute(context: CommandContext): CommandResult {
    if (!context.handlers.canRedo) {
      return {
        success: false,
        error: 'Nothing to redo'
      };
    }

    try {
      context.handlers.redo();
      return {
        success: true,
        message: 'Redid last operation'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to redo'
      };
    }
  }
};


export const copyCommand: Command = {
  name: 'copy',
  aliases: ['c'],
  description: 'Copy the selected node',
  category: 'editing',
  examples: ['copy', 'c', 'copy node-123'],
  args: [
    {
      name: 'nodeId',
      type: 'node-id',
      required: false,
      description: 'Node ID to copy (uses selected node if not specified)'
    }
  ],

  execute(context: CommandContext, args: Record<string, unknown>): CommandResult {
    const nodeId = (args as Record<string, string | undefined>)['nodeId'] || context.selectedNodeId;

    if (!nodeId) {
      return {
        success: false,
        error: 'No node selected and no node ID provided'
      };
    }

    const node = context.handlers.findNodeById(nodeId);
    if (!node) {
      return {
        success: false,
        error: `Node ${nodeId} not found`
      };
    }

    try {
      context.handlers.copyNode(nodeId);
      return {
        success: true,
        message: `Copied node "${node.text}"`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to copy node'
      };
    }
  },
  repeatable: true,
  countable: false  
};


export const pasteCommand: Command = {
  name: 'paste',
  aliases: ['v'],
  description: 'Paste copied node as child',
  category: 'editing',
  examples: ['paste', 'v', 'paste node-123'],
  args: [
    {
      name: 'targetId',
      type: 'node-id',
      required: false,
      description: 'Target node ID to paste into (uses selected node if not specified)'
    }
  ],

  async execute(context: CommandContext, args: Record<string, unknown>): Promise<CommandResult> {
    const targetId = (args as Record<string, string | undefined>)['targetId'] || context.selectedNodeId;

    if (!targetId) {
      return {
        success: false,
        error: 'No node selected and no target ID provided'
      };
    }

    const targetNode = context.handlers.findNodeById(targetId);
    if (!targetNode) {
      return {
        success: false,
        error: `Target node ${targetId} not found`
      };
    }

    try {
      
      await context.handlers.pasteNode(targetId);
      return {
        success: true,
        message: `Pasted as child of "${targetNode.text}"`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to paste'
      };
    }
  }
};

async function pasteTreeAsSibling(
  source: MindMapNode,
  refNodeId: string,
  insertAfter: boolean,
  context: CommandContext
): Promise<string | null> {
  
  const rootId = await context.handlers.addSiblingNode(refNodeId, source.text, false, insertAfter);
  if (!rootId) return null;

  
  context.handlers.updateNode(rootId, {
    fontSize: source.fontSize,
    fontWeight: source.fontWeight,
    color: source.color,
    collapsed: false,
    note: source.note,
    markdownMeta: source.markdownMeta
  });

  
  const addChildSync = async (parentId: string, text: string): Promise<string | undefined> => {
    const result = await context.handlers.addChildNode(parentId, text, false);
    return result || undefined;
  };

  
  const pasteSubtreeSync = async (node: MindMapNode, parentId: string): Promise<void> => {
    const newId = await addChildSync(parentId, node.text);
    if (!newId) return;

    context.handlers.updateNode(newId, {
      fontSize: node.fontSize,
      fontWeight: node.fontWeight,
      color: node.color,
      collapsed: false,
      note: node.note,
      markdownMeta: node.markdownMeta
    });

    
    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        await pasteSubtreeSync(child, newId);
      }
    }
  };

  
  if (source.children && source.children.length > 0) {
    for (const child of source.children) {
      await pasteSubtreeSync(child, rootId);
    }
  }

  return rootId;
}

export const pasteSiblingAfterCommand: Command = {
  name: 'paste-sibling-after',
  description: 'Paste as younger sibling (after selected node)',
  category: 'editing',
  examples: ['paste-sibling-after'],

  async execute(context: CommandContext): Promise<CommandResult> {

    const refNodeId = context.selectedNodeId;
    if (!refNodeId) {
      return { success: false, error: 'No node selected' };
    }
    const refNode = context.handlers.findNodeById(refNodeId);
    if (!refNode) {
      return { success: false, error: `Reference node ${refNodeId} not found` };
    }


    try {
      useMindMapStore.setState({ _pasteInProgress: true } as Partial<StoreState>);
      const state = useMindMapStore.getState() as ExtendedStoreState;
      state.beginHistoryGroup?.('paste');
    } catch {}


    const uiClipboard: MindMapNode | null = ((): MindMapNode | null => {
      try {
        const state = useMindMapStore.getState() as ExtendedStoreState;
        return state?.ui?.clipboard || null;
      } catch { return null; }
    })();

    
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const clipboardText = await navigator.clipboard.readText();
        if (clipboardText && clipboardText.trim()) {
          
          if (uiClipboard) {
            const newId = await pasteTreeAsSibling(uiClipboard, refNodeId, true, context);
            if (newId) {
              context.handlers.selectNode(newId);
              
              try {
                const state = useMindMapStore.getState() as ExtendedStoreState;
                state.endHistoryGroup?.(true);
                useMindMapStore.setState({ _pasteInProgress: false } as Partial<StoreState>);
              } catch {}
              return { success: true, message: `Pasted as sibling after "${refNode.text}"` };
            }
            
            try {
              const state = useMindMapStore.getState() as ExtendedStoreState;
              state.endHistoryGroup?.(false);
              useMindMapStore.setState({ _pasteInProgress: false } as Partial<StoreState>);
            } catch {}
            return { success: false, error: 'Failed to paste (sibling-after)' };
          }

          
          if (isMindMeisterFormat(clipboardText)) {
            const parsed = parseMindMeisterMarkdown(clipboardText);
            if (parsed) {
              const newId = await pasteTreeAsSibling(parsed, refNodeId, true, context);
              if (newId) {
                context.handlers.selectNode(newId);
                
                try {
                  const state = useMindMapStore.getState() as ExtendedStoreState;
                  useMindMapStore.setState({ _pasteInProgress: false } as Partial<StoreState>);
                  state.endHistoryGroup?.(true);
                } catch {}
                return { success: true, message: `Pasted MindMeister as sibling after "${refNode.text}"` };
              }
            }
          }

          
          const lines = clipboardText.split(/\r\n|\r|\n/)
            .map(l => {
              const t = l.trim();
              if (t.startsWith('#')) {
                let i = 0;
                while (i < t.length && i < 6 && t.charAt(i) === '#') i++;
                if (i > 0 && t.charAt(i) === ' ') return t.slice(i + 1);
              }
              return t;
            })
            .filter(l => l.length > 0);
          if (lines.length > 0) {
            let anchorId = refNodeId;
            let lastId: string | null = null;
            for (const line of lines) {
              const nid = await context.handlers.addSiblingNode(anchorId, line, false, true);
              if (nid) {
                lastId = nid;
                anchorId = nid; 
              }
            }
            if (lastId) {
              context.handlers.selectNode(lastId);
              const msg = lines.length === 1 ? `Pasted "${lines[0]}" as sibling after` : `Pasted ${lines.length} lines as siblings after`;
              
              try {
                const state = useMindMapStore.getState() as ExtendedStoreState;
                state.endHistoryGroup?.(true);
                useMindMapStore.setState({ _pasteInProgress: false } as Partial<StoreState>);
              } catch {}
              return { success: true, message: `${msg} "${refNode.text}"` };
            }
          }
        }
      }
    } catch (e) { console.warn('paste-sibling-after: clipboard read failed', e); }

    
    if (uiClipboard) {
      const newId = await pasteTreeAsSibling(uiClipboard, refNodeId, true, context);
      if (newId) {
        context.handlers.selectNode(newId);
        
        try {
          const state = useMindMapStore.getState() as ExtendedStoreState;
          useMindMapStore.setState({ _pasteInProgress: false } as Partial<StoreState>);
          state.endHistoryGroup?.(true);
        } catch {}
        return { success: true, message: `Pasted as sibling after "${refNode.text}"` };
      }
    }

    
    try {
      const state = useMindMapStore.getState() as ExtendedStoreState;
      state.endHistoryGroup?.(false);
      useMindMapStore.setState({ _pasteInProgress: false } as Partial<StoreState>);
    } catch {}
    return { success: false, error: 'Clipboard is empty' };
  },
  repeatable: true,
  countable: false
};

export const pasteSiblingBeforeCommand: Command = {
  name: 'paste-sibling-before',
  description: 'Paste as elder sibling (before selected node)',
  category: 'editing',
  examples: ['paste-sibling-before'],

  async execute(context: CommandContext): Promise<CommandResult> {
    
    const refNodeId = context.selectedNodeId;
    if (!refNodeId) {
      return { success: false, error: 'No node selected' };
    }
    const refNode = context.handlers.findNodeById(refNodeId);
    if (!refNode) {
      return { success: false, error: `Reference node ${refNodeId} not found` };
    }

    
    try {
      useMindMapStore.setState({ _pasteInProgress: true } as Partial<StoreState>);
      const state = useMindMapStore.getState() as ExtendedStoreState;
      state.beginHistoryGroup?.('paste');
    } catch {}

    const uiClipboard: MindMapNode | null = ((): MindMapNode | null => {
      try {
        const state = useMindMapStore.getState() as ExtendedStoreState;
        return state?.ui?.clipboard || null;
      } catch { return null; }
    })();

    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const clipboardText = await navigator.clipboard.readText();
        if (clipboardText && clipboardText.trim()) {
          
          if (uiClipboard) {
            const newId = await pasteTreeAsSibling(uiClipboard, refNodeId, false, context);
            if (newId) {
              context.handlers.selectNode(newId);
              
              try {
                const state = useMindMapStore.getState() as ExtendedStoreState;
                state.endHistoryGroup?.(true);
                useMindMapStore.setState({ _pasteInProgress: false } as Partial<StoreState>);
              } catch {}
              return { success: true, message: `Pasted as sibling before "${refNode.text}"` };
            }
            
            try {
              const state = useMindMapStore.getState() as ExtendedStoreState;
              state.endHistoryGroup?.(false);
              useMindMapStore.setState({ _pasteInProgress: false } as Partial<StoreState>);
            } catch {}
            return { success: false, error: 'Failed to paste (sibling-before)' };
          }

          if (isMindMeisterFormat(clipboardText)) {
            const parsed = parseMindMeisterMarkdown(clipboardText);
            if (parsed) {
              const newId = await pasteTreeAsSibling(parsed, refNodeId, false, context);
              if (newId) {
                context.handlers.selectNode(newId);
                
                try {
                  const state = useMindMapStore.getState() as ExtendedStoreState;
                  useMindMapStore.setState({ _pasteInProgress: false } as Partial<StoreState>);
                  state.endHistoryGroup?.(true);
                } catch {}
                return { success: true, message: `Pasted MindMeister as sibling before "${refNode.text}"` };
              }
            }
          }

          
          const lines = clipboardText.split(/\r\n|\r|\n/)
            .map(l => {
              const t = l.trim();
              if (t.startsWith('#')) {
                let i = 0;
                while (i < t.length && i < 6 && t.charAt(i) === '#') i++;
                if (i > 0 && t.charAt(i) === ' ') return t.slice(i + 1);
              }
              return t;
            })
            .filter(l => l.length > 0);
          if (lines.length > 0) {
            let lastId: string | null = null;
            for (let i = lines.length - 1; i >= 0; i--) {
              const line = lines[i];
              const nid = await context.handlers.addSiblingNode(refNodeId, line, false, false);
              if (nid) {
                lastId = nid; 
              }
            }
            if (lastId) {
              context.handlers.selectNode(lastId);
              const msg = lines.length === 1 ? `Pasted "${lines[0]}" as sibling before` : `Pasted ${lines.length} lines as siblings before`;
              
              try {
                const state = useMindMapStore.getState() as ExtendedStoreState;
                state.endHistoryGroup?.(true);
                useMindMapStore.setState({ _pasteInProgress: false } as Partial<StoreState>);
              } catch {}
              return { success: true, message: `${msg} "${refNode.text}"` };
            }
          }
        }
      }
    } catch (e) { console.warn('paste-sibling-before: clipboard read failed', e); }

    if (uiClipboard) {
      const newId = await pasteTreeAsSibling(uiClipboard, refNodeId, false, context);
      if (newId) {
        context.handlers.selectNode(newId);
        
        try {
          const state = useMindMapStore.getState() as ExtendedStoreState;
          useMindMapStore.setState({ _pasteInProgress: false } as Partial<StoreState>);
          state.endHistoryGroup?.(true);
        } catch {}
        return { success: true, message: `Pasted as sibling before "${refNode.text}"` };
      }
    }

    
    try {
      const state = useMindMapStore.getState() as ExtendedStoreState;
      state.endHistoryGroup?.(false);
      useMindMapStore.setState({ _pasteInProgress: false } as Partial<StoreState>);
    } catch {}
    return { success: false, error: 'Clipboard is empty' };
  },
  repeatable: true,
  countable: false
};

export const addWorkspaceCommand: Command = {
  name: 'addworkspace',
  aliases: ['workspace-add', 'ws-add'],
  description: 'Add a new workspace by selecting a folder',
  category: 'utility',
  examples: ['addworkspace', 'workspace-add'],

  async execute(): Promise<CommandResult> {
    try {
      
      const addWorkspaceFn = (window as Window & { mindoodleAddWorkspace?: () => Promise<void> }).mindoodleAddWorkspace;
      if (typeof addWorkspaceFn !== 'function') {
        return {
          success: false,
          error: 'Workspace functionality not available'
        };
      }

      await addWorkspaceFn();
      return {
        success: true,
        message: 'New workspace added successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add workspace'
      };
    }
  }
};

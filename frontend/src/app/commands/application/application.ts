/**
 * Application Commands
 * Core application-level operations (undo, redo, copy, paste)
 */

import type { Command, CommandContext, CommandResult } from '../system/types';
import type { MindMapNode } from '@shared/types';
import { useMindMapStore } from '@mindmap/store';
import { isMindMeisterFormat, parseMindMeisterMarkdown } from '../../features/markdown';

// Undo command
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

// Redo command
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

// Copy node command
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

  execute(context: CommandContext, args: Record<string, any>): CommandResult {
    const nodeId = (args as any)['nodeId'] || context.selectedNodeId;

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
  countable: false  // Copy doesn't use count
};

// Paste command
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

  async execute(context: CommandContext, args: Record<string, any>): Promise<CommandResult> {
    const targetId = (args as any)['targetId'] || context.selectedNodeId;

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
      // Try to paste node content as child node (vim-like behavior)
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

/**
 * Paste as sibling helper (internal)
 * Reuses pasteNodeTree for children to ensure consistent tree structure
 */
async function pasteTreeAsSibling(
  source: MindMapNode,
  refNodeId: string,
  insertAfter: boolean,
  context: CommandContext
): Promise<string | null> {
  // Add root as sibling relative to reference node
  const rootId = await context.handlers.addSiblingNode(refNodeId, source.text, false, insertAfter);
  if (!rootId) return null;

  // Copy basic styles/metadata
  context.handlers.updateNode(rootId, {
    fontSize: source.fontSize,
    fontWeight: source.fontWeight,
    color: source.color,
    collapsed: false,
    note: source.note,
    markdownMeta: source.markdownMeta
  });

  // Wrapper to unwrap Promise from async addChildNode
  const addChildSync = async (parentId: string, text: string): Promise<string | undefined> => {
    const result = await context.handlers.addChildNode(parentId, text, false);
    return result || undefined;
  };

  // Recursively paste children using the same pattern as pasteNodeTree
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

    // Recursively paste all children
    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        await pasteSubtreeSync(child, newId);
      }
    }
  };

  // Paste all children of the source node
  if (source.children && source.children.length > 0) {
    for (const child of source.children) {
      await pasteSubtreeSync(child, rootId);
    }
  }

  return rootId;
}

/**
 * Paste as younger sibling (vim 'p')
 */
export const pasteSiblingAfterCommand: Command = {
  name: 'paste-sibling-after',
  description: 'Paste as younger sibling (after selected node)',
  category: 'editing',
  examples: ['paste-sibling-after'],

  async execute(context: CommandContext): Promise<CommandResult> {
    // Early validation before setting flags
    const refNodeId = context.selectedNodeId;
    if (!refNodeId) {
      return { success: false, error: 'No node selected' };
    }
    const refNode = context.handlers.findNodeById(refNodeId);
    if (!refNode) {
      return { success: false, error: `Reference node ${refNodeId} not found` };
    }

    // Begin history group for paste operation and set paste flag
    try {
      useMindMapStore.setState({ _pasteInProgress: true } as any);
      (useMindMapStore.getState() as any).beginHistoryGroup?.('paste');
    } catch {}

    // Get internal UI clipboard node
    const uiClipboard: MindMapNode | null = ((): MindMapNode | null => {
      try {
        return (useMindMapStore.getState() as any)?.ui?.clipboard || null;
      } catch { return null; }
    })();

    // Try system clipboard text first
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const clipboardText = await navigator.clipboard.readText();
        if (clipboardText && clipboardText.trim()) {
          // If we have internal clipboard with structure, prefer it over plain text
          if (uiClipboard) {
            const newId = await pasteTreeAsSibling(uiClipboard, refNodeId, true, context);
            if (newId) {
              context.handlers.selectNode(newId);
              // End history group and commit, clear paste flag
              try {
                (useMindMapStore.getState() as any).endHistoryGroup?.(true);
                useMindMapStore.setState({ _pasteInProgress: false } as any);
              } catch {}
              return { success: true, message: `Pasted as sibling after "${refNode.text}"` };
            }
            // End history group without commit on error, clear paste flag
            try {
              (useMindMapStore.getState() as any).endHistoryGroup?.(false);
              useMindMapStore.setState({ _pasteInProgress: false } as any);
            } catch {}
            return { success: false, error: 'Failed to paste (sibling-after)' };
          }

          // MindMeister markdown format
          if (isMindMeisterFormat(clipboardText)) {
            const parsed = parseMindMeisterMarkdown(clipboardText);
            if (parsed) {
              const newId = await pasteTreeAsSibling(parsed, refNodeId, true, context);
              if (newId) {
                context.handlers.selectNode(newId);
                // End history group and commit, clear paste flag
                try {
                  const state: any = useMindMapStore.getState();
                  state._pasteInProgress = false;
                  state.endHistoryGroup?.(true);
                } catch {}
                return { success: true, message: `Pasted MindMeister as sibling after "${refNode.text}"` };
              }
            }
          }

          // Plain text lines: create consecutive younger siblings
          const lines = clipboardText.split(/\r\n|\r|\n/)
            .map(l => {
              const t = l.trim();
              const m = t.match(/^#{1,6}\s+(.+)$/);
              return m ? m[1] : t;
            })
            .filter(l => l.length > 0);
          if (lines.length > 0) {
            let anchorId = refNodeId;
            let lastId: string | null = null;
            for (const line of lines) {
              const nid = await context.handlers.addSiblingNode(anchorId, line, false, true);
              if (nid) {
                lastId = nid;
                anchorId = nid; // chain so order is preserved after each inserted sibling
              }
            }
            if (lastId) {
              context.handlers.selectNode(lastId);
              const msg = lines.length === 1 ? `Pasted "${lines[0]}" as sibling after` : `Pasted ${lines.length} lines as siblings after`;
              // End history group and commit, clear paste flag
              try {
                (useMindMapStore.getState() as any).endHistoryGroup?.(true);
                useMindMapStore.setState({ _pasteInProgress: false } as any);
              } catch {}
              return { success: true, message: `${msg} "${refNode.text}"` };
            }
          }
        }
      }
    } catch { /* ignore clipboard errors, fallback to UI clipboard */ }

    // Fallback: use internal clipboard tree
    if (uiClipboard) {
      const newId = await pasteTreeAsSibling(uiClipboard, refNodeId, true, context);
      if (newId) {
        context.handlers.selectNode(newId);
        // End history group and commit, clear paste flag
        try {
          const state: any = useMindMapStore.getState();
          state._pasteInProgress = false;
          state.endHistoryGroup?.(true);
        } catch {}
        return { success: true, message: `Pasted as sibling after "${refNode.text}"` };
      }
    }

    // End history group without commit on error, clear paste flag
    try {
      (useMindMapStore.getState() as any).endHistoryGroup?.(false);
      useMindMapStore.setState({ _pasteInProgress: false } as any);
    } catch {}
    return { success: false, error: 'Clipboard is empty' };
  },
  repeatable: true,
  countable: false
};

/**
 * Paste as elder sibling (vim 'P')
 */
export const pasteSiblingBeforeCommand: Command = {
  name: 'paste-sibling-before',
  description: 'Paste as elder sibling (before selected node)',
  category: 'editing',
  examples: ['paste-sibling-before'],

  async execute(context: CommandContext): Promise<CommandResult> {
    // Early validation before setting flags
    const refNodeId = context.selectedNodeId;
    if (!refNodeId) {
      return { success: false, error: 'No node selected' };
    }
    const refNode = context.handlers.findNodeById(refNodeId);
    if (!refNode) {
      return { success: false, error: `Reference node ${refNodeId} not found` };
    }

    // Begin history group for paste operation and set paste flag
    try {
      useMindMapStore.setState({ _pasteInProgress: true } as any);
      (useMindMapStore.getState() as any).beginHistoryGroup?.('paste');
    } catch {}

    const uiClipboard: MindMapNode | null = ((): MindMapNode | null => {
      try {
        return (useMindMapStore.getState() as any)?.ui?.clipboard || null;
      } catch { return null; }
    })();

    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const clipboardText = await navigator.clipboard.readText();
        if (clipboardText && clipboardText.trim()) {
          // If we have internal clipboard with structure, prefer it over plain text
          if (uiClipboard) {
            const newId = await pasteTreeAsSibling(uiClipboard, refNodeId, false, context);
            if (newId) {
              context.handlers.selectNode(newId);
              // End history group and commit, clear paste flag
              try {
                (useMindMapStore.getState() as any).endHistoryGroup?.(true);
                useMindMapStore.setState({ _pasteInProgress: false } as any);
              } catch {}
              return { success: true, message: `Pasted as sibling before "${refNode.text}"` };
            }
            // End history group without commit on error, clear paste flag
            try {
              (useMindMapStore.getState() as any).endHistoryGroup?.(false);
              useMindMapStore.setState({ _pasteInProgress: false } as any);
            } catch {}
            return { success: false, error: 'Failed to paste (sibling-before)' };
          }

          if (isMindMeisterFormat(clipboardText)) {
            const parsed = parseMindMeisterMarkdown(clipboardText);
            if (parsed) {
              const newId = await pasteTreeAsSibling(parsed, refNodeId, false, context);
              if (newId) {
                context.handlers.selectNode(newId);
                // End history group and commit, clear paste flag
                try {
                  const state: any = useMindMapStore.getState();
                  state._pasteInProgress = false;
                  state.endHistoryGroup?.(true);
                } catch {}
                return { success: true, message: `Pasted MindMeister as sibling before "${refNode.text}"` };
              }
            }
          }

          // For before: process lines in reverse to preserve order
          const lines = clipboardText.split(/\r\n|\r|\n/)
            .map(l => {
              const t = l.trim();
              const m = t.match(/^#{1,6}\s+(.+)$/);
              return m ? m[1] : t;
            })
            .filter(l => l.length > 0);
          if (lines.length > 0) {
            let lastId: string | null = null;
            for (let i = lines.length - 1; i >= 0; i--) {
              const line = lines[i];
              const nid = await context.handlers.addSiblingNode(refNodeId, line, false, false);
              if (nid) {
                lastId = nid; // first inserted (from end) ends up at top; select the first inserted (which becomes the top-most of pasted block)
              }
            }
            if (lastId) {
              context.handlers.selectNode(lastId);
              const msg = lines.length === 1 ? `Pasted "${lines[0]}" as sibling before` : `Pasted ${lines.length} lines as siblings before`;
              // End history group and commit, clear paste flag
              try {
                (useMindMapStore.getState() as any).endHistoryGroup?.(true);
                useMindMapStore.setState({ _pasteInProgress: false } as any);
              } catch {}
              return { success: true, message: `${msg} "${refNode.text}"` };
            }
          }
        }
      }
    } catch { /* ignore, fallback */ }

    if (uiClipboard) {
      const newId = await pasteTreeAsSibling(uiClipboard, refNodeId, false, context);
      if (newId) {
        context.handlers.selectNode(newId);
        // End history group and commit, clear paste flag
        try {
          const state: any = useMindMapStore.getState();
          state._pasteInProgress = false;
          state.endHistoryGroup?.(true);
        } catch {}
        return { success: true, message: `Pasted as sibling before "${refNode.text}"` };
      }
    }

    // End history group without commit on error, clear paste flag
    try {
      (useMindMapStore.getState() as any).endHistoryGroup?.(false);
      useMindMapStore.setState({ _pasteInProgress: false } as any);
    } catch {}
    return { success: false, error: 'Clipboard is empty' };
  },
  repeatable: true,
  countable: false
};
// Add workspace command
export const addWorkspaceCommand: Command = {
  name: 'addworkspace',
  aliases: ['workspace-add', 'ws-add'],
  description: 'Add a new workspace by selecting a folder',
  category: 'utility',
  examples: ['addworkspace', 'workspace-add'],

  async execute(): Promise<CommandResult> {
    try {
      // Call the global addWorkspace function
      const addWorkspaceFn = (window as any).mindoodleAddWorkspace;
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

// Cut command (equivalent to vim 'dd' - copy then delete)

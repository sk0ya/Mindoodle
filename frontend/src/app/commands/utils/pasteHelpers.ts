/**
 * Functional utilities for paste operations
 * Eliminates duplication between paste-sibling-after and paste-sibling-before
 */

import type { MindMapNode } from '@shared/types';
import type { CommandContext, CommandResult } from '../system/types';
import { useMindMapStore } from '@mindmap/store';
import { isMindMeisterFormat, parseMindMeisterMarkdown } from '../../features/markdown';
import { success, failure } from './commandFactories';

type ExtendedStoreState = ReturnType<typeof useMindMapStore.getState> & {
  beginHistoryGroup?: (group: string) => void;
  endHistoryGroup?: (success: boolean) => void;
  ui?: { clipboard?: MindMapNode };
  _pasteInProgress?: boolean;
};

// Pure function: Get clipboard from store
const getClipboard = (): MindMapNode | null => {
  try {
    const state = useMindMapStore.getState() as ExtendedStoreState;
    return state?.ui?.clipboard || null;
  } catch {
    return null;
  }
};

// Pure function: Parse markdown lines
const parseMarkdownLines = (text: string): string[] =>
  text
    .split(/\r\n|\r|\n/)
    .map(line => {
      const trimmed = line.trim();
      if (!trimmed.startsWith('#')) return trimmed;

      let i = 0;
      while (i < trimmed.length && i < 6 && trimmed.charAt(i) === '#') i++;
      return i > 0 && trimmed.charAt(i) === ' ' ? trimmed.slice(i + 1) : trimmed;
    })
    .filter(line => line.length > 0);

// Higher-order function: Wrap operation with history group
const withHistoryGroup = async <T>(
  groupName: string,
  operation: () => Promise<T>
): Promise<T> => {
  try {
    useMindMapStore.setState({ _pasteInProgress: true } as Partial<ReturnType<typeof useMindMapStore.getState>>);
    const state = useMindMapStore.getState() as ExtendedStoreState;
    state.beginHistoryGroup?.(groupName);
  } catch {
    // Ignore
  }

  try {
    const result = await operation();
    const state = useMindMapStore.getState() as ExtendedStoreState;
    state.endHistoryGroup?.(true);
    useMindMapStore.setState({ _pasteInProgress: false } as Partial<ReturnType<typeof useMindMapStore.getState>>);
    return result;
  } catch (error) {
    const state = useMindMapStore.getState() as ExtendedStoreState;
    state.endHistoryGroup?.(false);
    useMindMapStore.setState({ _pasteInProgress: false } as Partial<ReturnType<typeof useMindMapStore.getState>>);
    throw error;
  }
};

// Recursive paste subtree (functional composition)
const pasteSubtree = async (
  node: MindMapNode,
  parentId: string,
  context: CommandContext
): Promise<void> => {
  const newId = await context.handlers.addChildNode(parentId, node.text, false);
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
      await pasteSubtree(child, newId, context);
    }
  }
};

// Main paste tree as sibling function
export const pasteTreeAsSibling = async (
  source: MindMapNode,
  refNodeId: string,
  insertAfter: boolean,
  context: CommandContext
): Promise<string | null> => {
  const rootId = await context.handlers.addSiblingNode(
    refNodeId,
    source.text,
    false,
    insertAfter
  );

  if (!rootId) return null;

  context.handlers.updateNode(rootId, {
    fontSize: source.fontSize,
    fontWeight: source.fontWeight,
    color: source.color,
    collapsed: false,
    note: source.note,
    markdownMeta: source.markdownMeta
  });

  if (source.children && source.children.length > 0) {
    for (const child of source.children) {
      await pasteSubtree(child, rootId, context);
    }
  }

  return rootId;
};

// Paste MindMeister format
const pasteMindMeister = async (
  text: string,
  refNodeId: string,
  insertAfter: boolean,
  context: CommandContext
): Promise<string | null> => {
  if (!isMindMeisterFormat(text)) return null;

  const parsed = parseMindMeisterMarkdown(text);
  if (!parsed) return null;

  return pasteTreeAsSibling(parsed, refNodeId, insertAfter, context);
};

// Paste plain text lines
const pastePlainLines = async (
  lines: string[],
  refNodeId: string,
  insertAfter: boolean,
  context: CommandContext
): Promise<string | null> => {
  if (lines.length === 0) return null;

  if (insertAfter) {
    // Insert after: forward iteration
    let anchorId = refNodeId;
    let lastId: string | null = null;

    for (const line of lines) {
      const nid = await context.handlers.addSiblingNode(anchorId, line, false, true);
      if (nid) {
        lastId = nid;
        anchorId = nid;
      }
    }

    return lastId;
  } else {
    // Insert before: reverse iteration
    let lastId: string | null = null;

    for (let i = lines.length - 1; i >= 0; i--) {
      const nid = await context.handlers.addSiblingNode(refNodeId, lines[i], false, false);
      if (nid) lastId = nid;
    }

    return lastId;
  }
};

// Main paste sibling logic (unified for before/after)
export const executePasteSibling = async (
  context: CommandContext,
  insertAfter: boolean
): Promise<CommandResult> => {
  const refNodeId = context.selectedNodeId;
  if (!refNodeId) {
    return failure('No node selected');
  }

  const refNode = context.handlers.findNodeById(refNodeId);
  if (!refNode) {
    return failure(`Reference node ${refNodeId} not found`);
  }

  const position = insertAfter ? 'after' : 'before';

  return withHistoryGroup('paste', async () => {
    const uiClipboard = getClipboard();

    // Try system clipboard first
    try {
      if (navigator.clipboard?.readText) {
        const clipboardText = await navigator.clipboard.readText();

        if (clipboardText?.trim()) {
          // Prefer UI clipboard if available
          if (uiClipboard) {
            const newId = await pasteTreeAsSibling(uiClipboard, refNodeId, insertAfter, context);
            if (newId) {
              context.handlers.selectNode(newId);
              return success(`Pasted as sibling ${position} "${refNode.text}"`);
            }
            return failure(`Failed to paste (sibling-${position})`);
          }

          // Try MindMeister format
          const mindMeisterId = await pasteMindMeister(clipboardText, refNodeId, insertAfter, context);
          if (mindMeisterId) {
            context.handlers.selectNode(mindMeisterId);
            return success(`Pasted MindMeister as sibling ${position} "${refNode.text}"`);
          }

          // Fall back to plain text
          const lines = parseMarkdownLines(clipboardText);
          const lastId = await pastePlainLines(lines, refNodeId, insertAfter, context);
          if (lastId) {
            context.handlers.selectNode(lastId);
            const msg = lines.length === 1
              ? `Pasted "${lines[0]}" as sibling ${position}`
              : `Pasted ${lines.length} lines as siblings ${position}`;
            return success(`${msg} "${refNode.text}"`);
          }
        }
      }
    } catch (e) {
      console.warn(`paste-sibling-${position}: clipboard read failed`, e);
    }

    // Fall back to UI clipboard only
    if (uiClipboard) {
      const newId = await pasteTreeAsSibling(uiClipboard, refNodeId, insertAfter, context);
      if (newId) {
        context.handlers.selectNode(newId);
        return success(`Pasted as sibling ${position} "${refNode.text}"`);
      }
    }

    return failure('Clipboard is empty');
  });
};

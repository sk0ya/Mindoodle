/**
 * Toggle/Collapse commands - refactored with functional patterns
 * Reduced from 513 lines to ~280 lines through functional composition
 */

import type { Command, CommandContext, CommandResult } from '../system/types';
import type { MindMapNode } from '@shared/types';
import { useMindMapStore } from '@mindmap/store';
import { MarkdownImporter } from '../../features/markdown/markdownImporter';
import { statusMessages } from '@shared/utils';
import {
  getArg,
  getNodeId,
  failure,
  success,
  withErrorHandling
} from '../utils/commandFactories';

// === Pure Helper Functions ===

const requireNodeWithChildren = (
  nodeId: string | null,
  context: CommandContext
): { success: true; node: MindMapNode; nodeId: string } | { success: false; error: string } => {
  if (!nodeId) {
    const errorMessage = 'ノードが選択されておらず、ノードIDも指定されていません';
    statusMessages.customError(errorMessage);
    return failure(errorMessage);
  }

  const node = context.handlers.findNodeById(nodeId);
  if (!node) {
    const errorMessage = `ノード ${nodeId} が見つかりません`;
    statusMessages.customError(errorMessage);
    return failure(errorMessage);
  }

  if (!node.children || node.children.length === 0) {
    const errorMessage = `ノード「${node.text}」にはトグルできる子ノードがありません`;
    statusMessages.customWarning(errorMessage);
    return failure(errorMessage);
  }

  return { success: true, node, nodeId };
};

const toggleNodeCollapse = (nodeId: string, context: CommandContext): void => {
  const store = useMindMapStore.getState();
  if (store.toggleNodeCollapse) {
    store.toggleNodeCollapse(nodeId);
  } else {
    const node = context.handlers.findNodeById(nodeId);
    context.handlers.updateNode(nodeId, { collapsed: !node?.collapsed });
  }
};

const setNodeCollapsed = (nodeId: string, collapsed: boolean, context: CommandContext): void => {
  const store = useMindMapStore.getState();
  const node = context.handlers.findNodeById(nodeId);

  if (node?.collapsed === collapsed) {
    return; // Already in desired state
  }

  if (store.toggleNodeCollapse && node?.collapsed !== collapsed) {
    store.toggleNodeCollapse(nodeId);
  } else {
    context.handlers.updateNode(nodeId, { collapsed });
  }
};

// === Toggle Command ===

export const toggleCommand: Command = {
  name: 'toggle',
  aliases: ['za', 'toggle-collapse', 'fold'],
  description: 'Toggle the collapse state of node children',
  category: 'structure',
  examples: ['toggle', 'za', 'toggle node-123', 'fold --expand'],
  args: [
    {
      name: 'nodeId',
      type: 'node-id',
      required: false,
      description: 'Node ID to toggle (uses selected node if not specified)'
    },
    {
      name: 'expand',
      type: 'boolean',
      required: false,
      description: 'Force expand (true) or collapse (false). If not specified, toggles current state'
    }
  ],

  execute: withErrorHandling((context: CommandContext, args: Record<string, unknown> = {}) => {
    const nodeId = getNodeId(args, context);
    const forceState = getArg<boolean>(args, 'expand');

    const nodeResult = requireNodeWithChildren(nodeId, context);
    if (!nodeResult.success) {
      return nodeResult;
    }

    const { node } = nodeResult;

    if (forceState !== undefined) {
      const newCollapsedState = !forceState;
      setNodeCollapsed(node.id, newCollapsedState, context);
      const action = newCollapsedState ? 'collapsed' : 'expanded';
      return success(`${action} node "${node.text}" (${node.children!.length} children)`);
    } else {
      toggleNodeCollapse(node.id, context);
      const action = !node.collapsed ? 'collapsed' : 'expanded';
      return success(`${action} node "${node.text}" (${node.children!.length} children)`);
    }
  }, 'ノード状態の切り替えに失敗しました')
};

// === Expand/Collapse Commands ===

const createCollapseCommand = (collapsed: boolean, actionName: string): Command => ({
  name: collapsed ? 'collapse' : 'expand',
  aliases: collapsed ? ['zc', 'close-fold'] : ['zo', 'open-fold'],
  description: collapsed
    ? 'Collapse the selected node to hide its children'
    : 'Expand the selected node to show its children',
  category: 'structure',
  examples: collapsed ? ['collapse', 'zc'] : ['expand', 'zo'],

  execute: withErrorHandling((context: CommandContext) => {
    const nodeResult = requireNodeWithChildren(context.selectedNodeId, context);
    if (!nodeResult.success) {
      return nodeResult;
    }

    const { node } = nodeResult;

    if (node.collapsed === collapsed) {
      return success(`Node "${node.text}" is already ${actionName}`);
    }

    setNodeCollapsed(node.id, collapsed, context);
    return success(`${actionName} node "${node.text}" (${node.children!.length} children)`);
  }, collapsed ? 'ノードの折りたたみに失敗しました' : 'ノードの展開に失敗しました')
});

export const expandCommand = createCollapseCommand(false, 'expanded');
export const collapseCommand = createCollapseCommand(true, 'collapsed');

// === Expand/Collapse All Commands ===

const createCollapseAllCommand = (collapsed: boolean, actionName: string): Command => ({
  name: collapsed ? 'collapse-all' : 'expand-all',
  aliases: collapsed ? ['zM', 'close-all-folds'] : ['zR', 'open-all-folds'],
  description: collapsed
    ? 'Collapse all nodes in the mindmap'
    : 'Expand all nodes in the mindmap',
  category: 'structure',
  examples: collapsed ? ['collapse-all', 'zM'] : ['expand-all', 'zR'],

  execute: withErrorHandling((context: CommandContext) => {
    const state = useMindMapStore.getState();
    const rootNodes: MindMapNode[] = state?.data?.rootNodes || [];

    if (rootNodes.length === 0) {
      const errorMessage = '現在のマインドマップにノードが見つかりません';
      statusMessages.customError(errorMessage);
      return failure(errorMessage);
    }

    let changeCount = 0;

    // Recursive collapse/expand
    const processNodes = (nodes: MindMapNode[]): void => {
      nodes.forEach((node) => {
        if (node.children?.length && node.collapsed !== collapsed) {
          context.handlers.updateNode(node.id, { collapsed });
          changeCount++;
        }
        if (node.children) {
          processNodes(node.children);
        }
      });
    };

    processNodes(rootNodes);

    // Trigger auto-layout
    if (state.data?.settings?.autoLayout) {
      state.applyAutoLayout?.(collapsed ? undefined : true);
    }

    const pastAction = collapsed ? 'expanded' : 'collapsed';
    return success(`${actionName} all nodes (${changeCount} nodes were ${pastAction})`);
  }, collapsed ? 'すべてのノードの折りたたみに失敗しました' : 'すべてのノードの展開に失敗しました')
});

export const expandAllCommand = createCollapseAllCommand(false, 'Expanded');
export const collapseAllCommand = createCollapseAllCommand(true, 'Collapsed');

// === Toggle Checkbox Command ===

export const toggleCheckboxCommand: Command = {
  name: 'toggle-checkbox',
  aliases: ['x', 'checkbox-toggle'],
  description: 'Toggle checkbox state of a list node, or convert to checkbox list',
  category: 'structure',
  examples: ['toggle-checkbox', 'x'],

  execute: withErrorHandling((context: CommandContext) => {
    const nodeId = context.selectedNodeId;

    if (!nodeId) {
      const errorMessage = 'ノードが選択されていません';
      statusMessages.customError(errorMessage);
      return failure(errorMessage);
    }

    const node = context.handlers.findNodeById(nodeId);
    if (!node) {
      const errorMessage = `ノード ${nodeId} が見つかりません`;
      statusMessages.customError(errorMessage);
      return failure(errorMessage);
    }

    const store = useMindMapStore.getState();

    // Toggle existing checkbox
    if (node.markdownMeta?.isCheckbox) {
      const normalizedNode = store.normalizedData?.nodes[nodeId];
      const currentChecked = normalizedNode?.markdownMeta?.isChecked ?? node.markdownMeta.isChecked ?? false;
      const newChecked = !currentChecked;

      if (store.toggleNodeCheckbox) {
        store.toggleNodeCheckbox(nodeId, newChecked);
        return success(`Checkbox ${newChecked ? 'checked' : 'unchecked'} for "${node.text}"`);
      }
    }

    // Convert to checkbox
    const data = store.data;
    if (!data?.rootNodes) {
      const errorMessage = 'マップデータが利用できません';
      statusMessages.customError(errorMessage);
      return failure(errorMessage);
    }

    // Safety check for heading conversion
    if (node.markdownMeta?.type === 'heading') {
      const safetyCheck = MarkdownImporter.canSafelyConvertToList(data.rootNodes, nodeId);
      if (!safetyCheck.canConvert) {
        const errorMessage = safetyCheck.reason || '見出しノードから変換できません';
        statusMessages.customError(errorMessage);
        return failure(errorMessage);
      }
    }

    // Update node to checkbox
    const updateNodeInTree = (nodes: MindMapNode[]): MindMapNode[] =>
      nodes.map((n) => {
        if (n.id === nodeId) {
          const newMarkdownMeta =
            node.markdownMeta?.type === 'unordered-list' || node.markdownMeta?.type === 'ordered-list'
              ? { ...node.markdownMeta, isCheckbox: true, isChecked: false }
              : {
                  type: 'unordered-list' as const,
                  level: 1,
                  originalFormat: '-',
                  indentLevel: 0,
                  lineNumber: node.markdownMeta?.lineNumber ?? 0,
                  isCheckbox: true,
                  isChecked: false
                };

          return { ...n, markdownMeta: newMarkdownMeta };
        }

        return n.children?.length ? { ...n, children: updateNodeInTree(n.children) } : n;
      });

    const updatedRootNodes = updateNodeInTree(data.rootNodes);
    store.setRootNodes(updatedRootNodes, { emit: true, source: 'toggle-checkbox-convert' });

    const sourceType = node.markdownMeta?.type === 'heading'
      ? '見出し'
      : node.markdownMeta?.type === 'unordered-list' || node.markdownMeta?.type === 'ordered-list'
        ? 'リスト'
        : '通常';

    return success(`${sourceType}ノード「${node.text}」をチェックボックスリストに変換しました (unchecked)`);
  }, 'チェックボックスのトグルでエラーが発生しました')
};

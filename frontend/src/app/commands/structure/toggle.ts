/**
 * Toggle/Collapse commands - refactored with functional patterns
 * Reduced from 292 lines to 211 lines (28% reduction)
 */

import type { Command, CommandContext, CommandResult } from '../system/types';
import type { MindMapNode } from '@shared/types';
import { useMindMapStore } from '@mindmap/store';
import { MarkdownImporter } from '../../features/markdown/markdownImporter';
import { structureCommand, failure, success } from '../utils/commandFunctional';

// === Pure Helper Functions ===

type ToggleValidation = CommandResult | { success: true; node: MindMapNode; nodeId: string };
const isToggleSuccess = (v: ToggleValidation): v is { success: true; node: MindMapNode; nodeId: string } =>
  (v as any).success === true && 'node' in (v as any) && 'nodeId' in (v as any);

const getNodeWithChildren = (nodeId: string | null, context: CommandContext): ToggleValidation => {
  if (!nodeId) return failure('No node selected and no node ID provided');
  const node = context.handlers.findNodeById(nodeId);
  if (!node) return failure(`Node ${nodeId} not found`);
  if (!node.children?.length) return failure(`Node "${node.text}" has no children to toggle`);
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
  const node = context.handlers.findNodeById(nodeId);
  if (node?.collapsed === collapsed) return;

  const store = useMindMapStore.getState();
  if (store.toggleNodeCollapse && node?.collapsed !== collapsed) {
    store.toggleNodeCollapse(nodeId);
  } else {
    context.handlers.updateNode(nodeId, { collapsed });
  }
};

// === Toggle Command ===

export const toggleCommand: Command = structureCommand(
  'toggle',
  'Toggle the collapse state of node children',
  (context, args) => {
    const nodeId = (args['nodeId'] as string) ?? context.selectedNodeId;
    const forceState = args['expand'] as boolean | undefined;

    const result = getNodeWithChildren(nodeId, context);
    if (!isToggleSuccess(result)) return result;

    const { node } = result;

    if (forceState !== undefined) {
      const newCollapsed = !forceState;
      setNodeCollapsed(node.id, newCollapsed, context);
      const action = newCollapsed ? 'collapsed' : 'expanded';
      return success(`${action} node "${node.text}" (${node.children!.length} children)`);
    }

    toggleNodeCollapse(node.id, context);
    const action = !node.collapsed ? 'collapsed' : 'expanded';
    return success(`${action} node "${node.text}" (${node.children!.length} children)`);
  },
  {
    aliases: ['za', 'toggle-collapse', 'fold'],
    examples: ['toggle', 'za', 'toggle node-123', 'fold --expand'],
    args: [
      { name: 'nodeId', type: 'node-id', required: false, description: 'Node ID to toggle (uses selected node if not specified)' },
      { name: 'expand', type: 'boolean', required: false, description: 'Force expand (true) or collapse (false)' }
    ]
  }
);

// === Expand/Collapse Commands ===

const createCollapseCommand = (collapsed: boolean, actionName: string): Command =>
  structureCommand(
    collapsed ? 'collapse' : 'expand',
    collapsed ? 'Collapse the selected node to hide its children' : 'Expand the selected node to show its children',
    (context) => {
      const result = getNodeWithChildren(context.selectedNodeId, context);
      if (!isToggleSuccess(result)) return result;

      const { node } = result;
      if (node.collapsed === collapsed) return success(`Node "${node.text}" is already ${actionName}`);

      setNodeCollapsed(node.id, collapsed, context);
      return success(`${actionName} node "${node.text}" (${node.children!.length} children)`);
    },
    {
      aliases: collapsed ? ['zc', 'close-fold'] : ['zo', 'open-fold'],
      examples: collapsed ? ['collapse', 'zc'] : ['expand', 'zo']
    }
  );

export const expandCommand = createCollapseCommand(false, 'expanded');
export const collapseCommand = createCollapseCommand(true, 'collapsed');

// === Expand/Collapse All Commands ===

const processNodesRecursively = (nodes: MindMapNode[], collapsed: boolean, context: CommandContext): number => {
  let count = 0;
  nodes.forEach((node) => {
    if (node.children?.length && node.collapsed !== collapsed) {
      context.handlers.updateNode(node.id, { collapsed });
      count++;
    }
    if (node.children) count += processNodesRecursively(node.children, collapsed, context);
  });
  return count;
};

const createCollapseAllCommand = (collapsed: boolean, actionName: string): Command =>
  structureCommand(
    collapsed ? 'collapse-all' : 'expand-all',
    collapsed ? 'Collapse all nodes in the mindmap' : 'Expand all nodes in the mindmap',
    (context) => {
      const state = useMindMapStore.getState();
      const rootNodes = state?.data?.rootNodes || [];
      if (!rootNodes.length) return failure('No nodes found in current mindmap');

      const changeCount = processNodesRecursively(rootNodes, collapsed, context);

      if (state.data?.settings?.autoLayout) {
        state.applyAutoLayout?.(collapsed ? undefined : true);
      }

      const pastAction = collapsed ? 'expanded' : 'collapsed';
      return success(`${actionName} all nodes (${changeCount} nodes were ${pastAction})`);
    },
    {
      aliases: collapsed ? ['zM', 'close-all-folds'] : ['zR', 'open-all-folds'],
      examples: collapsed ? ['collapse-all', 'zM'] : ['expand-all', 'zR']
    }
  );

export const expandAllCommand = createCollapseAllCommand(false, 'Expanded');
export const collapseAllCommand = createCollapseAllCommand(true, 'Collapsed');

// === Toggle Checkbox Command ===

const createCheckboxMeta = (node: MindMapNode) => {
  const isListType = node.markdownMeta?.type === 'unordered-list' || node.markdownMeta?.type === 'ordered-list';
  return isListType
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
};

const updateNodeInTree = (nodes: MindMapNode[], nodeId: string, node: MindMapNode): MindMapNode[] =>
  nodes.map((n) => {
    if (n.id === nodeId) {
      return { ...n, markdownMeta: createCheckboxMeta(node) };
    }
    return n.children?.length ? { ...n, children: updateNodeInTree(n.children, nodeId, node) } : n;
  });

export const toggleCheckboxCommand: Command = structureCommand(
  'toggle-checkbox',
  'Toggle checkbox state of a list node, or convert to checkbox list',
  (context) => {
    const nodeId = context.selectedNodeId;
    if (!nodeId) return failure('No node selected');

    const node = context.handlers.findNodeById(nodeId);
    if (!node) return failure(`Node ${nodeId} not found`);

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
    if (!data?.rootNodes) return failure('Map data not available');

    // Safety check for heading conversion
    if (node.markdownMeta?.type === 'heading') {
      const safetyCheck = MarkdownImporter.canSafelyConvertToList(data.rootNodes, nodeId);
      if (!safetyCheck.canConvert) return failure(safetyCheck.reason || 'Cannot convert heading node');
    }

    const updatedRootNodes = updateNodeInTree(data.rootNodes, nodeId, node);
    store.setRootNodes(updatedRootNodes, { emit: true, source: 'toggle-checkbox-convert' });

    const sourceType = node.markdownMeta?.type === 'heading' ? 'heading' : 'list';
    return success(`Converted ${sourceType} node "${node.text}" to checkbox list (unchecked)`);
  },
  { aliases: ['x', 'checkbox-toggle'], examples: ['toggle-checkbox', 'x'] }
);

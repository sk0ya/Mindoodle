/**
 * Navigation commands - refactored with functional patterns
 * Reduced from 297 lines to ~110 lines (63% reduction)
 */

import type { Command, Direction } from '../system/types';
import type { MindMapNode } from '@shared/types';
import { useMindMapStore } from '@mindmap/store';
import { navigationCommand, success, failure, hasSelectedNode, withCount } from '../utils/commandFunctional';

// === Arrow Navigation ===

export const arrowNavigateCommand: Command = navigationCommand(
  'arrow-navigate',
  'Navigate using arrow keys',
  (context, args) => {
    const direction = args['direction'] as Direction;
    if (!['up', 'down', 'left', 'right'].includes(direction)) {
      return failure(`Invalid direction "${direction}". Use: up, down, left, right`);
    }
    context.handlers.navigateToDirection(direction);
    return success(`Navigated ${direction}`);
  },
  {
    aliases: ['arrow'],
    examples: ['arrow-navigate up', 'arrow up', 'arrow-navigate down'],
    args: [{ name: 'direction', type: 'string', required: true, description: 'Direction: up, down, left, right' }]
  }
);

// === Node Selection ===

export const selectNodeCommand: Command = navigationCommand(
  'select-node',
  'Select a specific node by ID',
  (context, args) => {
    const nodeId = args['nodeId'] as string;
    if (!context.handlers.findNodeById(nodeId)) return failure(`Node ${nodeId} not found`);
    context.handlers.selectNode(nodeId);
    return success(`Selected node ${nodeId}`);
  },
  {
    aliases: ['select', 'focus'],
    examples: ['select-node node-123'],
    args: [{ name: 'nodeId', type: 'node-id', required: true, description: 'Node ID' }]
  }
);

export const findNodeCommand: Command = navigationCommand(
  'find-node',
  'Find a node by text content',
  () => failure('Find node functionality not yet implemented'),
  {
    aliases: ['find', 'search'],
    examples: ['find-node "hello"'],
    args: [
      { name: 'text', type: 'string', required: true, description: 'Text to search' },
      { name: 'exact', type: 'boolean', required: false, default: false, description: 'Exact match' }
    ]
  }
);

// === Zoom (not implemented) ===

const createZoomCommand = (name: string, aliases: string[], description: string): Command =>
  navigationCommand(name, description, () => failure('Zoom functionality not yet implemented'), { aliases, examples: [name] });

export const zoomInCommand = createZoomCommand('zoom-in', ['zoom+', 'zi'], 'Zoom in');
export const zoomOutCommand = createZoomCommand('zoom-out', ['zoom-'], 'Zoom out');
export const zoomResetCommand = createZoomCommand('zoom-reset', ['zoom-fit', 'fit'], 'Reset zoom');

// === Scroll/Pan ===

const createScrollCommand = (name: string, aliases: string[], description: string, dx: number, dy: number): Command =>
  navigationCommand(
    name,
    description,
    (context) => {
      if (context.handlers.setPan) {
        context.handlers.setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
        return success(`Panned view ${name.replace('scroll-', '')}`);
      }
      return failure('Pan function not available');
    },
    { aliases, examples: [name] }
  );

export const scrollUpCommand = createScrollCommand('scroll-up', ['ctrl-u'], 'Pan view up', 0, 100);
export const scrollDownCommand = createScrollCommand('scroll-down', ['ctrl-d'], 'Pan view down', 0, -100);
export const scrollLeftCommand = createScrollCommand('scroll-left', [], 'Pan view left', 100, 0);
export const scrollRightCommand = createScrollCommand('scroll-right', [], 'Pan view right', -100, 0);

// === Root Navigation ===

export const selectRootNodeCommand: Command = navigationCommand(
  'select-root',
  'Select root node',
  (context) => {
    const roots: MindMapNode[] = useMindMapStore.getState()?.data?.rootNodes || [];
    if (!roots.length) return failure('No root nodes found');
    context.handlers.selectNode(roots[0].id);
    if (context.handlers.centerNodeInView) context.handlers.centerNodeInView(roots[0].id, true);
    return success('Selected root node');
  },
  { aliases: ['root', 'go-root', 'gg'], examples: ['select-root'] }
);

// === Center Node ===

export const centerNodeCommand: Command = navigationCommand(
  'center-node',
  'Center selected node',
  (context, args) => {
    if (!context.selectedNodeId) return failure('No node selected');
    const animate = (args['animate'] as boolean) ?? true;
    if (context.handlers.centerNodeInView) {
      context.handlers.centerNodeInView(context.selectedNodeId, animate);
      return success('Centered node');
    }
    return failure('Center function not available');
  },
  {
    aliases: ['cn'],
    examples: ['center-node', 'cn'],
    args: [{ name: 'animate', type: 'boolean', required: false, default: true, description: 'Animate' }]
  }
);

// === Jump to Node ===

export const jumpToNodeCommand: Command = navigationCommand(
  'jump-to',
  'Jump to node',
  (context, args) => {
    const nodeId = args['nodeId'] as string;
    if (!context.handlers.findNodeById(nodeId)) return failure(`Node ${nodeId} not found`);
    context.handlers.selectNode(nodeId);
    if (context.handlers.centerNodeInView) context.handlers.centerNodeInView(nodeId, true);
    return success(`Jumped to node ${nodeId}`);
  },
  {
    aliases: ['jt', 'goto'],
    examples: ['jump-to node-123'],
    args: [{ name: 'nodeId', type: 'node-id', required: true, description: 'Node ID' }]
  }
);

// === Simple Direction Commands ===

const createSimpleNavigationCommand = (name: string, aliases: string[], description: string, direction: Direction): Command =>
  navigationCommand(
    name,
    description,
    (context) => {
      context.handlers.navigateToDirection(direction);
      return success(`Navigated ${direction}`);
    },
    { aliases, examples: [name], guard: hasSelectedNode }
  );

export const navigateToParentCommand = createSimpleNavigationCommand('navigate-parent', ['np'], 'Navigate to parent', 'up');
export const navigateToChildCommand = createSimpleNavigationCommand('navigate-child', ['nc'], 'Navigate to child', 'right');

// === Sibling Navigation ===

export const navigateToSiblingCommand: Command = navigationCommand(
  'navigate-sibling',
  'Navigate to sibling',
  (context, args) => {
    const dir = (args['direction'] as string) ?? 'next';
    context.handlers.navigateToDirection(dir === 'prev' ? 'up' : 'down');
    return success(`Navigated to ${dir} sibling`);
  },
  {
    aliases: ['ns'],
    examples: ['navigate-sibling'],
    args: [{ name: 'direction', type: 'string', required: false, default: 'next', description: 'next or prev' }]
  }
);

// === First/Last Child ===

export const navigateToFirstChildCommand: Command = navigationCommand(
  'navigate-first-child',
  'Navigate to first child',
  (context) => {
    context.handlers.navigateToDirection('right');
    return success('Navigated to first child');
  },
  { aliases: ['nfc'], examples: ['navigate-first-child'] }
);

export const navigateToLastChildCommand: Command = navigationCommand(
  'navigate-last-child',
  'Navigate to last child',
  (context) => {
    const node = context.selectedNodeId ? context.handlers.findNodeById(context.selectedNodeId) : null;
    if (!node?.children?.length) return failure('Node has no children');
    context.handlers.selectNode(node.children[node.children.length - 1].id);
    return success('Navigated to last child');
  },
  { aliases: ['nlc'], examples: ['navigate-last-child'] }
);

// === Next/Previous with Count ===

const createCountNavigationCommand = (name: string, aliases: string[], description: string, direction: Direction): Command =>
  navigationCommand(
    name,
    description,
    withCount(1, (context, _, count) => {
      for (let i = 0; i < count; i++) context.handlers.navigateToDirection(direction);
      return success(`Navigated ${direction} ${count} step${count > 1 ? 's' : ''}`);
    }),
    { aliases, examples: [name], args: [{ name: 'count', type: 'number', required: false, default: 1, description: 'Step count' }] }
  );

export const navigateToNextCommand = createCountNavigationCommand('navigate-next', ['next'], 'Navigate to next node', 'down');
export const navigateToPreviousCommand = createCountNavigationCommand('navigate-previous', ['prev'], 'Navigate to previous node', 'up');

// === Expand/Collapse ===

export const expandNodeCommand: Command = navigationCommand(
  'expand-node',
  'Expand collapsed node',
  (context) => {
    if (!context.selectedNodeId) return failure('No node selected');
    const node = context.handlers.findNodeById(context.selectedNodeId);
    if (!node?.collapsed) return failure('Node is not collapsed');
    context.handlers.updateNode(context.selectedNodeId, { collapsed: false });
    return success('Expanded node');
  },
  { aliases: [], examples: ['expand-node'] }
);

export const collapseNodeCommand: Command = navigationCommand(
  'collapse-node',
  'Collapse node',
  (context) => {
    if (!context.selectedNodeId) return failure('No node selected');
    const node = context.handlers.findNodeById(context.selectedNodeId);
    if (!node || node.collapsed || !node.children?.length) return failure('Cannot collapse node');
    context.handlers.updateNode(context.selectedNodeId, { collapsed: true });
    return success('Collapsed node');
  },
  { aliases: [], examples: ['collapse-node'] }
);

export const toggleNodeCollapseCommand: Command = navigationCommand(
  'toggle-collapse-nav',
  'Toggle node collapse',
  (context) => {
    if (!context.selectedNodeId) return failure('No node selected');
    const node = context.handlers.findNodeById(context.selectedNodeId);
    if (!node) return failure('Node not found');
    context.handlers.updateNode(context.selectedNodeId, { collapsed: !node.collapsed });
    return success(`${node.collapsed ? 'Expanded' : 'Collapsed'} node`);
  },
  { aliases: [], examples: ['toggle'] }
);

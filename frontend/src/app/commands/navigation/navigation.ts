/**
 * Navigation commands - refactored using commandFactory
 */

import type { Command } from '../system/types';
import type { MindMapNode } from '@shared/types';
import { useMindMapStore } from '@mindmap/store';
import {
  createNavigationCommand,
  getStringArg,
  getBooleanArg,
  getNumberArg,
  validateEnum
} from '../system/commandFactory';

const DIRECTIONS = ['up', 'down', 'left', 'right'] as const;

export const arrowNavigateCommand: Command = createNavigationCommand({
  name: 'arrow-navigate',
  aliases: ['arrow'],
  description: 'Navigate using arrow keys',
  examples: ['arrow-navigate up', 'arrow up', 'arrow-navigate down'],
  args: [{ name: 'direction', type: 'string', required: true, description: 'Direction: up, down, left, right' }],
  handler: (context, args) => {
    const direction = getStringArg(args, 'direction');
    const validation = validateEnum(direction, DIRECTIONS, 'direction');
    if (!validation.valid) throw new Error(validation.error.error as string);
    context.handlers.navigateToDirection(validation.value);
  }
});

export const selectNodeCommand: Command = createNavigationCommand({
  name: 'select-node',
  aliases: ['select', 'focus'],
  description: 'Select a specific node by ID',
  examples: ['select-node node-123'],
  args: [{ name: 'nodeId', type: 'node-id', required: true, description: 'Node ID' }],
  handler: (context, args) => {
    const nodeId = getStringArg(args, 'nodeId');
    if (!context.handlers.findNodeById(nodeId)) throw new Error(`Node ${nodeId} not found`);
  }
});

export const findNodeCommand: Command = createNavigationCommand({
  name: 'find-node',
  aliases: ['find', 'search'],
  description: 'Find a node by text content',
  examples: ['find-node "hello"'],
  args: [
    { name: 'text', type: 'string', required: true, description: 'Text to search' },
    { name: 'exact', type: 'boolean', required: false, default: false, description: 'Exact match' }
  ],
  handler: () => {
    throw new Error('Find node functionality not yet implemented');
  }
});

export const zoomInCommand: Command = createNavigationCommand({
  name: 'zoom-in',
  aliases: ['zoom+', 'zi'],
  description: 'Zoom in',
  examples: ['zoom-in'],
  handler: () => {
    throw new Error('Zoom functionality not yet implemented');
  }
});

export const zoomOutCommand: Command = createNavigationCommand({
  name: 'zoom-out',
  aliases: ['zoom-'],
  description: 'Zoom out',
  examples: ['zoom-out'],
  handler: () => {
    throw new Error('Zoom functionality not yet implemented');
  }
});

export const zoomResetCommand: Command = createNavigationCommand({
  name: 'zoom-reset',
  aliases: ['zoom-fit', 'fit'],
  description: 'Reset zoom',
  examples: ['zoom-reset'],
  handler: () => {
    throw new Error('Zoom functionality not yet implemented');
  }
});

export const scrollUpCommand: Command = createNavigationCommand({
  name: 'scroll-up',
  aliases: ['ctrl-u'],
  description: 'Pan view up',
  examples: ['scroll-up'],
  handler: (context) => {
    if (context.handlers.setPan) {
      context.handlers.setPan(prev => ({ x: prev.x, y: prev.y + 100 }));
    }
  }
});

export const scrollDownCommand: Command = createNavigationCommand({
  name: 'scroll-down',
  aliases: ['ctrl-d'],
  description: 'Pan view down',
  examples: ['scroll-down'],
  handler: (context) => {
    if (context.handlers.setPan) {
      context.handlers.setPan(prev => ({ x: prev.x, y: prev.y - 100 }));
    }
  }
});

export const scrollLeftCommand: Command = createNavigationCommand({
  name: 'scroll-left',
  description: 'Pan view left',
  examples: ['scroll-left'],
  handler: (context) => {
    if (context.handlers.setPan) {
      context.handlers.setPan(prev => ({ x: prev.x + 100, y: prev.y }));
    }
  }
});

export const scrollRightCommand: Command = createNavigationCommand({
  name: 'scroll-right',
  description: 'Pan view right',
  examples: ['scroll-right'],
  handler: (context) => {
    if (context.handlers.setPan) {
      context.handlers.setPan(prev => ({ x: prev.x - 100, y: prev.y }));
    }
  }
});

export const selectRootNodeCommand: Command = createNavigationCommand({
  name: 'select-root',
  aliases: ['root', 'go-root', 'gg'],
  description: 'Select root node',
  examples: ['select-root'],
  handler: (context) => {
    const roots: MindMapNode[] = useMindMapStore.getState()?.data?.rootNodes || [];
    if (!roots.length) throw new Error('No root nodes found');
    context.handlers.selectNode(roots[0].id);
    if (context.handlers.centerNodeInView) {
      context.handlers.centerNodeInView(roots[0].id, true);
    }
  }
});

export const centerNodeCommand: Command = createNavigationCommand({
  name: 'center-node',
  aliases: ['center', 'cn'],
  description: 'Center selected node',
  examples: ['center'],
  args: [{ name: 'animate', type: 'boolean', required: false, default: true, description: 'Animate' }],
  handler: (context, args) => {
    if (!context.selectedNodeId) throw new Error('No node selected');
    const animate = getBooleanArg(args, 'animate', true);
    if (context.handlers.centerNodeInView) {
      context.handlers.centerNodeInView(context.selectedNodeId, animate);
    }
  }
});

export const jumpToNodeCommand: Command = createNavigationCommand({
  name: 'jump-to',
  aliases: ['jt', 'goto'],
  description: 'Jump to node',
  examples: ['jump-to node-123'],
  args: [{ name: 'nodeId', type: 'node-id', required: true, description: 'Node ID' }],
  handler: (context, args) => {
    const nodeId = getStringArg(args, 'nodeId');
    if (!context.handlers.findNodeById(nodeId)) throw new Error(`Node ${nodeId} not found`);
    context.handlers.selectNode(nodeId);
    if (context.handlers.centerNodeInView) {
      context.handlers.centerNodeInView(nodeId, true);
    }
  }
});

export const navigateToParentCommand: Command = createNavigationCommand({
  name: 'navigate-parent',
  aliases: ['np', 'parent'],
  description: 'Navigate to parent',
  examples: ['navigate-parent'],
  handler: (context) => context.handlers.navigateToDirection('up')
});

export const navigateToChildCommand: Command = createNavigationCommand({
  name: 'navigate-child',
  aliases: ['nc', 'child'],
  description: 'Navigate to child',
  examples: ['navigate-child'],
  handler: (context) => context.handlers.navigateToDirection('right')
});

export const navigateToSiblingCommand: Command = createNavigationCommand({
  name: 'navigate-sibling',
  aliases: ['ns', 'sibling'],
  description: 'Navigate to sibling',
  examples: ['navigate-sibling'],
  args: [{ name: 'direction', type: 'string', required: false, default: 'next', description: 'next or prev' }],
  handler: (context, args) => {
    const dir = getStringArg(args, 'direction', 'next');
    context.handlers.navigateToDirection(dir === 'prev' ? 'up' : 'down');
  }
});

export const navigateToFirstChildCommand: Command = createNavigationCommand({
  name: 'navigate-first-child',
  aliases: ['nfc'],
  description: 'Navigate to first child',
  examples: ['navigate-first-child'],
  handler: (context) => context.handlers.navigateToDirection('right')
});

export const navigateToLastChildCommand: Command = createNavigationCommand({
  name: 'navigate-last-child',
  aliases: ['nlc'],
  description: 'Navigate to last child',
  examples: ['navigate-last-child'],
  handler: (context) => {
    const node = context.selectedNodeId ? context.handlers.findNodeById(context.selectedNodeId) : null;
    if (node?.children?.length) {
      context.handlers.selectNode(node.children[node.children.length - 1].id);
    }
  }
});

export const navigateToNextCommand: Command = createNavigationCommand({
  name: 'navigate-next',
  aliases: ['next', 'j'],
  description: 'Navigate to next node',
  examples: ['navigate-next'],
  args: [{ name: 'count', type: 'number', required: false, default: 1, description: 'Step count' }],
  handler: (context, args) => {
    const count = getNumberArg(args, 'count', 1);
    for (let i = 0; i < count; i++) {
      context.handlers.navigateToDirection('down');
    }
  }
});

export const navigateToPreviousCommand: Command = createNavigationCommand({
  name: 'navigate-previous',
  aliases: ['prev', 'k'],
  description: 'Navigate to previous node',
  examples: ['navigate-previous'],
  args: [{ name: 'count', type: 'number', required: false, default: 1, description: 'Step count' }],
  handler: (context, args) => {
    const count = getNumberArg(args, 'count', 1);
    for (let i = 0; i < count; i++) {
      context.handlers.navigateToDirection('up');
    }
  }
});

export const expandNodeCommand: Command = createNavigationCommand({
  name: 'expand-node',
  aliases: ['expand'],
  description: 'Expand collapsed node',
  examples: ['expand'],
  handler: (context) => {
    if (!context.selectedNodeId) return;
    const node = context.handlers.findNodeById(context.selectedNodeId);
    if (node?.collapsed) {
      context.handlers.updateNode(context.selectedNodeId, { collapsed: false });
    }
  }
});

export const collapseNodeCommand: Command = createNavigationCommand({
  name: 'collapse-node',
  aliases: ['collapse'],
  description: 'Collapse node',
  examples: ['collapse'],
  handler: (context) => {
    if (!context.selectedNodeId) return;
    const node = context.handlers.findNodeById(context.selectedNodeId);
    if (node && !node.collapsed && node.children?.length) {
      context.handlers.updateNode(context.selectedNodeId, { collapsed: true });
    }
  }
});

export const toggleNodeCollapseCommand: Command = createNavigationCommand({
  name: 'toggle-collapse',
  aliases: ['toggle'],
  description: 'Toggle node collapse',
  examples: ['toggle'],
  handler: (context) => {
    if (!context.selectedNodeId) return;
    const node = context.handlers.findNodeById(context.selectedNodeId);
    if (node) {
      context.handlers.updateNode(context.selectedNodeId, { collapsed: !node.collapsed });
    }
  }
});

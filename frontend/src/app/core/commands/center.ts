/**
 * Center Command
 * Centers the selected node in the viewport (equivalent to vim 'zz')
 */

import type { Command, CommandContext, CommandResult } from './types';

export const centerCommand: Command = {
  name: 'center',
  aliases: ['zz', 'center-node'],
  description: 'Center the selected node in the viewport',
  category: 'navigation',
  examples: [
    'center',
    'zz',
    'center-node'
  ],
  args: [
    {
      name: 'nodeId',
      type: 'node-id',
      required: false,
      description: 'Node ID to center (uses selected node if not specified)'
    },
    {
      name: 'animate',
      type: 'boolean',
      required: false,
      default: false,
      description: 'Whether to animate the centering transition'
    }
  ],

  execute(context: CommandContext, args: Record<string, any>): CommandResult {
    const nodeId = (args as any)['nodeId'] || context.selectedNodeId;
    const animate = (args as any)['animate'] ?? false;

    if (!nodeId) {
      return {
        success: false,
        error: 'No node selected and no node ID provided'
      };
    }

    if (!context.handlers.centerNodeInView) {
      return {
        success: false,
        error: 'Center function is not available'
      };
    }

    try {
      context.handlers.centerNodeInView(nodeId, animate);
      return {
        success: true,
        message: `Centered node ${nodeId}`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to center node'
      };
    }
  }
};

// Center Left command (vim zt)
export const centerLeftCommand: Command = {
  name: 'center-left',
  aliases: ['zt'],
  description: 'Position the selected node at the left-center of the viewport',
  category: 'navigation',
  examples: [
    'center-left',
    'zt'
  ],
  args: [
    {
      name: 'nodeId',
      type: 'node-id',
      required: false,
      description: 'Node ID to center-left (uses selected node if not specified)'
    },
    {
      name: 'animate',
      type: 'boolean',
      required: false,
      default: false,
      description: 'Whether to animate the centering transition'
    }
  ],

  execute(context: CommandContext, args: Record<string, any>): CommandResult {
    const nodeId = (args as any)['nodeId'] || context.selectedNodeId;
    const animate = (args as any)['animate'] ?? false;

    if (!nodeId) {
      return {
        success: false,
        error: 'No node selected and no node ID provided'
      };
    }

    if (!context.handlers.centerNodeInView) {
      return {
        success: false,
        error: 'Center function is not available'
      };
    }

    try {
      // Use centerNodeInView with special mode for left positioning
      (context.handlers as any).centerNodeInView(nodeId, animate, { mode: 'left' });
      return {
        success: true,
        message: `Centered node ${nodeId} at left`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to center-left node'
      };
    }
  }
};

import type { Command } from '../system/types';
import { navigationCommand, success, failure } from '../utils/commandFunctional';

// Helper to center node with mode
const centerNode = (mode: 'center' | 'left', animate = true) =>
  navigationCommand(
    mode === 'center' ? 'center' : 'center-left',
    mode === 'center' ? 'Center the selected node in the viewport' : 'Position the selected node at the left-center of the viewport',
    (context, args) => {
      const nodeId = (args['nodeId'] as string | undefined) || context.selectedNodeId;
      const animateArg = (args['animate'] as boolean | undefined) ?? animate;

      if (!nodeId) return failure('No node selected and no node ID provided');
      if (!context.handlers.centerNodeInView) return failure('Center function is not available');

      try {
        context.handlers.centerNodeInView?.(nodeId, animateArg, mode);
        return success(`Centered node ${nodeId}${mode === 'left' ? ' at left' : ''}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const operation = mode === 'center' ? 'center' : 'center-left';
        return failure(`Failed to ${operation} node: ${errorMessage}`);
      }
    },
    {
      aliases: mode === 'center' ? ['zz', 'center-node'] : ['zt'],
      examples: mode === 'center' ? ['center', 'zz', 'center-node'] : ['center-left', 'zt'],
      args: [
        { name: 'nodeId', type: 'node-id', required: false, description: 'Node ID to center (uses selected node if not specified)' },
        { name: 'animate', type: 'boolean', required: false, default: animate, description: 'Whether to animate the centering transition' }
      ]
    }
  );

export const centerCommand: Command = centerNode('center', true);
export const centerLeftCommand: Command = centerNode('left', false);

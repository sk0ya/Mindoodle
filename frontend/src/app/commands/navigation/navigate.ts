import type { Command } from '../system/types';
import { navigationCommand, success, failure, hasSelectedNode, notInMode, allGuards, withCount } from '../utils/commandFunctional';

// Direction mapping
const DIRECTION_MAP: Record<string, 'up' | 'down' | 'left' | 'right'> = {
  up: 'up', u: 'up', k: 'up',
  down: 'down', d: 'down', j: 'down',
  left: 'left', l: 'left', h: 'left', parent: 'left',
  right: 'right', r: 'right', child: 'right'
};

const normalizeDirection = (input: string): 'up' | 'down' | 'left' | 'right' | null =>
  DIRECTION_MAP[input.toLowerCase().trim()] ?? null;

// Main navigate command
export const navigateCommand: Command = navigationCommand(
  'navigate',
  'Navigate to adjacent nodes in the specified direction',
  withCount(1, (context, args, count) => {
    const directionInput = (args['direction'] || args['_0']) as string | undefined;
    if (!directionInput) return failure('Direction is required (up, down, left, right)');

    const direction = normalizeDirection(directionInput);
    if (!direction) return failure(`Invalid direction "${directionInput}". Use: up, down, left, right`);

    try {
      // left/right need loop, up/down support count natively
      if (direction === 'left' || direction === 'right') {
        for (let i = 0; i < count; i++) context.handlers.navigateToDirection(direction);
      } else {
        context.handlers.navigateToDirection(direction, count);
      }
      const msg = count > 1 ? `Navigated ${direction} ${count} steps` : `Navigated ${direction}`;
      return success(msg);
    } catch (error) {
      return failure(error instanceof Error ? error.message : `Failed to navigate ${direction}`);
    }
  }),
  {
    aliases: ['nav', 'move', 'go'],
    examples: ['navigate up', 'nav down', 'move left', 'go right', 'h', 'j', 'k', 'l'],
    args: [{ name: 'direction', type: 'string', required: true, description: 'Direction: up, down, left, right (or u, d, l, r)' }],
    guard: allGuards(hasSelectedNode, notInMode('insert')),
    countable: true,
    repeatable: false
  }
);

// Create directional commands using factory
const createDirectionCommand = (
  name: string,
  direction: 'up' | 'down' | 'left' | 'right',
  aliases: string[],
  description: string
): Command =>
  navigationCommand(
    name,
    description,
    (context) => navigateCommand.execute(context, { direction }),
    {
      aliases,
      examples: [name, ...aliases],
      guard: allGuards(hasSelectedNode, notInMode('insert')),
      countable: true,
      repeatable: false
    }
  );

export const upCommand = createDirectionCommand('up', 'up', ['k'], 'Navigate up to the previous sibling node');
export const downCommand = createDirectionCommand('down', 'down', ['j', 'd'], 'Navigate down to the next sibling node');
export const leftCommand = createDirectionCommand('left', 'left', ['h', 'parent'], 'Navigate left to the parent node');
export const rightCommand = createDirectionCommand('right', 'right', ['l'], 'Navigate right to the first child node');

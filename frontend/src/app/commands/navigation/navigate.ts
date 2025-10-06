/**
 * Navigate Command
 * Navigate between nodes in different directions (equivalent to vim hjkl)
 */

import type { Command, CommandContext, CommandResult } from '../system/types';

export const navigateCommand: Command = {
  name: 'navigate',
  aliases: ['nav', 'move', 'go'],
  description: 'Navigate to adjacent nodes in the specified direction',
  category: 'navigation',
  examples: [
    'navigate up',
    'nav down',
    'move left',
    'go right',
    'h',
    'j',
    'k',
    'l'
  ],
  args: [
    {
      name: 'direction',
      type: 'string',
      required: true,
      description: 'Direction to navigate: up, down, left, right (or u, d, l, r)'
    }
  ],
  guard: (context) => {
    // Require a selected node and avoid navigation while in insert mode
    if (!context.selectedNodeId) return false;
    if (context.mode === 'insert') return false;
    return true;
  },

  execute(context: CommandContext, args: Record<string, any>): CommandResult {
    const directionInput = (args as any)['direction'] || (args as any)['_0']; // Support positional arg

    if (!directionInput) {
      return {
        success: false,
        error: 'Direction is required (up, down, left, right)'
      };
    }

    if (!context.selectedNodeId) {
      return {
        success: false,
        error: 'No node selected'
      };
    }

    // Normalize direction input
    const direction = normalizeDirection(directionInput);
    if (!direction) {
      return {
        success: false,
        error: `Invalid direction "${directionInput}". Use: up, down, left, right`
      };
    }

    // Support count for navigation (e.g., 3j means jump 3 nodes down)
    const count = context.count ?? 1;

    try {
      // For left/right, navigate step by step (count times)
      // For up/down, jump directly to the Nth sibling
      if (direction === 'left' || direction === 'right') {
        // Left/Right: repeat navigation count times
        for (let i = 0; i < count; i++) {
          context.handlers.navigateToDirection(direction);
        }
      } else {
        // Up/Down: jump directly to the Nth sibling
        context.handlers.navigateToDirection(direction, count);
      }

      return {
        success: true,
        message: count > 1 ? `Navigated ${direction} ${count} step${count > 1 ? 's' : ''}` : `Navigated ${direction}`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : `Failed to navigate ${direction}`
      };
    }
  },
  countable: true,
  repeatable: false  // Navigation is not typically repeated with dot
};

// Individual direction commands for convenience
export const upCommand: Command = {
  name: 'up',
  aliases: ['k'],
  description: 'Navigate up to the previous sibling node',
  category: 'navigation',
  examples: ['up', 'k'],
  guard: (context) => !!context.selectedNodeId && context.mode !== 'insert',
  async execute(context: CommandContext): Promise<CommandResult> {
    return await navigateCommand.execute(context, { direction: 'up' });
  },
  countable: true,
  repeatable: false
};

export const downCommand: Command = {
  name: 'down',
  aliases: ['j', 'd'],
  description: 'Navigate down to the next sibling node',
  category: 'navigation',
  examples: ['down', 'j', 'd'],
  guard: (context) => !!context.selectedNodeId && context.mode !== 'insert',
  async execute(context: CommandContext): Promise<CommandResult> {
    return await navigateCommand.execute(context, { direction: 'down' });
  },
  countable: true,
  repeatable: false
};

export const leftCommand: Command = {
  name: 'left',
  aliases: ['h', 'parent'],
  description: 'Navigate left to the parent node',
  category: 'navigation',
  examples: ['left', 'h', 'parent'],
  guard: (context) => !!context.selectedNodeId && context.mode !== 'insert',
  async execute(context: CommandContext): Promise<CommandResult> {
    return await navigateCommand.execute(context, { direction: 'left' });
  },
  countable: true,
  repeatable: false
};

export const rightCommand: Command = {
  name: 'right',
  aliases: ['l'],
  description: 'Navigate right to the first child node',
  category: 'navigation',
  examples: ['right', 'l'],
  guard: (context) => !!context.selectedNodeId && context.mode !== 'insert',
  async execute(context: CommandContext): Promise<CommandResult> {
    return await navigateCommand.execute(context, { direction: 'right' });
  },
  countable: true,
  repeatable: false
};

/**
 * Normalize direction input to standard format
 */
function normalizeDirection(input: string): 'up' | 'down' | 'left' | 'right' | null {
  const normalized = input.toLowerCase().trim();

  switch (normalized) {
    case 'up':
    case 'u':
    case 'k':
      return 'up';
    case 'down':
    case 'd':
    case 'j':
      return 'down';
    case 'left':
    case 'l':
    case 'h':
    case 'parent':
      return 'left';
    case 'right':
    case 'r':
    case 'child':
      return 'right';
    default:
      return null;
  }
}

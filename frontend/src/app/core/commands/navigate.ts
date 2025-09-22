/**
 * Navigate Command
 * Navigate between nodes in different directions (equivalent to vim hjkl)
 */

import type { Command, CommandContext, CommandResult } from './types';

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

    try {
      context.handlers.navigateToDirection(direction);
      return {
        success: true,
        message: `Navigated ${direction}`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : `Failed to navigate ${direction}`
      };
    }
  }
};

// Individual direction commands for convenience
export const upCommand: Command = {
  name: 'up',
  aliases: ['k'],
  description: 'Navigate up to the previous sibling node',
  category: 'navigation',
  examples: ['up', 'k'],
  async execute(context: CommandContext): Promise<CommandResult> {
    return await navigateCommand.execute(context, { direction: 'up' });
  }
};

export const downCommand: Command = {
  name: 'down',
  aliases: ['j', 'd'],
  description: 'Navigate down to the next sibling node',
  category: 'navigation',
  examples: ['down', 'j', 'd'],
  async execute(context: CommandContext): Promise<CommandResult> {
    return await navigateCommand.execute(context, { direction: 'down' });
  }
};

export const leftCommand: Command = {
  name: 'left',
  aliases: ['h', 'parent'],
  description: 'Navigate left to the parent node',
  category: 'navigation',
  examples: ['left', 'h', 'parent'],
  async execute(context: CommandContext): Promise<CommandResult> {
    return await navigateCommand.execute(context, { direction: 'left' });
  }
};

export const rightCommand: Command = {
  name: 'right',
  aliases: ['l'],
  description: 'Navigate right to the first child node',
  category: 'navigation',
  examples: ['right', 'l'],
  async execute(context: CommandContext): Promise<CommandResult> {
    return await navigateCommand.execute(context, { direction: 'right' });
  }
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

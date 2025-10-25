/**
 * Functional utilities for command creation
 * Reduces boilerplate through composition and higher-order functions
 */

import type { Command, CommandContext, CommandResult } from '../system/types';

// Result builders (pure functions)
export const success = (message?: string): CommandResult => ({
  success: true,
  ...(message && { message })
});

export const failure = (error: string): CommandResult => ({
  success: false,
  error
});

// Error handling wrapper (higher-order function)
export const withErrorHandling = <T extends unknown[]>(
  fn: (...args: T) => CommandResult | Promise<CommandResult>,
  fallbackError: string
) => async (...args: T): Promise<CommandResult> => {
  try {
    return await fn(...args);
  } catch (error) {
    return failure(error instanceof Error ? error.message : fallbackError);
  }
};

// Argument extraction (type-safe)
export const getArg = <T = string>(
  args: Record<string, unknown>,
  key: string,
  fallback?: T
): T | undefined =>
  (args[key] as T | undefined) ?? fallback;

export const getNodeId = (
  args: Record<string, unknown>,
  context: CommandContext
): string | null =>
  getArg<string>(args, 'nodeId') ?? context.selectedNodeId ?? null;

// Guard combinators
type NodeResult =
  | CommandResult
  | { success: true; node: NonNullable<ReturnType<CommandContext['handlers']['findNodeById']>>; nodeId: string };

// Type guard for NodeResult
const isNodeSuccess = (
  result: NodeResult
): result is { success: true; node: NonNullable<ReturnType<CommandContext['handlers']['findNodeById']>>; nodeId: string } =>
  'node' in result && 'nodeId' in result;

export const requireNode = (
  nodeId: string | null,
  context: CommandContext
): NodeResult => {
  if (!nodeId) {
    return failure('No node selected and no node ID provided');
  }

  const node = context.handlers.findNodeById(nodeId);
  if (!node) {
    return failure(`Node ${nodeId} not found`);
  }

  return { success: true as const, node, nodeId };
};

export const requireCondition = (
  condition: boolean,
  errorMsg: string
): { success: boolean; error?: string } =>
  condition ? { success: true } : failure(errorMsg);

// Simple command factory (for undo/redo style commands)
export const createSimpleCommand = (config: {
  name: string;
  aliases?: string[];
  description: string;
  category?: 'editing' | 'navigation' | 'utility';
  canExecute: (context: CommandContext) => boolean;
  execute: (context: CommandContext) => void;
  nothingMsg: string;
  successMsg: string;
}): Command => ({
  name: config.name,
  aliases: config.aliases,
  description: config.description,
  category: config.category ?? 'editing',
  examples: [config.name, ...(config.aliases || [])],
  execute: withErrorHandling((context: CommandContext) => {
    const canExecute = requireCondition(
      config.canExecute(context),
      config.nothingMsg
    );

    if (!canExecute.success) {
      return canExecute;
    }

    config.execute(context);
    return success(config.successMsg);
  }, `Failed to ${config.name}`)
});

// Node command factory (for copy/paste style commands)
export const createNodeCommand = (config: {
  name: string;
  aliases?: string[];
  description: string;
  category?: 'editing' | 'navigation' | 'utility';
  args?: Command['args'];
  execute: (nodeId: string, node: ReturnType<CommandContext['handlers']['findNodeById']>, context: CommandContext) => void | Promise<void>;
  successMsg: (node: NonNullable<ReturnType<CommandContext['handlers']['findNodeById']>>) => string;
  repeatable?: boolean;
  countable?: boolean;
}): Command => ({
  name: config.name,
  aliases: config.aliases,
  description: config.description,
  category: config.category ?? 'editing',
  examples: [config.name, ...(config.aliases || [])],
  args: config.args ?? [
    {
      name: 'nodeId',
      type: 'node-id',
      required: false,
      description: 'Node ID (uses selected node if not specified)'
    }
  ],
  execute: withErrorHandling(
    async (context: CommandContext, args: Record<string, unknown> = {}) => {
      const nodeId = getNodeId(args, context);
      const nodeResult = requireNode(nodeId, context);

      if (!isNodeSuccess(nodeResult)) {
        return nodeResult;
      }

      await config.execute(nodeResult.nodeId, nodeResult.node, context);
      return success(config.successMsg(nodeResult.node));
    },
    `Failed to ${config.name}`
  ),
  repeatable: config.repeatable ?? false,
  countable: config.countable ?? false
});

// Edit command factory (for insert/append style commands)
export const createEditCommand = (config: {
  name: string;
  aliases?: string[];
  description: string;
  cursorPosition: 'start' | 'end';
  examples?: string[];
}): Command =>
  createNodeCommand({
    name: config.name,
    aliases: config.aliases,
    description: config.description,
    execute: (nodeId, _node, ctx) => {
      if (ctx.vim?.isEnabled) {
        ctx.vim.setMode('insert');
      }

      if (config.cursorPosition === 'end') {
        ctx.handlers.startEditWithCursorAtEnd(nodeId);
      } else {
        ctx.handlers.startEditWithCursorAtStart(nodeId);
      }
    },
    successMsg: (node) =>
      `Started editing "${node.text}" at cursor ${config.cursorPosition}`,
    repeatable: false,
    countable: false
  });

// Sibling command factory (for open/open-above style commands)
export const createSiblingCommand = (config: {
  name: string;
  aliases?: string[];
  description: string;
  insertAfter: boolean;
  examples?: string[];
}): Command => ({
  name: config.name,
  aliases: config.aliases,
  description: config.description,
  category: 'editing',
  examples: config.examples ?? [config.name, ...(config.aliases || [])],
  args: [
    {
      name: 'nodeId',
      type: 'node-id',
      required: false,
      description: 'Reference node ID (uses selected node if not specified)'
    },
    {
      name: 'text',
      type: 'string',
      required: false,
      default: '',
      description: 'Initial text for the new sibling node'
    }
  ],

  execute: withErrorHandling(
    async (context: CommandContext, args: Record<string, unknown> = {}) => {
      const nodeId = getNodeId(args, context);
      const initialText = getArg<string>(args, 'text') ?? '';

      const nodeResult = requireNode(nodeId, context);
      if (!isNodeSuccess(nodeResult)) {
        return nodeResult;
      }

      if (context.vim?.isEnabled) {
        context.vim.setMode('insert');
      }

      const newNodeId = await context.handlers.addSiblingNode(
        nodeResult.nodeId,
        initialText,
        true,
        config.insertAfter
      );

      if (!newNodeId) {
        return failure('Failed to create new sibling node');
      }

      const position = config.insertAfter ? 'after' : 'before';
      return success(
        `Created new sibling node ${position} "${nodeResult.node.text}" and started editing`
      );
    },
    `Failed to ${config.name}`
  )
});

// Format toggle command factory (for bold/italic/strikethrough)
export const createFormatToggleCommand = (config: {
  name: string;
  aliases: string[];
  description: string;
  formatType: 'bold' | 'italic' | 'strikethrough';
}): Command =>
  createNodeCommand({
    name: config.name,
    aliases: config.aliases,
    description: config.description,
    args: [], // Only uses selected node
    execute: async (nodeId, node, ctx) => {
      const { toggleInlineMarkdown } = await import('../../features/markdown/parseInlineMarkdown');
      const currentText = node.text || '';
      const { newText } = toggleInlineMarkdown(currentText, config.formatType);
      ctx.handlers.updateNode(nodeId, { text: newText });
    },
    successMsg: (node) => `Toggled ${config.formatType} formatting for node "${node.text}"`,
    repeatable: false,
    countable: false
  });

// UI Toggle command factory (for panel toggles)
export const createToggleCommand = (config: {
  name: string;
  aliases?: string[];
  description: string;
  getState: (ctx: CommandContext) => boolean;
  setState: (ctx: CommandContext, value: boolean) => void;
  panelName: string;
}): Command => ({
  name: config.name,
  aliases: config.aliases,
  description: config.description,
  category: 'utility',
  examples: [config.name, ...(config.aliases || [])],

  execute: withErrorHandling((context: CommandContext) => {
    const currentState = config.getState(context);
    config.setState(context, !currentState);
    return success(`${currentState ? 'Closed' : 'Opened'} ${config.panelName}`);
  }, `Failed to toggle ${config.panelName}`)
});

// Panel toggle with fallback factory
export const createPanelToggleCommand = (config: {
  name: string;
  aliases?: string[];
  description: string;
  panelName: string;
  toggleFn?: string;
  setFn?: string;
  stateProp?: string;
}): Command => ({
  name: config.name,
  aliases: config.aliases,
  description: config.description,
  category: 'ui',
  examples: [config.name, ...(config.aliases || [])],

  execute: withErrorHandling((context: CommandContext) => {
    const handlers = context.handlers as Record<string, unknown>;

    // Try toggle function first
    if (config.toggleFn && typeof handlers[config.toggleFn] === 'function') {
      (handlers[config.toggleFn] as () => void)();
      return success(`Toggled ${config.panelName}`);
    }

    // Fall back to set function with state
    if (config.setFn && config.stateProp &&
        typeof handlers[config.setFn] === 'function' &&
        typeof handlers[config.stateProp] === 'boolean') {
      const currentState = handlers[config.stateProp] as boolean;
      (handlers[config.setFn] as (b: boolean) => void)(!currentState);
      return success(`Toggled ${config.panelName}`);
    }

    return failure(`${config.panelName} controls are not available`);
  }, `Failed to toggle ${config.panelName}`)
});

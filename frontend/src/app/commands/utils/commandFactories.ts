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

// Node command factory (for copy/paste style commands)
export const createNodeCommand = (config: {
  name: string;
  aliases?: string[];
  description: string;
  category?: 'editing' | 'navigation' | 'utility';
  args?: Command['args'];
  execute: (nodeId: string, node: NonNullable<ReturnType<CommandContext['handlers']['findNodeById']>>, context: CommandContext) => void | Promise<void>;
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

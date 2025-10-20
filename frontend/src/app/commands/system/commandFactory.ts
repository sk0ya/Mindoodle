/**
 * Command factory utilities for reducing command definition boilerplate
 */

import type { Command, CommandContext, CommandResult, CommandArg, CommandCategory } from './types';

type ArgValue = string | number | boolean;
type ArgsMap = Record<string, ArgValue>;

interface CommandConfig {
  name: string;
  aliases?: string[];
  description: string;
  category: CommandCategory;
  examples?: string[];
  args?: CommandArg[];
}

interface SimpleCommandConfig extends CommandConfig {
  execute: (context: CommandContext, args: ArgsMap) => CommandResult;
  guard?: (context: CommandContext) => boolean;
}

/**
 * Create a simple command with guard support
 */
export function createCommand(config: SimpleCommandConfig): Command {
  const { execute, guard, ...commandConfig } = config;

  return {
    ...commandConfig,
    execute: (context: CommandContext, args: ArgsMap): CommandResult => {
      // Apply guard if provided
      if (guard && !guard(context)) {
        return {
          success: false,
          error: 'Command guard failed: preconditions not met'
        };
      }

      return execute(context, args);
    }
  };
}

/**
 * Guard: Require selected node
 */
export function requireSelectedNode(context: CommandContext): boolean {
  return context.selectedNodeId !== null;
}

/**
 * Guard: Require editing node
 */
export function requireEditingNode(context: CommandContext): boolean {
  return context.editingNodeId !== null;
}

/**
 * Guard: Require NOT editing
 */
export function requireNotEditing(context: CommandContext): boolean {
  return context.editingNodeId === null;
}

/**
 * Common error results
 */
export const CommandErrors = {
  noNodeSelected: (): CommandResult => ({
    success: false,
    error: 'No node selected'
  }),

  nodeNotFound: (nodeId: string): CommandResult => ({
    success: false,
    error: `Node ${nodeId} not found`
  }),

  invalidArgument: (argName: string, value: unknown, expected: string): CommandResult => ({
    success: false,
    error: `Invalid ${argName} "${value}". Expected: ${expected}`
  }),

  executionFailed: (operation: string, error: unknown): CommandResult => ({
    success: false,
    error: error instanceof Error ? error.message : `Failed to ${operation}`
  })
};

/**
 * Common success results
 */
export const CommandSuccess = {
  simple: (message: string): CommandResult => ({
    success: true,
    message
  }),

  withData: <T>(message: string, data: T): CommandResult => ({
    success: true,
    message,
    data
  })
};

/**
 * Extract string argument safely
 */
export function getStringArg(args: ArgsMap, name: string, defaultValue: string = ''): string {
  const value = args[name];
  return typeof value === 'string' ? value : defaultValue;
}

/**
 * Extract number argument safely
 */
export function getNumberArg(args: ArgsMap, name: string, defaultValue: number = 0): number {
  const value = args[name];
  return typeof value === 'number' ? value : defaultValue;
}

/**
 * Extract boolean argument safely
 */
export function getBooleanArg(args: ArgsMap, name: string, defaultValue: boolean = false): boolean {
  const value = args[name];
  return typeof value === 'boolean' ? value : defaultValue;
}

/**
 * Validate enum argument
 */
export function validateEnum<T extends string>(
  value: string,
  validValues: readonly T[],
  argName: string
): { valid: true; value: T } | { valid: false; error: CommandResult } {
  if (validValues.includes(value as T)) {
    return { valid: true, value: value as T };
  }

  return {
    valid: false,
    error: CommandErrors.invalidArgument(argName, value, validValues.join(', '))
  };
}

/**
 * Create a navigation command with standard pattern
 */
export function createNavigationCommand(config: {
  name: string;
  aliases?: string[];
  description: string;
  examples?: string[];
  handler: (context: CommandContext, args: ArgsMap) => void;
  args?: CommandArg[];
}): Command {
  return createCommand({
    ...config,
    category: 'navigation',
    guard: requireSelectedNode,
    execute: (context, args) => {
      try {
        context.handlers.closeAttachmentAndLinkLists();
        config.handler(context, args);
        return CommandSuccess.simple(config.description);
      } catch (error) {
        return CommandErrors.executionFailed(config.name, error);
      }
    }
  });
}

/**
 * Create an editing command with standard pattern
 */
export function createEditingCommand(config: {
  name: string;
  aliases?: string[];
  description: string;
  examples?: string[];
  handler: (context: CommandContext, args: ArgsMap) => Promise<void> | void;
  args?: CommandArg[];
  requireNode?: boolean;
}): Command {
  const syncExecute = (context: CommandContext, args: ArgsMap): CommandResult => {
    try {
      const result = config.handler(context, args);
      if (result instanceof Promise) {
        // Cannot handle async in sync context, but we'll document this limitation
        throw new Error('Async handlers not supported in current execute signature');
      }
      return CommandSuccess.simple(config.description);
    } catch (error) {
      return CommandErrors.executionFailed(config.name, error);
    }
  };

  return createCommand({
    ...config,
    category: 'editing' as CommandCategory,
    guard: config.requireNode !== false ? requireSelectedNode : undefined,
    execute: syncExecute
  });
}

/**
 * Create a UI command with standard pattern
 */
export function createUICommand(config: {
  name: string;
  aliases?: string[];
  description: string;
  examples?: string[];
  handler: (context: CommandContext, args: ArgsMap) => void;
  args?: CommandArg[];
}): Command {
  return createCommand({
    ...config,
    category: 'ui',
    execute: (context, args) => {
      try {
        config.handler(context, args);
        return CommandSuccess.simple(config.description);
      } catch (error) {
        return CommandErrors.executionFailed(config.name, error);
      }
    }
  });
}

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


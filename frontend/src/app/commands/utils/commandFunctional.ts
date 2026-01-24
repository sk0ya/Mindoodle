/**
 * Functional utilities for command system
 * Reduce boilerplate in command definitions and execution
 */

import type { Command, CommandContext, CommandResult, CommandCategory, ArgsMap } from '../system/types';

// === Type Aliases ===

export type CommandExecutor = (context: CommandContext, args: ArgsMap) => CommandResult | Promise<CommandResult>;
export type CommandGuard = (context: CommandContext, args: ArgsMap) => boolean;
export type CommandOptions = Partial<Omit<Command, 'name' | 'description' | 'execute' | 'category'>>;

// === Result Helpers ===

export const success = (message?: string, data?: unknown): CommandResult => ({
  success: true,
  message,
  data
});

export const failure = (error: string, data?: unknown): CommandResult => ({
  success: false,
  error,
  data
});

// === Command Builders ===

/**
 * Quick command factory for simple commands
 */
export const command = (
  name: string,
  description: string,
  execute: CommandExecutor,
  options?: Partial<Omit<Command, 'name' | 'description' | 'execute'>>
): Command => ({
  name,
  description,
  execute,
  ...options
});

// === Guard Composition ===

/**
 * Combine multiple guards with AND logic
 */
export const allGuards = (...guards: CommandGuard[]): CommandGuard =>
  (context: CommandContext, args: ArgsMap) =>
    guards.every(guard => guard(context, args));

/**
 * Negate a guard
 */
export const notGuard = (guard: CommandGuard): CommandGuard =>
  (context: CommandContext, args: ArgsMap) =>
    !guard(context, args);

/**
 * Guard that always passes
 */
export const alwaysGuard: CommandGuard = () => true;

// === Common Guards ===

/**
 * Guard that checks if a node is selected
 */
export const hasSelectedNode: CommandGuard = (context) =>
  context.selectedNodeId !== null;

/**
 * Guard that checks if a node is being edited
 */
export const hasEditingNode: CommandGuard = (context) =>
  context.editingNodeId !== null;

/**
 * Guard that checks if in specific mode
 */
export const inMode = (mode: string): CommandGuard =>
  (context) => context.mode === mode;

/**
 * Guard that checks if not in specific mode
 */
export const notInMode = (mode: string): CommandGuard =>
  notGuard(inMode(mode));

/**
 * Guard that checks if vim is available
 */
export const hasVim: CommandGuard = (context) =>
  !!context.vim;

/**
 * Guard that checks if can undo
 */
export const canUndo: CommandGuard = (context) =>
  context.handlers.canUndo;

/**
 * Guard that checks if can redo
 */
export const canRedo: CommandGuard = (context) =>
  context.handlers.canRedo;

/**
 * Run command if guard passes
 */
export const whenGuard = (
  guard: CommandGuard,
  execute: CommandExecutor
): CommandExecutor =>
  async (context: CommandContext, args: ArgsMap): Promise<CommandResult> => {
    if (guard(context, args)) {
      return await execute(context, args);
    }
    return failure('Guard condition not met');
  };

// === Command Categories ===

export const categories = {
  NAVIGATION: 'navigation' as CommandCategory,
  EDITING: 'editing' as CommandCategory,
  STRUCTURE: 'structure' as CommandCategory,
  UI: 'ui' as CommandCategory,
  APPLICATION: 'application' as CommandCategory,
  VIM: 'vim' as CommandCategory,
  UTILITY: 'utility' as CommandCategory
};

// === Command Definition Helpers ===

/**
 * Define a navigation command
 */
export const navigationCommand = (
  name: string,
  description: string,
  execute: CommandExecutor,
  options?: CommandOptions
): Command =>
  command(name, description, execute, { ...options, category: categories.NAVIGATION });

/**
 * Define an editing command
 */
export const editingCommand = (
  name: string,
  description: string,
  execute: CommandExecutor,
  options?: CommandOptions
): Command =>
  command(name, description, execute, { ...options, category: categories.EDITING });

/**
 * Define a structure command
 */
export const structureCommand = (
  name: string,
  description: string,
  execute: CommandExecutor,
  options?: CommandOptions
): Command =>
  command(name, description, execute, { ...options, category: categories.STRUCTURE });

/**
 * Define a UI command
 */
export const uiCommand = (
  name: string,
  description: string,
  execute: CommandExecutor,
  options?: CommandOptions
): Command =>
  command(name, description, execute, { ...options, category: categories.UI });

/**
 * Define an application command
 */
export const applicationCommand = (
  name: string,
  description: string,
  execute: CommandExecutor,
  options?: CommandOptions
): Command =>
  command(name, description, execute, { ...options, category: categories.APPLICATION });

/**
 * Define a vim command
 */
export const vimCommand = (
  name: string,
  description: string,
  execute: CommandExecutor,
  options?: CommandOptions
): Command =>
  command(name, description, execute, {
    ...options,
    category: categories.VIM,
    guard: allGuards(hasVim, options?.guard ?? alwaysGuard)
  });

/**
 * Define a utility command
 */
export const utilityCommand = (
  name: string,
  description: string,
  execute: CommandExecutor,
  options?: CommandOptions
): Command =>
  command(name, description, execute, { ...options, category: categories.UTILITY });

// === Node Helpers ===

/**
 * Get selected node from context
 */
export const getSelectedNode = (context: CommandContext): ReturnType<typeof context.handlers.findNodeById> =>
  context.selectedNodeId ? context.handlers.findNodeById(context.selectedNodeId) : null;

/**
 * Execute command with count
 */
export const withCount = (
  defaultCount: number,
  executor: (context: CommandContext, args: ArgsMap, count: number) => CommandResult | Promise<CommandResult>
): CommandExecutor =>
  async (context: CommandContext, args: ArgsMap): Promise<CommandResult> => {
    const count = context.count ?? defaultCount;
    return await executor(context, args, count);
  };

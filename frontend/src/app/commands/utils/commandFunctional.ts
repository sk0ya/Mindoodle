/**
 * Functional utilities for command system
 * Reduce boilerplate in command definitions and execution
 */

import type { Command, CommandContext, CommandResult, CommandCategory, ArgsMap } from '../system/types';

export type CommandExecutor = (context: CommandContext, args: ArgsMap) => CommandResult | Promise<CommandResult>;
export type CommandGuard = (context: CommandContext, args: ArgsMap) => boolean;

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

export type CommandBuilder = {
  name: string;
  description: string;
  execute?: CommandExecutor;
  guard?: CommandGuard;
  category?: CommandCategory;
  aliases?: string[];
};

/**
 * Fluent API for building commands
 */
export class CommandBuilderImpl {
  private command: CommandBuilder;

  constructor(name: string, description: string) {
    this.command = { name, description };
  }

  withExecute(execute: CommandExecutor): this {
    this.command.execute = execute;
    return this;
  }

  withGuard(guard: CommandGuard): this {
    this.command.guard = guard;
    return this;
  }

  withCategory(category: CommandCategory): this {
    this.command.category = category;
    return this;
  }

  withAliases(...aliases: string[]): this {
    this.command.aliases = aliases;
    return this;
  }

  build(): Command {
    if (!this.command.execute) {
      throw new Error(`Command ${this.command.name} must have an execute function`);
    }

    return {
      name: this.command.name,
      description: this.command.description,
      execute: this.command.execute,
      guard: this.command.guard,
      category: this.command.category,
      aliases: this.command.aliases
    };
  }
}

export const createCommand = (name: string, description: string) =>
  new CommandBuilderImpl(name, description);

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

/**
 * Combine multiple guards with AND logic
 */
export const allGuards = (...guards: CommandGuard[]): CommandGuard =>
  (context: CommandContext, args: ArgsMap) =>
    guards.every(guard => guard(context, args));

/**
 * Combine multiple guards with OR logic
 */

/**
 * Negate a guard
 */

/**
 * Guard that always passes
 */
/**
 * Guard that never passes
 */

/**
 * Guard that checks if a node is selected
 */

/**
 * Guard that checks if a node is being edited
 */

/**
 * Guard that checks if in specific mode
 */

/**
 * Guard that checks if not in specific mode
 */
export const notInMode = (mode: string): CommandGuard =>
  notGuard(inMode(mode));

/**
 * Guard that checks if vim is available
 */

/**
 * Guard that checks if can undo
 */

/**
 * Guard that checks if can redo
 */

/**
 * Guard that checks if an argument exists
 */

/**
 * Guard that requires selected node
 */

/**
 * Execute command with error handling
 */

/**
 * Execute command with timing
 */

/**
 * Chain multiple commands
 */

/**
 * Run command if guard passes
 */

/**
 * Run command unless guard passes
 */

/**
 * Filter commands by category
 */

/**
 * Filter commands by name pattern
 */

/**
 * Filter commands that match search query
 */

export const categories = {
  NAVIGATION: 'navigation' as CommandCategory,
  EDITING: 'editing' as CommandCategory,
  STRUCTURE: 'structure' as CommandCategory,
  UI: 'ui' as CommandCategory,
  APPLICATION: 'application' as CommandCategory,
  VIM: 'vim' as CommandCategory,
  UTILITY: 'utility' as CommandCategory
};

/**
 * Define a navigation command
 */
export const navigationCommand = (
  name: string,
  description: string,
  execute: CommandExecutor,
  options?: Partial<Omit<Command, 'name' | 'description' | 'execute' | 'category'>>
): Command =>
  command(name, description, execute, { ...options, category: categories.NAVIGATION });

/**
 * Define an editing command
 */
export const editingCommand = (
  name: string,
  description: string,
  execute: CommandExecutor,
  options?: Partial<Omit<Command, 'name' | 'description' | 'execute' | 'category'>>
): Command =>
  command(name, description, execute, { ...options, category: categories.EDITING });

/**
 * Define a structure command
 */
export const structureCommand = (
  name: string,
  description: string,
  execute: CommandExecutor,
  options?: Partial<Omit<Command, 'name' | 'description' | 'execute' | 'category'>>
): Command =>
  command(name, description, execute, { ...options, category: categories.STRUCTURE });

/**
 * Define a UI command
 */
export const uiCommand = (
  name: string,
  description: string,
  execute: CommandExecutor,
  options?: Partial<Omit<Command, 'name' | 'description' | 'execute' | 'category'>>
): Command =>
  command(name, description, execute, { ...options, category: categories.UI });

/**
 * Define an application command
 */
export const applicationCommand = (
  name: string,
  description: string,
  execute: CommandExecutor,
  options?: Partial<Omit<Command, 'name' | 'description' | 'execute' | 'category'>>
): Command =>
  command(name, description, execute, { ...options, category: categories.APPLICATION });

/**
 * Define a vim command
 */

/**
 * Define a utility command
 */
export const utilityCommand = (
  name: string,
  description: string,
  execute: CommandExecutor,
  options?: Partial<Omit<Command, 'name' | 'description' | 'execute' | 'category'>>
): Command =>
  command(name, description, execute, { ...options, category: categories.UTILITY });

/**
 * Create multiple commands at once
 */

/**
 * Create commands with shared options
 */

/**
 * Get selected node from context
 */

/**
 * Execute command only if node is selected
 */

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

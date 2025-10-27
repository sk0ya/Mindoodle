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
export const anyGuard = (...guards: CommandGuard[]): CommandGuard =>
  (context: CommandContext, args: ArgsMap) =>
    guards.some(guard => guard(context, args));

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

/**
 * Guard that never passes
 */
export const neverGuard: CommandGuard = () => false;


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
 * Guard that checks if an argument exists
 */
export const hasArg = (name: string): CommandGuard =>
  (_, args) => args[name] !== undefined;

/**
 * Guard that requires selected node
 */
export const requireSelectedNode: CommandGuard = hasSelectedNode;


/**
 * Execute command with error handling
 */
export const safeExecute = async (
  execute: CommandExecutor,
  context: CommandContext,
  args: ArgsMap = {},
  onError?: (error: Error) => void
): Promise<CommandResult> => {
  try {
    return await execute(context, args);
  } catch (error) {
    if (onError) {
      onError(error as Error);
    }
    return failure((error as Error).message);
  }
};

/**
 * Execute command with timing
 */
export const timeExecute = (
  execute: CommandExecutor,
  onComplete?: (duration: number) => void
): CommandExecutor =>
  async (context: CommandContext, args: ArgsMap): Promise<CommandResult> => {
    const start = performance.now();
    const result = await execute(context, args);
    const duration = performance.now() - start;
    onComplete?.(duration);
    return result;
  };


/**
 * Chain multiple commands
 */
export const chainCommands = (...executors: CommandExecutor[]): CommandExecutor =>
  async (context: CommandContext, args: ArgsMap): Promise<CommandResult> => {
    for (const executor of executors) {
      const result = await executor(context, args);
      if (!result.success) return result;
    }
    return success('All commands executed successfully');
  };

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

/**
 * Run command unless guard passes
 */
export const unlessGuard = (
  guard: CommandGuard,
  execute: CommandExecutor
): CommandExecutor =>
  whenGuard(notGuard(guard), execute);


/**
 * Filter commands by category
 */
export const byCategory = (category: CommandCategory) =>
  (commands: Command[]): Command[] =>
    commands.filter(cmd => cmd.category === category);

/**
 * Filter commands by name pattern
 */
export const byNamePattern = (pattern: RegExp) =>
  (commands: Command[]): Command[] =>
    commands.filter(cmd => pattern.test(cmd.name));

/**
 * Filter commands that match search query
 */
export const matchesQuery = (query: string) =>
  (commands: Command[]): Command[] => {
    const lowerQuery = query.toLowerCase();
    return commands.filter(cmd =>
      cmd.name.toLowerCase().includes(lowerQuery) ||
      cmd.description?.toLowerCase().includes(lowerQuery) ||
      cmd.aliases?.some(alias => alias.toLowerCase().includes(lowerQuery))
    );
  };


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
export const vimCommand = (
  name: string,
  description: string,
  execute: CommandExecutor,
  options?: Partial<Omit<Command, 'name' | 'description' | 'execute' | 'category'>>
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
  options?: Partial<Omit<Command, 'name' | 'description' | 'execute' | 'category'>>
): Command =>
  command(name, description, execute, { ...options, category: categories.UTILITY });


/**
 * Create multiple commands at once
 */
export const createCommands = (
  definitions: Array<{
    name: string;
    description: string;
    execute: CommandExecutor;
    options?: Partial<Omit<Command, 'name' | 'description' | 'execute'>>;
  }>
): Command[] =>
  definitions.map(def => command(def.name, def.description, def.execute, def.options));

/**
 * Create commands with shared options
 */
export const createCommandsWithDefaults = (
  defaults: Partial<Omit<Command, 'name' | 'description' | 'execute'>>,
  definitions: Array<{
    name: string;
    description: string;
    execute: CommandExecutor;
    options?: Partial<Omit<Command, 'name' | 'description' | 'execute'>>;
  }>
): Command[] =>
  definitions.map(def =>
    command(def.name, def.description, def.execute, { ...defaults, ...def.options })
  );


/**
 * Get selected node from context
 */
export const getSelectedNode = (context: CommandContext): ReturnType<typeof context.handlers.findNodeById> =>
  context.selectedNodeId ? context.handlers.findNodeById(context.selectedNodeId) : null;

/**
 * Execute command only if node is selected
 */
export const withSelectedNode = (
  executor: (context: CommandContext, args: ArgsMap, node: NonNullable<ReturnType<typeof getSelectedNode>>) => CommandResult | Promise<CommandResult>
): CommandExecutor =>
  async (context: CommandContext, args: ArgsMap): Promise<CommandResult> => {
    const node = getSelectedNode(context);
    if (!node) {
      return failure('No node selected');
    }
    return await executor(context, args, node);
  };

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

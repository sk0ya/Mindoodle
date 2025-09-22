/**
 * Command Registry
 * Manages registration, lookup, and organization of available commands
 */

import type { Command, CommandRegistry } from './types';

/**
 * Implementation of the command registry
 */
export class CommandRegistryImpl implements CommandRegistry {
  private commands = new Map<string, Command>();
  private aliases = new Map<string, string>(); // alias -> command name

  /**
   * Register a new command
   */
  register(command: Command): void {
    // Validate command
    if (!command.name) {
      throw new Error('Command name is required');
    }

    if (this.commands.has(command.name)) {
      throw new Error(`Command '${command.name}' is already registered`);
    }

    // Register main command
    this.commands.set(command.name, command);

    // Register aliases
    if (command.aliases) {
      for (const alias of command.aliases) {
        if (this.aliases.has(alias) || this.commands.has(alias)) {
          throw new Error(`Alias '${alias}' conflicts with existing command or alias`);
        }
        this.aliases.set(alias, command.name);
      }
    }
  }

  /**
   * Unregister a command
   */
  unregister(name: string): void {
    const command = this.commands.get(name);
    if (!command) {
      return; // Command doesn't exist, nothing to do
    }

    // Remove aliases
    if (command.aliases) {
      for (const alias of command.aliases) {
        this.aliases.delete(alias);
      }
    }

    // Remove main command
    this.commands.delete(name);
  }

  /**
   * Get a command by name or alias
   */
  get(nameOrAlias: string): Command | undefined {
    // Try direct lookup first
    const command = this.commands.get(nameOrAlias);
    if (command) {
      return command;
    }

    // Try alias lookup
    const aliasTarget = this.aliases.get(nameOrAlias);
    if (aliasTarget) {
      return this.commands.get(aliasTarget);
    }

    return undefined;
  }

  /**
   * Get all registered commands
   */
  getAll(): Command[] {
    return Array.from(this.commands.values());
  }

  /**
   * Get commands by category
   */
  getByCategory(category: string): Command[] {
    return Array.from(this.commands.values())
      .filter(cmd => cmd.category === category);
  }

  /**
   * Search commands by name, alias, or description
   */
  search(query: string): Command[] {
    const lowerQuery = query.toLowerCase().trim();
    if (!lowerQuery) {
      return this.getAll();
    }

    const results: Array<{ command: Command; score: number }> = [];

    for (const command of this.commands.values()) {
      const score = this.calculateSearchScore(command, lowerQuery);
      if (score > 0) {
        results.push({ command, score });
      }
    }

    // Sort by score (descending) and return commands
    return results
      .sort((a, b) => b.score - a.score)
      .map(result => result.command);
  }

  /**
   * Get all available command names and aliases
   */
  getAvailableNames(): string[] {
    const names = Array.from(this.commands.keys());
    const aliasNames = Array.from(this.aliases.keys());
    return [...names, ...aliasNames].sort();
  }

  /**
   * Get command help information
   */
  getHelp(nameOrAlias?: string): string {
    if (nameOrAlias) {
      const command = this.get(nameOrAlias);
      if (!command) {
        return `Command '${nameOrAlias}' not found`;
      }
      return this.formatCommandHelp(command);
    }

    // Return general help with all commands
    const categories = this.groupByCategory();
    let help = 'Available Commands:\n\n';

    for (const [category, commands] of categories) {
      help += `${category.toUpperCase()}:\n`;
      for (const command of commands) {
        help += `  ${command.name}`;
        if (command.aliases && command.aliases.length > 0) {
          help += ` (${command.aliases.join(', ')})`;
        }
        help += ` - ${command.description}\n`;
      }
      help += '\n';
    }

    help += 'Use "help <command>" for detailed information about a specific command.';
    return help;
  }

  /**
   * Calculate search score for a command against a query
   */
  private calculateSearchScore(command: Command, query: string): number {
    let score = 0;

    // Exact name match (highest priority)
    if (command.name.toLowerCase() === query) {
      score += 100;
    }
    // Name starts with query
    else if (command.name.toLowerCase().startsWith(query)) {
      score += 80;
    }
    // Name contains query
    else if (command.name.toLowerCase().includes(query)) {
      score += 60;
    }

    // Alias matches
    if (command.aliases) {
      for (const alias of command.aliases) {
        const lowerAlias = alias.toLowerCase();
        if (lowerAlias === query) {
          score += 90;
        } else if (lowerAlias.startsWith(query)) {
          score += 70;
        } else if (lowerAlias.includes(query)) {
          score += 50;
        }
      }
    }

    // Description contains query
    if (command.description.toLowerCase().includes(query)) {
      score += 30;
    }

    // Category matches
    if (command.category?.toLowerCase().includes(query)) {
      score += 20;
    }

    return score;
  }

  /**
   * Format detailed help for a specific command
   */
  private formatCommandHelp(command: Command): string {
    let help = `Command: ${command.name}\n`;

    if (command.aliases && command.aliases.length > 0) {
      help += `Aliases: ${command.aliases.join(', ')}\n`;
    }

    help += `Description: ${command.description}\n`;

    if (command.category) {
      help += `Category: ${command.category}\n`;
    }

    if (command.args && command.args.length > 0) {
      help += '\nArguments:\n';
      for (const arg of command.args) {
        help += `  --${arg.name} (${arg.type})`;
        if (arg.required) {
          help += ' [required]';
        }
        if (arg.default !== undefined) {
          help += ` [default: ${arg.default}]`;
        }
        if (arg.description) {
          help += ` - ${arg.description}`;
        }
        help += '\n';
      }
    }

    if (command.examples && command.examples.length > 0) {
      help += '\nExamples:\n';
      for (const example of command.examples) {
        help += `  ${example}\n`;
      }
    }

    return help;
  }

  /**
   * Group commands by category
   */
  private groupByCategory(): Map<string, Command[]> {
    const categories = new Map<string, Command[]>();

    for (const command of this.commands.values()) {
      const category = command.category || 'general';
      if (!categories.has(category)) {
        categories.set(category, []);
      }
      categories.get(category)!.push(command);
    }

    // Sort commands within each category
    for (const commands of categories.values()) {
      commands.sort((a, b) => a.name.localeCompare(b.name));
    }

    return categories;
  }
}

// Global registry instance
let globalRegistry: CommandRegistryImpl | null = null;

/**
 * Get the global command registry instance
 */
export function getCommandRegistry(): CommandRegistryImpl {
  if (!globalRegistry) {
    globalRegistry = new CommandRegistryImpl();
  }
  return globalRegistry;
}

/**
 * Reset the global registry (mainly for testing)
 */
export function resetCommandRegistry(): void {
  globalRegistry = new CommandRegistryImpl();
}
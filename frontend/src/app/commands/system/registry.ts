

import type { Command, CommandRegistry, CommandContext, CommandResult } from './types';


export class CommandRegistryImpl implements CommandRegistry {
  private commands = new Map<string, Command>();
  private aliases = new Map<string, string>(); 

  register(command: Command): void {
    if (!command.name) throw new Error('Command name is required');
    if (this.commands.has(command.name)) throw new Error(`Command '${command.name}' is already registered`);

    this.commands.set(command.name, command);

    if (command.aliases) {
      for (const alias of command.aliases) {
        if (this.aliases.has(alias) || this.commands.has(alias)) {
          throw new Error(`Alias '${alias}' conflicts with existing command or alias`);
        }
        this.aliases.set(alias, command.name);
      }
    }
  }

  unregister(name: string): void {
    const command = this.commands.get(name);
    if (!command) return;

    command.aliases?.forEach(alias => this.aliases.delete(alias));
    this.commands.delete(name);
  }

  get(nameOrAlias: string): Command | undefined {
    return this.commands.get(nameOrAlias) ?? this.commands.get(this.aliases.get(nameOrAlias) ?? '');
  }

  getAll(): Command[] {
    return Array.from(this.commands.values());
  }

  getByCategory(category: string): Command[] {
    return Array.from(this.commands.values()).filter(cmd => cmd.category === category);
  }

  search(query: string): Command[] {
    const lowerQuery = query.toLowerCase().trim();
    if (!lowerQuery) return this.getAll();

    const results: Array<{ command: Command; score: number }> = [];

    for (const command of this.commands.values()) {
      const score = this.calculateSearchScore(command, lowerQuery);
      if (score > 0) results.push({ command, score });
    }

    return results.sort((a, b) => b.score - a.score).map(r => r.command);
  }

  canExecute(nameOrAlias: string, context: CommandContext, args: Record<string, string | number | boolean> = {}): boolean {
    const command = this.get(nameOrAlias);
    return !!command && (!command.guard || command.guard(context, args));
  }

  async execute(nameOrAlias: string, context: CommandContext, args: Record<string, string | number | boolean> = {}): Promise<CommandResult> {
    const command = this.get(nameOrAlias);
    if (!command) return { success: false, error: `Command '${nameOrAlias}' not found` };
    if (command.guard && !command.guard(context, args)) return { success: false, error: 'Command guard rejected execution' };

    try {
      return await command.execute(context, args);
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Unknown command error' };
    }
  }

  getAvailableNames(): string[] {
    return [...this.commands.keys(), ...this.aliases.keys()].sort((a, b) => a.localeCompare(b));
  }

  getHelp(nameOrAlias?: string): string {
    if (nameOrAlias) {
      const command = this.get(nameOrAlias);
      return command ? this.formatCommandHelp(command) : `Command '${nameOrAlias}' not found`;
    }

    const categories = this.groupByCategory();
    let help = 'Available Commands:\n\n';

    for (const [category, commands] of categories) {
      help += `${category.toUpperCase()}:\n`;
      for (const command of commands) {
        help += `  ${command.name}`;
        if (command.aliases?.length) help += ` (${command.aliases.join(', ')})`;
        help += ` - ${command.description}\n`;
      }
      help += '\n';
    }

    return help + 'Use "help <command>" for detailed information about a specific command.';
  }

  private calculateSearchScore(command: Command, query: string): number {
    const name = command.name.toLowerCase();
    let score = 0;

    if (name === query) score += 100;
    else if (name.startsWith(query)) score += 80;
    else if (name.includes(query)) score += 60;

    if (command.aliases) {
      for (const alias of command.aliases) {
        const lower = alias.toLowerCase();
        if (lower === query) score += 90;
        else if (lower.startsWith(query)) score += 70;
        else if (lower.includes(query)) score += 50;
      }
    }

    if (command.description.toLowerCase().includes(query)) score += 30;
    if (command.category?.toLowerCase().includes(query)) score += 20;

    return score;
  }

  private formatCommandHelp(command: Command): string {
    let help = `Command: ${command.name}\n`;

    if (command.aliases?.length) help += `Aliases: ${command.aliases.join(', ')}\n`;
    help += `Description: ${command.description}\n`;
    if (command.category) help += `Category: ${command.category}\n`;

    if (command.args?.length) {
      help += '\nArguments:\n';
      for (const arg of command.args) {
        help += `  --${arg.name} (${arg.type})`;
        if (arg.required) help += ' [required]';
        if (arg.default !== undefined) help += ` [default: ${arg.default}]`;
        if (arg.description) help += ` - ${arg.description}`;
        help += '\n';
      }
    }

    if (command.examples?.length) {
      help += '\nExamples:\n';
      command.examples.forEach(ex => help += `  ${ex}\n`);
    }

    return help;
  }

  private groupByCategory(): Map<string, Command[]> {
    const categories = new Map<string, Command[]>();

    for (const command of this.commands.values()) {
      const category = command.category || 'general';
      if (!categories.has(category)) categories.set(category, []);
      categories.get(category)?.push(command);
    }

    for (const commands of categories.values()) {
      commands.sort((a, b) => a.name.localeCompare(b.name));
    }

    return categories;
  }
}

let globalRegistry: CommandRegistryImpl | null = null;

export function getCommandRegistry(): CommandRegistryImpl {
  if (!globalRegistry) globalRegistry = new CommandRegistryImpl();
  return globalRegistry;
}

export function resetCommandRegistry(): void {
  globalRegistry = new CommandRegistryImpl();
}

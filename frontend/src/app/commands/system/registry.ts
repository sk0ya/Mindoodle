

import type { Command, CommandRegistry, CommandContext, CommandResult } from './types';


export class CommandRegistryImpl implements CommandRegistry {
  private commands = new Map<string, Command>();
  private aliases = new Map<string, string>(); 

  
  register(command: Command): void {
    
    if (!command.name) {
      throw new Error('Command name is required');
    }

    if (this.commands.has(command.name)) {
      throw new Error(`Command '${command.name}' is already registered`);
    }

    
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
    if (!command) {
      return; 
    }

    
    if (command.aliases) {
      for (const alias of command.aliases) {
        this.aliases.delete(alias);
      }
    }

    
    this.commands.delete(name);
  }

  
  get(nameOrAlias: string): Command | undefined {
    
    const command = this.commands.get(nameOrAlias);
    if (command) {
      return command;
    }

    
    const aliasTarget = this.aliases.get(nameOrAlias);
    if (aliasTarget) {
      return this.commands.get(aliasTarget);
    }

    return undefined;
  }

  
  getAll(): Command[] {
    return Array.from(this.commands.values());
  }

  
  getByCategory(category: string): Command[] {
    return Array.from(this.commands.values())
      .filter(cmd => cmd.category === category);
  }

  
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

    
    return results
      .sort((a, b) => b.score - a.score)
      .map(result => result.command);
  }

    async execute(nameOrAlias: string, context: CommandContext, args: Record<string, any> = {}): Promise<CommandResult> {
    const command = this.get(nameOrAlias);
    if (!command) {
      return { success: false, error: `Command '${nameOrAlias}' not found` };
    }

    if (command.guard && !command.guard(context, args)) {
      return { success: false, error: 'Command guard rejected execution' };
    }

    try {
      const res = await command.execute(context, args);
      return res;
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Unknown command error' };
    }
  }

  
  getAvailableNames(): string[] {
    const names = Array.from(this.commands.keys());
    const aliasNames = Array.from(this.aliases.keys());
    return [...names, ...aliasNames].sort();
  }

  
  getHelp(nameOrAlias?: string): string {
    if (nameOrAlias) {
      const command = this.get(nameOrAlias);
      if (!command) {
        return `Command '${nameOrAlias}' not found`;
      }
      return this.formatCommandHelp(command);
    }

    
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

  
  private calculateSearchScore(command: Command, query: string): number {
    let score = 0;

    
    if (command.name.toLowerCase() === query) {
      score += 100;
    }
    
    else if (command.name.toLowerCase().startsWith(query)) {
      score += 80;
    }
    
    else if (command.name.toLowerCase().includes(query)) {
      score += 60;
    }

    
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

    
    if (command.description.toLowerCase().includes(query)) {
      score += 30;
    }

    
    if (command.category?.toLowerCase().includes(query)) {
      score += 20;
    }

    return score;
  }

  
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

  
  private groupByCategory(): Map<string, Command[]> {
    const categories = new Map<string, Command[]>();

    for (const command of this.commands.values()) {
      const category = command.category || 'general';
      if (!categories.has(category)) {
        categories.set(category, []);
      }
      categories.get(category)!.push(command);
    }

    
    for (const commands of categories.values()) {
      commands.sort((a, b) => a.name.localeCompare(b.name));
    }

    return categories;
  }
}


let globalRegistry: CommandRegistryImpl | null = null;


export function getCommandRegistry(): CommandRegistryImpl {
  if (!globalRegistry) {
    globalRegistry = new CommandRegistryImpl();
  }
  return globalRegistry;
}


export function resetCommandRegistry(): void {
  globalRegistry = new CommandRegistryImpl();
}

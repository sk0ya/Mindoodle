/**
 * Command Parser
 * Parses user input strings into structured command objects
 */

import type { ParseResult, ParsedCommand, Command, CommandArg } from './types';

/**
 * Parse a command string into name and arguments
 * Supports formats like:
 * - "center"
 * - "delete node-123"
 * - "navigate up"
 * - "add-child --text 'Hello World' --edit"
 */
export function parseCommand(input: string): ParseResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return {
      success: false,
      error: 'Empty command'
    };
  }

  try {
    const tokens = tokenize(trimmed);
    if (tokens.length === 0) {
      return {
        success: false,
        error: 'No valid tokens found'
      };
    }

    const commandName = tokens[0];
    const args = parseArguments(tokens.slice(1));

    const parsedCommand: ParsedCommand = {
      name: commandName,
      args,
      rawInput: trimmed
    };

    return {
      success: true,
      command: parsedCommand
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Parse error'
    };
  }
}

/**
 * Validate parsed command arguments against command definition
 */
export function validateCommand(parsed: ParsedCommand, command: Command): ParseResult {
  if (!command.args || command.args.length === 0) {
    return { success: true, command: parsed };
  }

  const errors: string[] = [];
  const processedArgs: Record<string, any> = { ...parsed.args };

  // Check required arguments
  for (const argDef of command.args) {
    const value = processedArgs[argDef.name];

    if (argDef.required && (value === undefined || value === null)) {
      errors.push(`Required argument '${argDef.name}' is missing`);
      continue;
    }

    // Set default value if not provided
    if (value === undefined && argDef.default !== undefined) {
      processedArgs[argDef.name] = argDef.default;
      continue;
    }

    // Type validation
    if (value !== undefined) {
      const validationError = validateArgumentType(value, argDef);
      if (validationError) {
        errors.push(validationError);
      }
    }
  }

  if (errors.length > 0) {
    return {
      success: false,
      error: errors.join(', ')
    };
  }

  return {
    success: true,
    command: {
      ...parsed,
      args: processedArgs
    }
  };
}

/**
 * Tokenize input string, handling quotes and escape sequences
 */
function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = '';
  let i = 0;

  while (i < input.length) {
    const char = input[i];

    if (!inQuotes) {
      if (char === '"' || char === "'") {
        inQuotes = true;
        quoteChar = char;
      } else if (char === ' ' || char === '\t') {
        if (current) {
          tokens.push(current);
          current = '';
        }
      } else {
        current += char;
      }
    } else {
      if (char === quoteChar) {
        inQuotes = false;
        quoteChar = '';
      } else if (char === '\\' && i + 1 < input.length) {
        // Handle escape sequences
        const nextChar = input[i + 1];
        if (nextChar === quoteChar || nextChar === '\\') {
          current += nextChar;
          i++; // Skip next character
        } else {
          current += char;
        }
      } else {
        current += char;
      }
    }

    i++;
  }

  if (current) {
    tokens.push(current);
  }

  if (inQuotes) {
    throw new Error(`Unclosed quote: ${quoteChar}`);
  }

  return tokens;
}

/**
 * Parse arguments from token array
 * Supports both positional and named arguments:
 * - Positional: "center node-123"
 * - Named: "--text 'Hello World' --edit true"
 */
function parseArguments(tokens: string[]): Record<string, any> {
  const args: Record<string, any> = {};
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i];

    if (token.startsWith('--')) {
      // Named argument
      const argName = token.slice(2);
      if (i + 1 < tokens.length && !tokens[i + 1].startsWith('--')) {
        // Has value
        args[argName] = parseValue(tokens[i + 1]);
        i += 2;
      } else {
        // Boolean flag
        args[argName] = true;
        i++;
      }
    } else {
      // Positional argument - use index as key
      args[`_${i}`] = parseValue(token);
      i++;
    }
  }

  return args;
}

/**
 * Parse string value to appropriate type
 */
function parseValue(value: string): any {
  // Boolean
  if (value === 'true') return true;
  if (value === 'false') return false;

  // Number
  if (/^-?\d+$/.test(value)) {
    return parseInt(value, 10);
  }
  if (/^-?\d*\.\d+$/.test(value)) {
    return parseFloat(value);
  }

  // String (remove quotes if present)
  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  return value;
}

/**
 * Validate argument type against definition
 */
function validateArgumentType(value: any, argDef: CommandArg): string | null {
  switch (argDef.type) {
    case 'string':
      if (typeof value !== 'string') {
        return `Argument '${argDef.name}' must be a string`;
      }
      break;
    case 'number':
      if (typeof value !== 'number' || isNaN(value)) {
        return `Argument '${argDef.name}' must be a number`;
      }
      break;
    case 'boolean':
      if (typeof value !== 'boolean') {
        return `Argument '${argDef.name}' must be a boolean`;
      }
      break;
    case 'node-id':
      if (typeof value !== 'string' || !value.trim()) {
        return `Argument '${argDef.name}' must be a valid node ID`;
      }
      break;
  }
  return null;
}

/**
 * Generate command suggestions based on partial input
 */
export function generateSuggestions(input: string, availableCommands: Command[]): string[] {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) {
    return availableCommands.slice(0, 10).map(cmd => cmd.name);
  }

  const suggestions: string[] = [];

  // Direct name matches
  for (const cmd of availableCommands) {
    if (cmd.name.toLowerCase().startsWith(trimmed)) {
      suggestions.push(cmd.name);
    }
  }

  // Alias matches
  for (const cmd of availableCommands) {
    if (cmd.aliases) {
      for (const alias of cmd.aliases) {
        if (alias.toLowerCase().startsWith(trimmed)) {
          suggestions.push(alias);
        }
      }
    }
  }

  // Fuzzy matches (for typos)
  for (const cmd of availableCommands) {
    if (suggestions.length < 10 && levenshteinDistance(trimmed, cmd.name.toLowerCase()) <= 2) {
      suggestions.push(cmd.name);
    }
  }

  return [...new Set(suggestions)].slice(0, 10);
}

/**
 * Calculate Levenshtein distance for fuzzy matching
 */
function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));

  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,     // deletion
        matrix[j - 1][i] + 1,     // insertion
        matrix[j - 1][i - 1] + indicator // substitution
      );
    }
  }

  return matrix[b.length][a.length];
}
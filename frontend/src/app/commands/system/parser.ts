

import type { ParseResult, ParsedCommand, Command, CommandArg, ArgsMap, ArgPrimitive } from './types';


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
    if (!Array.isArray(tokens) || tokens.length === 0) {
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


export function validateCommand(parsed: ParsedCommand, command: Command): ParseResult {
  if (!command.args || command.args.length === 0) {
    return { success: true, command: parsed };
  }

  const errors: string[] = [];
  const processedArgs: ArgsMap = { ...parsed.args } as ArgsMap;



  for (const argDef of command.args) {
    const hasValue = argDef.name in processedArgs;
    const value = processedArgs[argDef.name];

    if (argDef.required && !hasValue) {
      errors.push(`Required argument '${argDef.name}' is missing`);
      continue;
    }


    if (!hasValue && argDef.default !== undefined) {
      processedArgs[argDef.name] = argDef.default as ArgPrimitive;
      continue;
    }


    if (hasValue) {
      const normalized = normalizeArgumentValue(value as unknown as ArgPrimitive, argDef);
      if (!normalized.ok) {
        errors.push(normalized.error);
      } else {
        processedArgs[argDef.name] = normalized.value;
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
function parseArguments(tokens: string[]): ArgsMap {
  const args: ArgsMap = {} as ArgsMap;
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i];
    if (!token) { i++; continue; }

    if (token.startsWith('--')) {

      const argName = token.slice(2);
      const next = tokens[i + 1];
      if (i + 1 < tokens.length && next && !next.startsWith('--')) {
        // assign raw token; conversion happens in validation
        args[argName] = parseValue(next);
        i += 2;
      } else {
        
        args[argName] = true;
        i++;
      }
    } else {
      // positional arg; conversion happens in validation
      args[`_${i}`] = parseValue(token);
      i++;
    }
  }

  return args;
}


function parseValue(value: string): string {
  // keep values as strings during tokenization; trim wrapping quotes if present
  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

type Normalized = { ok: true; value: ArgPrimitive } | { ok: false; error: string };

function normalizeArgumentValue(value: ArgPrimitive, argDef: CommandArg): Normalized {
  switch (argDef.type) {
    case 'string': {
      if (typeof value === 'string') return { ok: true, value };
      return { ok: true, value: String(value) as ArgPrimitive };
    }
    case 'number': {
      if (typeof value === 'number' && !Number.isNaN(value)) return { ok: true, value };
      if (typeof value === 'string') {
        const n = Number(value);
        if (!Number.isNaN(n)) return { ok: true, value: n as ArgPrimitive };
      }
      return { ok: false, error: `Argument '${argDef.name}' must be a number` };
    }
    case 'boolean': {
      if (typeof value === 'boolean') return { ok: true, value };
      if (typeof value === 'string') {
        if (value.toLowerCase() === 'true') return { ok: true, value: true };
        if (value.toLowerCase() === 'false') return { ok: true, value: false };
      }
      return { ok: false, error: `Argument '${argDef.name}' must be a boolean` };
    }
    case 'node-id': {
      const s = typeof value === 'string' ? value : String(value);
      if (s.trim().length > 0) return { ok: true, value: s as ArgPrimitive };
      return { ok: false, error: `Argument '${argDef.name}' must be a valid node ID` };
    }
    default:
      return { ok: true, value };
  }
}


export function generateSuggestions(input: string, availableCommands: Command[]): string[] {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) {
    return availableCommands.slice(0, 10).map(cmd => cmd.name);
  }

  const suggestions: string[] = [];

  
  for (const cmd of availableCommands) {
    if (cmd.name.toLowerCase().startsWith(trimmed)) {
      suggestions.push(cmd.name);
    }
  }

  
  for (const cmd of availableCommands) {
    if (cmd.aliases) {
      for (const alias of cmd.aliases) {
        if (alias.toLowerCase().startsWith(trimmed)) {
          suggestions.push(alias);
        }
      }
    }
  }

  
  for (const cmd of availableCommands) {
    if (suggestions.length < 10 && levenshteinDistance(trimmed, cmd.name.toLowerCase()) <= 2) {
      suggestions.push(cmd.name);
    }
  }

  return [...new Set(suggestions)].slice(0, 10);
}


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
        matrix[j][i - 1] + 1,     
        matrix[j - 1][i] + 1,     
        matrix[j - 1][i - 1] + indicator 
      );
    }
  }

  return matrix[b.length][a.length];
}

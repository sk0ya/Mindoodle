/**
 * Vim Key Sequence Parser
 * Handles parsing and validation of vim key sequences
 */

export interface VimSequenceResult {
  isComplete: boolean;
  isPartial: boolean;
  command?: string;
  shouldClear?: boolean;
}

// Vim command patterns with their key sequences
// This must match the vimCommandMap in useCommands.ts
const VIM_COMMAND_PATTERNS = {
  // Multi-key commands
  'zz': { keys: ['z', 'z'], command: 'zz' },
  'zt': { keys: ['z', 't'], command: 'zt' },
  'za': { keys: ['z', 'a'], command: 'za' },
  'zo': { keys: ['z', 'o'], command: 'zo' },
  'zc': { keys: ['z', 'c'], command: 'zc' },
  'zR': { keys: ['z', 'R'], command: 'zR' },
  'zM': { keys: ['z', 'M'], command: 'zM' },
  'dd': { keys: ['d', 'd'], command: 'dd' },
  'yy': { keys: ['y', 'y'], command: 'yy' },
  'gg': { keys: ['g', 'g'], command: 'gg' },
  'gt': { keys: ['g', 't'], command: 'gt' },
  'gT': { keys: ['g', 'T'], command: 'gT' },
  'ciw': { keys: ['c', 'i', 'w'], command: 'ciw' },
  '>>': { keys: ['>', '>'], command: '>>' },
  '<<': { keys: ['<', '<'], command: '<<' },

  // Single-key commands
  'h': { keys: ['h'], command: 'h' },
  'j': { keys: ['j'], command: 'j' },
  'k': { keys: ['k'], command: 'k' },
  'l': { keys: ['l'], command: 'l' },
  'i': { keys: ['i'], command: 'i' },
  'a': { keys: ['a'], command: 'a' },
  'A': { keys: ['A'], command: 'A' },
  'I': { keys: ['I'], command: 'I' },
  'o': { keys: ['o'], command: 'o' },
  'O': { keys: ['O'], command: 'O' },
  'p': { keys: ['p'], command: 'p' },
  'm': { keys: ['m'], command: 'm' },
  'M': { keys: ['M'], command: 'M' },
  'G': { keys: ['G'], command: 'G' },
  't': { keys: ['t'], command: 't' },
  'T': { keys: ['T'], command: 'T' },
  '0': { keys: ['0'], command: '0' },
  '/': { keys: ['/'], command: '/' },
  'n': { keys: ['n'], command: 'n' },
  'N': { keys: ['N'], command: 'N' },
  's': { keys: ['s'], command: 's' },
} as const;

// Generate all possible partial sequences
function generatePartialSequences(): Set<string> {
  const partials = new Set<string>();

  for (const pattern of Object.values(VIM_COMMAND_PATTERNS)) {
    for (let i = 1; i < pattern.keys.length; i++) {
      const partial = pattern.keys.slice(0, i).join('');
      partials.add(partial);
    }
  }

  return partials;
}

const PARTIAL_SEQUENCES = generatePartialSequences();

/**
 * Parse a vim key sequence and determine the result
 */
export function parseVimSequence(sequence: string): VimSequenceResult {
  // Don't normalize case to preserve uppercase commands like 'M'
  const normalizedSequence = sequence.trim();

  // Support numeric prefix for ordered-list conversion: "<number>m"
  // - Partial when only digits (wait for trailing 'm')
  // - Complete when digits followed by 'm'
  if (/^\d+$/.test(normalizedSequence)) {
    return {
      isComplete: false,
      isPartial: true
    };
  }
  if (/^(\d+)m$/.test(normalizedSequence)) {
    const m = normalizedSequence.match(/^(\d+)m$/);
    const num = m ? m[1] : '';
    return {
      isComplete: true,
      isPartial: false,
      // Encode numeric argument in the command string
      command: `m:${num}`
    };
  }

  // Check for complete commands
  for (const [key, pattern] of Object.entries(VIM_COMMAND_PATTERNS)) {
    if (key === normalizedSequence) {
      return {
        isComplete: true,
        isPartial: false,
        command: pattern.command
      };
    }
  }

  // Check for partial commands
  if (PARTIAL_SEQUENCES.has(normalizedSequence)) {
    return {
      isComplete: false,
      isPartial: true
    };
  }

  // Invalid sequence - should clear buffer
  return {
    isComplete: false,
    isPartial: false,
    shouldClear: true
  };
}

/**
 * Check if a key can be part of a vim sequence
 */
export function isValidVimKey(key: string): boolean {
  // Don't normalize case to preserve uppercase commands like 'M'
  const normalizedKey = key;

  // Check if this key starts any command or continues any partial sequence
  for (const pattern of Object.values(VIM_COMMAND_PATTERNS)) {
    if (pattern.keys.some(k => k === normalizedKey)) {
      return true;
    }
  }

  return false;
}

/**
 * Get all vim keys that should prevent default behavior
 */
export function getVimKeys(): string[] {
  const keys = new Set<string>();

  // Add all keys from patterns
  for (const pattern of Object.values(VIM_COMMAND_PATTERNS)) {
    pattern.keys.forEach(key => keys.add(key));
  }

  // Add special keys (must match useCommands vimCommandMap)
  // Let standard handler manage delete/backspace/tab/enter
  keys.add('escape');

  // Allow digits for numeric-prefixed commands like "3m"
  '0123456789'.split('').forEach(k => keys.add(k));

  return Array.from(keys);
}

/**
 * Check if a sequence can potentially become a valid command
 */
export function canSequenceContinue(sequence: string, newKey: string): boolean {
  // Don't normalize case to preserve uppercase commands like 'M'
  const testSequence = sequence + newKey;
  const result = parseVimSequence(testSequence);

  return result.isComplete || result.isPartial;
}

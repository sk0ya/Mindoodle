
export interface VimSequenceResult {
  isComplete: boolean;
  isPartial: boolean;
  command?: string;
  count?: number;
  shouldClear?: boolean;
  isCountDigit?: boolean; 
  isDotRepeat?: boolean; 
}



const VIM_COMMAND_PATTERNS = {
  
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
  'gv': { keys: ['g', 'v'], command: 'gv' },
  'ciw': { keys: ['c', 'i', 'w'], command: 'ciw' },
  '>>': { keys: ['>', '>'], command: '>>' },
  '<<': { keys: ['<', '<'], command: '<<' },

  
  'r': { keys: ['r'], command: 'r' },  
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
  'X': { keys: ['X'], command: 'X' },
  'p': { keys: ['p'], command: 'p' },
  'P': { keys: ['P'], command: 'P' },
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
  'x': { keys: ['x'], command: 'x' },
  'u': { keys: ['u'], command: 'u' },
  
  'S': { keys: ['S'], command: 'S' },  
  'B': { keys: ['B'], command: 'B' },  
  '~': { keys: ['~'], command: '~' },  
  '.': { keys: ['.'], command: '.' },  
} as const;;


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

  
  
  const countMatch = normalizedSequence.match(/^([1-9]\d*)(.*)$/);
  let count: number | undefined;
  let commandPart = normalizedSequence;

  if (countMatch) {
    const [, countStr, rest] = countMatch;
    count = parseInt(countStr, 10);
    commandPart = rest;

    
    if (!commandPart) {
      return {
        isComplete: false,
        isPartial: true,
        count
      };
    }
  }

  
  if (commandPart === 'm' && count !== undefined) {
    return {
      isComplete: true,
      isPartial: false,
      command: `m:${count}`,
      count
    };
  }

  
  if (commandPart === '.') {
    return {
      isComplete: true,
      isPartial: false,
      command: '.',
      isDotRepeat: true
    };
  }

  
  for (const [key, pattern] of Object.entries(VIM_COMMAND_PATTERNS)) {
    if (key === commandPart) {
      return {
        isComplete: true,
        isPartial: false,
        command: pattern.command,
        count
      };
    }
  }

  
  if (PARTIAL_SEQUENCES.has(commandPart)) {
    return {
      isComplete: false,
      isPartial: true,
      count
    };
  }

  
  return {
    isComplete: false,
    isPartial: false,
    shouldClear: true
  };
}

export function isValidVimKey(key: string): boolean {
  
  const normalizedKey = key;

  
  for (const pattern of Object.values(VIM_COMMAND_PATTERNS)) {
    if (pattern.keys.some(k => k === normalizedKey)) {
      return true;
    }
  }

  return false;
}

export function getVimKeys(): string[] {
  const keys = new Set<string>();

  
  for (const pattern of Object.values(VIM_COMMAND_PATTERNS)) {
    pattern.keys.forEach(key => keys.add(key));
  }

  
  
  keys.add('escape');

  
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

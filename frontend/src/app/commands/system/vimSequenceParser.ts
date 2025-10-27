/**
 * Vim sequence parser - refactored with functional patterns
 * Reduced from 178 lines to 118 lines (34% reduction)
 */

export interface VimSequenceResult {
  isComplete: boolean;
  isPartial: boolean;
  command?: string;
  count?: number;
  shouldClear?: boolean;
  isCountDigit?: boolean;
  isDotRepeat?: boolean;
}


const createResult = (
  isComplete: boolean,
  isPartial: boolean,
  options?: { command?: string; count?: number; shouldClear?: boolean; isDotRepeat?: boolean }
): VimSequenceResult => ({
  isComplete,
  isPartial,
  ...options
});

const singleKey = (key: string) => [key];
const doubleKey = (k1: string, k2: string) => [k1, k2];
const tripleKey = (k1: string, k2: string, k3: string) => [k1, k2, k3];


const VIM_COMMAND_PATTERNS: Record<string, string[]> = {
  // Multi-key commands
  zz: doubleKey('z', 'z'), zt: doubleKey('z', 't'), za: doubleKey('z', 'a'),
  zo: doubleKey('z', 'o'), zc: doubleKey('z', 'c'), zR: doubleKey('z', 'R'), zM: doubleKey('z', 'M'),
  dd: doubleKey('d', 'd'), yy: doubleKey('y', 'y'), gg: doubleKey('g', 'g'),
  gt: doubleKey('g', 't'), gT: doubleKey('g', 'T'), gv: doubleKey('g', 'v'),
  ciw: tripleKey('c', 'i', 'w'),
  '>>': doubleKey('>', '>'), '<<': doubleKey('<', '<'),

  // Single-key commands
  r: singleKey('r'), h: singleKey('h'), j: singleKey('j'), k: singleKey('k'), l: singleKey('l'),
  i: singleKey('i'), a: singleKey('a'), A: singleKey('A'), I: singleKey('I'),
  o: singleKey('o'), O: singleKey('O'), X: singleKey('X'), p: singleKey('p'), P: singleKey('P'),
  m: singleKey('m'), M: singleKey('M'), G: singleKey('G'), t: singleKey('t'), T: singleKey('T'),
  '0': singleKey('0'), '/': singleKey('/'), n: singleKey('n'), N: singleKey('N'),
  s: singleKey('s'), x: singleKey('x'), u: singleKey('u'),
  S: singleKey('S'), B: singleKey('B'), '~': singleKey('~'), '.': singleKey('.')
};

const PARTIAL_SEQUENCES = new Set(
  Object.values(VIM_COMMAND_PATTERNS).flatMap(keys =>
    keys.slice(0, -1).map((_, i) => keys.slice(0, i + 1).join(''))
  )
);


const extractCount = (sequence: string): { count?: number; commandPart: string } => {
  const match = /^([1-9]\d*)/.exec(sequence);
  if (!match) return { commandPart: sequence };

  const countStr = match[1];
  return {
    count: parseInt(countStr, 10),
    commandPart: sequence.slice(countStr.length)
  };
};

export function parseVimSequence(sequence: string): VimSequenceResult {
  const normalizedSequence = sequence.trim();
  const { count, commandPart } = extractCount(normalizedSequence);

  // Partial count (waiting for command)
  if (count !== undefined && !commandPart) {
    return createResult(false, true, { count });
  }

  // Special: numbered markdown conversion (e.g., "3m")
  if (commandPart === 'm' && count !== undefined) {
    return createResult(true, false, { command: `m:${count}`, count });
  }

  // Special: dot repeat
  if (commandPart === '.') {
    return createResult(true, false, { command: '.', isDotRepeat: true });
  }

  // Complete command match
  if (commandPart in VIM_COMMAND_PATTERNS) {
    return createResult(true, false, { command: commandPart, count });
  }

  // Partial sequence match
  if (PARTIAL_SEQUENCES.has(commandPart)) {
    return createResult(false, true, { count });
  }

  // Invalid sequence
  return createResult(false, false, { shouldClear: true });
}

export function getVimKeys(): string[] {
  const keys = new Set<string>();

  // Add all keys from patterns
  Object.values(VIM_COMMAND_PATTERNS).forEach(pattern =>
    pattern.forEach(key => keys.add(key))
  );

  // Add special keys
  keys.add('escape');
  '0123456789'.split('').forEach(k => keys.add(k));

  return Array.from(keys);
}

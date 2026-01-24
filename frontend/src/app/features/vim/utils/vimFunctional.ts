/**
 * Functional utilities for Vim mode
 * Declarative helpers to reduce vim-related code complexity
 */

import type { VimMode } from '../hooks/useVimMode';
import type { MindMapNode } from '@shared/types';
// removed unused pipe import

// === Mode Predicates ===

export const isNormalMode = (mode: VimMode): mode is 'normal' => mode === 'normal';
export const isInsertMode = (mode: VimMode): mode is 'insert' => mode === 'insert';
export const isVisualMode = (mode: VimMode): mode is 'visual' => mode === 'visual';
export const isCommandMode = (mode: VimMode): mode is 'command' => mode === 'command';
export const isSearchMode = (mode: VimMode): mode is 'search' => mode === 'search';
export const isJumpyMode = (mode: VimMode): mode is 'jumpy' => mode === 'jumpy';

export const modeIs = (expected: VimMode) => (actual: VimMode) => actual === expected;
export const modeIsOneOf = (...expected: VimMode[]) => (actual: VimMode) =>
  expected.includes(actual);

// === Mode Transitions ===

export type ModeTransition = {
  from: VimMode;
  to: VimMode;
  condition?: () => boolean;
};

export const canTransition = (transition: ModeTransition) =>
  !transition.condition || transition.condition();

export const transitionMode = (
  current: VimMode,
  transitions: ModeTransition[]
): VimMode => {
  const validTransition = transitions.find(
    t => t.from === current && canTransition(t)
  );
  return validTransition?.to ?? current;
};

// === Command Buffer ===

export const isDigit = (char: string): boolean => /^\d$/.test(char);
export const isMotion = (char: string): boolean => /^[hjklwbefntT[\]{}()%^$0G]$/.test(char);
export const isOperator = (char: string): boolean => /^[dycx<>]$/.test(char);
export const isModifier = (char: string): boolean => /^[ai]$/.test(char);

export const parseCount = (buffer: string): number | undefined => {
  const regex = /^(\d+)/;
  const match = regex.exec(buffer);
  return match ? parseInt(match[1], 10) : undefined;
};

export const extractMotion = (buffer: string): string | undefined => {
  const withoutCount = buffer.replace(/^\d+/, '');
  const regex = /[hjklwbefntT[\]{}()%^$0G]/;
  const match = regex.exec(withoutCount);
  return match ? match[0] : undefined;
};

export const extractOperator = (buffer: string): string | undefined => {
  const regex = /^[dycx<>]/;
  const match = regex.exec(buffer);
  return match ? match[0] : undefined;
};

export type VimCommand = {
  operator?: string;
  count?: number;
  motion?: string;
  modifier?: string;
  register?: string;
};

export const parseVimCommand = (buffer: string): VimCommand => {
  const count = parseCount(buffer);
  const operator = extractOperator(buffer);
  const motion = extractMotion(buffer);

  return {
    count,
    operator,
    motion
  };
};

// === Buffer Manipulation ===

export const appendToBuffer = (buffer: string, char: string): string =>
  buffer + char;

export const clearBuffer = (): string => '';

export const removeLastChar = (buffer: string): string =>
  buffer.slice(0, -1);

export const bufferLength = (buffer: string): number => buffer.length;

export const isBufferEmpty = (buffer: string): boolean => buffer.length === 0;

export const isBufferComplete = (buffer: string): boolean => {
  const cmd = parseVimCommand(buffer);
  return !!(cmd.motion || (cmd.operator && cmd.count));
};

// === Node Predicates ===

export const nodeHasChildren = (node: MindMapNode): boolean =>
  !!node.children && node.children.length > 0;

export const nodeIsCollapsed = (node: MindMapNode): boolean =>
  !!node.collapsed;

export const nodeIsExpanded = (node: MindMapNode): boolean =>
  !node.collapsed;

export const nodeIsCheckbox = (node: MindMapNode): boolean =>
  !!node.markdownMeta?.isCheckbox;

export const nodeIsChecked = (node: MindMapNode): boolean =>
  !!node.markdownMeta?.isChecked;

export const nodeHasLink = (node: MindMapNode): boolean =>
  Array.isArray(node.links) && node.links.length > 0;

// === Node Transformations ===

export const toggleNodeCollapsed = (node: MindMapNode): MindMapNode => ({
  ...node,
  collapsed: !node.collapsed
});

export const setNodeCollapsed = (collapsed: boolean) => (node: MindMapNode): MindMapNode => ({
  ...node,
  collapsed
});

export const toggleNodeChecked = (node: MindMapNode): MindMapNode => ({
  ...node,
  markdownMeta: {
    ...node.markdownMeta,
    isChecked: !node.markdownMeta?.isChecked
  }
});

export const updateNodeText = (text: string) => (node: MindMapNode): MindMapNode => ({
  ...node,
  text
});

export const updateNodeNote = (note: string) => (node: MindMapNode): MindMapNode => ({
  ...node,
  note
});

// === Search Helpers ===

export const searchInNode = (query: string, caseSensitive = false) => (node: MindMapNode): boolean => {
  const text = caseSensitive ? node.text : node.text.toLowerCase();
  const search = caseSensitive ? query : query.toLowerCase();
  return text.includes(search);
};

export const findNodesMatching = (
  nodes: MindMapNode[],
  predicate: (node: MindMapNode) => boolean
): MindMapNode[] => {
  const results: MindMapNode[] = [];

  const search = (nodes: MindMapNode[]) => {
    for (const node of nodes) {
      if (predicate(node)) results.push(node);
      if (node.children) search(node.children);
    }
  };

  search(nodes);
  return results;
};

export const searchNodes = (query: string, caseSensitive = false) =>
  (nodes: MindMapNode[]): MindMapNode[] =>
    findNodesMatching(nodes, searchInNode(query, caseSensitive));

// === Jump Labels ===

export const JUMP_CHARS = 'abcdefghijklmnopqrstuvwxyz';

export const generateJumpLabel = (index: number): string => {
  if (index < JUMP_CHARS.length) {
    return JUMP_CHARS[index];
  }
  const firstIndex = Math.floor(index / JUMP_CHARS.length) - 1;
  const secondIndex = index % JUMP_CHARS.length;
  return JUMP_CHARS[firstIndex] + JUMP_CHARS[secondIndex];
};

export const generateJumpLabels = (count: number): string[] =>
  Array.from({ length: count }, (_, i) => generateJumpLabel(i));

export const createJumpMapping = (nodeIds: string[]): Array<{ nodeId: string; label: string }> =>
  nodeIds.map((nodeId, index) => ({
    nodeId,
    label: generateJumpLabel(index)
  }));

// === Motion Helpers ===

export type Direction = 'up' | 'down' | 'left' | 'right';

export const motionToDirection = (motion: string): Direction | undefined => {
  const map: Record<string, Direction> = {
    h: 'left',
    j: 'down',
    k: 'up',
    l: 'right'
  };
  return map[motion];
};

export const directionToMotion = (direction: Direction): string => {
  const map: Record<Direction, string> = {
    left: 'h',
    down: 'j',
    up: 'k',
    right: 'l'
  };
  return map[direction];
};

// === Repeat Helpers ===

export const repeatAction = <T>(action: () => T, count: number): T[] =>
  Array.from({ length: count }, action);

export const repeatWith = <T>(count: number, action: () => T): T[] =>
  repeatAction(action, count);

// === State Composition ===

export type VimStateUpdate<T> = (state: T) => T;

export const composeUpdates = <T>(...updates: VimStateUpdate<T>[]) =>
  (state: T): T =>
    updates.reduce((acc, update) => update(acc), state);

export const updateIf = <T>(condition: boolean, update: VimStateUpdate<T>) =>
  (state: T): T =>
    condition ? update(state) : state;

export const updateWhen = <T>(predicate: (state: T) => boolean, update: VimStateUpdate<T>) =>
  (state: T): T =>
    predicate(state) ? update(state) : state;

// === Command Execution ===

export type CommandContext = {
  count?: number;
  register?: string;
  motion?: string;
};

export type CommandExecutor<T> = (context: CommandContext) => T;

export const withCount = (defaultCount: number) =>
  <T>(executor: CommandExecutor<T>) =>
    (context: CommandContext): T =>
      executor({ ...context, count: context.count ?? defaultCount });

export const withMotion = (defaultMotion: string) =>
  <T>(executor: CommandExecutor<T>) =>
    (context: CommandContext): T =>
      executor({ ...context, motion: context.motion ?? defaultMotion });

export const requireCount = <T>(executor: CommandExecutor<T>) =>
  (context: CommandContext): T | undefined =>
    context.count !== undefined ? executor(context) : undefined;

export const requireMotion = <T>(executor: CommandExecutor<T>) =>
  (context: CommandContext): T | undefined =>
    context.motion ? executor(context) : undefined;

// === Key Mapping ===

export type KeyMapping = {
  key: string;
  mode: VimMode;
  action: string | (() => void);
  description?: string;
};

export const createKeyMapping = (
  key: string,
  mode: VimMode,
  action: string | (() => void),
  description?: string
): KeyMapping => ({
  key,
  mode,
  action,
  description
});

export const findKeyMapping = (
  mappings: KeyMapping[],
  key: string,
  mode: VimMode
): KeyMapping | undefined =>
  mappings.find(m => m.key === key && m.mode === mode);

export const filterMappingsByMode = (mappings: KeyMapping[], mode: VimMode): KeyMapping[] =>
  mappings.filter(m => m.mode === mode);

// === Vim Command Builder ===

export class VimCommandBuilder {
  private command: VimCommand = {};

  withOperator(operator: string): this {
    this.command.operator = operator;
    return this;
  }

  withCount(count: number): this {
    this.command.count = count;
    return this;
  }

  withMotion(motion: string): this {
    this.command.motion = motion;
    return this;
  }

  withModifier(modifier: string): this {
    this.command.modifier = modifier;
    return this;
  }

  withRegister(register: string): this {
    this.command.register = register;
    return this;
  }

  build(): VimCommand {
    return this.command;
  }
}

export const createCommand = () => new VimCommandBuilder();

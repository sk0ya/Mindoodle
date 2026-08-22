import { describe, expect, it } from 'vitest';
import { generateSuggestions, parseCommand, validateCommand } from './parser';
import { parseVimSequence, getVimKeys } from './vimSequenceParser';
import { parseVimMappingsText } from '../../features/vim/utils/parseVimMappings';
import type { Command } from './types';

describe('command parser', () => {
  it('parses positional, named, quoted, and boolean arguments', () => {
    expect(parseCommand('center node-1')).toEqual({
      success: true,
      command: { name: 'center', args: { _0: 'node-1' }, rawInput: 'center node-1' },
    });
    expect(parseCommand('edit --text "Hello world" --force')).toEqual({
      success: true,
      command: { name: 'edit', args: { text: 'Hello world', force: true }, rawInput: 'edit --text "Hello world" --force' },
    });
    expect(parseCommand("edit --text 'it\\'s fine'").command?.args.text).toBe("it's fine");
  });

  it('reports empty and unterminated commands', () => {
    expect(parseCommand('   ')).toEqual({ success: false, error: 'Empty command' });
    expect(parseCommand('edit "unfinished')).toEqual({ success: false, error: 'Unclosed quote: "' });
  });

  it('validates required, default, and typed arguments', () => {
    const command: Command = {
      name: 'move',
      description: 'Move a node',
      args: [
        { name: 'nodeId', type: 'node-id', required: true },
        { name: 'count', type: 'number', default: 1 },
        { name: 'animate', type: 'boolean', default: false },
      ],
      execute: () => ({ success: true }),
    };

    const parsed = parseCommand('move --nodeId n1 --animate TRUE').command;
    if (!parsed) throw new Error('Expected command to parse');
    expect(validateCommand(parsed, command)).toEqual({
      success: true,
      command: { ...parsed, args: { nodeId: 'n1', animate: true, count: 1 } },
    });
    expect(validateCommand({ name: 'move', args: { nodeId: 'n1', count: 'bad' as never }, rawInput: '' }, command)).toEqual({
      success: false,
      error: "Argument 'count' must be a number",
    });
    expect(validateCommand({ name: 'move', args: {}, rawInput: '' }, command).error).toContain("Required argument 'nodeId' is missing");
  });

  it('generates prefix, alias, fuzzy, and capped suggestions', () => {
    const commands = Array.from({ length: 12 }, (_, index) => ({
      name: `command-${index}`,
      aliases: index === 0 ? ['cmd'] : undefined,
      description: 'test',
      execute: () => ({ success: true }),
    } satisfies Command));
    expect(generateSuggestions('', commands)).toHaveLength(10);
    expect(generateSuggestions('cmd', commands)).toContain('cmd');
    expect(generateSuggestions('comman-0', commands)).toContain('command-0');
  });
});

describe('vim sequence parser and mapping parser', () => {
  it('recognizes counts, partial sequences, special commands, and invalid input', () => {
    expect(parseVimSequence('3')).toEqual({ isComplete: false, isPartial: true, count: 3 });
    expect(parseVimSequence('3m')).toEqual({ isComplete: true, isPartial: false, command: 'm:3', count: 3 });
    expect(parseVimSequence('2dd')).toEqual({ isComplete: true, isPartial: false, command: 'dd', count: 2 });
    expect(parseVimSequence('g')).toEqual({ isComplete: false, isPartial: true });
    expect(parseVimSequence('.')).toEqual({ isComplete: true, isPartial: false, command: '.', isDotRepeat: true });
    expect(parseVimSequence('invalid')).toEqual({ isComplete: false, isPartial: false, shouldClear: true });
    expect(getVimKeys()).toEqual(expect.arrayContaining(['g', 'escape', '0', '9']));
  });

  it('parses leaders, mappings, unmapping, errors, and warnings', () => {
    const result = parseVimMappingsText(`
      " comment
      set leader <Space>
      nnoremap <leader>w :write<CR>
      map jj <Esc>
      unmap jj
      map
      set leader too-long
      unknown value
    `);
    expect(result.leader).toBe(' ');
    expect(result.mappings).toEqual({ '<leader>w': ':write<CR>' });
    expect(result.errors).toEqual([
      'Line 7: Usage: map <lhs> <rhs>',
      'Line 8: leader must be a single character or <Space>',
    ]);
    expect(result.warnings).toEqual(['Line 9: Unknown directive "unknown"']);
  });
});

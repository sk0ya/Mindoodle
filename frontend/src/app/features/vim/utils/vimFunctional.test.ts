import { describe, expect, it } from 'vitest';
import {
  VimCommandBuilder,
  appendToBuffer,
  createJumpMapping,
  createKeyMapping,
  generateLabels,
  isBufferComplete,
  parseVimCommand,
  searchInNode,
  findNodesMatching,
  toggleNodeChecked,
  toggleNodeCollapsed,
  withCount,
} from './vimFunctional';
import type { MindMapNode } from '@shared/types';

const node = (id: string, text: string, children: MindMapNode[] = []): MindMapNode => ({
  id,
  text,
  x: 0,
  y: 0,
  fontSize: 14,
  fontWeight: 'normal',
  children,
});

describe('vimFunctional', () => {
  it('parses counts, operators, and motions independently', () => {
    expect(parseVimCommand('2dw')).toEqual({ count: 2, operator: 'd', motion: 'w' });
    expect(parseVimCommand('2w')).toEqual({ count: 2, operator: undefined, motion: 'w' });
    expect(parseVimCommand('')).toEqual({ count: undefined, operator: undefined, motion: undefined });
  });

  it('only marks a command complete once it contains a motion', () => {
    expect(isBufferComplete('h')).toBe(true);
    expect(isBufferComplete('dw')).toBe(true);
    expect(isBufferComplete('2dw')).toBe(true);
    expect(isBufferComplete('d')).toBe(false);
    expect(isBufferComplete('2d')).toBe(false);
    expect(isBufferComplete('d2')).toBe(false);
  });

  it('supports immutable node transformations', () => {
    const original = node('n1', 'Task');
    const collapsed = toggleNodeCollapsed(original);
    const checked = toggleNodeChecked(original);

    expect(collapsed).toMatchObject({ id: 'n1', collapsed: true });
    expect(checked.markdownMeta?.isChecked).toBe(true);
    expect(original.collapsed).toBeUndefined();
    expect(original.markdownMeta).toBeUndefined();
  });

  it('finds matching nodes recursively and preserves traversal order', () => {
    const tree = [node('root', 'Project', [node('child', 'Review'), node('other', 'Build')])];
    expect(findNodesMatching(tree, searchInNode('re')).map(n => n.id)).toEqual(['child']);
    expect(searchInNode('project', true)(tree[0])).toBe(false);
    expect(searchInNode('project')(tree[0])).toBe(true);
  });

  it('generates deterministic labels, mappings, and builder output', () => {
    expect(generateLabels(5, 'ab')).toEqual(['a', 'b', 'aa', 'ab', 'ba']);
    expect(createJumpMapping(['a', 'b'])).toHaveLength(2);
    expect(createKeyMapping('x', 'normal', 'delete', 'Delete')).toEqual({
      key: 'x', mode: 'normal', action: 'delete', description: 'Delete'
    });
    expect(new VimCommandBuilder().withOperator('d').withCount(2).withMotion('w').build())
      .toEqual({ operator: 'd', count: 2, motion: 'w' });
    expect(appendToBuffer('d', 'w')).toBe('dw');
  });

  it('injects a default count without overwriting an explicit count', () => {
    const execute = withCount(1)((ctx) => ctx.count);
    expect(execute({})).toBe(1);
    expect(execute({ count: 3 })).toBe(3);
  });
});

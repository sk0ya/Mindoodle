import { describe, expect, it } from 'vitest';
import {
  cloneNode,
  createChildNode,
  createNode,
  createNodesFromTexts,
  createRootNode,
} from './nodeFactory';

describe('markdown node factory', () => {
  it('creates nodes with defaults and options', () => {
    const node = createNode('hello', { x: 10, y: 20, fontSize: 18, fontWeight: 'bold', note: 'note' });
    expect(node).toMatchObject({ text: 'hello', x: 10, y: 20, fontSize: 18, fontWeight: 'bold', note: 'note', children: [], lineEnding: '\n' });
    expect(node.id).toEqual(expect.any(String));
    expect(createRootNode('root', '\r\n').lineEnding).toBe('\r\n');
  });

  it('inherits a parent line ending and clones with a new id', () => {
    const parent = createNode('parent', { lineEnding: '\r\n' });
    const child = createChildNode('child', parent);
    const clone = cloneNode(parent, { text: 'copy' });
    expect(child.lineEnding).toBe('\r\n');
    expect(clone).toMatchObject({ text: 'copy', lineEnding: '\r\n' });
    expect(clone.id).not.toBe(parent.id);
  });

  it('creates evenly spaced nodes from text', () => {
    const nodes = createNodesFromTexts(['a', 'b', 'c'], { startX: 5, startY: 10, verticalSpacing: 25 });
    expect(nodes.map(node => ({ text: node.text, x: node.x, y: node.y })))
      .toEqual([
        { text: 'a', x: 5, y: 10 },
        { text: 'b', x: 5, y: 35 },
        { text: 'c', x: 5, y: 60 },
      ]);
  });
});

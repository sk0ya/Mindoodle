import { describe, expect, it } from 'vitest';
import type { MindMapNode } from '@shared/types';
import {
  findNodeById,
  findNodeInData,
  findNodeInRoots,
  findNodePathById,
  findParentNode,
  getSiblingNodes,
  isMindMapNode,
  isRootNode,
  removeNodeFromTree,
  traverseNodes,
  updateNodeInTree,
  validateMindMapNode,
} from './nodeOperations';

const node = (id: string, text: string, children: MindMapNode[] = [], overrides: Partial<MindMapNode> = {}): MindMapNode => ({
  id,
  text,
  x: 0,
  y: 0,
  fontSize: 14,
  fontWeight: 'normal',
  children,
  ...overrides,
});

const root = node('root', 'Root', [node('child', 'Child', [node('leaf', 'Leaf')]), node('sibling', 'Sibling')]);

describe('nodeOperations', () => {
  it('finds nodes and structural relationships', () => {
    expect(findNodeById(root, 'leaf')?.text).toBe('Leaf');
    expect(findNodeById(root, 'missing')).toBeNull();
    expect(findNodePathById(root, 'leaf')?.map(n => n.id)).toEqual(['root', 'child', 'leaf']);
    expect(findNodePathById(root, 'missing')).toBeNull();
    expect(findParentNode(root, 'leaf')?.id).toBe('child');
    expect(findParentNode(root, 'root')).toBeNull();
    expect(findNodeInRoots([root], 'sibling')?.id).toBe('sibling');
    expect(findNodeInRoots(undefined, 'sibling')).toBeNull();
    expect(findNodeInData({ rootNodes: [root] }, 'child')?.id).toBe('child');
    expect(findNodeInData(null, 'child')).toBeNull();
    expect(getSiblingNodes(root, 'child')).toMatchObject({ currentIndex: 0, siblings: [root.children[0], root.children[1]] });
    expect(getSiblingNodes(root, 'root')).toMatchObject({ currentIndex: 0, siblings: [root] });
    expect(isRootNode(root, 'root')).toBe(true);
    expect(isRootNode(root, 'child')).toBe(false);
  });

  it('traverses and immutably updates/removes nodes', () => {
    const visited: string[] = [];
    traverseNodes(root, current => visited.push(current.id));
    expect(visited).toEqual(['root', 'child', 'leaf', 'sibling']);

    const updated = updateNodeInTree(root, 'leaf', current => ({ ...current, text: 'Updated' }));
    expect(findNodeById(updated, 'leaf')?.text).toBe('Updated');
    expect(findNodeById(root, 'leaf')?.text).toBe('Leaf');
    const removed = removeNodeFromTree(root, 'child');
    expect(removed.children.map(n => n.id)).toEqual(['sibling']);
    expect(root.children.map(n => n.id)).toEqual(['child', 'sibling']);
  });

  it('validates complete nodes recursively and rejects non-finite coordinates', () => {
    expect(validateMindMapNode(root)).toEqual({ isValid: true, errors: [] });
    expect(isMindMapNode(root)).toBe(true);

    const invalid = { ...root, x: Number.NaN };
    const result = validateMindMapNode(invalid);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Missing or invalid node x coordinate');
    expect(isMindMapNode(invalid)).toBe(false);

    const invalidChild = { ...root, children: [{ ...root.children[0], text: 42 }] };
    expect(validateMindMapNode(invalidChild).errors[0]).toContain('Invalid child node at index 0');
    expect(isMindMapNode(invalidChild)).toBe(false);
    expect(validateMindMapNode(null).errors).toEqual(['Node must be an object']);
  });
});

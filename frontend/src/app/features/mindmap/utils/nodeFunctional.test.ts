import { describe, expect, it } from 'vitest';
import type { MindMapNode } from '@shared/types';
import {
  appendChild,
  collapse,
  cloneNode,
  cloneWithNewIds,
  countChildren,
  countDescendants,
  countNodes,
  expand,
  filterTree,
  findAll,
  findById,
  findNode,
  flatten,
  flattenVisible,
  getDepth,
  getParent,
  getPath,
  getSiblingIndex,
  getSiblings,
  hasChildren,
  hasImage,
  hasLink,
  hasNote,
  isCheckbox,
  isChecked,
  isCollapsed,
  isExpanded,
  isHeading,
  isList,
  mapTree,
  matchesText,
  maxDepth,
  moveBy,
  nodesEqual,
  prependChild,
  removeNode,
  setChecked,
  setCollapsed,
  setNote,
  setText,
  sortByText,
  toggleChecked,
  toggleCollapsed,
  treesEqual,
  updateNode,
  updatePosition,
  validateTree,
} from './nodeFunctional';

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

const tree = (): MindMapNode => node('root', 'Root', [
  node('a', 'Alpha', [node('a1', 'Alpha child')]),
  node('b', 'Beta', [], { collapsed: true }),
]);

describe('nodeFunctional', () => {
  it('supports predicates for content and markdown metadata', () => {
    const target = node('n', 'Task', [node('child', 'Child')], {
      note: ' note ',
      links: [{ id: 'l' }],
      customImageWidth: 120,
      markdownMeta: { type: 'unordered-list', isCheckbox: true, isChecked: true, level: 2 },
    });

    expect(hasChildren(target)).toBe(true);
    expect(isCollapsed(target)).toBe(false);
    expect(isExpanded(target)).toBe(true);
    expect(isCheckbox(target)).toBe(true);
    expect(isChecked(target)).toBe(true);
    expect(hasNote(target)).toBe(true);
    expect(hasLink(target)).toBe(true);
    expect(hasImage(target)).toBe(true);
    expect(isHeading(2)(node('h', 'H', [], { markdownMeta: { type: 'heading', level: 2 } }))).toBe(true);
    expect(isList(target)).toBe(true);
    expect(matchesText('TASK')(target)).toBe(true);
    expect(matchesText('task', true)(target)).toBe(false);
  });

  it('transforms nodes immutably and preserves unrelated fields', () => {
    const original = node('n', 'Old', [], { x: 1, y: 2, note: 'old' });
    expect(setText('New')(original)).toMatchObject({ id: 'n', text: 'New', note: 'old' });
    expect(setNote('new note')(original).note).toBe('new note');
    expect(setCollapsed(true)(original).collapsed).toBe(true);
    expect(toggleCollapsed(original).collapsed).toBe(true);
    expect(expand(setCollapsed(true)(original)).collapsed).toBe(false);
    expect(collapse(original).collapsed).toBe(true);
    expect(updatePosition(8, 9)(original)).toMatchObject({ x: 8, y: 9 });
    expect(moveBy(3, -1)(original)).toMatchObject({ x: 4, y: 1 });
    expect(original).toMatchObject({ text: 'Old', x: 1, y: 2, note: 'old' });
  });

  it('updates checkbox metadata without dropping existing metadata', () => {
    const original = node('n', 'Task', [], { markdownMeta: { type: 'unordered-list', level: 1 } });
    const checked = setChecked(true)(original);
    expect(checked.markdownMeta).toMatchObject({ type: 'unordered-list', level: 1, isChecked: true });
    expect(toggleChecked(checked).markdownMeta?.isChecked).toBe(false);
  });

  it('maps, filters, finds, and flattens trees', () => {
    const original = tree();
    const mapped = mapTree(setText('mapped'))(original);
    expect(flatten(mapped).map(n => n.text)).toEqual(['mapped', 'mapped', 'mapped', 'mapped']);
    expect(original.text).toBe('Root');
    expect(flattenVisible(original).map(n => n.id)).toEqual(['root', 'a', 'a1', 'b']);
    expect(flattenVisible(node('root', 'Root', [node('b', 'Beta', [node('b1', 'hidden')])], { collapsed: false }))).toHaveLength(3);
    expect(filterTree(n => n.id !== 'a')(original)?.children?.map(n => n.id)).toEqual(['b']);
    expect(filterTree(() => false)(original)).toBeNull();
    expect(findNode(n => n.text === 'Alpha child')(original)?.id).toBe('a1');
    expect(findById('b')(original)?.text).toBe('Beta');
    expect(findNode(() => false)(original)).toBeNull();
    expect(findAll(n => n.text.startsWith('A'))(original).map(n => n.id)).toEqual(['a', 'a1']);
  });

  it('returns paths, parents, siblings, and depths including root nodes', () => {
    const original = tree();
    expect(getDepth(original, 'a1')).toBe(2);
    expect(getDepth(original, 'missing')).toBe(-1);
    expect(getPath(original, 'a1').map(n => n.id)).toEqual(['root', 'a', 'a1']);
    expect(getPath(original, 'missing')).toEqual([]);
    expect(getParent(original, 'a1')?.id).toBe('a');
    expect(getParent(original, 'root')).toBeNull();
    expect(getSiblings(original, 'a').map(n => n.id)).toEqual(['a', 'b']);
    expect(getSiblings(original, 'root').map(n => n.id)).toEqual(['root']);
    expect(getSiblings(original, 'missing')).toEqual([]);
    expect(getSiblingIndex(original, 'b')).toBe(1);
    expect(getSiblingIndex(original, 'root')).toBe(0);
  });

  it('inserts and removes descendants without mutating the source', () => {
    const original = tree();
    const child = node('new', 'New');
    const appended = appendChild('a', child)(original);
    expect(appended.children?.[0].children?.map(n => n.id)).toEqual(['a1', 'new']);
    const prepended = prependChild('a', node('first', 'First'))(original);
    expect(prepended.children?.[0].children?.[0].id).toBe('first');
    expect(original.children?.[0].children).toHaveLength(1);
    expect(removeNode('a1')(original).children?.[0].children).toEqual([]);
    expect(() => removeNode('root')(original)).toThrow('Cannot remove root node');
  });

  it('calculates statistics, sorting, cloning, and equality', () => {
    const original = tree();
    expect(countNodes(original)).toBe(4);
    expect(countChildren(original)).toBe(2);
    expect(countDescendants(original)).toBe(3);
    expect(maxDepth(original)).toBe(3);
    expect(sortByText(node('r', 'R', [node('z', 'Z'), node('a', 'A')])).children?.map(n => n.id)).toEqual(['a', 'z']);
    const cloned = cloneNode(original);
    expect(cloned).toEqual(original);
    expect(cloned).not.toBe(original);
    expect(cloned.children?.[0]).not.toBe(original.children?.[0]);
    let nextId = 0;
    const rekeyed = cloneWithNewIds(original, () => `new-${++nextId}`);
    expect(flatten(rekeyed).map(n => n.id)).toEqual(['new-1', 'new-2', 'new-3', 'new-4']);
    expect(nodesEqual(original, cloneNode(original))).toBe(true);
    expect(treesEqual(original, cloneNode(original))).toBe(true);
    expect(treesEqual(original, updateNode('a', setText('changed'))(original))).toBe(false);
    expect(validateTree(original)).toBe(true);
  });
});

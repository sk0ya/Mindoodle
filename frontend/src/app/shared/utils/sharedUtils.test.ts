import { describe, expect, it, beforeEach } from 'vitest';
import {
  buildChildPath,
  buildWorkspacePath,
  cleanWorkspacePath,
  extractParentPaths,
  extractWorkspaceId,
  normalizePathSeparators,
  parseWorkspacePath,
  resolveWorkspaceId,
} from './pathOperations';
import {
  buildMapUrl,
  getMapTargetFromUrl,
} from './mapUrl';
import {
  getFileExtension,
  getFileName,
  getFileNameWithoutExtension,
  getParentPath,
  hasExtension,
  isEmpty,
  joinPath,
  normalizePath,
  sanitizeFileName,
  splitPath,
  truncateString,
} from './stringUtils';
import {
  parseStoredJson,
  safeJsonParse,
  safeJsonParseWithDefault,
  safeJsonStringify,
  storeJson,
} from './safeJson';
import {
  cloneNodeTree,
  countNodes,
  findNodeById,
  findNodePath,
  findParentNode,
  flattenVisibleNodes,
  getNodeDepth,
  getSiblings,
  isAncestor,
  findNodeBySpatialDirection,
} from './treeUtils';
import type { MindMapNode } from '@shared/types';

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

describe('shared data and path utilities', () => {
  beforeEach(() => localStorage.clear());

  it('handles safe JSON parsing, defaults, storage, and circular values', () => {
    expect(safeJsonParse<{ value: number }>('{"value": 3}')).toEqual({ success: true, data: { value: 3 } });
    expect(safeJsonParse('{invalid}').success).toBe(false);
    expect(safeJsonParseWithDefault('invalid', { value: 0 })).toEqual({ value: 0 });
    expect(safeJsonParseWithDefault('null', { value: 0 })).toBeNull();
    expect(safeJsonStringify({ value: 3 }).data).toBe('{"value":3}');

    expect(storeJson('settings', { compact: true })).toBe(true);
    expect(parseStoredJson('settings', { compact: false })).toEqual({ compact: true });
    expect(parseStoredJson('missing', { compact: false })).toEqual({ compact: false });

    const circular: { self?: unknown } = {};
    circular.self = circular;
    expect(safeJsonStringify(circular).success).toBe(false);
  });

  it('parses and builds workspace paths consistently', () => {
    expect(extractWorkspaceId('/ws_demo/maps/main')).toBe('ws_demo');
    expect(extractWorkspaceId('cloud/maps/main')).toBe('cloud');
    expect(extractWorkspaceId('local/maps/main')).toBeNull();
    expect(parseWorkspacePath('/ws_demo/maps/main')).toEqual({ workspaceId: 'ws_demo', relativePath: 'maps/main' });
    expect(parseWorkspacePath('cloud')).toEqual({ workspaceId: 'cloud', relativePath: null });
    expect(cleanWorkspacePath('/group/docs/map')).toBe('docs/map');
    expect(buildWorkspacePath('ws_demo', 'maps/main')).toBe('/ws_demo/maps/main');
    expect(buildWorkspacePath('cloud', null)).toBe('/cloud');
    expect(buildChildPath(null, 'map.md')).toBe('map.md');
    expect(buildChildPath('docs', 'map.md')).toBe('docs/map.md');
    expect(extractParentPaths('a/b/c')).toEqual(['a', 'a/b']);
    expect(normalizePathSeparators('/a//b/')).toBe('a/b');
    expect(resolveWorkspaceId(null, 'ws_fallback')).toBe('ws_fallback');
    expect(resolveWorkspaceId(null, null)).toBe('local');
  });

  it('handles map URL query and hash formats', () => {
    const queryLocation = new URL('https://example.test/Mindoodle/?map=docs/main.md&workspace=ws_1');
    expect(getMapTargetFromUrl(queryLocation)).toEqual({ mapId: 'docs/main', workspaceId: 'ws_1' });

    const hashLocation = new URL('https://example.test/Mindoodle/#/map/docs%2Fmain.md?workspaceId=ws_2');
    expect(getMapTargetFromUrl(hashLocation)).toEqual({ mapId: 'docs/main', workspaceId: 'ws_2' });
    expect(getMapTargetFromUrl(new URL('https://example.test/Mindoodle/'))).toBeNull();

    expect(buildMapUrl(new URL('https://example.test/Mindoodle/?mapId=old#ignored'), {
      mapId: 'docs/main.md',
      workspaceId: 'ws_3',
    })).toBe('/Mindoodle/?map=docs%2Fmain.md&workspace=ws_3');
  });

  it('provides path and string helpers', () => {
    expect(getFileName('docs/main.md')).toBe('main.md');
    expect(getParentPath('docs/main.md')).toBe('docs');
    expect(splitPath('/docs//main/')).toEqual(['docs', 'main']);
    expect(joinPath('', 'docs', 'main.md')).toBe('docs/main.md');
    expect(getFileNameWithoutExtension('.env')).toBe('.env');
    expect(getFileNameWithoutExtension('main.md')).toBe('main');
    expect(getFileExtension('main.md')).toBe('md');
    expect(hasExtension('main.MD', ['txt', 'md'])).toBe(true);
    expect(sanitizeFileName('a:b?.md')).toBe('a_b_.md');
    expect(truncateString('abcdef', 5)).toBe('ab...');
    expect(isEmpty('  ')).toBe(true);
    expect(normalizePath('//docs///main/')).toBe('docs/main');
  });

  it('finds, traverses, clones, and navigates node trees', () => {
    const childA = node('a', 'A', [], { x: 30, y: 0 });
    const childB = node('b', 'B', [], { x: 0, y: 40 });
    const root = node('root', 'Root', [childA, childB], { x: 0, y: 0 });
    const roots = [root];

    expect(findNodeById(roots, 'b')?.text).toBe('B');
    expect(findParentNode(roots, 'b')).toEqual({ parent: root, index: 1 });
    expect(findNodePath(roots, 'b')?.map(item => item.id)).toEqual(['root', 'b']);
    expect(getSiblings(roots, 'a')?.index).toBe(0);
    expect(getNodeDepth(roots, 'b')).toBe(1);
    expect(countNodes(roots)).toBe(3);
    expect(isAncestor(roots, 'root', 'b')).toBe(true);
    expect(isAncestor(roots, 'root', 'root')).toBe(false);
    expect(isAncestor(roots, 'b', 'root')).toBe(false);

    root.collapsed = true;
    expect(flattenVisibleNodes(root).map(item => item.id)).toEqual(['root']);
    const copy = cloneNodeTree(root);
    copy.children.push(node('c', 'C'));
    expect(root.children).toHaveLength(2);

    root.collapsed = false;
    expect(findNodeBySpatialDirection('root', 'right', root)).toBe('a');
    expect(findNodeBySpatialDirection('root', 'down', root)).toBe('b');
  });
});

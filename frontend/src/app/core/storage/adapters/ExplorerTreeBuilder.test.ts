import { describe, expect, it, vi } from 'vitest';
import {
  buildExplorerItems,
  buildRootExplorerTree,
  buildWorkspacesExplorerTree,
  countMarkdownFiles,
  findAllMarkdownFiles,
} from './ExplorerTreeBuilder';

const entries = async function* (items: FileSystemHandle[]) {
  yield* items;
};

const directory = (name: string, children: FileSystemHandle[] = []): FileSystemDirectoryHandle => ({
  kind: 'directory', name,
  values: () => entries(children),
  entries: async function* () {
    for (const child of children) yield [child.name, child] as [string, FileSystemHandle];
  }
} as unknown as FileSystemDirectoryHandle);

const markdown = (name: string): FileSystemFileHandle => ({ kind: 'file', name } as FileSystemFileHandle);
const withPermission = (handle: FileSystemDirectoryHandle, status: 'granted' | 'denied') =>
  Object.assign(handle, { queryPermission: vi.fn().mockResolvedValue(status) });

describe('ExplorerTreeBuilder', () => {
  it('builds a sorted tree and ignores non-markdown files', async () => {
    const tree = await buildExplorerItems(directory('root', [
      markdown('z.txt'), markdown('b.md'),
      directory('z-folder', [markdown('nested.md')]), directory('a-folder')
    ]), '');

    expect(tree.map(item => item.name)).toEqual(['a-folder', 'z-folder', 'b.md']);
    expect(tree[1]?.children?.[0]).toMatchObject({ name: 'nested.md', path: 'z-folder/nested.md' });
  });

  it('builds root trees with permission denied and granted paths', async () => {
    const denied = withPermission(directory('workspace'), 'denied');
    const deniedTree = await buildRootExplorerTree(denied, false);
    expect(deniedTree).toMatchObject({ name: 'workspace', children: [] });

    const root = directory('workspace', [markdown('one.md')]);
    const grantedTree = await buildRootExplorerTree(root, true);
    expect(grantedTree.children).toMatchObject([{ name: 'one.md', type: 'file' }]);
  });

  it('marks workspaces requiring permission and counts/finds markdown recursively', async () => {
    const denied = withPermission(directory('denied'), 'denied');
    const allowed = directory('allowed', [markdown('a.md'), directory('nested', [markdown('b.MD')])]);
    const root = await buildWorkspacesExplorerTree([
      { id: 'ws-denied', name: 'Denied', handle: denied },
      { id: 'ws-allowed', name: 'Allowed', handle: allowed }
    ], false);
    expect(root.children?.[0]).toMatchObject({ name: 'Denied (権限が必要)', children: [] });
    expect(root.children?.[1]?.children).toHaveLength(2);

    expect(await countMarkdownFiles(allowed)).toBe(2);
    const files = await findAllMarkdownFiles(allowed);
    expect(files.map(item => item.path)).toEqual(['a.md', 'nested/b.MD']);
  });
});

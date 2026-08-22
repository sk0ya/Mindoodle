import { describe, expect, it, vi } from 'vitest';
import {
  getFileName,
  hasContentChanged,
  loadMarkdownAsMapData,
  parseMarkdownToMapData,
  readMarkdownFile,
  saveMapDataToFile,
  writeMarkdownFile,
} from './MarkdownFileIO';

type Writable = { write: (content: string) => Promise<void>; close: () => Promise<void> };
type TestFileHandle = FileSystemFileHandle & {
  getFile: () => Promise<File>;
  createWritable: () => Promise<Writable>;
};

const fileHandle = (content: string, name = 'map.md'): TestFileHandle => {
  const file = {
    name,
    lastModified: 123,
    text: vi.fn(async () => content),
  } as unknown as File;
  const writable: Writable = { write: vi.fn(async () => undefined), close: vi.fn(async () => undefined) };
  return {
    kind: 'file',
    name,
    getFile: vi.fn(async () => file),
    createWritable: vi.fn(async () => writable),
  } as unknown as TestFileHandle;
};

describe('MarkdownFileIO', () => {
  it('reads file metadata and parses structured markdown with complete defaults', async () => {
    const handle = fileHandle('# Project\n- Task');
    expect(await readMarkdownFile(handle)).toBe('# Project\n- Task');
    expect(await getFileName(handle)).toBe('map.md');
    const data = await parseMarkdownToMapData('# Project\n- Task', 'project', 'ws_1');
    expect(data).toMatchObject({
      title: 'project',
      mapIdentifier: { mapId: 'project', workspaceId: 'ws_1' },
      settings: { autoSave: true, autoLayout: true, showGrid: false, animationEnabled: true },
    });
    expect(data?.rootNodes).toHaveLength(1);
    expect(await parseMarkdownToMapData('', 'empty', 'ws_1')).not.toBeNull();
  });

  it('writes content and avoids redundant writes', async () => {
    const handle = fileHandle('# Project');
    const writable = await handle.createWritable();
    await writeMarkdownFile(handle, '# New');
    expect(handle.createWritable).toHaveBeenCalledTimes(2);
    expect(writable.write).toHaveBeenCalledWith('# New');
    expect(hasContentChanged(undefined, 'x')).toBe(true);
    expect(hasContentChanged('x', 'x')).toBe(false);

    const target = {
      dir: { getFileHandle: vi.fn(async () => handle) } as unknown as FileSystemDirectoryHandle,
      fileName: 'map.md',
      isRoot: true,
      id: 'ws_1',
      name: 'map',
    };
    const cache = new Map<string, string>();
    await saveMapDataToFile(target, '# Saved', cache);
    await saveMapDataToFile(target, '# Saved', cache);
    expect(cache.get('ws_1/map')).toBe('# Saved');
    expect(handle.createWritable).toHaveBeenCalledTimes(3);
    await expect(saveMapDataToFile(target, '  \n', cache)).rejects.toThrow('Cannot save empty markdown content');
  });

  it('loads a file once and reports malformed/unreadable files without throwing', async () => {
    const warned = new Set<string>();
    const good = await loadMarkdownAsMapData(fileHandle('# Project'), 'project', 'ws_1', warned);
    expect(good?.mapIdentifier).toEqual({ mapId: 'project', workspaceId: 'ws_1' });
    const empty = await loadMarkdownAsMapData(fileHandle('', 'empty.md'), 'empty', 'ws_1', warned);
    expect(empty).not.toBeNull();

    const broken = fileHandle('# Broken', 'broken.md');
    broken.getFile = vi.fn(async () => { throw new Error('read failed'); });
    expect(await loadMarkdownAsMapData(broken, 'broken', 'ws_1', warned)).toBeNull();
    expect(warned.has('broken.md')).toBe(true);
  });
});

import { describe, expect, it, vi } from 'vitest';
import {
  checkFSASupport,
  copyDirectoryRecursive,
  copyFileHandle,
  ensurePermission,
  ensureUniqueName,
  getFileName,
  getHandle,
  iterateMarkdownFiles,
  requestPermission,
  resolveParentDirAndName,
  writeTextFile,
} from './fileSystemHelpers';

type MockFile = FileSystemFileHandle & { getFile: ReturnType<typeof vi.fn> };
type MockDir = FileSystemDirectoryHandle & {
  kind: 'directory';
  name: string;
  entries: () => AsyncIterable<[string, MockFile | MockDir]>;
  getDirectoryHandle: ReturnType<typeof vi.fn>;
  getFileHandle: ReturnType<typeof vi.fn>;
};

const entries = async function* (items: Array<[string, MockFile | MockDir]>) {
  yield* items;
};

const file = (name: string): MockFile => ({
  kind: 'file', name, getFile: vi.fn().mockResolvedValue({ arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)) })
} as unknown as MockFile);

const dir = (name: string, items: Array<[string, MockFile | MockDir]> = []): MockDir => {
  const value = {
    kind: 'directory', name,
    entries: () => entries(items),
    getDirectoryHandle: vi.fn(),
    getFileHandle: vi.fn()
  } as unknown as MockDir;
  value.getDirectoryHandle.mockImplementation(async (childName: string) => {
    const found = items.find(([entryName, entry]) => entryName === childName && entry.kind === 'directory');
    return found?.[1] ?? dir(childName);
  });
  value.getFileHandle.mockImplementation(async (childName: string) => {
    const found = items.find(([entryName, entry]) => entryName === childName && entry.kind === 'file');
    if (!found) throw new Error('not found');
    return found[1];
  });
  return value;
};

describe('fileSystemHelpers', () => {
  it('handles permission APIs and unsupported browsers', async () => {
    const handle = {
      queryPermission: vi.fn().mockResolvedValue('prompt'),
      requestPermission: vi.fn().mockResolvedValue('granted')
    } as unknown as FileSystemHandle;
    expect(await ensurePermission(handle, false)).toBe(true);
    expect(await requestPermission(handle)).toBe('granted');
    expect(await requestPermission({} as FileSystemHandle)).toBe('granted');
  });

  it('extracts names, resolves path parents, and rejects empty paths', async () => {
    expect(getFileName('/folder/note.md')).toBe('note.md');
    expect(getFileName('/')).toBe('');
    const root = dir('root');
    const resolved = await resolveParentDirAndName(root, '/folder/note.md');
    expect(resolved.name).toBe('note.md');
    expect(root.getDirectoryHandle).toHaveBeenCalledWith('folder', { create: true });
    await expect(resolveParentDirAndName(root, '///')).rejects.toThrow('Invalid path: empty');
  });

  it('creates unique markdown names and copies file contents', async () => {
    const existing = dir('root', [['note.md', file('note.md')], ['note (1).md', file('note (1).md')]]);
    expect(await ensureUniqueName(existing, 'note.md', false)).toBe('note (2).md');

    const writable = { write: vi.fn(), close: vi.fn() };
    const destinationFile = { createWritable: vi.fn().mockResolvedValue(writable) };
    const destination = dir('destination');
    destination.getFileHandle.mockResolvedValue(destinationFile);
    const source = file('source.md');
    await copyFileHandle(source, destination, 'copy.md');
    expect(destination.getFileHandle).toHaveBeenCalledWith('copy.md', { create: true });
    expect(writable.write).toHaveBeenCalledWith(expect.any(ArrayBuffer));
    expect(writable.close).toHaveBeenCalled();
  });

  it('writes text, recursively copies directories, and lists markdown files', async () => {
    const writable = { write: vi.fn(), close: vi.fn() };
    const target = { createWritable: vi.fn().mockResolvedValue(writable) };
    await writeTextFile(target as never, 'hello');
    expect(writable.write).toHaveBeenCalledWith('hello');

    const nestedFile = file('child.md');
    const source = dir('source', [['child.md', nestedFile]]);
    const createdSubdir = dir('sub');
    const destination = dir('destination');
    destination.getDirectoryHandle.mockResolvedValue(createdSubdir);
    destination.getFileHandle.mockResolvedValue({ createWritable: vi.fn().mockResolvedValue(writable) });
    createdSubdir.getFileHandle.mockResolvedValue({ createWritable: vi.fn().mockResolvedValue(writable) });
    await copyDirectoryRecursive(source, destination);

    const nested = dir('nested', [['deep.md', file('deep.md')], ['skip.txt', file('skip.txt')]]);
    const files = [];
    for await (const item of iterateMarkdownFiles(dir('root', [['nested', nested], ['root.md', file('root.md')], ['x.txt', file('x.txt')]]))) {
      files.push(item.path);
    }
    expect(files).toEqual(['nested/deep.md', 'root.md']);
  });

  it('uses the fallback handle getter and reports FSA support', async () => {
    const fallback = {} as FileSystemFileHandle;
    expect(await getHandle(() => { throw new Error('missing'); }, async () => fallback)).toBe(fallback);
    await expect(getHandle(() => { throw new Error('missing'); })).rejects.toThrow('Handle not found');
    Object.defineProperty(window, 'showDirectoryPicker', { configurable: true, value: vi.fn() });
    expect(checkFSASupport()).toBe(true);
  });
});

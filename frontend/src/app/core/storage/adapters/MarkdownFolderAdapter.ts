import type { MindMapData } from '@shared/types';
import type { StorageAdapter, ExplorerItem } from '../../types/storage.types';
import { logger, statusMessages, generateWorkspaceId, generateTimestampedFilename } from '@shared/utils';
import { MarkdownImporter } from '../../../features/markdown/markdownImporter';
import {
  ensurePermission,
  getOrCreateDirectory,
  iterateMarkdownFiles,
  copyDirectoryRecursive
} from './fileSystemHelpers';

type DirHandle = FileSystemDirectoryHandle;
type FileHandle = FileSystemFileHandle;

type WindowWithFSA = Window & {
  showDirectoryPicker?: (options?: { id?: string; mode?: string }) => Promise<FileSystemDirectoryHandle>;
  indexedDB?: IDBFactory & {
    databases?: () => Promise<Array<{ name?: string; version?: number }>>;
  };
};

type ErrorWithName = Error & { name?: string };

type DirHandleWithIterators = FileSystemDirectoryHandle & {
  values?: () => AsyncIterable<FileSystemHandle>;
  entries?: () => AsyncIterable<[string, FileSystemHandle]>;
};

type Workspace = { id: string; name: string; handle: DirHandle };
type SaveTarget = { dir: DirHandle; fileName: string; isRoot: boolean; baseHeadingLevel?: number; headingLevelByText?: Record<string, number>; fileHandle?: FileHandle };

// Functional utilities
const checkFSA = (): boolean => typeof (window as WindowWithFSA)?.showDirectoryPicker === 'function';

const safeAsync = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
  try {
    return await fn();
  } catch {
    return fallback;
  }
};

const getHandle = async <T extends FileHandle | DirHandle>(
  getter: () => Promise<T> | T,
  fallbackGetter?: () => Promise<T>
): Promise<T> => {
  try {
    return await getter();
  } catch {
    return fallbackGetter ? await fallbackGetter() : Promise.reject(new Error('Handle not found'));
  }
};

const parsePathParts = (path: string): string[] => (path || '').split('/').filter(Boolean);

export class MarkdownFolderAdapter implements StorageAdapter {
  private _isInitialized = false;
  private rootHandle: DirHandle | null = null;
  private workspaces: Workspace[] = [];
  private saveTargets = new Map<string, SaveTarget>();
  private permissionWarned = false;
  // To avoid spamming warnings during periodic scans
  private warnedFiles = new Set<string>();
  private allMaps: MindMapData[] = [];
  private saveLocks = new Map<string, Promise<void>>();
  private lastSavedContent = new Map<string, string>();

  get isInitialized(): boolean {
    return this._isInitialized;
  }

  async initialize(): Promise<void> {
    if (!checkFSA()) {
      logger.warn('File System Access API is not available in this environment');
      statusMessages.folderAccessUnavailable();
    }

    await safeAsync(async () => {
      await this.restoreWorkspaces();
      if (this.workspaces.length > 0) {
        logger.info(`📁 MarkdownFolderAdapter: Restored ${this.workspaces.length} workspace(s)`);
        this.rootHandle = this.workspaces[0].handle;
      } else {
        const restored = await this.restoreRootHandle();
        logger.info(restored ? '📁 MarkdownFolderAdapter: Restored legacy root folder' : '📁 MarkdownFolderAdapter: Initialized (no workspace yet)');
      }
    }, undefined);

    this._isInitialized = true;
  }

  async selectRootFolder(): Promise<void> {
    const wnd = window as WindowWithFSA;
    if (!wnd?.showDirectoryPicker) {
      throw new Error('File System Access API is not available in this environment');
    }

    const handle = await wnd.showDirectoryPicker({ id: 'mindoodle-workspace', mode: 'readwrite' });
    this.rootHandle = handle;
    logger.debug('📁 MarkdownFolderAdapter: Workspace folder selected');

    await safeAsync(async () => {
      const id = generateWorkspaceId();
      const name = handle?.name || 'workspace';
      await this.persistWorkspace({ id, name, handle });
      await this.restoreWorkspaces();
      this.rootHandle = this.workspaces[0]?.handle || handle;
    }, undefined).catch(() => safeAsync(() => this.saveRootHandle(handle), undefined));
  }

  get selectedFolderName(): string | null {
    return this.workspaces.length > 0 ? this.workspaces[0].name : (this.rootHandle?.name ?? null);
  }

  async loadAllMaps(): Promise<MindMapData[]> {
    logger.debug('📄️ MarkdownFolderAdapter.loadAllMaps called');
    if (!this._isInitialized) await this.initialize();
    if (this.workspaces.length === 0 && !this.rootHandle) return [];

    const targets = this.workspaces.length > 0
      ? this.workspaces.map(w => ({ handle: w.handle, id: w.id, name: w.name }))
      : [{ handle: this.rootHandle!, id: '__default__', name: this.rootHandle?.name || '' }];

    const maps: MindMapData[] = [];
    for (const t of targets) {
      if (!t.handle) continue;

      const hasPermission = await ensurePermission(t.handle, this.permissionWarned);
      if (!hasPermission) {
        if (!this.permissionWarned) {
          logger.warn('MarkdownFolderAdapter: Workspace permission not granted for:', t.name);
          statusMessages.workspacePermissionDenied(t.name);
          this.permissionWarned = true;
        }
        continue;
      }

      await this.loadMapsFromWorkspace(t, maps);
    }

    logger.debug('📄️ MarkdownFolderAdapter.loadAllMaps finished. Total maps:', maps.length);
    return maps;
  }

  private async loadMapsFromWorkspace(target: { handle: DirHandle; id: string; name: string }, maps: MindMapData[]): Promise<void> {
    const addMapIfUnique = (data: MindMapData) => {
      const isDuplicate = maps.some(m =>
        m.mapIdentifier.mapId === data.mapIdentifier.mapId &&
        m.mapIdentifier.workspaceId === data.mapIdentifier.workspaceId
      );
      if (!isDuplicate) maps.push(data);
      else logger.warn('⚠️ Duplicate map found, skipping:', data.mapIdentifier.mapId);
    };

    // Load from root
    await safeAsync(async () => {
      for await (const { handle: fileHandle } of iterateMarkdownFiles(target.handle)) {
        const data = await safeAsync(() => this.loadMapFromFile(fileHandle, target.handle, '', target.id), null);
        if (data) addMapIfUnique(data);
      }
    }, undefined);

    // Load from subdirectories
    await safeAsync(async () => {
      for await (const entry of (target.handle as DirHandleWithIterators).values?.() ?? this.iterateEntries(target.handle)) {
        if (entry.kind === 'directory') {
          await this.collectMapsForWorkspace({ id: target.id, name: target.name, handle: target.handle }, entry as DirHandle, entry.name ?? '', maps);
        }
      }
    }, undefined);
  }

  async addMapToList(newMap: MindMapData): Promise<void> {
    const existingIndex = this.allMaps.findIndex(map =>
      map.mapIdentifier.mapId === newMap.mapIdentifier.mapId &&
      map.mapIdentifier.workspaceId === newMap.mapIdentifier.workspaceId
    );
    if (existingIndex !== -1) {
      this.allMaps[existingIndex] = newMap;
    } else {
      this.allMaps.push(newMap);
    }
  }

  async removeMapFromList(id: { mapId: string; workspaceId?: string }): Promise<void> {
    logger.warn('MarkdownFolderAdapter: removeMapFromList not implemented', { id });
  }

  async updateMapInList(_map: MindMapData): Promise<void> {}

  cleanup(): void {}

  async getMapMarkdown(id: { mapId: string; workspaceId: string }): Promise<string | null> {
    if (!this._isInitialized) await this.initialize();
    if (this.workspaces.length === 0 && !this.rootHandle) return null;

    // Try cache first
    const cached = await this.readFromCache(id);
    if (cached) return cached;

    // Fallback to workspace
    return await this.readFromWorkspace(id);
  }

  private async readFromCache(id: { mapId: string; workspaceId: string }): Promise<string | null> {
    const target = Array.from(this.saveTargets.entries()).find(([k]) => k.endsWith(`::${id.mapId}`))?.[1] || this.saveTargets.get(id.mapId);
    if (!target) return null;

    return await safeAsync(async () => {
      const fh = await getHandle(() => target.dir.getFileHandle?.(target.fileName), () => target.dir.getFileHandle(target.fileName));
      const file = await fh.getFile();
      return await file.text();
    }, null);
  }

  private async readFromWorkspace(id: { mapId: string; workspaceId: string }): Promise<string | null> {
    return await safeAsync(async () => {
      const parts = parsePathParts(id.mapId);
      if (parts.length === 0) return null;

      const base = parts.pop()!;
      const ws = this.workspaces.find(w => w.id === id.workspaceId);
      if (!ws) return null;

      let dir: DirHandle = ws.handle;
      for (const p of parts) {
        const next = await this.getExistingDirectory(dir, p);
        if (!next) return null;
        dir = next;
      }

      const fh = await this.getExistingFile(dir, `${base}.md`);
      if (!fh) return null;

      const file = await fh.getFile();
      return await file.text();
    }, null);
  }

  async getMapLastModified(id: { mapId: string; workspaceId: string }): Promise<number | null> {
    if (!this._isInitialized) await this.initialize();
    if (this.workspaces.length === 0 && !this.rootHandle) return null;

    const getLastModified = async (fileHandle: FileHandle): Promise<number | null> => {
      const file = await fileHandle.getFile();
      return typeof file.lastModified === 'number' ? file.lastModified : null;
    };

    // Try cache
    const target = Array.from(this.saveTargets.entries()).find(([k]) => k.endsWith(`::${id.mapId}`))?.[1] || this.saveTargets.get(id.mapId);
    if (target) {
      const fh = await safeAsync(() => getHandle(() => target.dir.getFileHandle?.(target.fileName), () => target.dir.getFileHandle(target.fileName)), null);
      if (fh) return await getLastModified(fh);
    }

    // Try workspace
    return await safeAsync(async () => {
      const parts = parsePathParts(id.mapId);
      if (parts.length === 0) return null;

      const base = parts.pop()!;
      const ws = this.workspaces.find(w => w.id === id.workspaceId);
      if (!ws) return null;

      let dir: DirHandle = ws.handle;
      for (const p of parts) {
        const next = await this.getExistingDirectory(dir, p);
        if (!next) return null;
        dir = next;
      }

      const fh = await this.getExistingFile(dir, `${base}.md`);
      return fh ? await getLastModified(fh) : null;
    }, null);
  }

  async saveMapMarkdown(id: { mapId: string; workspaceId: string }, markdown: string): Promise<void> {
    if (!this._isInitialized) await this.initialize();
    if (this.workspaces.length === 0 && !this.rootHandle) {
      logger.warn('MarkdownFolderAdapter: No folder selected; skipping markdown save');
      return;
    }

    const saveKey = `${id.workspaceId || '__default__'}::${id.mapId}`;
    if (this.lastSavedContent.get(saveKey) === markdown) {
      logger.debug('📾 MarkdownFolderAdapter: Skipped markdown save (no changes) for', id.mapId);
      return;
    }

    const doSave = async () => {
      const { dir, fileName, fileHandle } = await this.resolveSaveLocation(id);
      const handle = fileHandle || await getHandle(() => dir.getFileHandle?.(fileName, { create: true }), () => dir.getFileHandle(fileName, { create: true }));

      const writable = await handle.createWritable();
      await writable.write(markdown);
      await writable.close();

      const entry: SaveTarget = { dir, fileName, isRoot: false, fileHandle: handle };
      this.saveTargets.set(saveKey, entry);
      this.saveTargets.set(id.mapId, entry);
      this.lastSavedContent.set(saveKey, markdown);
      logger.debug(`📝 MarkdownFolderAdapter: Saved markdown for ${id.mapId}`);
    };

    const prev = this.saveLocks.get(saveKey) || Promise.resolve();
    const next = prev.then(doSave).finally(() => {});
    this.saveLocks.set(saveKey, next);
    await next;
  }

  private async resolveSaveLocation(id: { mapId: string; workspaceId: string }): Promise<{ dir: DirHandle; fileName: string; fileHandle?: FileHandle }> {
    const target = Array.from(this.saveTargets.entries()).find(([k]) => k.endsWith(`::${id.mapId}`))?.[1] || this.saveTargets.get(id.mapId);
    if (target) return target;

    const parts = parsePathParts(id.mapId);
    if (parts.length === 0) throw new Error('Invalid mapId');

    const base = parts.pop()!;
    const ws = this.workspaces.find(w => w.id === id.workspaceId);
    if (!ws) throw new Error('Workspace not found for save');

    let dir: DirHandle = ws.handle;
    for (const p of parts) {
      dir = await getOrCreateDirectory(dir, p);
    }

    return { dir, fileName: `${base}.md` };
  }

  async createFolder(relativePath: string, workspaceId?: string): Promise<void> {
    const wsHandle = workspaceId
      ? this.workspaces.find(w => w.id === workspaceId)?.handle
      : (this.workspaces[0]?.handle || this.rootHandle);

    if (!wsHandle) throw new Error(`No workspace found for ID: ${workspaceId || 'default'}`);

    let dir: DirHandle = wsHandle;
    for (const part of parsePathParts(relativePath)) {
      dir = await getOrCreateDirectory(dir, part);
    }
  }

  private async collectMapsForWorkspace(ws: Workspace, dir: DirHandle, categoryPath: string, out: MindMapData[]): Promise<void> {
    const addMapIfUnique = (data: MindMapData) => {
      const isDuplicate = out.some(m =>
        m.mapIdentifier.mapId === data.mapIdentifier.mapId &&
        m.mapIdentifier.workspaceId === data.mapIdentifier.workspaceId
      );
      if (!isDuplicate) out.push(data);
      else logger.warn('⚠️ Duplicate map found in collectMapsForWorkspace, skipping:', data.mapIdentifier.mapId);
    };

    // Load files
    for await (const { handle: fh } of iterateMarkdownFiles(dir)) {
      const data = await safeAsync(() => this.loadMapFromFile(fh, dir, categoryPath, ws.id), null);
      if (data) addMapIfUnique(data);
    }

    // Recurse into subdirectories
    for await (const entry of (dir as DirHandleWithIterators).values?.() ?? this.iterateEntries(dir)) {
      if (entry.kind === 'directory') {
        const sub = categoryPath ? `${categoryPath}/${entry.name}` : entry.name;
        await this.collectMapsForWorkspace(ws, entry as DirHandle, sub, out);
      }
    }
  }

  private async loadMapFromFile(fileHandle: FileHandle, dirForSave: DirHandle, categoryPath: string, workspaceId: string): Promise<MindMapData | null> {
    try {
      const file = await fileHandle.getFile();
      const text = await file.text();
      const parseResult = MarkdownImporter.parseMarkdownToNodes(text);

      const headingLevelByText = parseResult.headingLevelByText;
      const headingLevels = Object.values(headingLevelByText);
      const baseHeadingLevel = headingLevels.length > 0 ? Math.min(...headingLevels) : 1;

      const fileName = await this.getFileName(fileHandle);
      const baseName = fileName.replace(/\.md$/i, '');
      const mapId = categoryPath ? `${categoryPath}/${baseName}` : baseName;
      const fileLastModified = new Date(file.lastModified).toISOString();

      const data: MindMapData = {
        title: baseName,
        category: categoryPath || '',
        rootNodes: parseResult.rootNodes,
        createdAt: fileLastModified,
        updatedAt: fileLastModified,
        settings: { autoSave: true, autoLayout: true, showGrid: false, animationEnabled: true },
        mapIdentifier: { mapId, workspaceId }
      };

      const saveTarget: SaveTarget = { dir: dirForSave, fileName, isRoot: !categoryPath, baseHeadingLevel, headingLevelByText };
      this.saveTargets.set(data.mapIdentifier.mapId, saveTarget);
      this.saveTargets.set(`${data.mapIdentifier.workspaceId || '__default__'}::${data.mapIdentifier.mapId}`, saveTarget);

      return data;
    } catch (e) {
      this.handleLoadError(e as ErrorWithName, fileHandle);
      return null;
    }
  }

  private async handleLoadError(e: ErrorWithName, fileHandle: FileHandle): Promise<void> {
    const name = await this.getFileName(fileHandle).catch(() => 'unknown.md');
    const errorMessage = e?.message || String(e) || '';
    const errorName = e?.name || '';

    logger.debug(`MarkdownFolderAdapter: Error loading file "${name}"`, {
      errorName,
      errorMessage,
      hasMessage: !!e?.message,
      errorType: typeof e,
    });

    // Only surface permission-related warnings to the UI (once),
    // other parsing/IO errors during background scans should be logged but not spammed.
    if (errorName === 'NotReadableError' || /NotReadable/i.test(errorName) || /NotReadable/i.test(errorMessage)) {
      if (!this.permissionWarned) {
        logger.warn(`MarkdownFolderAdapter: Failed to read file due to permission ("${name}"). Please reselect the folder.`);
        statusMessages.fileReadPermissionDenied();
        this.permissionWarned = true;
      }
    } else if (errorMessage.includes('見出しが見つかりません') || errorMessage.includes('構造要素が見つかりません')) {
      // Treat non-structural markdown files as non-maps during scans; do not show repeated warnings
      if (!this.warnedFiles.has(name)) {
        logger.debug(`MarkdownFolderAdapter: File "${name}" has no structure elements, skipping`);
        this.warnedFiles.add(name);
      }
    } else {
      // Generic read/parse failure: warn once per file to avoid repeated alerts from periodic refreshes
      if (!this.warnedFiles.has(name)) {
        logger.warn(`MarkdownFolderAdapter: Failed to load from file "${name}": ${errorMessage}`);
        this.warnedFiles.add(name);
      } else {
        logger.debug(`MarkdownFolderAdapter: (suppressed repeat) Failed to load from file "${name}": ${errorMessage}`);
      }
    }
  }

  private async writeTextFile(dir: DirHandle, name: string, content: string): Promise<void> {
    const fileHandle = await getHandle(() => dir.getFileHandle?.(name, { create: true }), () => dir.getFileHandle(name, { create: true }));
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
  }

  async saveImageFile(relativePath: string, imageBlob: Blob, workspaceId?: string): Promise<void> {
    if (!this._isInitialized) await this.initialize();

    const wsHandle = workspaceId
      ? this.workspaces.find(w => w.id === workspaceId)?.handle
      : (this.workspaces[0]?.handle || this.rootHandle);

    if (!wsHandle) throw new Error(`No workspace found for ID: ${workspaceId || 'default'}`);

    const parts = parsePathParts(relativePath.replace(/^\.\//, ''));
    if (parts.length === 0) throw new Error('Invalid image path');

    let currentDir: DirHandle = wsHandle;
    const fileName = parts.pop()!;

    for (const part of parts) {
      currentDir = await getOrCreateDirectory(currentDir, part);
    }

    const fileHandle = await getHandle(() => currentDir.getFileHandle?.(fileName, { create: true }), () => currentDir.getFileHandle(fileName, { create: true }));
    const writable = await fileHandle.createWritable();
    await writable.write(imageBlob);
    await writable.close();
  }

  private async copyFileHandle(srcFileHandle: FileHandle, dstDir: DirHandle, name: string): Promise<void> {
    const dstHandle = await getHandle(() => dstDir.getFileHandle?.(name, { create: true }), () => dstDir.getFileHandle(name, { create: true }));
    const writable = await dstHandle.createWritable();
    const blob = await srcFileHandle.getFile();
    await writable.write(blob);
    await writable.close();
  }

  private async getFileName(fileHandle: FileHandle): Promise<string> {
    if (fileHandle.name) return fileHandle.name;
    const file = await safeAsync(() => fileHandle.getFile?.(), null);
    return file?.name || 'map.md';
  }

  // IndexedDB utilities
  private async openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = (window as WindowWithFSA).indexedDB?.open?.('mindoodle-fsa', 2);
      if (!req) { reject(new Error('indexedDB not available')); return; }
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('handles')) db.createObjectStore('handles');
        if (!db.objectStoreNames.contains('workspaces')) db.createObjectStore('workspaces');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  private async persistWorkspace(ws: Workspace): Promise<void> {
    const db = await this.openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('workspaces', 'readwrite');
      const req = tx.objectStore('workspaces').put({ name: ws.name, handle: ws.handle }, ws.id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    db.close();
  }

  private async restoreWorkspaces(): Promise<void> {
    this.workspaces = [];

    await safeAsync(async () => {
      const databases = await (window as WindowWithFSA).indexedDB?.databases?.();
      const dbExists = databases?.some(db => db.name === 'mindoodle-fsa');
      if (!dbExists) return;

      const db = await this.openDb();
      const items: Array<{ id: string; rec: { name: string; handle: DirHandle } }> = await new Promise((resolve, reject) => {
        const list: Array<{ id: string; rec: { name: string; handle: DirHandle } }> = [];
        const tx = db.transaction('workspaces', 'readonly');
        const cursorReq = tx.objectStore('workspaces').openCursor?.();
        if (!cursorReq) { resolve([]); return; }
        cursorReq.onsuccess = (ev: Event) => {
          const cursor = (ev.target as IDBRequest)?.result;
          if (cursor) {
            list.push({ id: String(cursor.key), rec: cursor.value });
            cursor.continue();
          } else {
            resolve(list);
          }
        };
        cursorReq.onerror = () => reject(cursorReq.error);
      });
      db.close();

      for (const { id, rec } of items) {
        if (rec) {
          const name = rec.handle?.name || rec.name || 'workspace';
          this.workspaces.push({ id, name, handle: rec.handle });
        }
      }
    }, undefined);
  }

  private async getExistingFile(dir: DirHandle, name: string): Promise<FileHandle | null> {
    return await safeAsync(() => getHandle(() => dir.getFileHandle?.(name), () => dir.getFileHandle(name)), null);
  }

  private async getExistingDirectory(dir: DirHandle, name: string): Promise<DirHandle | null> {
    return await safeAsync(() => getHandle(() => dir.getDirectoryHandle?.(name), () => dir.getDirectoryHandle(name)), null);
  }

  private async resolveParentDirAndName(path: string): Promise<{ dir: DirHandle; name: string } | null> {
    const parts = parsePathParts(path);
    if (parts.length === 0) return null;

    let baseHandle: DirHandle | null = null;
    let pathParts = parts;

    if (parts[0]?.startsWith('ws_')) {
      const workspace = this.workspaces.find(ws => ws.id === parts[0]);
      if (workspace?.handle) {
        baseHandle = workspace.handle;
        pathParts = parts.slice(1);
      }
    }

    baseHandle = baseHandle || this.workspaces[0]?.handle || this.rootHandle;
    if (!baseHandle || pathParts.length === 0) return null;

    const name = pathParts.pop()!;
    let dir: DirHandle = baseHandle;

    for (const part of pathParts) {
      const next = await this.getExistingDirectory(dir, part);
      if (!next) return null;
      dir = next;
    }

    return { dir, name };
  }

  async deleteItem(path: string): Promise<void> {
    const resolved = await this.resolveParentDirAndName(path);
    if (!resolved) throw new Error('Path not found');
    const { dir, name } = resolved;
    const remover = dir.removeEntry?.bind(dir);
    if (!remover) throw new Error('removeEntry not supported');
    await safeAsync(() => remover(name, { recursive: true }), undefined).catch(() => remover(name));
  }

  async renameItem(path: string, newName: string): Promise<void> {
    const resolved = await this.resolveParentDirAndName(path);
    if (!resolved) throw new Error('Path not found');
    const { dir, name } = resolved;

    const file = await this.getExistingFile(dir, name);
    if (file) {
      const fileData = await (await file.getFile()).text();
      const targetName = /\.md$/i.test(newName) ? newName : `${newName}.md`;
      await this.writeTextFile(dir, targetName, fileData);
      const remover = dir.removeEntry?.bind(dir);
      if (remover) await remover(name);
      return;
    }

    const srcDir = await this.getExistingDirectory(dir, name);
    if (!srcDir) throw new Error('Item not found');
    const dstDir = await getOrCreateDirectory(dir, newName);
    await copyDirectoryRecursive(srcDir, dstDir);
    const remover = dir.removeEntry?.bind(dir);
    if (remover) await remover(name, { recursive: true });
  }

  private async *iterateEntries(dir: DirHandle): AsyncGenerator<FileSystemDirectoryHandle | FileSystemFileHandle, void, unknown> {
    const entriesFn = (dir as DirHandleWithIterators).entries;
    if (typeof entriesFn === 'function') {
      for await (const [, entry] of entriesFn.call(dir)) {
        yield entry as FileSystemDirectoryHandle | FileSystemFileHandle;
      }
    }
  }

  async getExplorerTree(): Promise<ExplorerItem> {
    if (this.workspaces.length === 0 && !this.rootHandle) {
      throw new Error('No workspace selected');
    }

    if (this.workspaces.length > 0) {
      const root: ExplorerItem = { type: 'folder', name: 'workspaces', path: '', children: [] };
      for (const ws of this.workspaces) {
        const hasPermission = await ensurePermission(ws.handle, this.permissionWarned);
        const children = hasPermission ? await this.buildExplorerItems(ws.handle, `/${ws.id}`) : [];
        const name = hasPermission ? ws.name : `${ws.name} (権限が必要)`;
        root.children?.push({ type: 'folder', name, path: `/${ws.id}`, children });
      }
      return root;
    }

    if (!this.rootHandle) throw new Error('No root folder selected');

    const hasPermission = await ensurePermission(this.rootHandle, this.permissionWarned);
    if (!hasPermission) {
      if (!this.permissionWarned) {
        logger.warn('MarkdownFolderAdapter: Root folder permission is not granted. Please reselect the folder.');
        this.permissionWarned = true;
      }
      return { type: 'folder', name: this.rootHandle?.name || '', path: '', children: [] };
    }

    const root: ExplorerItem = { type: 'folder', name: this.rootHandle.name || '', path: '', children: [] };
    root.children = await this.buildExplorerItems(this.rootHandle, '');
    return root;
  }

  private async buildExplorerItems(dir: DirHandle, basePath: string): Promise<ExplorerItem[]> {
    const items: ExplorerItem[] = [];
    const valuesFn = (dir as DirHandleWithIterators).values;

    const processEntries = async (iterator: AsyncIterable<FileSystemHandle>) => {
      for await (const entry of iterator) {
        if (entry.kind === 'directory') {
          const path = basePath ? `${basePath}/${entry.name}` : entry.name;
          const childDir = await getHandle(() => dir.getDirectoryHandle?.(entry.name), () => dir.getDirectoryHandle(entry.name));
          const children = await this.buildExplorerItems(childDir, path);
          items.push({ type: 'folder', name: entry.name, path, children });
        } else if (entry.kind === 'file') {
          const name = entry.name || '';
          const path = basePath ? `${basePath}/${name}` : name;
          items.push({ type: 'file', name, path, isMarkdown: /\.md$/i.test(name) });
        }
      }
    };

    if (typeof valuesFn === 'function') {
      await processEntries(valuesFn.call(dir));
    } else {
      const entriesFn = (dir as DirHandleWithIterators).entries;
      if (typeof entriesFn === 'function') {
        for await (const [name, entry] of entriesFn.call(dir)) {
          if (entry.kind === 'directory') {
            const path = basePath ? `${basePath}/${name}` : name;
            const childDir = await getHandle(() => dir.getDirectoryHandle?.(name), () => dir.getDirectoryHandle(name));
            const children = await this.buildExplorerItems(childDir, path);
            items.push({ type: 'folder', name, path, children });
          } else if (entry.kind === 'file') {
            const path = basePath ? `${basePath}/${name}` : name;
            items.push({ type: 'file', name, path, isMarkdown: /\.md$/i.test(name) });
          }
        }
      }
    }

    return items.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name, 'ja');
    });
  }

  // Legacy root handle support
  private async openLegacyDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = (window as WindowWithFSA).indexedDB?.open?.('mindoodle-fsa', 1);
      if (!req) { reject(new Error('indexedDB not available')); return; }
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('handles')) db.createObjectStore('handles');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  private async saveRootHandle(handle: DirHandle): Promise<void> {
    const db = await this.openLegacyDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('handles', 'readwrite');
      const req = tx.objectStore('handles').put(handle, 'root');
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    db.close();
  }

  private async loadRootHandle(): Promise<DirHandle | null> {
    return await safeAsync(async () => {
      const databases = await (window as WindowWithFSA).indexedDB?.databases?.();
      const dbExists = databases?.some(db => db.name === 'mindoodle-fsa');
      if (!dbExists) return null;

      const db = await this.openLegacyDb();
      const handle = await new Promise<DirHandle | null>((resolve, reject) => {
        const tx = db.transaction('handles', 'readonly');
        const req = tx.objectStore('handles').get('root');
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
      db.close();
      return handle;
    }, null);
  }

  private async restoreRootHandle(): Promise<boolean> {
    const handle = await this.loadRootHandle();
    if (!handle) return false;
    const hasPermission = await ensurePermission(handle, this.permissionWarned);
    if (hasPermission) {
      this.rootHandle = handle;
      return true;
    }
    return false;
  }

  async listWorkspaces(): Promise<Array<{ id: string; name: string }>> {
    return this.workspaces.map(w => ({ id: w.id, name: w.name }));
  }

  async addWorkspace(): Promise<void> {
    const wnd = window as WindowWithFSA;
    if (!wnd?.showDirectoryPicker) {
      throw new Error('File System Access API is not available in this environment');
    }

    const handle = await wnd.showDirectoryPicker({ id: 'mindoodle-workspace', mode: 'readwrite' });

    await safeAsync(async () => {
      await this.restoreWorkspaces();
      for (const ws of this.workspaces) {
        if (typeof handle.isSameEntry === 'function') {
          const same = await safeAsync(() => handle.isSameEntry(ws.handle), false);
          if (same) {
            logger.info('📁 MarkdownFolderAdapter: Workspace already added; skipping');
            return;
          }
        }
      }
    }, undefined);

    const id = generateWorkspaceId();
    const name = handle?.name || 'workspace';
    await this.persistWorkspace({ id, name, handle });
    await this.restoreWorkspaces();
  }

  async removeWorkspace(id: string): Promise<void> {
    const workspace = this.workspaces.find(w => w.id === id);

    const db = await this.openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('workspaces', 'readwrite');
      const req = tx.objectStore('workspaces').delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    db.close();

    const prefix = `${id}::`;
    Array.from(this.saveTargets.keys()).forEach(k => {
      if (k.startsWith(prefix)) this.saveTargets.delete(k);
    });

    if (workspace) {
      logger.info(`Removed workspace reference: ${workspace.name} (${id}) - Files preserved`);
    }

    this.workspaces = this.workspaces.filter(w => w.id !== id);
  }

  async readImageAsDataURL(relativePath: string, workspaceId?: string): Promise<string | null> {
    if (!this._isInitialized) await this.initialize();

    const wsHandle = workspaceId
      ? this.workspaces.find(w => w.id === workspaceId)?.handle
      : (this.workspaces[0]?.handle || this.rootHandle);

    if (!wsHandle) return null;

    return await safeAsync(async () => {
      const parts = parsePathParts(relativePath.replace(/^\.\//, ''));
      if (parts.length === 0) return null;

      let currentDir: DirHandle = wsHandle;
      const fileName = parts.pop()!;

      for (const part of parts) {
        if (part === '..') {
          console.warn('Parent directory navigation (..) not supported for images in File System Access API');
          return null;
        }
        const nextDir = await this.getExistingDirectory(currentDir, part);
        if (!nextDir) return null;
        currentDir = nextDir;
      }

      const fileHandle = await this.getExistingFile(currentDir, fileName);
      if (!fileHandle) return null;

      const file = await fileHandle.getFile();
      if (!file.type.startsWith('image/')) {
        console.warn('File is not an image:', fileName, 'type:', file.type);
        return null;
      }

      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
    }, null);
  }

  async moveItem(sourcePath: string, targetFolderPath: string): Promise<void> {
    if (!this.rootHandle) throw new Error('No root folder selected');
    const resolved = await this.resolveParentDirAndName(sourcePath);
    if (!resolved) throw new Error('Source path not found');
    const { dir: srcParent, name } = resolved;

    let dstDir: DirHandle = this.rootHandle;
    for (const part of parsePathParts(targetFolderPath)) {
      dstDir = await getOrCreateDirectory(dstDir, part);
    }

    if (srcParent === dstDir) return;

    const srcFile = await this.getExistingFile(srcParent, name);
    if (srcFile) {
      const uniqueName = await this.ensureUniqueName(dstDir, name);
      await this.copyFileHandle(srcFile, dstDir, uniqueName);
      const remover = srcParent.removeEntry?.bind(srcParent);
      if (remover) await remover(name);
      return;
    }

    const srcDir = await this.getExistingDirectory(srcParent, name);
    if (!srcDir) throw new Error('Source not found');
    const uniqueFolderName = await this.ensureUniqueFolderName(dstDir, name);
    const dstSub = await getOrCreateDirectory(dstDir, uniqueFolderName);
    await copyDirectoryRecursive(srcDir, dstSub);
    const remover = srcParent.removeEntry?.bind(srcParent);
    if (remover) await remover(name, { recursive: true });
  }

  private async ensureUniqueName(dir: DirHandle, desired: string): Promise<string> {
    const exists = async (name: string) => !!(await this.getExistingFile(dir, name)) || !!(await this.getExistingDirectory(dir, name));
    if (!(await exists(desired))) return desired;

    const dot = desired.lastIndexOf('.');
    const base = dot > 0 ? desired.substring(0, dot) : desired;
    const ext = dot > 0 ? desired.substring(dot) : '';

    for (let i = 1; i < 1000; i++) {
      const candidate = `${base}-${i}${ext}`;
      if (!(await exists(candidate))) return candidate;
    }

    return generateTimestampedFilename(base, ext);
  }

  private async ensureUniqueFolderName(dir: DirHandle, desired: string): Promise<string> {
    const exists = async (name: string) => !!(await this.getExistingDirectory(dir, name));
    if (!(await exists(desired))) return desired;

    for (let i = 1; i < 1000; i++) {
      const candidate = `${desired}-${i}`;
      if (!(await exists(candidate))) return candidate;
    }

    return generateTimestampedFilename(desired);
  }
}

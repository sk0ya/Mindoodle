import type { MindMapData } from '@shared/types';
import type { StorageAdapter, ExplorerItem } from '../types';
import { logger } from '../../../shared/utils/logger';
import { MarkdownImporter } from '../../../shared/utils/markdownImporter';
import { exportToMarkdown } from '../../../shared/utils/exportUtils';
import { createInitialData } from '../../../shared/types/dataTypes';

type DirHandle = any; // File System Access API types (browser only)
type FileHandle = any;

export class MarkdownFolderAdapter implements StorageAdapter {
  private _isInitialized = false;
  private rootHandle: DirHandle | null = null;
  private saveTargets: Map<string, { dir: DirHandle, fileName: string, isRoot: boolean, baseHeadingLevel?: number, headingLevelByText?: Record<string, number> } > = new Map();
  private permissionWarned = false;

  get isInitialized(): boolean {
    return this._isInitialized;
  }

  async initialize(): Promise<void> {
    // Do not open picker here; must be a user gesture.
    if (typeof (window as any)?.showDirectoryPicker !== 'function') {
      logger.warn('File System Access API is not available in this environment');
    }
    // Try to restore previously selected folder handle from IndexedDB
    try {
      const restored = await this.restoreRootHandle();
      if (restored) {
        logger.info('📁 MarkdownFolderAdapter: Restored root folder from previous session');
      } else {
        logger.info('📁 MarkdownFolderAdapter: Initialized (waiting for user to select a folder)');
      }
    } catch (e) {
      logger.warn('Failed to restore root folder handle:', e);
    }
    this._isInitialized = true;
  }

  // Must be called from a user gesture (e.g. button click)
  async selectRootFolder(): Promise<void> {
    if (typeof (window as any)?.showDirectoryPicker !== 'function') {
      throw new Error('File System Access API is not available in this environment');
    }
    this.rootHandle = await (window as any).showDirectoryPicker({
      id: 'mindoodle-root',
      mode: 'readwrite'
    });
      logger.debug('📁 MarkdownFolderAdapter: Root folder selected');
    // Persist the handle for future sessions
    try {
      await this.saveRootHandle(this.rootHandle);
    } catch (e) {
      logger.warn('Failed to persist root folder handle:', e);
    }
  }

  get selectedFolderName(): string | null {
    try {
      return (this.rootHandle as any)?.name ?? null;
    } catch {
      return null;
    }
  }

  async loadInitialData(): Promise<MindMapData> {
    if (!this._isInitialized) {
      await this.initialize();
    }
    if (!this.rootHandle) {
      // No folder selected yet; return an initial in-memory map.
      return createInitialData();
    }

    try {
      // Try root-level map first (map.md or README.md)
      const rootFileHandle = await this.getExistingFile(this.rootHandle as any, 'map.md')
        || await this.getExistingFile(this.rootHandle as any, 'README.md');
      if (rootFileHandle) {
        const data = await this.loadMapFromFile(rootFileHandle, this.rootHandle as any, '');
        if (data) return data;
      }

      // Try any *.md at root level
      for await (const fileHandle of this.iterateMarkdownFiles(this.rootHandle as any)) {
        const data = await this.loadMapFromFile(fileHandle, this.rootHandle as any, '');
        if (data) return data;
      }

      // Try to find first subfolder (recursively) containing markdown
      for await (const entry of (this.rootHandle as any).values?.() || this.iterateEntries(this.rootHandle)) {
        if (entry.kind === 'directory') {
          const data = await this.loadMapFromDirectory(entry, entry.name ?? '');
          if (data) return data;
        }
      }
    } catch (e) {
      logger.error('❌ MarkdownFolderAdapter: Failed to load initial data', e);
    }

    return createInitialData();
  }

  async saveData(data: MindMapData): Promise<void> {
    if (!this._isInitialized) {
      await this.initialize();
    }
    if (!this.rootHandle) {
      logger.warn('MarkdownFolderAdapter: No folder selected; skipping save');
      return;
    }

    const target = this.saveTargets.get(data.id);
    const markdown = exportToMarkdown(data, { 
      includeMetadata: false,
      baseHeadingLevel: target?.baseHeadingLevel || 1,
      headingLevelByText: target?.headingLevelByText
    });

    // If this map has a known save target (loaded from a specific file), write back to it
    if (target) {
      await this.writeTextFile(target.dir, target.fileName, markdown);
      logger.debug(`💾 MarkdownFolderAdapter: Saved ${target.fileName} ${target.isRoot ? 'at root' : 'in directory'}`);
      return;
    }
    // New map: create a dedicated file. Honor category path if provided.
    let targetDir: DirHandle = this.rootHandle;
    if (data.category) {
      const parts = data.category.split('/').filter(Boolean);
      for (const part of parts) {
        targetDir = await this.getOrCreateDirectory(targetDir, part);
      }
    }
    const baseName = this.sanitizeName(data.title || 'mindmap');
    const fileName = await this.ensureUniqueMarkdownName(targetDir, `${baseName}.md`);
    await this.writeTextFile(targetDir, fileName, markdown);
    this.saveTargets.set(data.id, { dir: targetDir, fileName, isRoot: !data.category });
    logger.debug('💾 MarkdownFolderAdapter: Created file', fileName, 'in', data.category || '(root)');
  }

  async loadAllMaps(): Promise<MindMapData[]> {
    if (!this._isInitialized) {
      await this.initialize();
    }
    if (!this.rootHandle) return [];

    const maps: MindMapData[] = [];

    // Verify we still have permission; if not, avoid noisy attempts
    const perm = await this.queryPermission(this.rootHandle as any, 'readwrite');
    if (perm !== 'granted') {
      if (!this.permissionWarned) {
        logger.warn('MarkdownFolderAdapter: Root folder permission is not granted. Please reselect the folder in Settings.');
        this.permissionWarned = true;
      }
      return maps;
    }

    // Include all root-level *.md as maps
    try {
      for await (const fileHandle of this.iterateMarkdownFiles(this.rootHandle as any)) {
        const data = await this.loadMapFromFile(fileHandle, this.rootHandle as any, '');
        if (data) maps.push(data);
      }
    } catch (e) {
      logger.warn('MarkdownFolderAdapter: Failed to read root-level markdown files', e);
    }

    for await (const entry of (this.rootHandle as any).values?.() || this.iterateEntries(this.rootHandle)) {
      if (entry.kind === 'directory') {
        await this.collectMaps(entry, entry.name ?? '', maps);
      }
    }
    return maps;
  }

  async saveAllMaps(maps: MindMapData[]): Promise<void> {
    for (const map of maps) {
      await this.saveData(map);
    }
  }

  async addMapToList(map: MindMapData): Promise<void> {
    await this.saveData(map);
  }

  async removeMapFromList(mapId: string): Promise<void> {
    // Not implemented yet (optional)
    logger.warn('MarkdownFolderAdapter: removeMapFromList not implemented', { mapId });
  }

  async updateMapInList(map: MindMapData): Promise<void> {
    await this.saveData(map);
  }

  cleanup(): void {
    // No persistent handles kept beyond session
  }

  // Return raw markdown text of a map by id (category/subpath + base name)
  async getMapMarkdown(mapId: string): Promise<string | null> {
    if (!this._isInitialized) {
      await this.initialize();
    }
    if (!this.rootHandle) return null;

    // 1) Try saveTargets (reliable when map was loaded or enumerated this session)
    const target = this.saveTargets.get(mapId);
    if (target) {
      try {
        const fh: FileHandle = await (target.dir as any).getFileHandle?.(target.fileName)
          ?? await (target.dir as any).getFileHandle(target.fileName);
        const file = await fh.getFile();
        return await file.text();
      } catch (e) {
        // fall through to path resolution
      }
    }

    // 2) Resolve path from mapId: "category/sub/name" => category/sub + name.md
    try {
      const parts = (mapId || '').split('/').filter(Boolean);
      if (parts.length === 0) return null;
      const base = parts.pop() as string;
      let dir: DirHandle = this.rootHandle as any;
      for (const p of parts) {
        const next = await this.getExistingDirectory(dir, p);
        if (!next) return null;
        dir = next;
      }
      const fh = await this.getExistingFile(dir, `${base}.md`);
      if (!fh) return null;
      const file = await fh.getFile();
      return await file.text();
    } catch {
      return null;
    }
  }

  // Save raw markdown text for a map by id
  async saveMapMarkdown(mapId: string, markdown: string): Promise<void> {
    if (!this._isInitialized) {
      await this.initialize();
    }
    if (!this.rootHandle) {
      logger.warn('MarkdownFolderAdapter: No folder selected; skipping markdown save');
      return;
    }

    // 1) Try saveTargets first (most reliable)
    const target = this.saveTargets.get(mapId);
    if (target) {
      try {
        const fh: FileHandle = await (target.dir as any).getFileHandle?.(target.fileName)
          ?? await (target.dir as any).getFileHandle(target.fileName);
        const writable = await fh.createWritable();
        await writable.write(markdown);
        await writable.close();
        logger.debug(`📝 MarkdownFolderAdapter: Saved markdown for ${mapId}`);
        return;
      } catch (e) {
        logger.warn('Failed to save via saveTargets, trying path resolution:', e);
      }
    }

    // 2) Resolve path from mapId and save
    try {
      const parts = (mapId || '').split('/').filter(Boolean);
      if (parts.length === 0) throw new Error('Invalid mapId');
      const base = parts.pop() as string;
      let dir: DirHandle = this.rootHandle as any;

      // Navigate to directory, creating if necessary
      for (const p of parts) {
        dir = await this.getOrCreateDirectory(dir, p);
      }

      const fileName = `${base}.md`;
      await this.writeTextFile(dir, fileName, markdown);

      logger.debug(`📝 MarkdownFolderAdapter: Saved markdown for ${mapId} via path resolution`);
    } catch (error) {
      logger.error(`❌ MarkdownFolderAdapter: Failed to save markdown for ${mapId}:`, error);
      throw error;
    }
  }

  async createFolder(relativePath: string): Promise<void> {
    if (!this.rootHandle) throw new Error('No root folder selected');
    let dir: DirHandle = this.rootHandle as any;
    const parts = (relativePath || '').split('/').filter(Boolean);
    for (const part of parts) {
      dir = await this.getOrCreateDirectory(dir, part);
    }
    // nothing else to do; folder ensured
  }

  private async loadMapFromDirectory(dir: DirHandle, categoryPath: string): Promise<MindMapData | null> {
    try {
      // Prefer map.md/README.md
      let fileHandle = await this.getExistingFile(dir, 'map.md') || await this.getExistingFile(dir, 'README.md');
      if (!fileHandle) {
        // Fallback to the first *.md within the directory
        for await (const fh of this.iterateMarkdownFiles(dir)) {
          fileHandle = fh;
          break;
        }
      }
      if (!fileHandle) return null;

      const data = await this.loadMapFromFile(fileHandle, dir, categoryPath);
      if (data) {
        // Mark save target as inside this directory
        this.saveTargets.set(data.id, { dir, fileName: await this.getFileName(fileHandle), isRoot: false });
      }
      return data;
    } catch (e) {
      logger.warn('MarkdownFolderAdapter: Failed to load from directory', e);
      return null;
    }
  }

  private async collectMaps(dir: DirHandle, categoryPath: string, out: MindMapData[]): Promise<void> {
    // Add all *.md in current directory (include map.md/README.md and others)
    for await (const fh of this.iterateMarkdownFiles(dir)) {
      const data = await this.loadMapFromFile(fh, dir, categoryPath);
      if (data) out.push(data);
    }

    // Recurse into subdirectories
    for await (const entry of (dir as any).values?.() || this.iterateEntries(dir)) {
      if (entry.kind === 'directory') {
        const subPath = categoryPath ? `${categoryPath}/${entry.name}` : entry.name;
        await this.collectMaps(entry, subPath, out);
      }
    }
  }

  private async loadMapFromFile(fileHandle: FileHandle, dirForSave: DirHandle, categoryPath: string): Promise<MindMapData | null> {
    try {
      const file = await fileHandle.getFile();
      const text = await file.text();
      const rootNode = MarkdownImporter.parseMarkdownToNodes(text);
      const headings = MarkdownImporter.parseHeadings(text);
      const baseHeadingLevel = headings[0]?.level || 1;
      const headingLevelByText: Record<string, number> = {};
      headings.forEach(h => { if (!(h.text in headingLevelByText)) headingLevelByText[h.text] = h.level; });
      const fileName = await this.getFileName(fileHandle);
      const baseName = fileName.replace(/\.md$/i, '') || 'Untitled';
      const now = new Date().toISOString();
      const data: MindMapData = {
        id: categoryPath ? `${categoryPath}/${baseName}` : baseName,
        title: baseName, // マップ名はファイル名に固定
        category: categoryPath || undefined,
        rootNode,
        createdAt: now,
        updatedAt: now,
        settings: { autoSave: true, autoLayout: true }
      };
      // Record save target (dir where the file resides)
      this.saveTargets.set(data.id, { dir: dirForSave, fileName, isRoot: !categoryPath, baseHeadingLevel, headingLevelByText });
      return data;
    } catch (e) {
      const name = await this.getFileName(fileHandle).catch(() => 'unknown.md');
      const tag = (e as any)?.name || (e as any)?.message || '';
      if ((e as any)?.name === 'NotReadableError' || /NotReadable/i.test(String(tag))) {
        if (!this.permissionWarned) {
          logger.warn(`MarkdownFolderAdapter: Failed to read file due to permission ("${name}"). Please reselect the folder.`);
          this.permissionWarned = true;
        } else {
          logger.debug('MarkdownFolderAdapter: Skipping unreadable file:', name);
        }
      } else {
        logger.warn('MarkdownFolderAdapter: Failed to load from file', e);
      }
      return null;
    }
  }

  private async writeTextFile(dir: DirHandle, name: string, content: string): Promise<void> {
    const fileHandle: FileHandle = await dir.getFileHandle?.(name, { create: true })
      ?? await (dir as any).getFileHandle(name, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
  }

  private async copyFileHandle(srcFileHandle: FileHandle, dstDir: DirHandle, name: string): Promise<void> {
    const dstHandle: FileHandle = await dstDir.getFileHandle?.(name, { create: true })
      ?? await (dstDir as any).getFileHandle(name, { create: true });
    const writable = await dstHandle.createWritable();
    const blob = await srcFileHandle.getFile();
    await writable.write(blob);
    await writable.close();
  }

  private async getFileName(fileHandle: FileHandle): Promise<string> {
    if ((fileHandle as any).name) return (fileHandle as any).name as string;
    try {
      const file = await fileHandle.getFile?.();
      if (file?.name) return file.name as string;
    } catch {}
    return 'map.md';
  }

  private async getOrCreateDirectory(parent: DirHandle, name: string): Promise<DirHandle> {
    return await parent.getDirectoryHandle?.(name, { create: true })
      ?? await (parent as any).getDirectoryHandle(name, { create: true });
  }

  private async getExistingFile(dir: DirHandle, name: string): Promise<FileHandle | null> {
    try {
      const handle = await dir.getFileHandle?.(name)
        ?? await (dir as any).getFileHandle(name);
      return handle;
    } catch {
      return null;
    }
  }

  private async getExistingDirectory(dir: DirHandle, name: string): Promise<DirHandle | null> {
    try {
      const handle = await dir.getDirectoryHandle?.(name)
        ?? await (dir as any).getDirectoryHandle(name);
      return handle;
    } catch {
      return null;
    }
  }

  private async resolveParentDirAndName(path: string): Promise<{ dir: DirHandle; name: string } | null> {
    if (!this.rootHandle) return null;
    const parts = (path || '').split('/').filter(Boolean);
    if (parts.length === 0) return null;
    const name = parts.pop() as string;
    let dir: DirHandle = this.rootHandle as any;
    for (const part of parts) {
      const next = await this.getExistingDirectory(dir, part);
      if (!next) return null;
      dir = next;
    }
    return { dir, name };
  }

  async deleteItem(path: string): Promise<void> {
    if (!this.rootHandle) throw new Error('No root folder selected');
    const resolved = await this.resolveParentDirAndName(path);
    if (!resolved) throw new Error('Path not found');
    const { dir, name } = resolved;
    const remover = (dir as any).removeEntry?.bind(dir);
    if (!remover) throw new Error('removeEntry not supported');
    try {
      await remover(name, { recursive: true });
    } catch (e) {
      // Some browsers do not support recursive for files
      await remover(name);
    }
  }

  async renameItem(path: string, newName: string): Promise<void> {
    if (!this.rootHandle) throw new Error('No root folder selected');
    const resolved = await this.resolveParentDirAndName(path);
    if (!resolved) throw new Error('Path not found');
    const { dir, name } = resolved;
    // Try file rename (copy + delete)
    const file = await this.getExistingFile(dir, name);
    if (file) {
      const fileData = await (await file.getFile()).text();
      const targetName = /\.md$/i.test(newName) ? newName : `${newName}.md`;
      await this.writeTextFile(dir, targetName, fileData);
      const remover = (dir as any).removeEntry?.bind(dir);
      if (remover) await remover(name);
      return;
    }
    // Directory rename (recursively copy then delete)
    const srcDir = await this.getExistingDirectory(dir, name);
    if (!srcDir) throw new Error('Item not found');
    const dstDir = await this.getOrCreateDirectory(dir, newName);
    await this.copyDirectoryRecursive(srcDir, dstDir);
    const remover = (dir as any).removeEntry?.bind(dir);
    if (remover) await remover(name, { recursive: true });
  }

  private async copyDirectoryRecursive(src: DirHandle, dst: DirHandle): Promise<void> {
    // @ts-ignore
    const iter = src.values?.() || src.entries?.();
    // @ts-ignore
    for await (const entry of iter) {
      let kind: string, name: string;
      if (Array.isArray(entry)) {
        name = entry[0];
        kind = entry[1].kind;
      } else {
        name = entry.name;
        kind = entry.kind;
      }
      if (kind === 'file') {
        // @ts-ignore
        const fh = await src.getFileHandle?.(name) ?? await (src as any).getFileHandle(name);
        const data = await (await fh.getFile()).text();
        await this.writeTextFile(dst, name, data);
      } else if (kind === 'directory') {
        const dstSub = await this.getOrCreateDirectory(dst, name);
        // @ts-ignore
        const srcSub = await src.getDirectoryHandle?.(name) ?? await (src as any).getDirectoryHandle(name);
        await this.copyDirectoryRecursive(srcSub, dstSub);
      }
    }
  }

  private async *iterateEntries(dir: DirHandle): AsyncGenerator<any, void, unknown> {
    // Fallback iterator if .values() is not available
    // @ts-ignore
    if (dir.entries) {
      // @ts-ignore
      for await (const [, entry] of dir.entries()) {
        yield entry;
      }
      return;
    }
    // No entries API available
    return;
  }

  // Explorer tree API
  async getExplorerTree(): Promise<ExplorerItem> {
    if (!this.rootHandle) {
      throw new Error('No root folder selected');
    }
    const perm = await this.queryPermission(this.rootHandle as any, 'readwrite');
    if (perm !== 'granted') {
      if (!this.permissionWarned) {
        logger.warn('MarkdownFolderAdapter: Root folder permission is not granted. Please reselect the folder in Settings.');
        this.permissionWarned = true;
      }
      return { type: 'folder', name: (this.rootHandle as any).name || '', path: '', children: [] };
    }
    const root: ExplorerItem = {
      type: 'folder',
      name: (this.rootHandle as any).name || '',
      path: '',
      children: []
    };
    root.children = await this.buildExplorerItems(this.rootHandle as any, '');
    return root;
  }

  private async buildExplorerItems(dir: DirHandle, basePath: string): Promise<ExplorerItem[]> {
    const items: ExplorerItem[] = [];
    // Prefer values(); fallback to entries()
    // @ts-ignore
    if (dir.values) {
      // @ts-ignore
      for await (const entry of dir.values()) {
        if (entry.kind === 'directory') {
          const path = basePath ? `${basePath}/${entry.name}` : entry.name;
          const childDir = await dir.getDirectoryHandle?.(entry.name) ?? await (dir as any).getDirectoryHandle(entry.name);
          const children = await this.buildExplorerItems(childDir, path);
          items.push({ type: 'folder', name: entry.name, path, children });
        } else if (entry.kind === 'file') {
          const name: string = entry.name || '';
          const path = basePath ? `${basePath}/${name}` : name;
          items.push({ type: 'file', name, path, isMarkdown: /\.md$/i.test(name) });
        }
      }
      return items.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name, 'ja') : a.type === 'folder' ? -1 : 1));
    }
    // @ts-ignore
    if (dir.entries) {
      // @ts-ignore
      for await (const [name, entry] of dir.entries()) {
        if (entry.kind === 'directory') {
          const path = basePath ? `${basePath}/${name}` : name;
          // @ts-ignore
          const childDir = await dir.getDirectoryHandle?.(name) ?? await (dir as any).getDirectoryHandle(name);
          const children = await this.buildExplorerItems(childDir, path);
          items.push({ type: 'folder', name, path, children });
        } else if (entry.kind === 'file') {
          const path = basePath ? `${basePath}/${name}` : name;
          items.push({ type: 'file', name, path, isMarkdown: /\.md$/i.test(name) });
        }
      }
      return items.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name, 'ja') : a.type === 'folder' ? -1 : 1));
    }
    return items;
  }

  private async ensureUniqueMarkdownName(dir: DirHandle, desired: string): Promise<string> {
    const exists = async (name: string) => !!(await this.getExistingFile(dir, name));
    if (!(await exists(desired))) return desired;
    const dot = desired.lastIndexOf('.');
    const base = dot > 0 ? desired.substring(0, dot) : desired;
    const ext = dot > 0 ? desired.substring(dot) : '';
    let i = 1;
    while (i < 1000) {
      const candidate = `${base}-${i}${ext}`;
      if (!(await exists(candidate))) return candidate;
      i++;
    }
    return `${base}-${Date.now()}${ext}`;
  }

  // ======= IndexedDB persistence for directory handles =======
  private async openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = (window as any).indexedDB?.open?.('mindoodle-fsa', 1);
      if (!req) { reject(new Error('indexedDB not available')); return; }
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('handles')) {
          db.createObjectStore('handles');
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  private async saveRootHandle(handle: DirHandle): Promise<void> {
    const db = await this.openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('handles', 'readwrite');
      const store = tx.objectStore('handles');
      const req = store.put(handle, 'root');
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    db.close();
  }

  private async loadRootHandle(): Promise<DirHandle | null> {
    const db = await this.openDb();
    const handle = await new Promise<DirHandle | null>((resolve, reject) => {
      const tx = db.transaction('handles', 'readonly');
      const store = tx.objectStore('handles');
      const req = store.get('root');
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return handle;
  }

  private async restoreRootHandle(): Promise<boolean> {
    try {
      const handle = await this.loadRootHandle();
      if (!handle) return false;
      const perm = await this.queryPermission(handle, 'readwrite');
      if (perm === 'granted') {
        this.rootHandle = handle;
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  private async queryPermission(handle: any, mode: 'read' | 'readwrite'): Promise<'granted' | 'denied' | 'prompt'> {
    try {
      if (typeof handle.queryPermission === 'function') {
        return await handle.queryPermission({ mode });
      }
      // Fallback: assume granted if methods exist
      return 'granted';
    } catch {
      return 'denied';
    }
  }

  private async *iterateMarkdownFiles(dir: DirHandle): AsyncGenerator<FileHandle, void, unknown> {
    // Prefer using .values() to iterate entries
    // Look for files ending with .md (case-insensitive)
    // @ts-ignore
    if (dir.values) {
      // @ts-ignore
      for await (const entry of dir.values()) {
        if (entry.kind === 'file' && /\.md$/i.test(entry.name || '')) {
          // @ts-ignore
          const fh = await dir.getFileHandle?.(entry.name) ?? await (dir as any).getFileHandle(entry.name);
          if (fh) yield fh;
        }
      }
      return;
    }
    // Fallback via entries()
    // @ts-ignore
    if (dir.entries) {
      // @ts-ignore
      for await (const [name, entry] of dir.entries()) {
        if (entry.kind === 'file' && /\.md$/i.test(name)) {
          // @ts-ignore
          const fh = await dir.getFileHandle?.(name) ?? await (dir as any).getFileHandle(name);
          if (fh) yield fh;
        }
      }
    }
  }

  private sanitizeName(name: string): string {
    return name.replace(/[^a-zA-Z0-9\-_.\s\u3040-\u30FF\u4E00-\u9FAF]/g, '_').trim() || 'untitled';
  }

  async moveItem(sourcePath: string, targetFolderPath: string): Promise<void> {
    if (!this.rootHandle) throw new Error('No root folder selected');
    const resolved = await this.resolveParentDirAndName(sourcePath);
    if (!resolved) throw new Error('Source path not found');
    const { dir: srcParent, name } = resolved;
    // Resolve/ensure target folder
    let dstDir: DirHandle = this.rootHandle as any;
    const parts = (targetFolderPath || '').split('/').filter(Boolean);
    for (const part of parts) {
      dstDir = await this.getOrCreateDirectory(dstDir, part);
    }
    // If moving to same parent and same name, nothing to do
    if (srcParent === dstDir) return;

    // Try move file first
    const srcFile = await this.getExistingFile(srcParent, name);
    if (srcFile) {
      const uniqueName = await this.ensureUniqueName(dstDir, name);
      await this.copyFileHandle(srcFile, dstDir, uniqueName);
      const remover = (srcParent as any).removeEntry?.bind(srcParent);
      if (remover) await remover(name);
      return;
    }
    // Directory move
    const srcDir = await this.getExistingDirectory(srcParent, name);
    if (!srcDir) throw new Error('Source not found');
    const uniqueFolderName = await this.ensureUniqueFolderName(dstDir, name);
    const dstSub = await this.getOrCreateDirectory(dstDir, uniqueFolderName);
    await this.copyDirectoryRecursive(srcDir, dstSub);
    const remover = (srcParent as any).removeEntry?.bind(srcParent);
    if (remover) await remover(name, { recursive: true });
  }

  private async ensureUniqueName(dir: DirHandle, desired: string): Promise<string> {
    const exists = async (name: string) => !!(await this.getExistingFile(dir, name)) || !!(await this.getExistingDirectory(dir, name));
    if (!(await exists(desired))) return desired;
    const dot = desired.lastIndexOf('.');
    const base = dot > 0 ? desired.substring(0, dot) : desired;
    const ext = dot > 0 ? desired.substring(dot) : '';
    let i = 1;
    while (i < 1000) {
      const candidate = `${base}-${i}${ext}`;
      if (!(await exists(candidate))) return candidate;
      i++;
    }
    return `${base}-${Date.now()}${ext}`;
  }

  private async ensureUniqueFolderName(dir: DirHandle, desired: string): Promise<string> {
    const exists = async (name: string) => !!(await this.getExistingDirectory(dir, name));
    if (!(await exists(desired))) return desired;
    let i = 1;
    while (i < 1000) {
      const candidate = `${desired}-${i}`;
      if (!(await exists(candidate))) return candidate;
      i++;
    }
    return `${desired}-${Date.now()}`;
  }
}

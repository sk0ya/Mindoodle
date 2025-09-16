import type { MindMapData } from '@shared/types';
import { DEFAULT_WORKSPACE_ID } from '@shared/types';
import type { StorageAdapter, ExplorerItem } from '../types';
import { logger } from '../../../shared/utils/logger';
import { MarkdownImporter } from '../../../shared/utils/markdownImporter';
import { createInitialData } from '../../../shared/types/dataTypes';

type DirHandle = any; // File System Access API types (browser only)
type FileHandle = any;

export class MarkdownFolderAdapter implements StorageAdapter {
  private _isInitialized = false;
  private rootHandle: DirHandle | null = null;
  // Multi-workspace: list of persisted directory handles
  private workspaces: Array<{ id: string; name: string; handle: DirHandle }> = [];
  private saveTargets: Map<string, { dir: DirHandle, fileName: string, isRoot: boolean, baseHeadingLevel?: number, headingLevelByText?: Record<string, number> } > = new Map();
  private permissionWarned = false;
  private allMaps: MindMapData[] = [];

  get isInitialized(): boolean {
    return this._isInitialized;
  }

  async initialize(): Promise<void> {
    // Do not open picker here; must be a user gesture.
    if (typeof (window as any)?.showDirectoryPicker !== 'function') {
      logger.warn('File System Access API is not available in this environment');
    }
    // Try to restore workspaces (multi) or legacy root (single)
    try {
      await this.restoreWorkspaces();
      if (this.workspaces.length > 0) {
        logger.info(`📁 MarkdownFolderAdapter: Restored ${this.workspaces.length} workspace(s)`);
        this.rootHandle = this.workspaces[0].handle; // fallback reference
      } else {
        const restored = await this.restoreRootHandle();
        if (restored) {
          logger.info('📁 MarkdownFolderAdapter: Restored legacy root folder');
        } else {
          logger.info('📁 MarkdownFolderAdapter: Initialized (no workspace yet)');
        }
      }
    } catch (e) {
      logger.warn('Failed to restore workspaces/root handle:', e);
    }
    this._isInitialized = true;
  }

  // Must be called from a user gesture (e.g. button click)
  async selectRootFolder(): Promise<void> {
    if (typeof (window as any)?.showDirectoryPicker !== 'function') {
      throw new Error('File System Access API is not available in this environment');
    }
    const handle = await (window as any).showDirectoryPicker({ id: 'mindoodle-workspace', mode: 'readwrite' });
    this.rootHandle = handle;
    logger.debug('📁 MarkdownFolderAdapter: Workspace folder selected');
    try {
      // Persist as a new workspace entry
      const id = this.generateWorkspaceId();
      const name = (handle as any)?.name || 'workspace';
      await this.persistWorkspace({ id, name, handle });
      await this.restoreWorkspaces();
      this.rootHandle = this.workspaces[0]?.handle || handle;
    } catch (e) {
      logger.warn('Failed to persist workspace handle:', e);
      // Fallback to legacy root persistence
      try { await this.saveRootHandle(handle); } catch {}
    }
  }

  get selectedFolderName(): string | null {
    try {
      if (this.workspaces.length > 0) return this.workspaces[0].name;
      return (this.rootHandle as any)?.name ?? null;
    } catch {
      return null;
    }
  }

  async loadInitialData(): Promise<MindMapData> {
    if (!this._isInitialized) {
      await this.initialize();
    }
    if (this.workspaces.length === 0 && !this.rootHandle) {
      // No folder selected yet; return an initial in-memory map.
      const mapIdentifier = { mapId: `map_${Date.now()}`, workspaceId: DEFAULT_WORKSPACE_ID };
    return createInitialData(mapIdentifier);
    }

    try {
      const targets = this.workspaces.length > 0 ? this.workspaces.map(w => w.handle) : [this.rootHandle as any];
      for (const handle of targets) {
        // Try root-level map first (map.md or README.md)
        const rootFileHandle = await this.getExistingFile(handle as any, 'map.md')
          || await this.getExistingFile(handle as any, 'README.md');
        if (rootFileHandle) {
          const data = await this.loadMapFromFile(rootFileHandle, handle as any, '', '0');
          if (data) return data;
        }
        // Try any *.md at root level
        for await (const fileHandle of this.iterateMarkdownFiles(handle as any)) {
          const data = await this.loadMapFromFile(fileHandle, handle as any, '', '0');
          if (data) return data;
        }
        // Try to find first subfolder (recursively) containing markdown
        for await (const entry of (handle as any).values?.() || this.iterateEntries(handle)) {
          if (entry.kind === 'directory') {
            const data = await this.loadMapFromDirectory(entry, entry.name ?? '');
            if (data) return data;
          }
        }
      }
    } catch (e) {
      logger.error('❌ MarkdownFolderAdapter: Failed to load initial data', e);
    }

    const mapIdentifier = { mapId: `map_${Date.now()}`, workspaceId: DEFAULT_WORKSPACE_ID };
    return createInitialData(mapIdentifier);
  }

  async saveData(data: MindMapData): Promise<void> {
    console.log('🔍 saveData called for:', data.mapIdentifier.mapId, data.title);
    
    if (!this._isInitialized) {
      await this.initialize();
    }
    const wsHandle = (data as any).mapIdentifier?.workspaceId
      ? (this.workspaces.find(w => w.id === (data as any).mapIdentifier.workspaceId)?.handle || null)
      : (this.workspaces[0]?.handle || this.rootHandle);
    if (!wsHandle) {
      logger.warn('MarkdownFolderAdapter: No folder selected; skipping save');
      return;
    }

    // mapIdentifier.mapIdから直接ファイルパスを決定
    const mapId = data.mapIdentifier.mapId;
    console.log('📁 Resolving file path from mapId:', mapId);
    
    // mapIdの構造: category/filename または filename
    const parts = (mapId || '').split('/').filter(Boolean);
    if (parts.length === 0) {
      console.log('❌ Invalid mapId, cannot determine file path');
      return;
    }
    
    const fileName = parts[parts.length - 1] + '.md';
    const categoryParts = parts.slice(0, -1);
    
    console.log('📂 Category parts:', categoryParts);
    console.log('📄 File name:', fileName);
    
    // ディレクトリを辿る
    let targetDir: DirHandle = wsHandle;
    for (const categoryPart of categoryParts) {
      targetDir = await this.getOrCreateDirectory(targetDir, categoryPart);
    }
    
    // ファイルに保存
    const markdown = this.buildMarkdownDocument(data);
    
    console.log('✅ Saving directly to file:', fileName, 'in directory:', categoryParts.join('/') || '(root)');
    await this.writeTextFile(targetDir, fileName, markdown);
    
    // saveTargetsにも記録（後続の処理のため）
    const stKey = `${data.mapIdentifier.workspaceId || '__default__'}::${data.mapIdentifier.mapId}`;
    this.saveTargets.set(stKey, { dir: targetDir, fileName, isRoot: categoryParts.length === 0 });
    this.saveTargets.set(data.mapIdentifier.mapId, { dir: targetDir, fileName, isRoot: categoryParts.length === 0 });
    
    logger.debug('💾 MarkdownFolderAdapter: Saved file', fileName);
  }

  async loadAllMaps(): Promise<MindMapData[]> {
    console.log('🗄️ MarkdownFolderAdapter.loadAllMaps called');
    if (!this._isInitialized) {
      await this.initialize();
    }
    if (this.workspaces.length === 0 && !this.rootHandle) return [];

    const maps: MindMapData[] = [];
    console.log('🗄️ Starting to load maps...');
    const targets = this.workspaces.length > 0 ? this.workspaces.map(w => ({ handle: w.handle, id: w.id, name: w.name })) : [{ handle: this.rootHandle as any, id: '__default__', name: (this.rootHandle as any)?.name || '' }];
    for (const t of targets) {
      const perm = await this.queryPermission(t.handle as any, 'readwrite');
      if (perm !== 'granted') {
        if (!this.permissionWarned) {
          logger.warn('MarkdownFolderAdapter: Workspace permission not granted');
          this.permissionWarned = true;
        }
        continue;
      }
      try {
        for await (const fileHandle of this.iterateMarkdownFiles(t.handle as any)) {
          try {
            const data = await this.loadMapFromFile(fileHandle, t.handle as any, '', t.id);
            if (data) {
              console.log('🗄️ Loading map from file:', data.mapIdentifier.mapId, data.title);
              // Check for duplicates
              const existing = maps.find(m =>
                m.mapIdentifier.mapId === data.mapIdentifier.mapId &&
                m.mapIdentifier.workspaceId === data.mapIdentifier.workspaceId
              );
              if (existing) {
                console.log('⚠️ Duplicate map found, skipping:', data.mapIdentifier.mapId);
              } else {
                maps.push(data);
              }
            }
          } catch {}
        }
      } catch (e) {
        logger.debug('MarkdownFolderAdapter: Root-level scan transient error', (e as any)?.name || (e as any)?.message || e);
      }
      for await (const entry of (t.handle as any).values?.() || this.iterateEntries(t.handle)) {
        if (entry.kind === 'directory') {
          await this.collectMapsForWorkspace({ id: t.id, name: t.name, handle: t.handle as any }, entry, entry.name ?? '', maps);
        }
      }
    }
    console.log('🗄️ MarkdownFolderAdapter.loadAllMaps finished. Total maps:', maps.length);
    console.log('🗄️ Final map list:', maps.map(m => `${m.mapIdentifier.mapId}: ${m.title}`));
    return maps;
  }

  // Minimal Markdown exporter (replaces exportUtils usage)
  // Minimal Markdown exporter (replaces exportUtils usage)
  // Minimal Markdown exporter (replaces exportUtils usage)
  // Minimal Markdown exporter (replaces exportUtils usage)
  // Minimal Markdown exporter (replaces exportUtils usage)
  // Minimal Markdown exporter (replaces exportUtils usage)
  private buildMarkdownDocument(data: MindMapData): string {
    console.log('🔍 buildMarkdownDocument called - using MarkdownImporter.convertNodesToMarkdown');

    // Use the proper markdown conversion logic that respects node types
    return MarkdownImporter.convertNodesToMarkdown(data.rootNodes || []);
  }

  async saveAllMaps(maps: MindMapData[]): Promise<void> {
    for (const map of maps) {
      await this.saveData(map);
    }
  }

  async addMapToList(newMap: MindMapData): Promise<void> {
    // Initialize allMaps if not done yet
    if (!this.allMaps) {
      this.allMaps = [];
    }
    
    const existingIndex = this.allMaps.findIndex(map => 
      map.mapIdentifier.mapId === newMap.mapIdentifier.mapId &&
      map.mapIdentifier.workspaceId === newMap.mapIdentifier.workspaceId
    );
    
    if (existingIndex !== -1) {
      // Update existing entry
      this.allMaps[existingIndex] = newMap;
    } else {
      // Add new entry
      this.allMaps.push(newMap);
    }
    
    // Don't call saveData here - only add to the in-memory list
    // Actual saving should be done explicitly by the user or through other means
  }

  async removeMapFromList(id: { mapId: string; workspaceId?: string }): Promise<void> {
    // Not implemented yet (optional)
    logger.warn('MarkdownFolderAdapter: removeMapFromList not implemented', { id });
  }

  async updateMapInList(map: MindMapData): Promise<void> {
    await this.saveData(map);
  }

  cleanup(): void {
    // No persistent handles kept beyond session
  }

  // Return raw markdown text of a map by id (category/subpath + base name)
  async getMapMarkdown(id: { mapId: string; workspaceId: string }): Promise<string | null> {
    if (!this._isInitialized) {
      await this.initialize();
    }
    if (this.workspaces.length === 0 && !this.rootHandle) return null;

    // 1) Try saveTargets (reliable when map was loaded or enumerated this session)
    const mapId = id.mapId;
    const target = Array.from(this.saveTargets.entries()).find(([k]) => k.endsWith(`::${mapId}`))?.[1] || this.saveTargets.get(mapId);
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

    // 2) Resolve path from mapId within specified workspace
    try {
      const parts = (mapId || '').split('/').filter(Boolean);
      if (parts.length === 0) return null;
      const base = parts.pop() as string;
      const ws = this.workspaces.find(w => w.id === id.workspaceId);
      if (!ws) return null;
      let dir: DirHandle = ws.handle as any;
      for (const p of parts) {
        const next = await this.getExistingDirectory(dir, p);
        if (!next) return null;
        dir = next;
      }
      const fh = await this.getExistingFile(dir, `${base}.md`);
      if (!fh) return null;
      const file = await fh.getFile();
      return await file.text();
    } catch {}
    return null;
  }

  // Return lastModified timestamp (ms) of a map file, or null if unavailable
  async getMapLastModified(id: { mapId: string; workspaceId: string }): Promise<number | null> {
    if (!this._isInitialized) {
      await this.initialize();
    }
    if (this.workspaces.length === 0 && !this.rootHandle) return null;
    try {
      const mapId = id.mapId;
      const target = Array.from(this.saveTargets.entries()).find(([k]) => k.endsWith(`::${mapId}`))?.[1] || this.saveTargets.get(mapId);
      if (target) {
        const fh: FileHandle = await (target.dir as any).getFileHandle?.(target.fileName)
          ?? await (target.dir as any).getFileHandle(target.fileName);
        const file = await fh.getFile();
        // @ts-ignore
        return typeof file.lastModified === 'number' ? (file.lastModified as number) : (file as any)?.lastModified || null;
      }
      const parts = (mapId || '').split('/').filter(Boolean);
      if (parts.length === 0) return null;
      const base = parts.pop() as string;
      const ws = this.workspaces.find(w => w.id === id.workspaceId);
      if (!ws) return null;
      let dir: DirHandle = ws.handle as any;
      for (const p of parts) {
        const next = await this.getExistingDirectory(dir, p);
        if (!next) return null;
        dir = next;
      }
      const fh = await this.getExistingFile(dir, `${base}.md`);
      if (!fh) return null;
      const file = await fh.getFile();
      // @ts-ignore
      return typeof file.lastModified === 'number' ? (file.lastModified as number) : (file as any)?.lastModified || null;
    } catch {
      return null;
    }
  }

  // Save raw markdown text for a map by id
  async saveMapMarkdown(id: { mapId: string; workspaceId: string }, markdown: string): Promise<void> {
    if (!this._isInitialized) {
      await this.initialize();
    }
    if (this.workspaces.length === 0 && !this.rootHandle) {
      logger.warn('MarkdownFolderAdapter: No folder selected; skipping markdown save');
      return;
    }

    // 1) Try saveTargets first (most reliable)
    const mapId = id.mapId;
    const target = Array.from(this.saveTargets.entries()).find(([k]) => k.endsWith(`::${mapId}`))?.[1] || this.saveTargets.get(mapId);
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

    // 2) Resolve in specified workspace
    const parts = (mapId || '').split('/').filter(Boolean);
    if (parts.length === 0) throw new Error('Invalid mapId');
    const base = parts.pop() as string;
    const ws = this.workspaces.find(w => w.id === id.workspaceId);
    if (!ws) throw new Error('Workspace not found for save');
    let dir: DirHandle = ws.handle as any;
    for (const p of parts) {
      dir = await this.getOrCreateDirectory(dir, p);
    }
    const fileName = `${base}.md`;
    await this.writeTextFile(dir, fileName, markdown);
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

      const data = await this.loadMapFromFile(fileHandle, dir, categoryPath, '0');
      if (data) {
        // Mark save target as inside this directory
        this.saveTargets.set(data.mapIdentifier.mapId, { dir, fileName: await this.getFileName(fileHandle), isRoot: false });
      }
      return data;
    } catch (e) {
      logger.warn('MarkdownFolderAdapter: Failed to load from directory', e);
      return null;
    }
  }

  // Old variant kept for reference (unused)
  // Removed unused legacy method

  private async collectMapsForWorkspace(ws: { id: string; name: string; handle: DirHandle }, dir: DirHandle, categoryPath: string, out: MindMapData[]): Promise<void> {
    for await (const fh of this.iterateMarkdownFiles(dir)) {
      try {
        const data = await this.loadMapFromFile(fh, dir, categoryPath, ws.id);
        if (data) {
          console.log('🗄️ collectMapsForWorkspace - Loading map:', data.mapIdentifier.mapId, data.title);
          // Check for duplicates
          const existing = out.find(m =>
            m.mapIdentifier.mapId === data.mapIdentifier.mapId &&
            m.mapIdentifier.workspaceId === data.mapIdentifier.workspaceId
          );
          if (existing) {
            console.log('⚠️ Duplicate map found in collectMapsForWorkspace, skipping:', data.mapIdentifier.mapId);
          } else {
            out.push(data);
          }
        }
      } catch {}
    }
    for await (const entry of (dir as any).values?.() || this.iterateEntries(dir)) {
      if (entry.kind === 'directory') {
        const sub = categoryPath ? `${categoryPath}/${entry.name}` : entry.name;
        await this.collectMapsForWorkspace(ws, entry, sub, out);
      }
    }
  }

  private async loadMapFromFile(fileHandle: FileHandle, dirForSave: DirHandle, categoryPath: string, workspaceId?: string): Promise<MindMapData | null> {
    try {
      const file = await fileHandle.getFile();
      const text = await file.text();
      
      const parseResult = MarkdownImporter.parseMarkdownToNodes(text);

      // Use heading level information from MarkdownImporter
      const headingLevelByText = parseResult.headingLevelByText;

      // Find the minimum heading level as base level
      const headingLevels = Object.values(headingLevelByText);
      const baseHeadingLevel = headingLevels.length > 0 ? Math.min(...headingLevels) : 1;
      
      const fileName = await this.getFileName(fileHandle);
      const baseName = fileName.replace(/\.md$/i, '');
      const mapId = categoryPath ? `${categoryPath}/${baseName}` : baseName;
      const fileLastModified = new Date(file.lastModified).toISOString();
      const data: MindMapData = {
        title: baseName, // マップ名はファイル名に固定
        category: categoryPath || undefined,
        rootNodes: parseResult.rootNodes,
        createdAt: fileLastModified,
        updatedAt: fileLastModified,
        settings: { autoSave: true, autoLayout: true },
        mapIdentifier: { mapId, workspaceId: workspaceId || DEFAULT_WORKSPACE_ID }
      };
      
      // Record save target with both keys to ensure consistency
      const saveTarget = { dir: dirForSave, fileName, isRoot: !categoryPath, baseHeadingLevel, headingLevelByText };
      
      // Set with plain mapId (legacy compatibility)
      this.saveTargets.set(data.mapIdentifier.mapId, saveTarget);
      
      // Set with composite key (matches saveData lookup)
      const compositeKey = `${data.mapIdentifier.workspaceId || '__default__'}::${data.mapIdentifier.mapId}`;
      this.saveTargets.set(compositeKey, saveTarget);
      
      return data;
    } catch (e) {
      const name = await this.getFileName(fileHandle).catch(() => 'unknown.md');
      const errorMessage = (e as any)?.message || '';
      const tag = (e as any)?.name || errorMessage;

      if ((e as any)?.name === 'NotReadableError' || /NotReadable/i.test(String(tag))) {
        if (!this.permissionWarned) {
          logger.warn(`MarkdownFolderAdapter: Failed to read file due to permission ("${name}"). Please reselect the folder.`);
          this.permissionWarned = true;
        } else {
          logger.debug('MarkdownFolderAdapter: Skipping unreadable file:', name);
        }
      } else if (errorMessage.includes('見出しが見つかりません')) {
        logger.warn(`MarkdownFolderAdapter: File "${name}" has no headings and cannot be imported as a mindmap`);
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

  // Multi-workspace persistence
  private async openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = (window as any).indexedDB?.open?.('mindoodle-fsa', 2);
      if (!req) { reject(new Error('indexedDB not available')); return; }
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('handles')) db.createObjectStore('handles'); // legacy
        if (!db.objectStoreNames.contains('workspaces')) db.createObjectStore('workspaces');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  private generateWorkspaceId(): string { return `ws_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; }

  private async persistWorkspace(ws: { id: string; name: string; handle: DirHandle }): Promise<void> {
    const db = await this.openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('workspaces', 'readwrite');
      const store = tx.objectStore('workspaces');
      const req = store.put({ name: ws.name, handle: ws.handle }, ws.id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    db.close();
  }

  private async restoreWorkspaces(): Promise<void> {
    this.workspaces = [];
    const db = await this.openDb();
    // Read all entries atomically via cursor to avoid nested async on a finished transaction
    const items: Array<{ id: string; rec: any }> = await new Promise((resolve, reject) => {
      const list: Array<{ id: string; rec: any }> = [];
      const tx = db.transaction('workspaces', 'readonly');
      const store = tx.objectStore('workspaces');
      const cursorReq = (store as any).openCursor?.();
      if (!cursorReq) { resolve([]); return; }
      cursorReq.onsuccess = (ev: any) => {
        const cursor = ev.target?.result;
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
    // Now outside of IDB transaction, check permissions and populate
    for (const { id, rec } of items) {
      if (!rec) continue;
      const handle = rec.handle as DirHandle;
      const perm = await this.queryPermission(handle, 'readwrite');
      if (perm === 'granted') {
        const name = (handle as any)?.name || rec.name || 'workspace';
        this.workspaces.push({ id, name, handle });
      }
    }
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
    const baseHandle = this.workspaces[0]?.handle || this.rootHandle;
    if (!baseHandle) return null;
    const parts = (path || '').split('/').filter(Boolean);
    if (parts.length === 0) return null;
    const name = parts.pop() as string;
    let dir: DirHandle = baseHandle as any;
    for (const part of parts) {
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
    if (this.workspaces.length === 0 && !this.rootHandle) {
      throw new Error('No workspace selected');
    }
    // If multi workspaces, synthesize a root with each workspace
    if (this.workspaces.length > 0) {
      const root: ExplorerItem = { type: 'folder', name: 'workspaces', path: '', children: [] };
      for (const ws of this.workspaces) {
        const perm = await this.queryPermission(ws.handle as any, 'readwrite');
        const node: ExplorerItem = { type: 'folder', name: ws.name, path: `/${ws.id}`, children: [] };
      if (perm === 'granted') node.children = await this.buildExplorerItems(ws.handle as any, `/${ws.id}`);
      root.children?.push(node);
    }
    return root;
  }
    // Fallback to legacy single root
    const perm = await this.queryPermission(this.rootHandle as any, 'readwrite');
    if (perm !== 'granted') {
      if (!this.permissionWarned) {
        logger.warn('MarkdownFolderAdapter: Root folder permission is not granted. Please reselect the folder.');
        this.permissionWarned = true;
      }
      return { type: 'folder', name: (this.rootHandle as any).name || '', path: '', children: [] };
    }
    const root: ExplorerItem = { type: 'folder', name: (this.rootHandle as any).name || '', path: '', children: [] };
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

  // ======= IndexedDB persistence for directory handles =======
  private async openLegacyDb(): Promise<IDBDatabase> {
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
    const db = await this.openLegacyDb();
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
    const db = await this.openLegacyDb();
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

  // Public workspace APIs (optional on adapter)
  async listWorkspaces(): Promise<Array<{ id: string; name: string }>> {
    return this.workspaces.map(w => ({ id: w.id, name: w.name }));
  }

  async addWorkspace(): Promise<void> {
    if (typeof (window as any)?.showDirectoryPicker !== 'function') {
      throw new Error('File System Access API is not available in this environment');
    }
    const handle = await (window as any).showDirectoryPicker({ id: 'mindoodle-workspace', mode: 'readwrite' });
    // Prevent duplicates: compare with existing handles via isSameEntry when available
    try {
      await this.restoreWorkspaces();
      for (const ws of this.workspaces) {
        try {
          if (typeof (handle as any).isSameEntry === 'function') {
            const same = await (handle as any).isSameEntry(ws.handle);
            if (same) {
              logger.info('📁 MarkdownFolderAdapter: Workspace already added; skipping');
              return;
            }
          }
        } catch {}
      }
    } catch {}
    const id = this.generateWorkspaceId();
    const name = (handle as any)?.name || 'workspace';
    await this.persistWorkspace({ id, name, handle });
    await this.restoreWorkspaces();
  }

  async removeWorkspace(id: string): Promise<void> {
    const db = await this.openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('workspaces', 'readwrite');
      const store = tx.objectStore('workspaces');
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    db.close();
    const prefix = `${id}::`;
    Array.from(this.saveTargets.keys()).forEach(k => { if (k.startsWith(prefix)) this.saveTargets.delete(k); });
    await this.restoreWorkspaces();
  }

  // Read image file from workspace and convert to data URL for display
  async readImageAsDataURL(relativePath: string, workspaceId?: string): Promise<string | null> {
    if (!this._isInitialized) {
      await this.initialize();
    }

    // Get the appropriate workspace handle
    const wsHandle = workspaceId
      ? this.workspaces.find(w => w.id === workspaceId)?.handle
      : (this.workspaces[0]?.handle || this.rootHandle);

    if (!wsHandle) {
      return null;
    }

    try {
      // Parse relative path
      const cleanPath = relativePath.replace(/^\.\//, ''); // Remove leading ./
      const parts = cleanPath.split('/').filter(Boolean);
      if (parts.length === 0) return null;

      // Navigate to directory
      let currentDir: DirHandle = wsHandle as any;
      const fileName = parts.pop() as string;

      for (const part of parts) {
        if (part === '..') {
          // Handle parent directory navigation - not supported in File System Access API
          // We can't go up from the selected folder
          console.warn('Parent directory navigation (..) not supported for images in File System Access API');
          return null;
        }
        const nextDir = await this.getExistingDirectory(currentDir, part);
        if (!nextDir) return null;
        currentDir = nextDir;
      }

      // Get the image file
      const fileHandle = await this.getExistingFile(currentDir, fileName);
      if (!fileHandle) return null;

      const file = await fileHandle.getFile();

      // Check if it's an image file
      if (!file.type.startsWith('image/')) {
        console.warn('File is not an image:', fileName, 'type:', file.type);
        return null;
      }

      // Convert to data URL
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
    } catch (error) {
      console.warn('Failed to read image file:', relativePath, error);
      return null;
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
          try {
            // @ts-ignore
            const fh = await dir.getFileHandle?.(entry.name) ?? await (dir as any).getFileHandle(entry.name);
            if (fh) yield fh;
          } catch (e) {
            // NotFound or race condition during rename/move: ignore
          }
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
          try {
            // @ts-ignore
            const fh = await dir.getFileHandle?.(name) ?? await (dir as any).getFileHandle(name);
            if (fh) yield fh;
          } catch (e) {
            // NotFound or race: ignore
          }
        }
      }
    }
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

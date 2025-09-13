import type { MindMapData } from '@shared/types';
import type { StorageAdapter } from '../types';
import { logger } from '../../../shared/utils/logger';
import { MarkdownImporter } from '../../../shared/utils/markdownImporter';
import { exportToMarkdown } from '../../../shared/utils/exportUtils';
import { createInitialData } from '../../../shared/types/dataTypes';

type DirHandle = any; // File System Access API types (browser only)
type FileHandle = any;

export class MarkdownFolderAdapter implements StorageAdapter {
  private _isInitialized = false;
  private rootHandle: DirHandle | null = null;

  get isInitialized(): boolean {
    return this._isInitialized;
  }

  async initialize(): Promise<void> {
    // Do not open picker here; must be a user gesture.
    if (typeof (window as any)?.showDirectoryPicker !== 'function') {
      logger.warn('File System Access API is not available in this environment');
    }
    this._isInitialized = true;
    logger.info('📁 MarkdownFolderAdapter: Initialized (waiting for user to select a folder)');
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
    logger.info('📁 MarkdownFolderAdapter: Root folder selected');
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
      // Try to find first map folder and load its markdown
      for await (const entry of (this.rootHandle as any).values?.() || this.iterateEntries(this.rootHandle)) {
        if (entry.kind === 'directory') {
          const data = await this.loadMapFromDirectory(entry);
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

    const folderName = this.sanitizeName(data.title || 'mindmap');
    const mapDir = await this.getOrCreateDirectory(this.rootHandle, folderName);
    const markdown = exportToMarkdown(data, { includeMetadata: true });
    await this.writeTextFile(mapDir, 'map.md', markdown);
    logger.info('💾 MarkdownFolderAdapter: Saved map.md in', folderName);
  }

  async loadAllMaps(): Promise<MindMapData[]> {
    if (!this._isInitialized) {
      await this.initialize();
    }
    if (!this.rootHandle) return [];

    const maps: MindMapData[] = [];
    for await (const entry of (this.rootHandle as any).values?.() || this.iterateEntries(this.rootHandle)) {
      if (entry.kind === 'directory') {
        const map = await this.loadMapFromDirectory(entry);
        if (map) maps.push(map);
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

  private async loadMapFromDirectory(dir: DirHandle): Promise<MindMapData | null> {
    try {
      const fileHandle = await this.getExistingFile(dir, 'map.md') || await this.getExistingFile(dir, 'README.md');
      if (!fileHandle) return null;
      const file = await fileHandle.getFile();
      const text = await file.text();
      const rootNode = MarkdownImporter.parseMarkdownToNodes(text);
      const title = rootNode.text || (dir.name ?? 'Untitled');
      const now = new Date().toISOString();
      const data: MindMapData = {
        id: dir.name ?? `map-${now}`,
        title,
        rootNode,
        createdAt: now,
        updatedAt: now,
        settings: {
          autoSave: true,
          autoLayout: false
        }
      };
      return data;
    } catch (e) {
      logger.warn('MarkdownFolderAdapter: Failed to load from directory', e);
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

  private sanitizeName(name: string): string {
    return name.replace(/[^a-zA-Z0-9\-_.\s\u3040-\u30FF\u4E00-\u9FAF]/g, '_').trim() || 'untitled';
  }
}

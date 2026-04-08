import type { ExplorerItem, StorageAdapter } from '@core/types';
import type { MapIdentifier } from '@shared/types';
import { buildWorkspacePath, cleanWorkspacePath, parseWorkspacePath } from '@shared/utils';

const IMAGE_FILE_RE = /\.(png|jpe?g|gif|webp|bmp|svg|avif|ico)$/i;
const MARKDOWN_FILE_RE = /\.md$/i;

export interface ExplorerMoveResolution {
  sourceWorkspaceId: string | null;
  sourceRelativePath: string;
  targetWorkspaceId: string | null;
  targetRelativePath: string;
}

interface CrossAdapterMoveOptions {
  sourcePath: string;
  targetFolderPath: string;
  explorerTree: ExplorerItem | null;
  getAdapterForWorkspace: (workspaceId: string | null) => StorageAdapter | null;
}

export class ExplorerMoveService {
  static resolveMove(
    sourcePath: string,
    targetFolderPath: string,
    fallbackSourceWorkspaceId?: string | null
  ): ExplorerMoveResolution {
    const sourceInfo = parseWorkspacePath(sourcePath);
    const targetInfo = parseWorkspacePath(targetFolderPath);
    const sourceWorkspaceId = sourceInfo.workspaceId ?? fallbackSourceWorkspaceId ?? null;
    const targetWorkspaceId = targetInfo.workspaceId ?? sourceWorkspaceId;

    return {
      sourceWorkspaceId,
      sourceRelativePath: sourceInfo.relativePath || '',
      targetWorkspaceId,
      targetRelativePath: targetInfo.relativePath || ''
    };
  }

  static findItemByPath(tree: ExplorerItem | null | undefined, targetPath: string): ExplorerItem | null {
    if (!tree) return null;
    if (tree.path === targetPath) return tree;

    for (const child of tree.children || []) {
      const found = this.findItemByPath(child, targetPath);
      if (found) return found;
    }

    return null;
  }

  static async moveAcrossAdapters(options: CrossAdapterMoveOptions): Promise<void> {
    const resolution = this.resolveMove(options.sourcePath, options.targetFolderPath);
    const { sourceWorkspaceId, targetWorkspaceId, targetRelativePath } = resolution;

    if (!sourceWorkspaceId || !targetWorkspaceId) {
      throw new Error('Cross-workspace move requires explicit source and target workspaces');
    }

    const sourceAdapter = options.getAdapterForWorkspace(sourceWorkspaceId);
    const targetAdapter = options.getAdapterForWorkspace(targetWorkspaceId);

    if (!sourceAdapter || !targetAdapter) {
      throw new Error('Storage adapter is not available for cross-workspace move');
    }

    const sourceItem =
      this.findItemByPath(options.explorerTree, options.sourcePath) ||
      this.createSyntheticItem(options.sourcePath);

    await this.copyItemAcrossAdapters(
      sourceItem,
      targetRelativePath,
      {
        sourceWorkspaceId,
        targetWorkspaceId,
        sourceAdapter,
        targetAdapter,
        explorerTree: options.explorerTree
      }
    );

    await this.deleteCopiedSource(sourceItem, sourceAdapter);
  }

  private static async copyItemAcrossAdapters(
    item: ExplorerItem,
    targetParentRelativePath: string,
    context: {
      sourceWorkspaceId: string;
      targetWorkspaceId: string;
      sourceAdapter: StorageAdapter;
      targetAdapter: StorageAdapter;
      explorerTree: ExplorerItem | null;
    }
  ): Promise<void> {
    const targetParentPath = buildWorkspacePath(
      context.targetWorkspaceId,
      targetParentRelativePath || null
    );

    if (item.type === 'folder') {
      const uniqueFolderName = this.ensureUniqueChildName(
        item.name,
        targetParentPath,
        context.explorerTree
      );
      const targetFolderRelativePath = this.joinRelativePath(targetParentRelativePath, uniqueFolderName);

      if (typeof context.targetAdapter.createFolder === 'function') {
        await context.targetAdapter.createFolder(targetFolderRelativePath, context.targetWorkspaceId);
      }

      for (const child of item.children || []) {
        await this.copyItemAcrossAdapters(child, targetFolderRelativePath, context);
      }
      return;
    }

    if (item.isMarkdown || MARKDOWN_FILE_RE.test(item.name)) {
      await this.copyMarkdownItem(item, targetParentRelativePath, targetParentPath, context);
      return;
    }

    if (IMAGE_FILE_RE.test(item.name)) {
      await this.copyImageItem(item, targetParentRelativePath, targetParentPath, context);
      return;
    }

    throw new Error(`Cross-workspace move does not support file type: ${item.name}`);
  }

  private static async copyMarkdownItem(
    item: ExplorerItem,
    targetParentRelativePath: string,
    targetParentPath: string,
    context: {
      sourceWorkspaceId: string;
      targetWorkspaceId: string;
      sourceAdapter: StorageAdapter;
      targetAdapter: StorageAdapter;
      explorerTree: ExplorerItem | null;
    }
  ): Promise<void> {
    const sourceMapIdentifier = this.toMapIdentifier(item.path, context.sourceWorkspaceId);
    const markdown = await context.sourceAdapter.getMapMarkdown?.(sourceMapIdentifier);

    if (markdown == null) {
      throw new Error(`Failed to read source map: ${sourceMapIdentifier.mapId}`);
    }
    if (typeof context.targetAdapter.saveMapMarkdown !== 'function') {
      throw new Error('Target adapter does not support markdown saves');
    }

    const uniqueFileName = this.ensureUniqueChildName(item.name, targetParentPath, context.explorerTree);
    const targetMapIdentifier: MapIdentifier = {
      mapId: this.joinRelativePath(
        targetParentRelativePath,
        uniqueFileName.replace(MARKDOWN_FILE_RE, '')
      ),
      workspaceId: context.targetWorkspaceId
    };

    await context.targetAdapter.saveMapMarkdown(targetMapIdentifier, markdown);
  }

  private static async copyImageItem(
    item: ExplorerItem,
    targetParentRelativePath: string,
    targetParentPath: string,
    context: {
      sourceWorkspaceId: string;
      targetWorkspaceId: string;
      sourceAdapter: StorageAdapter;
      targetAdapter: StorageAdapter;
      explorerTree: ExplorerItem | null;
    }
  ): Promise<void> {
    const sourceRelativePath = cleanWorkspacePath(item.path);
    const dataUrl = await context.sourceAdapter.readImageAsDataURL?.(
      sourceRelativePath,
      context.sourceWorkspaceId
    );

    if (!dataUrl) {
      throw new Error(`Failed to read source image: ${item.path}`);
    }
    if (typeof context.targetAdapter.saveImageFile !== 'function') {
      throw new Error('Target adapter does not support image saves');
    }

    const uniqueFileName = this.ensureUniqueChildName(item.name, targetParentPath, context.explorerTree);
    const targetRelativePath = this.joinRelativePath(targetParentRelativePath, uniqueFileName);
    const file = this.dataUrlToFile(dataUrl, uniqueFileName);

    await context.targetAdapter.saveImageFile(targetRelativePath, file, context.targetWorkspaceId);
  }

  private static async deleteCopiedSource(item: ExplorerItem, sourceAdapter: StorageAdapter): Promise<void> {
    if (item.type === 'folder') {
      for (const child of item.children || []) {
        await this.deleteCopiedSource(child, sourceAdapter);
      }

      if (typeof sourceAdapter.deleteItem === 'function') {
        try {
          await sourceAdapter.deleteItem(item.path);
        } catch {
          // Cloud folders can be virtual and do not always support direct deletion.
        }
      }
      return;
    }

    if (typeof sourceAdapter.deleteItem !== 'function') {
      throw new Error('Source adapter does not support deleting moved items');
    }

    await sourceAdapter.deleteItem(item.path);
  }

  private static createSyntheticItem(path: string): ExplorerItem {
    let normalized = path;
    while (normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }
    const segments = normalized.split('/').filter(Boolean);
    const name = segments[segments.length - 1] || normalized;

    return {
      type: 'file',
      name,
      path,
      isMarkdown: MARKDOWN_FILE_RE.test(name)
    };
  }

  private static toMapIdentifier(path: string, workspaceId: string): MapIdentifier {
    return {
      workspaceId,
      mapId: cleanWorkspacePath(path).replace(MARKDOWN_FILE_RE, '')
    };
  }

  private static joinRelativePath(parent: string, childName: string): string {
    return parent ? `${parent}/${childName}` : childName;
  }

  private static ensureUniqueChildName(
    desiredName: string,
    targetParentPath: string,
    explorerTree: ExplorerItem | null
  ): string {
    const existingNames = new Set(
      (this.findItemByPath(explorerTree, targetParentPath)?.children || []).map(child => child.name)
    );

    if (!existingNames.has(desiredName)) {
      return desiredName;
    }

    const extensionIndex = desiredName.lastIndexOf('.');
    const hasExtension = extensionIndex > 0;
    const baseName = hasExtension ? desiredName.slice(0, extensionIndex) : desiredName;
    const extension = hasExtension ? desiredName.slice(extensionIndex) : '';

    for (let index = 1; index < 1000; index++) {
      const candidate = `${baseName}-${index}${extension}`;
      if (!existingNames.has(candidate)) {
        return candidate;
      }
    }

    return `${baseName}-${Date.now()}${extension}`;
  }

  private static dataUrlToFile(dataUrl: string, fileName: string): File {
    const matches = /^data:([^;,]+)?(;base64)?,(.*)$/.exec(dataUrl);
    if (!matches) {
      throw new Error('Invalid image data URL');
    }

    const mimeType = matches[1] || 'application/octet-stream';
    const isBase64 = !!matches[2];
    const payload = matches[3] || '';
    const bytes = isBase64
      ? Uint8Array.from(atob(payload), char => char.charCodeAt(0))
      : new TextEncoder().encode(decodeURIComponent(payload));

    return new File([bytes], fileName, { type: mimeType });
  }
}

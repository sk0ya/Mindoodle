/**
 * Data Types - データ構造の型定義
 * MindMapに関連するデータ構造を定義
 */

import type { Position } from './base.types';

// Map Identifier types
export interface MapIdentifier {
  mapId: string;
  workspaceId: string;
}

// File attachment interface for both local and cloud storage
export interface FileAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  isImage: boolean;
  createdAt: string;

  // Data storage (for local mode)
  data?: string; // Base64 encoded data
  dataURL?: string; // For backward compatibility

  // Cloud storage (for cloud mode)
  downloadUrl?: string;
  storagePath?: string;
  thumbnailUrl?: string;
  r2FileId?: string;
  isR2Storage?: boolean;

  // Common optimization fields
  isOptimized?: boolean;
  originalSize?: number;
  optimizedSize?: number;
  compressionRatio?: string;
  optimizedType?: string;
  thumbnail?: string;
  nodeId?: string;
}

// Node link interface
export interface NodeLink {
  id: string;
  title?: string;
  url?: string;
  description?: string;
  createdAt: string;
  updatedAt?: string;
  targetNodeId?: string;
  targetMapId?: string;
  targetAnchor?: string;
}

// Markdown metadata interface
export interface MarkdownMeta {
  filePath?: string;
  lineNumber?: number;
  level?: number;
  type?: 'heading' | 'unordered-list' | 'ordered-list';
  originalText?: string;
  lastModified?: number;
  originalFormat?: string;
  indentLevel?: number;
}

// MindMap Node interface
export interface MindMapNode {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontWeight: string;
  fontFamily?: string;
  fontStyle?: string;
  color?: string;
  children: MindMapNode[];
  collapsed?: boolean;
  links?: NodeLink[];
  markdownMeta?: MarkdownMeta;
  note?: string;
  customImageWidth?: number;
  customImageHeight?: number;
}

// MindMap Settings interface
export interface MindMapSettings {
  autoSave: boolean;
  autoLayout: boolean;
  snapToGrid: boolean;
  showGrid: boolean;
  animationEnabled: boolean;
}

// MindMap Data interface
export interface MindMapData {
  title: string;
  category: string;
  createdAt: string;
  updatedAt: string;
  mapIdentifier: MapIdentifier;
  rootNodes: MindMapNode[];
  settings: MindMapSettings;
}

// Service dependency interfaces
export interface MindMapHookDependency {
  updateNode: (nodeId: string, updates: Partial<MindMapNode>) => void;
  addChildNode: (parentId: string, text: string, options?: Partial<MindMapNode>) => string | undefined;
  deleteNode: (nodeId: string) => void;
  changeParent: (nodeId: string, newParentId: string) => void;
  findNode: (nodeId: string) => MindMapNode | undefined;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export interface FileHandlersDependency {
  handleFileUpload: (nodeId: string, file: File) => Promise<void>;
  handleRemoveFile: (nodeId: string, fileId: string) => Promise<void>;
  handleFileDownload: (nodeId: string, fileId: string) => Promise<void>;
  handleFileRename: (nodeId: string, fileId: string, newName: string) => Promise<void>;
  handleShowImageModal: (image: { url: string; alt: string }) => void;
  handleShowFileActionMenu: (position: Position) => void;
}

export interface MapHandlersDependency {
  handleNavigateToMap: (id: MapIdentifier) => Promise<void>;
  handleCreateMap: (title: string) => Promise<string>;
  handleDeleteMap: (id: MapIdentifier) => Promise<void>;
  handleRenameMap: (id: MapIdentifier, newTitle: string) => Promise<void>;
  handleChangeCategory: (id: MapIdentifier, category: string) => Promise<void>;
  handleSelectMap: (id: MapIdentifier) => Promise<void>;
}

export interface UIStateDependency {
  handleCloseNodeMapLinksPanel: () => void;
  handleShowNodeMapLinks: (node: MindMapNode, position: Position) => void;
}

// Default workspace ID constant
export const DEFAULT_WORKSPACE_ID = '__default__';


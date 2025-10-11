
import type { Position } from './base.types';


export interface MapIdentifier {
  mapId: string;
  workspaceId: string;
}

export interface FileAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  isImage: boolean;
  createdAt: string;

  
  data?: string; 
  dataURL?: string; 

  downloadUrl?: string;

  
  isOptimized?: boolean;
  originalSize?: number;
  optimizedSize?: number;
  compressionRatio?: string;
  optimizedType?: string;
  thumbnail?: string;
  nodeId?: string;
}


export interface NodeLink {
  id: string;
  title?: string;
  url?: string;
  description?: string;
  targetNodeId?: string;
  targetMapId?: string;
  targetAnchor?: string;
}


export interface MarkdownMeta {
  filePath?: string;
  lineNumber?: number;
  level?: number;
  type?: 'heading' | 'unordered-list' | 'ordered-list' | 'preface';
  originalText?: string;
  lastModified?: number;
  originalFormat?: string;
  indentLevel?: number;
  isCheckbox?: boolean;
  isChecked?: boolean;
}


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
  
  kind?: 'text' | 'table';
  tableData?: {
    headers?: string[];
    rows: string[][];
  };
  
  lineEnding?: string;
}


export interface MindMapSettings {
  autoSave: boolean;
  autoLayout: boolean;
  showGrid: boolean;
  animationEnabled: boolean;
  defaultCollapseDepth?: number; 
}


export interface MindMapData {
  title: string;
  category?: string;
  createdAt: string;
  updatedAt: string;
  mapIdentifier: MapIdentifier;
  rootNodes: MindMapNode[];
  settings: MindMapSettings;
}


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


export const DEFAULT_WORKSPACE_ID = '__default__';


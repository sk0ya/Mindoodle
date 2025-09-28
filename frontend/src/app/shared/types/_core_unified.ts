export type NodeId = string & { readonly __brand: 'NodeId' };
export type MapId = string & { readonly __brand: 'MapId' };
export type FileId = string & { readonly __brand: 'FileId' };
export type UserId = string & { readonly __brand: 'UserId' };

// Type guards and factory functions for branded types
export const createNodeId = (id: string): NodeId => id as NodeId;
export const createMapId = (id: string): MapId => id as MapId;
export const createFileId = (id: string): FileId => id as FileId;
export const createUserId = (id: string): UserId => id as UserId;

export const isNodeId = (id: string): id is NodeId => typeof id === 'string' && id.length > 0;
export const isMapId = (id: string): id is MapId => typeof id === 'string' && id.length > 0;
export const isFileId = (id: string): id is FileId => typeof id === 'string' && id.length > 0;
export const isUserId = (id: string): id is UserId => typeof id === 'string' && id.length > 0;

// Base node interface that both modes can extend
export interface MindMapNode {
  id: string;
  text: string;
  x: number;
  y: number;
  children: MindMapNode[];
  
  // Optional visual properties
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  fontStyle?: string;
  color?: string;
  
  // Functional properties  
  collapsed?: boolean;
  links?: NodeLink[];
  
  // Image display properties
  customImageWidth?: number;
  customImageHeight?: number;
  
  // Markdown note for each node
  note?: string;

  // Markdown structure metadata
  markdownMeta?: MarkdownNodeMeta;

  // Line ending preference for markdown export (inherited from parent or detected from source)
  lineEnding?: string;
}

// Markdown structure metadata for preserving original format
export interface MarkdownNodeMeta {
  type: 'heading' | 'unordered-list' | 'ordered-list';
  level: number;
  originalFormat: string; // #, ##, -, *, +, 1., 2. など
  indentLevel?: number; // リストのインデントレベル（スペース数）
  lineNumber: number; // 元の行番号
  // Checkbox functionality for GitHub-style task lists
  isCheckbox?: boolean; // Whether this list item is a checkbox
  isChecked?: boolean;  // Checkbox state (true = checked, false = unchecked)
}

// Main mindmap data structure
export interface MindMapData {
  title: string;
  rootNodes: MindMapNode[]; // 複数ルートノード対応
  category?: string;
  // Unified identifier for storage routing
  mapIdentifier: MapIdentifier;
  theme?: string;
  createdAt: string;
  updatedAt: string;
  settings: MindMapSettings;
}

// Default workspace ID for when no workspace is selected
export const DEFAULT_WORKSPACE_ID = '__default__';

// Unified identifier for maps (id + workspace)
export interface MapIdentifier {
  mapId: string;
  workspaceId: string; // always required
}

// No factory helper needed; maps hold the identifier directly

// Settings configuration
export interface MindMapSettings {
  autoSave: boolean;
  autoLayout: boolean;
  showGrid?: boolean;
  animationEnabled?: boolean;
}

// Node link interface for linking to other mindmaps or nodes
export interface NodeLink {
  id: string;
  targetMapId?: string; // ID of target mindmap
  targetNodeId?: string; // ID of target node (optional, for root if not specified)
  targetAnchor?: string; // Anchor text for the target node (for duplicate node names)
  createdAt: string;
  updatedAt: string;
}

// UI State types
export interface UIState {
  selectedNodeId: string | null;
  editingNodeId: string | null;
  showTutorial: boolean;
  showKeyboardHelper: boolean;
  showMapList: boolean;
  showLayoutPanel: boolean;
  zoom: number;
  panX: number;
  panY: number;
}

// Utility types
export interface Position {
  x: number;
  y: number;
}

export interface Theme {
  name: string;
  background: string;
  connectionColor: string;
  textColor: string;
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  warnings?: string[];
}

export interface StorageStats {
  used: number;
  total: number;
  percentage: number;
}

export interface PerformanceMetrics {
  renderTime: number;
  nodeCount: number;
  memoryUsage?: number;
}

export interface KeyboardShortcut {
  key: string;
  description: string;
  category: string;
}

export interface LayoutAlgorithm {
  name: string;
  id: string;
  description: string;
}

// Enum-like types
export type StorageMode = 'local';

// Event types for consistency
export interface NodeEvent {
  nodeId: string;
  action: 'select' | 'edit' | 'create' | 'delete' | 'move';
  data?: unknown;
}

export interface MapEvent {
  mapId: string;
  action: 'create' | 'delete' | 'rename' | 'switch';
  data?: unknown;
}

// Error types
export interface AppError {
  code: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  context?: Record<string, unknown>;
  timestamp: string;
}

// Hook return types for consistency
export interface MindMapHookReturn {
  data: MindMapData | null;
  selectedNodeId: string | null;
  editingNodeId: string | null;
  editText: string;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setSelectedNodeId: (id: string | null) => void;
  setEditingNodeId: (id: string | null) => void;
  setEditText: (text: string) => void;
  findNode: (id: string) => MindMapNode | null;
  updateNode: (id: string, updates: Partial<MindMapNode>) => void;
  addChildNode: (parentId: string, text?: string, autoEdit?: boolean) => void;
  deleteNode: (id: string) => void;
  startEdit: (nodeId: string) => void;
  finishEdit: (nodeId?: string, text?: string) => void;
  updateTitle: (title: string) => void;
}

// Type guards for runtime type checking
export const isValidMindMapNode = (obj: unknown): obj is MindMapNode => {
  if (!obj || typeof obj !== 'object') return false;
  const node = obj as Record<string, unknown>;
  return (
    typeof node.id === 'string' &&
    typeof node.text === 'string' &&
    typeof node.x === 'number' &&
    typeof node.y === 'number' &&
    Array.isArray(node.children)
  );
};

export const isValidMindMapData = (obj: unknown): obj is MindMapData => {
  if (!obj || typeof obj !== 'object') return false;
  const data = obj as Record<string, unknown>;
  return (
    typeof data.title === 'string' &&
    Array.isArray(data.rootNodes) &&
    data.rootNodes.every(isValidMindMapNode) &&
    typeof data.createdAt === 'string' &&
    typeof data.updatedAt === 'string' &&
    data.settings !== null &&
    typeof data.settings === 'object' &&
    typeof (data.settings as Record<string, unknown>).autoSave === 'boolean' &&
    typeof (data.settings as Record<string, unknown>).autoLayout === 'boolean'
  );
};
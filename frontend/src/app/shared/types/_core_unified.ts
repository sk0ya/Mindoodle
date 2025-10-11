export type NodeId = string & { readonly __brand: 'NodeId' };
export type MapId = string & { readonly __brand: 'MapId' };
export type FileId = string & { readonly __brand: 'FileId' };
export type UserId = string & { readonly __brand: 'UserId' };


export const createNodeId = (id: string): NodeId => id as NodeId;
export const createMapId = (id: string): MapId => id as MapId;
export const createFileId = (id: string): FileId => id as FileId;
export const createUserId = (id: string): UserId => id as UserId;

export const isNodeId = (id: string): id is NodeId => typeof id === 'string' && id.length > 0;
export const isMapId = (id: string): id is MapId => typeof id === 'string' && id.length > 0;
export const isFileId = (id: string): id is FileId => typeof id === 'string' && id.length > 0;
export const isUserId = (id: string): id is UserId => typeof id === 'string' && id.length > 0;


export interface MindMapNode {
  id: string;
  text: string;
  x: number;
  y: number;
  children: MindMapNode[];
  
  
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  fontStyle?: string;
  color?: string;
  
  
  collapsed?: boolean;
  links?: NodeLink[];
  
  
  customImageWidth?: number;
  customImageHeight?: number;
  
  
  note?: string;

  
  markdownMeta?: MarkdownNodeMeta;

  
  lineEnding?: string;
}


export interface MarkdownNodeMeta {
  type: 'heading' | 'unordered-list' | 'ordered-list';
  level: number;
  originalFormat: string; 
  indentLevel?: number; 
  lineNumber: number; 
  
  isCheckbox?: boolean; 
  isChecked?: boolean;  
}


export interface MindMapData {
  title: string;
  rootNodes: MindMapNode[]; 
  category?: string;
  
  mapIdentifier: MapIdentifier;
  theme?: string;
  createdAt: string;
  updatedAt: string;
  settings: MindMapSettings;
}


export const DEFAULT_WORKSPACE_ID = '__default__';


export interface MapIdentifier {
  mapId: string;
  workspaceId: string; 
}




export interface MindMapSettings {
  autoSave: boolean;
  autoLayout: boolean;
  showGrid?: boolean;
  animationEnabled?: boolean;
}


export interface NodeLink {
  id: string;
  targetMapId?: string;
  targetNodeId?: string;
  targetAnchor?: string;
}


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


export type StorageMode = 'local';


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


export interface AppError {
  code: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  context?: Record<string, unknown>;
  timestamp: string;
}


export interface MindMapHookReturn {
  data: MindMapData | null;
  selectedNodeId: string | null;
  editingNodeId: string | null;
  editText: string;
  isLoading: boolean;
  error: string | null;
  
  
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
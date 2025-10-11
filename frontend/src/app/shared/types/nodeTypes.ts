import type { MindMapNode, MindMapData, NodeLink } from '@shared/types';
import type { NormalizedData } from '../../core/data/normalizedStore';


export interface DataState {
  data: MindMapData | null;
  normalizedData: NormalizedData | null; 
  selectedNodeId: string | null;
  editingNodeId: string | null;
  editText: string;
  editingMode: 'select-all' | 'cursor-at-end' | 'cursor-at-start' | null;
  
  lastSelectionBeforeInsert?: string | null;
}


export interface NodeOperations {
  
  addNode: (parentId: string, text?: string) => void;
  updateNode: (nodeId: string, updates: Partial<MindMapNode>) => void;
  deleteNode: (nodeId: string) => void;
  moveNode: (nodeId: string, newParentId: string) => void;
  changeSiblingOrder: (draggedNodeId: string, targetNodeId: string, insertBefore?: boolean) => void;
  toggleNodeCollapse: (nodeId: string) => void;
  
  
  findNode: (nodeId: string) => MindMapNode | null;
  getChildNodes: (nodeId: string) => MindMapNode[];
  
  
  selectNode: (nodeId: string | null) => void;
  startEditing: (nodeId: string) => void;
  startEditingWithCursorAtEnd: (nodeId: string) => void;
  startEditingWithCursorAtStart: (nodeId: string) => void;
  finishEditing: (nodeId: string, text: string) => void;
  cancelEditing: () => void;
  setEditText: (text: string) => void;
}


export interface LinkOperations {
  addNodeLink: (nodeId: string, linkData: Partial<NodeLink>) => void;
  updateNodeLink: (nodeId: string, linkId: string, updates: Partial<NodeLink>) => void;
  deleteNodeLink: (nodeId: string, linkId: string) => void;
}


export interface NodeActions extends NodeOperations, LinkOperations {
  
  setData: (data: MindMapData) => void;
  setRootNodes: (rootNodes: MindMapNode[]) => void;
  
  
  applyAutoLayout: () => void;
  
  
  updateNormalizedData: () => void;
  syncToMindMapData: () => void;
}


export interface NodeSlice extends NodeActions {

  data: MindMapData | null;
  normalizedData: NormalizedData | null;
  selectedNodeId: string | null;
  editingNodeId: string | null;
  editText: string;
  editingMode: 'select-all' | 'cursor-at-end' | 'cursor-at-start' | null;
  lastSelectionBeforeInsert?: string | null;
}

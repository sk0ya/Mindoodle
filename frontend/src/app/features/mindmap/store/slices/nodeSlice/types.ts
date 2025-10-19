import type { MindMapNode, NodeLink } from '@shared/types';

/**
 * Interface for the node slice of the MindMap store
 * Defines all operations for managing nodes in the mind map
 */
export interface NodeSlice {
  // Query operations (O(1) with normalized data)
  findNode: (nodeId: string) => MindMapNode | null;
  getChildNodes: (nodeId: string) => MindMapNode[];

  // CRUD operations
  updateNode: (nodeId: string, updates: Partial<MindMapNode>) => void;
  addChildNode: (parentId: string, text?: string) => string | undefined;
  addSiblingNode: (nodeId: string, text?: string, insertAfter?: boolean) => string | undefined;
  deleteNode: (nodeId: string) => void;
  moveNode: (nodeId: string, newParentId: string) => { success: boolean; reason?: string };
  moveNodeWithPosition: (nodeId: string, targetNodeId: string, position: 'before' | 'after' | 'child') => { success: boolean; reason?: string };
  changeSiblingOrder: (draggedNodeId: string, targetNodeId: string, insertBefore?: boolean) => void;
  toggleNodeCollapse: (nodeId: string) => void;

  // Editing operations
  selectNode: (nodeId: string | null) => void;
  startEditing: (nodeId: string) => void;
  startEditingWithCursorAtEnd: (nodeId: string) => void;
  startEditingWithCursorAtStart: (nodeId: string) => void;
  finishEditing: (nodeId: string, text: string) => void;
  cancelEditing: () => void;
  setEditText: (text: string) => void;

  // Link operations
  addNodeLink: (nodeId: string, linkData: Partial<NodeLink>) => void;
  updateNodeLink: (nodeId: string, linkId: string, updates: Partial<NodeLink>) => void;
  deleteNodeLink: (nodeId: string, linkId: string) => void;

  // Checkbox operations
  toggleNodeCheckbox: (nodeId: string, checked: boolean) => void;
}

/**
 * Normalized data structure for efficient lookups
 */
export interface NormalizedDataLike {
  nodes: Record<string, MindMapNode>;
  childrenMap?: Record<string, string[]>;
  parentMap?: Record<string, string>;
  rootNodeIds?: string[];
}

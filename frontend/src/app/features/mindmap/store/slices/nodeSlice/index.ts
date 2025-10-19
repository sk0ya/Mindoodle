import type { StateCreator } from 'zustand';
import type { MindMapStore } from '../types';
import type { NodeSlice } from './types';
import { createQueryOperations } from './queryOperations';
import { createCRUDOperations } from './crudOperations';
import { createMoveOperations } from './moveOperations';
import { createEditingOperations } from './editingOperations';
import { createLinkOperations } from './linkOperations';
import { createCheckboxOperations } from './checkboxOperations';

export type { NodeSlice } from './types';

/**
 * Node slice factory for MindMap store
 * Aggregates all node-related operations into a single slice
 */
export const createNodeSlice: StateCreator<
  MindMapStore,
  [["zustand/immer", never]],
  [],
  NodeSlice
> = (set, get) => ({
  // Query operations - O(1) with normalized data
  ...createQueryOperations(get),

  // CRUD operations - create, update, delete
  ...createCRUDOperations(set, get),

  // Move operations - repositioning and reordering
  ...createMoveOperations(set, get),

  // Editing operations - text editing and UI state
  ...createEditingOperations(set, get),

  // Link operations - hyperlink management
  ...createLinkOperations(set, get),

  // Checkbox operations - task list functionality
  ...createCheckboxOperations(set, get),
});

/**
 * Node slice - refactored into focused modules
 * Main exports retained for backward compatibility
 * Implementation split across:
 * - types.ts: Interface definitions
 * - helpers.ts: Utility functions
 * - queryOperations.ts: Node lookups
 * - crudOperations.ts: Create/update/delete
 * - moveOperations.ts: Repositioning/reordering
 * - editingOperations.ts: Text editing & UI state
 * - linkOperations.ts: Hyperlink management
 * - checkboxOperations.ts: Task list functionality
 */
export { createNodeSlice, type NodeSlice } from './nodeSlice/index';

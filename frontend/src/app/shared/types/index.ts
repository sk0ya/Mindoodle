/**
 * Local mode types - now using shared type system
 * This file re-exports shared types for backward compatibility
 */

// Import all types from unified core
export type {
  MindMapNode,
  MindMapData,
  MindMapSettings,
  UIState,
  ValidationResult,
  StorageStats,
  PerformanceMetrics,
  KeyboardShortcut,
  LayoutAlgorithm,
  NodeEvent,
  MapEvent,
  AppError,
  MindMapHookReturn,
  NodeId,
  MapId,
  FileId,
  UserId,
  NodeLink,
  Position,
  Theme,
  StorageMode,
  SyncStatus,
  ConnectionStatus,
  MapIdentifier,
  MarkdownNodeMeta
} from './_core_unified';

// Import local types (avoiding duplicates)
export type {
  MindMapHookDependency,
  FileHandlersDependency,
  MapHandlersDependency,
  UIStateDependency,
} from './dataTypes';

// Constants are now exported from the unified constants file
// Use: import { COLORS, LAYOUT, TYPOGRAPHY, etc. } from '@shared/constants'

// Re-export type guards and factories
export {
  isValidMindMapNode,
  isValidMindMapData,
  DEFAULT_WORKSPACE_ID,
  createNodeId,
  createMapId,
  createFileId,
  createUserId,
  isNodeId,
  isMapId,
  isFileId,
  isUserId
} from './_core_unified';

// Export dataTypes specific items (only non-conflicting ones)
// Note: NodeId, MapId, FileId are already exported from _core_unified, so skip them here

export type { Result } from './result';
export { Success, Failure, isSuccess, isFailure, map, flatMap, match, collect, tryCatch, tryCatchAsync } from './result';

export type { MindFlowError } from './errors';
export { 
  ErrorCode, 
  MindFlowBaseError, 
  NodeError, 
  MapError, 
  FileError, 
  StorageError, 
  ValidationError,
  createNodeError,
  createMapError,
  createFileError,
  createStorageError,
  createValidationError,
  isNodeError,
  isMapError,
  isFileError,
  isStorageError,
  isValidationError,
  isMindFlowError
} from './errors';
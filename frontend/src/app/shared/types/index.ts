/**
 * Shared Types - 統一エクスポート
 * アプリケーション全体で使用される共通型をエクスポート
 */

// Base types
export type {
  Position,
  Size,
  Bounds,
  NodeId,
  MapId,
  FileId,
  Theme
} from './base.types';

export {
  isNodeId,
  isMapId,
  isFileId,
  createNodeId,
  createMapId,
  createFileId
} from './base.types';

// Data types
export type {
  MapIdentifier,
  NodeLink,
  MarkdownMeta,
  MindMapNode,
  MindMapSettings,
  MindMapData,
  MindMapHookDependency,
  FileHandlersDependency,
  MapHandlersDependency,
  UIStateDependency
} from './data.types';

export {
  DEFAULT_WORKSPACE_ID
} from './data.types';

// Data factory functions
export { createInitialData } from '../utils/dataFactory';


// UI types
export type {
  UIState,
  ContextMenuState,
  ModalStates,
  UIActions,
  UISlice
} from './ui.types';

// Storage types
export type {
  StorageAdapter,
  ExplorerItem,
  StorageConfig,
  StorageMode,
  SyncStatus
} from '../../core/types/storage.types';

// Legacy compatibility - maintaining old import paths
// These should eventually be migrated to use the new structure
export type {
  MindMapNode as SharedMindMapNode,
  MindMapData as SharedMindMapData,
  MindMapSettings as SharedMindMapSettings
} from './data.types';

// Legacy types that still exist (maintaining backward compatibility)
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

// Legacy unified types (for backward compatibility)
// TODO: これらは段階的に新しい型構造に移行する
export type {
  ValidationResult,
  StorageStats,
  PerformanceMetrics,
  KeyboardShortcut,
  LayoutAlgorithm,
  NodeEvent,
  MapEvent,
  AppError,
  MindMapHookReturn,
  UserId,
  ConnectionStatus,
  MarkdownNodeMeta
} from './_core_unified';
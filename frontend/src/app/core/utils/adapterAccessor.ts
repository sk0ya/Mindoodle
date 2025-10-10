/**
 * Adapter Accessor Utilities
 *
 * Eliminates the repeated pattern of accessing storage adapters throughout the codebase.
 * This centralizes adapter access logic and improves type safety.
 */

import type { StorageAdapter } from '@/app/core/types';

/**
 * Interface for persistence hook with adapter access methods
 * TODO: Move this to proper type definitions in Phase 6
 */
interface PersistenceHookLike {
  storageAdapter?: StorageAdapter | null;
  getAdapterForWorkspace?: (workspaceId: string | null) => StorageAdapter | null;
}

/**
 * Get storage adapter for a specific workspace
 *
 * This function replaces the repeated pattern:
 * `(persistenceHook as any).getAdapterForWorkspace?.(workspaceId) || persistenceHook.storageAdapter`
 *
 * @param persistenceHook - The persistence hook instance
 * @param workspaceId - Optional workspace ID (null for current workspace)
 * @returns Storage adapter instance or null if not available
 *
 * @example
 * ```typescript
 * // Before:
 * const adapter = (persistenceHook as any).getAdapterForWorkspace?.(workspaceId) || persistenceHook.storageAdapter;
 *
 * // After:
 * const adapter = getAdapterForWorkspace(persistenceHook, workspaceId);
 * ```
 */
export function getAdapterForWorkspace(
  persistenceHook: PersistenceHookLike | null | undefined,
  workspaceId?: string | null
): StorageAdapter | null {
  if (!persistenceHook) {
    return null;
  }

  // If workspace ID is provided and method exists, use it
  if (workspaceId !== undefined && typeof persistenceHook.getAdapterForWorkspace === 'function') {
    return persistenceHook.getAdapterForWorkspace(workspaceId);
  }

  // Fallback to current adapter
  return persistenceHook.storageAdapter ?? null;
}

/**
 * Get current storage adapter (shorthand for no workspace ID)
 *
 * @param persistenceHook - The persistence hook instance
 * @returns Current storage adapter instance or null
 *
 * @example
 * ```typescript
 * const adapter = getCurrentAdapter(persistenceHook);
 * ```
 */
export function getCurrentAdapter(
  persistenceHook: PersistenceHookLike | null | undefined
): StorageAdapter | null {
  return persistenceHook?.storageAdapter ?? null;
}

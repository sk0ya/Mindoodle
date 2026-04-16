import { useCallback, useEffect, useRef } from 'react';
import {
  LAYOUT_AUTO_PAN_MAX_RETRIES,
  LAYOUT_AUTO_PAN_RETRY_MS,
  type EnsureSelectedNodeVisibleResult,
} from './viewportAutoPanTiming';

/**
 * Automatically ensures the selected node is visible in the viewport
 *
 * Single Responsibility: "When a node is selected, ensure it's visible"
 *
 * This hook implements the principle that selecting a node should make it
 * visible if it's currently off-screen. Unlike centerNodeInView, this only
 * scrolls the minimum amount needed to bring the node into view.
 *
 * Key behavior:
 * - If node is already visible: does nothing (no annoying scrolling)
 * - If node is off-screen: scrolls just enough to show it
 */
interface UseAutoScrollToSelectedNodeProps {
  selectedNodeId: string | null;
  ensureSelectedNodeVisible: (options?: { force?: boolean }) => EnsureSelectedNodeVisibleResult;
  /**
   * When true, disables auto-scroll (for cases where selection changes
   * but we don't want to move the viewport, e.g., during bulk operations)
   */
  disabled?: boolean;
}

export function useAutoScrollToSelectedNode({
  selectedNodeId,
  ensureSelectedNodeVisible,
  disabled = false,
}: UseAutoScrollToSelectedNodeProps) {
  const previousNodeIdRef = useRef<string | null>(null);
  const retryTimeoutIdRef = useRef<number | null>(null);

  const clearRetryTimeout = useCallback(() => {
    if (retryTimeoutIdRef.current === null) return;
    clearTimeout(retryTimeoutIdRef.current);
    retryTimeoutIdRef.current = null;
  }, []);

  useEffect(() => {
    // Skip if disabled
    if (disabled) return;

    // Skip if no node selected
    if (!selectedNodeId) {
      previousNodeIdRef.current = null;
      return;
    }

    // Skip if same node (no change)
    if (previousNodeIdRef.current === selectedNodeId) {
      return;
    }

    // Update ref
    previousNodeIdRef.current = selectedNodeId;

    const scheduleRetry = (attempt: number) => {
      clearRetryTimeout();
      retryTimeoutIdRef.current = window.setTimeout(() => {
        retryTimeoutIdRef.current = null;
        if (previousNodeIdRef.current !== selectedNodeId) return;
        const result = ensureSelectedNodeVisible();
        if (result === 'suppressed' && attempt < LAYOUT_AUTO_PAN_MAX_RETRIES) {
          scheduleRetry(attempt + 1);
        }
      }, LAYOUT_AUTO_PAN_RETRY_MS);
    };

    // Ensure node is visible after the DOM has updated.
    const frameId = requestAnimationFrame(() => {
      if (previousNodeIdRef.current !== selectedNodeId) return;
      ensureSelectedNodeVisible();
      scheduleRetry(1);
    });

    return () => {
      cancelAnimationFrame(frameId);
      clearRetryTimeout();
    };
  }, [selectedNodeId, ensureSelectedNodeVisible, disabled, clearRetryTimeout]);
}

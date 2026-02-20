import { useEffect, useRef } from 'react';

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
  ensureSelectedNodeVisible: (options?: { force?: boolean }) => void;
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

    // Ensure node is visible (only scrolls if off-screen)
    // Use requestAnimationFrame to ensure DOM has updated
    // Do NOT use force: true here — after node insertion, the layout's
    // pan-compensation already stabilises the viewport and layout.applied
    // sets a suppression window.  Using force would bypass that suppression
    // and cause a conflicting scroll.  Keyboard navigation handles its own
    // forced scroll via the navigateToDirection handler.
    requestAnimationFrame(() => {
      ensureSelectedNodeVisible();
    });
  }, [selectedNodeId, ensureSelectedNodeVisible, disabled]);
}

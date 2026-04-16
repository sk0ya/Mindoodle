import type { MindMapNode } from '@shared/types';
import { findNodeInRoots } from '@mindmap/utils';
import {
  LAYOUT_AUTO_PAN_MAX_RETRIES,
  LAYOUT_AUTO_PAN_RETRY_MS,
  type EnsureSelectedNodeVisibleResult,
} from '../../hooks/viewportAutoPanTiming';

interface ScheduleNewNodeVisibilityCheckParams {
  nodeId: string;
  ensureSelectedNodeVisible?: () => EnsureSelectedNodeVisibleResult;
  getSelectedNodeId: () => string | null;
  getRootNodes: () => MindMapNode[];
}

export const scheduleNewNodeVisibilityCheck = ({
  nodeId,
  ensureSelectedNodeVisible,
  getSelectedNodeId,
  getRootNodes,
}: ScheduleNewNodeVisibilityCheckParams): void => {
  if (!ensureSelectedNodeVisible) return;

  const schedule = (attempt: number) => {
    window.setTimeout(() => {
      if (getSelectedNodeId() !== nodeId) return;
      if (!findNodeInRoots(getRootNodes(), nodeId)) return;

      const result = ensureSelectedNodeVisible();
      if (result === 'suppressed' && attempt < LAYOUT_AUTO_PAN_MAX_RETRIES) {
        schedule(attempt + 1);
      }
    }, LAYOUT_AUTO_PAN_RETRY_MS);
  };

  schedule(1);
};

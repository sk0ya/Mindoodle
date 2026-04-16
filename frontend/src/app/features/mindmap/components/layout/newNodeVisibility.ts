import type { MindMapNode } from '@shared/types';
import { findNodeInRoots } from '@mindmap/utils';
import {
  NEW_NODE_VISIBILITY_MAX_RETRIES,
  NEW_NODE_VISIBILITY_RETRY_MS,
  type EnsureSelectedNodeVisibleResult,
} from '../../hooks/viewportAutoPanTiming';

interface ScheduleNewNodeVisibilityCheckParams {
  nodeId: string;
  ensureSelectedNodeVisible?: (options?: { force?: boolean }) => EnsureSelectedNodeVisibleResult;
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

  const isStillTargetNode = () => (
    getSelectedNodeId() === nodeId &&
    Boolean(findNodeInRoots(getRootNodes(), nodeId))
  );

  const runCheck = (attempt: number) => {
    if (!isStillTargetNode()) return;

    const result = ensureSelectedNodeVisible({ force: true });
    if (result === 'suppressed' && attempt < NEW_NODE_VISIBILITY_MAX_RETRIES) {
      window.setTimeout(() => runCheck(attempt + 1), NEW_NODE_VISIBILITY_RETRY_MS);
    }
  };

  const schedule = (attempt: number) => {
    window.requestAnimationFrame(() => runCheck(attempt));
  };

  schedule(1);
};

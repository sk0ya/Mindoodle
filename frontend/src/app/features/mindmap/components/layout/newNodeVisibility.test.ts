import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MindMapNode } from '@shared/types';
import { scheduleNewNodeVisibilityCheck } from './newNodeVisibility';
import {
  LAYOUT_AUTO_PAN_MAX_RETRIES,
  LAYOUT_AUTO_PAN_RETRY_MS,
  type EnsureSelectedNodeVisibleResult,
} from '../../hooks/viewportAutoPanTiming';

const createNode = (id: string, children: MindMapNode[] = []): MindMapNode => ({
  id,
  text: id,
  x: 0,
  y: 0,
  fontSize: 14,
  fontWeight: 'normal',
  children,
});

describe('scheduleNewNodeVisibilityCheck', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('checks only the newly created node after the layout suppression window', () => {
    const ensureSelectedNodeVisible = vi.fn();

    scheduleNewNodeVisibilityCheck({
      nodeId: 'new-node',
      ensureSelectedNodeVisible,
      getSelectedNodeId: () => 'new-node',
      getRootNodes: () => [createNode('root', [createNode('new-node')])],
    });

    vi.advanceTimersByTime(LAYOUT_AUTO_PAN_RETRY_MS - 1);
    expect(ensureSelectedNodeVisible).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(ensureSelectedNodeVisible).toHaveBeenCalledTimes(1);
    expect(ensureSelectedNodeVisible).toHaveBeenCalledWith();
  });

  it('does nothing if the user has selected another node before the delayed check', () => {
    const ensureSelectedNodeVisible = vi.fn();

    scheduleNewNodeVisibilityCheck({
      nodeId: 'new-node',
      ensureSelectedNodeVisible,
      getSelectedNodeId: () => 'other-node',
      getRootNodes: () => [createNode('root', [createNode('new-node')])],
    });

    vi.advanceTimersByTime(LAYOUT_AUTO_PAN_RETRY_MS);

    expect(ensureSelectedNodeVisible).not.toHaveBeenCalled();
  });

  it('retries while creation visibility is still suppressed', () => {
    const ensureSelectedNodeVisible = vi.fn<() => EnsureSelectedNodeVisibleResult>()
      .mockReturnValue('suppressed');

    scheduleNewNodeVisibilityCheck({
      nodeId: 'new-node',
      ensureSelectedNodeVisible,
      getSelectedNodeId: () => 'new-node',
      getRootNodes: () => [createNode('root', [createNode('new-node')])],
    });

    for (let i = 0; i < LAYOUT_AUTO_PAN_MAX_RETRIES; i += 1) {
      vi.advanceTimersByTime(LAYOUT_AUTO_PAN_RETRY_MS);
    }

    expect(ensureSelectedNodeVisible).toHaveBeenCalledTimes(LAYOUT_AUTO_PAN_MAX_RETRIES);
    expect(ensureSelectedNodeVisible).not.toHaveBeenCalledWith({ force: true });
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MindMapNode } from '@shared/types';
import { scheduleNewNodeVisibilityCheck } from './newNodeVisibility';
import {
  NEW_NODE_VISIBILITY_MAX_RETRIES,
  NEW_NODE_VISIBILITY_RETRY_MS,
  type EnsureSelectedNodeVisibleOptions,
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
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      return window.setTimeout(() => callback(performance.now()), 0);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('checks the newly created empty node on the next animation frame', () => {
    const ensureSelectedNodeVisible = vi.fn();

    scheduleNewNodeVisibilityCheck({
      nodeId: 'new-node',
      ensureSelectedNodeVisible,
      getSelectedNodeId: () => 'new-node',
      getRootNodes: () => [createNode('root', [createNode('new-node')])],
    });

    expect(ensureSelectedNodeVisible).not.toHaveBeenCalled();

    vi.advanceTimersByTime(0);

    expect(ensureSelectedNodeVisible).toHaveBeenCalledTimes(1);
    expect(ensureSelectedNodeVisible).toHaveBeenCalledWith({ force: true });
  });

  it('does nothing if the user has selected another node before the creation frame', () => {
    const ensureSelectedNodeVisible = vi.fn();

    scheduleNewNodeVisibilityCheck({
      nodeId: 'new-node',
      ensureSelectedNodeVisible,
      getSelectedNodeId: () => 'other-node',
      getRootNodes: () => [createNode('root', [createNode('new-node')])],
    });

    vi.advanceTimersByTime(0);

    expect(ensureSelectedNodeVisible).not.toHaveBeenCalled();
  });

  it('retries while creation visibility is still suppressed', () => {
    const ensureSelectedNodeVisible = vi.fn<(options?: EnsureSelectedNodeVisibleOptions) => EnsureSelectedNodeVisibleResult>()
      .mockReturnValue('suppressed');

    scheduleNewNodeVisibilityCheck({
      nodeId: 'new-node',
      ensureSelectedNodeVisible,
      getSelectedNodeId: () => 'new-node',
      getRootNodes: () => [createNode('root', [createNode('new-node')])],
    });

    for (let i = 0; i < NEW_NODE_VISIBILITY_MAX_RETRIES; i += 1) {
      vi.advanceTimersByTime(i === 0 ? 0 : NEW_NODE_VISIBILITY_RETRY_MS);
    }

    expect(ensureSelectedNodeVisible).toHaveBeenCalledTimes(NEW_NODE_VISIBILITY_MAX_RETRIES);
    expect(ensureSelectedNodeVisible).toHaveBeenCalledWith({ force: true });
  });

  it('can prevent downward pan for rightward child insertion checks', () => {
    const ensureSelectedNodeVisible = vi.fn();

    scheduleNewNodeVisibilityCheck({
      nodeId: 'new-node',
      ensureSelectedNodeVisible,
      preventDownwardPan: true,
      getSelectedNodeId: () => 'new-node',
      getRootNodes: () => [createNode('root', [createNode('new-node')])],
    });

    vi.advanceTimersByTime(0);

    expect(ensureSelectedNodeVisible).toHaveBeenCalledWith({
      force: true,
      preventDownwardPan: true,
    });
  });
});

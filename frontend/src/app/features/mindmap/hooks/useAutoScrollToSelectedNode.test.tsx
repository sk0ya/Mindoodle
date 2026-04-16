import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAutoScrollToSelectedNode } from './useAutoScrollToSelectedNode';
import { LAYOUT_AUTO_PAN_RETRY_MS, type EnsureSelectedNodeVisibleResult } from './viewportAutoPanTiming';

interface HarnessProps {
  selectedNodeId: string | null;
  ensureSelectedNodeVisible: (options?: { force?: boolean }) => EnsureSelectedNodeVisibleResult;
  disabled?: boolean;
}

const Harness = (props: HarnessProps) => {
  useAutoScrollToSelectedNode(props);
  return null;
};

describe('useAutoScrollToSelectedNode', () => {
  const advanceTimersBy = (ms: number) => {
    act(() => {
      vi.advanceTimersByTime(ms);
    });
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      return window.setTimeout(() => callback(performance.now()), 0);
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
      window.clearTimeout(id);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('does not bypass layout auto-pan suppression on selection changes', () => {
    const ensureSelectedNodeVisible = vi.fn();

    const { rerender } = render(
      <Harness
        selectedNodeId={null}
        ensureSelectedNodeVisible={ensureSelectedNodeVisible}
      />
    );

    rerender(
      <Harness
        selectedNodeId="node-1"
        ensureSelectedNodeVisible={ensureSelectedNodeVisible}
      />
    );

    advanceTimersBy(0);
    advanceTimersBy(LAYOUT_AUTO_PAN_RETRY_MS);

    expect(ensureSelectedNodeVisible).toHaveBeenCalledTimes(2);
    expect(ensureSelectedNodeVisible).toHaveBeenNthCalledWith(1);
    expect(ensureSelectedNodeVisible).toHaveBeenNthCalledWith(2);
    expect(ensureSelectedNodeVisible).not.toHaveBeenCalledWith({ force: true });
  });

  it('rechecks visibility after layout auto-pan suppression ends', () => {
    const ensureSelectedNodeVisible = vi.fn<(options?: { force?: boolean }) => EnsureSelectedNodeVisibleResult>()
      .mockReturnValueOnce('suppressed');

    render(
      <Harness
        selectedNodeId="node-1"
        ensureSelectedNodeVisible={ensureSelectedNodeVisible}
      />
    );

    advanceTimersBy(0);
    advanceTimersBy(LAYOUT_AUTO_PAN_RETRY_MS - 1);

    expect(ensureSelectedNodeVisible).toHaveBeenCalledTimes(1);

    advanceTimersBy(1);

    expect(ensureSelectedNodeVisible).toHaveBeenCalledTimes(2);
    expect(ensureSelectedNodeVisible).toHaveBeenNthCalledWith(1);
    expect(ensureSelectedNodeVisible).toHaveBeenNthCalledWith(2);
    expect(ensureSelectedNodeVisible).not.toHaveBeenCalledWith({ force: true });
  });

  it('rechecks visibility even when the first pass runs before final layout settles', () => {
    const ensureSelectedNodeVisible = vi.fn();

    render(
      <Harness
        selectedNodeId="node-1"
        ensureSelectedNodeVisible={ensureSelectedNodeVisible}
      />
    );

    advanceTimersBy(0);

    expect(ensureSelectedNodeVisible).toHaveBeenCalledTimes(1);

    advanceTimersBy(LAYOUT_AUTO_PAN_RETRY_MS);

    expect(ensureSelectedNodeVisible).toHaveBeenCalledTimes(2);
    expect(ensureSelectedNodeVisible).not.toHaveBeenCalledWith({ force: true });
  });

  it('retries again when the delayed visibility check is still suppressed', () => {
    const ensureSelectedNodeVisible = vi.fn<(options?: { force?: boolean }) => EnsureSelectedNodeVisibleResult>()
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce('suppressed');

    render(
      <Harness
        selectedNodeId="node-1"
        ensureSelectedNodeVisible={ensureSelectedNodeVisible}
      />
    );

    advanceTimersBy(0);
    advanceTimersBy(LAYOUT_AUTO_PAN_RETRY_MS);

    expect(ensureSelectedNodeVisible).toHaveBeenCalledTimes(2);

    advanceTimersBy(LAYOUT_AUTO_PAN_RETRY_MS);

    expect(ensureSelectedNodeVisible).toHaveBeenCalledTimes(3);
    expect(ensureSelectedNodeVisible).not.toHaveBeenCalledWith({ force: true });
  });
});

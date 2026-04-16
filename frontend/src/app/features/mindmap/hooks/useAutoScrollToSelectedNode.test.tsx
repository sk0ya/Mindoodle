import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAutoScrollToSelectedNode } from './useAutoScrollToSelectedNode';
import type { EnsureSelectedNodeVisibleResult } from './viewportAutoPanTiming';

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
  const flushAnimationFrame = () => {
    act(() => {
      vi.advanceTimersByTime(0);
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

    flushAnimationFrame();

    expect(ensureSelectedNodeVisible).toHaveBeenCalledTimes(1);
    expect(ensureSelectedNodeVisible).toHaveBeenNthCalledWith(1);
    expect(ensureSelectedNodeVisible).not.toHaveBeenCalledWith({ force: true });
  });
});
